const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const Course = require('../models/Course');
const Lecture = require('../models/Lecture');
const Progress = require('../models/Progress');
const Result = require('../models/Result');
const User = require('../models/User');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// @desc    Get Student Analytics (Global or Per Course)
// @route   GET /api/analytics/student/:userId
// @route   GET /api/analytics/student/:userId/:courseId
// @access  Private
const getStudentAnalytics = async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const user = await User.findById(userId).populate('enrolledCourses');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let filterCourseIds = [];
    if (courseId) {
      filterCourseIds = [new mongoose.Types.ObjectId(courseId)];
    } else {
      filterCourseIds = user.enrolledCourses.map(c => c._id);
    }
    
    // Fetch relevant courses with modules and lectures
    const courses = await Course.find({ _id: { $in: filterCourseIds } }).populate({
        path: 'modules',
        populate: [{ path: 'lectures' }, { path: 'tests' }]
    });

    let totalLectures = 0;
    const lectureIds = [];
    const testIds = [];

    courses.forEach(course => {
        course.modules.forEach(module => {
            totalLectures += module.lectures.length;
            module.lectures.forEach(l => lectureIds.push(l._id));
            module.tests.forEach(t => testIds.push(t._id));
        });
    });

    // 2. Completed lectures by student (filtered by lectureIds if courseId provided)
    const completedCount = await Progress.countDocuments({ 
        user: userId, 
        completed: true,
        lecture: { $in: lectureIds }
    });

    // 3. Test results (filtered by testIds)
    const results = await Result.find({ 
        student: userId,
        test: { $in: testIds }
    }).populate({
        path: 'test',
        populate: { path: 'module' }
    });

    // Calculations
    const progress = totalLectures > 0 ? (completedCount / totalLectures) * 100 : 0;
    const totalScore = results.reduce((acc, curr) => acc + curr.percentage, 0);
    const averageScore = results.length > 0 ? totalScore / results.length : 0;

    // Topic-wise performance
    const topicPerformance = {};
    results.forEach(res => {
        const topic = res.test.module.title;
        if (!topicPerformance[topic]) {
            topicPerformance[topic] = { total: 0, count: 0 };
        }
        topicPerformance[topic].total += res.percentage;
        topicPerformance[topic].count += 1;
    });

    const performanceData = Object.keys(topicPerformance).map(topic => ({
        topic,
        average: topicPerformance[topic].total / topicPerformance[topic].count
    }));

    const weakTopics = performanceData.filter(t => t.average < 50).map(t => t.topic);
    const strongTopics = performanceData.filter(t => t.average > 75).map(t => t.topic);

    res.status(200).json({
      success: true,
      data: {
        courseTitle: courseId && courses.length > 0 ? courses[0].title : 'Overall',
        progress: Math.round(progress),
        averageScore: Math.round(averageScore),
        weakTopics,
        strongTopics,
        testScores: results.map(r => ({ date: r.createdAt, score: r.percentage })),
        topicPerformance: performanceData
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

router.get('/student/:userId', protect, getStudentAnalytics);
router.get('/student/:userId/:courseId', protect, getStudentAnalytics);

// @desc    Get Faculty Analytics
// @route   GET /api/analytics/faculty/:courseId
// @access  Private/Faculty
router.get('/faculty/:courseId', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await Course.findById(courseId).populate('students');

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const totalStudents = course.students.length;

    // Active students (last active in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeStudents = course.students.filter(s => s.lastActive >= sevenDaysAgo).length;

    const engagementRate = totalStudents > 0 ? (activeStudents / totalStudents) * 100 : 0;

    // Average score of class (all results for tests in this course)
    // First get all tests in this course modules
    const populatedCourse = await Course.findById(courseId).populate({
        path: 'modules',
        populate: { path: 'tests' }
    });

    const testIds = [];
    populatedCourse.modules.forEach(m => {
        m.tests.forEach(t => testIds.push(t._id));
    });

    const allResults = await Result.find({ test: { $in: testIds } });
    const classAvg = allResults.length > 0 
        ? allResults.reduce((acc, curr) => acc + curr.percentage, 0) / allResults.length 
        : 0;

    // Difficult topics (low average score per module)
    const topicScores = {};
    for (const testId of testIds) {
        const testResults = allResults.filter(r => r.test.toString() === testId.toString());
        if (testResults.length > 0) {
            const test = await mongoose.model('Test').findById(testId).populate('module');
            const topic = test.module.title;
            if (!topicScores[topic]) topicScores[topic] = { total: 0, count: 0 };
            const avg = testResults.reduce((acc, r) => acc + r.percentage, 0) / testResults.length;
            topicScores[topic].total += avg;
            topicScores[topic].count += 1;
        }
    }

    const difficultTopics = Object.keys(topicScores)
        .map(topic => ({ topic, average: topicScores[topic].total / topicScores[topic].count }))
        .filter(t => t.average < 60);

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        activeStudents,
        engagementRate: Math.round(engagementRate),
        averageScore: Math.round(classAvg),
        difficultTopics,
        dropOffLectures: [] // Complex logic needed for real drop-off, placeholder for now
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @desc    Get AI Insights
// @route   POST /api/analytics/ai-insights
// @access  Private
router.post('/ai-insights', protect, async (req, res) => {
  const { type, data } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({ 
      success: true, 
      insights: "Please add GEMINI_API_KEY to generate AI insights." 
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let prompt = "";
    if (type === "student") {
      prompt = `As an AI Academic Advisor, analyze this student's data:
      - Progress: ${data.progress}%
      - Average Score: ${data.averageScore}%
      - Weak Topics: ${data.weakTopics.join(', ') || 'None'}
      - Strong Topics: ${data.strongTopics.join(', ') || 'None'}
      
      Provide a concise 3-bullet point summary of their performance and 2 specific improvement tips. Keep it under 100 words.`;
    } else {
      prompt = `As an AI Educational Consultant, analyze this course's faculty data:
      - Engagement Rate: ${data.engagementRate}%
      - Class Average Score: ${data.averageScore}%
      - Difficult Topics: ${data.difficultTopics.map(t => t.topic).join(', ') || 'None'}
      
      Provide a concise analysis of class health and 2 suggestions for the instructor to improve engagement and scores. Keep it under 150 words.`;
    }

    const result = await model.generateContent(prompt);
    const insights = result.response.text();

    res.status(200).json({ success: true, insights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'AI Generation Failed' });
  }
});

module.exports = router;
