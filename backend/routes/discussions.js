const express = require('express');
const Discussion = require('../models/Discussion');
const Course = require('../models/Course');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all discussions for a course
// @route   GET /api/discussions/:courseId
// @access  Private
router.get('/:courseId', protect, async (req, res) => {
  try {
    const discussions = await Discussion.find({ course: req.params.courseId })
      .populate('author', 'name role')
      .populate('replies.author', 'name role')
      .sort('-createdAt');
    res.status(200).json({ success: true, data: discussions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Create a new discussion thread
// @route   POST /api/discussions/:courseId
// @access  Private
router.post('/:courseId', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const discussion = await Discussion.create({
      course: req.params.courseId,
      author: req.user.id,
      text: req.body.text
    });

    const populatedDiscussion = await Discussion.findById(discussion._id).populate('author', 'name role');

    res.status(201).json({ success: true, data: populatedDiscussion });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Reply to a discussion
// @route   POST /api/discussions/:threadId/reply
// @access  Private
router.post('/:threadId/reply', protect, async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.threadId);
    if (!discussion) return res.status(404).json({ success: false, message: 'Discussion not found' });

    discussion.replies.push({
      author: req.user.id,
      text: req.body.text
    });

    await discussion.save();
    
    // Return the specific newly added reply to easily update frontend without re-fetching all
    const updatedDiscussion = await Discussion.findById(discussion._id).populate('replies.author', 'name role');
    const newReply = updatedDiscussion.replies[updatedDiscussion.replies.length - 1];

    res.status(201).json({ success: true, data: newReply });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Toggle like on a thread or reply
// @route   PUT /api/discussions/:threadId/like
// @access  Private
router.put('/:threadId/like', protect, async (req, res) => {
  try {
    const { replyId } = req.body; // if replyId is provided, like the reply, else like the thread
    const discussion = await Discussion.findById(req.params.threadId);
    
    if (!discussion) return res.status(404).json({ success: false, message: 'Discussion not found' });

    if (replyId) {
      const reply = discussion.replies.id(replyId);
      if (!reply) return res.status(404).json({ success: false, message: 'Reply not found' });
      
      const idx = reply.likes.indexOf(req.user.id);
      if (idx !== -1) reply.likes.splice(idx, 1);
      else reply.likes.push(req.user.id);
    } else {
      const idx = discussion.likes.indexOf(req.user.id);
      if (idx !== -1) discussion.likes.splice(idx, 1);
      else discussion.likes.push(req.user.id);
    }

    await discussion.save();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
