const express = require('express');
const Test = require('../models/Test');
const Module = require('../models/Module');
const Result = require('../models/Result');
const { protect, authorize } = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');
const { getTestResultEmailTemplate } = require('../utils/emailTemplate');

const router = express.Router();

// @desc    Create test in module
// @route   POST /api/tests/:moduleId
// @access  Private (Faculty/Admin)
router.post('/:moduleId', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const mod = await Module.findById(req.params.moduleId).populate('course');
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });

    if (mod.course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const test = await Test.create({
      title: req.body.title,
      duration: req.body.duration || 0,
      negativeMarking: req.body.negativeMarking || 0,
      shuffleQuestions: req.body.shuffleQuestions !== undefined ? req.body.shuffleQuestions : true,
      isAdaptive: req.body.isAdaptive || false,
      questions: req.body.questions,
      module: req.params.moduleId
    });

    mod.tests.push(test._id);
    await mod.save();

    res.status(201).json({ success: true, data: test });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Get test by ID
// @route   GET /api/tests/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    
    // For students, don't send correct answers initially
    let testData = test.toObject();
    if (req.user.role === 'student') {
        testData.questions = testData.questions.map(q => {
            const { correctAnswerIndex, ...rest } = q;
            return rest;
        });
    }

    res.status(200).json({ success: true, data: testData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Attempt/Submit test
// @route   POST /api/tests/:id/attempt
// @access  Private (Student)
router.post('/:id/attempt', protect, authorize('student'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    // Ensure teacher cannot attempt
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Only students can attempt tests' });
    }

    // Check for existing attempt
    const existingResult = await Result.findOne({ test: test._id, student: req.user.id });
    if (existingResult) {
        return res.status(400).json({ success: false, message: 'You have already attempted this test once.' });
    }

    const { answers, malpracticeLogs, violationCount } = req.body; 
    let score = 0;
    let totalMarks = 0;
    let correctAnswers = [];

    test.questions.forEach((q, index) => {
      totalMarks += q.marks || 1;
      correctAnswers.push(q.correctAnswerIndex);
      if (answers[index] === q.correctAnswerIndex) {
        score += q.marks || 1;
      } else if (answers[index] !== null && test.negativeMarking > 0) {
        score -= test.negativeMarking;
      }
    });

    const percentage = (score / totalMarks) * 100;

    const previousAttempts = await Result.countDocuments({ test: test._id, student: req.user.id });

    const result = await Result.create({
      student: req.user.id,
      test: test._id,
      score,
      total: totalMarks,
      percentage,
      answers,
      attemptNumber: previousAttempts + 1,
      malpracticeLogs: malpracticeLogs || [],
      violationCount: violationCount || 0
    });

    res.status(201).json({ success: true, data: { result, correctAnswers } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Get my results for a test
// @route   GET /api/tests/:id/result
// @access  Private (Student)
router.get('/:id/result', protect, authorize('student'), async (req, res) => {
  try {
    // Find the latest attempt or highest score. Let's return the highest score or latest.
    // For now, return all attempts, or just the latest one (sorting by createdAt desc).
    const results = await Result.find({ test: req.params.id, student: req.user.id }).sort('-createdAt');
    if (!results.length) return res.status(404).json({ success: false, message: 'Result not found' });

    res.status(200).json({ success: true, data: results[0], history: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Get all results for a test
// @route   GET /api/tests/:id/all-results
// @access  Private (Faculty/Admin)
router.get('/:id/all-results', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate({
      path: 'module',
      populate: { path: 'course' }
    });
    
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    if (test.module.course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const results = await Result.find({ test: req.params.id }).populate('student', 'name email').sort('-createdAt');
    res.status(200).json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Delete test
// @route   DELETE /api/tests/:testId
// @access  Private (Faculty/Admin)
router.delete('/:testId', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId).populate({
      path: 'module',
      populate: { path: 'course' }
    });
    
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    if (test.module.course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Remove from Module
    const mod = await Module.findById(test.module._id);
    mod.tests = mod.tests.filter(id => id.toString() !== test._id.toString());
    await mod.save();

    await Result.deleteMany({ test: test._id });
    await Test.findByIdAndDelete(req.params.testId);

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Publish results and send emails
// @route   PUT /api/tests/:id/publish
// @access  Private (Faculty/Admin)
router.put('/:id/publish', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate({
        path: 'module',
        populate: { path: 'course' }
    });
    
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    if (test.module.course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    test.resultsPublished = true;
    await test.save();

    // Generate Rankings & Send Emails
    const results = await Result.find({ test: test._id }).populate('student', 'name email').sort('-percentage');
    
    // Send email to each student
    const emailPromises = results.map((result, index) => {
        const rank = index + 1;
        const status = result.percentage >= 50 ? 'Pass' : 'Fail';
        
        const emailHTML = getTestResultEmailTemplate({
            studentName: result.student.name,
            testName: test.title,
            score: result.score,
            total: result.total,
            percentage: Math.round(result.percentage),
            rank: rank,
            totalAttempts: results.length,
            status: status
        });

        return sendEmail({
            email: result.student.email,
            subject: `Exam Result Published: ${test.title} (Your Rank: #${rank})`,
            message: emailHTML
        });
    });


    await Promise.all(emailPromises);

    res.status(200).json({ success: true, message: 'Results published and emails sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});


// @desc    Delete student result (Allows retake)
// @route   DELETE /api/tests/results/:resultId
// @access  Private (Faculty/Admin)
router.delete('/results/:resultId', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const result = await Result.findById(req.params.resultId);
    if (!result) return res.status(404).json({ success: false, message: 'Result not found' });

    // We can add more strict check here to ensure the faculty owns the course
    // But for now, authorize('faculty') is a good start.
    
    await Result.findByIdAndDelete(req.params.resultId);
    res.status(200).json({ success: true, message: 'Attempt record deleted. Student can now retake the test.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
