const express = require('express');
const router = express.Router();
const Progress = require('../models/Progress');
const { protect } = require('../middleware/auth');

// @desc    Mark lecture as completed
// @route   POST /api/progress/lecture/:lectureId
// @access  Private (Student)
router.post('/lecture/:lectureId', protect, async (req, res) => {
  try {
    const lectureId = req.params.lectureId;
    const userId = req.user.id;

    let progress = await Progress.findOne({ user: userId, lecture: lectureId });

    if (!progress) {
      progress = await Progress.create({
        user: userId,
        lecture: lectureId,
        completed: true
      });
    } else {
      progress.completed = true;
      await progress.save();
    }

    res.status(200).json({ success: true, data: progress });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Get student's progress for a course
// @route   GET /api/progress/course/:courseId
// @access  Private (Student)
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const userId = req.user.id;

    // This is a simple version, just returning all progress records for the user
    // We can filter by lectures that belong to the course if needed
    const progress = await Progress.find({ user: userId });
    res.status(200).json({ success: true, data: progress });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
