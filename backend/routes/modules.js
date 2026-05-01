const express = require('express');
const multer = require('multer');
const path = require('path');
const Module = require('../models/Module');
const Course = require('../models/Course');
const Lecture = require('../models/Lecture');
const LiveSession = require('../models/LiveSession');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(null, `${Date.now()}-${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// @desc    Add module to course
// @route   POST /api/modules/:courseId
// @access  Private (Faculty/Admin)
router.post('/:courseId', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const newModule = await Module.create({
      title: req.body.title,
      course: req.params.courseId
    });

    course.modules.push(newModule._id);
    await course.save();

    res.status(201).json({ success: true, data: newModule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Upload lecture to module
// @route   POST /api/modules/:moduleId/lectures
// @access  Private (Faculty/Admin)
router.post('/:moduleId/lectures', protect, authorize('faculty', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const mod = await Module.findById(req.params.moduleId).populate('course');
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });

    if (mod.course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const lecture = await Lecture.create({
      title: req.body.title,
      fileUrl: `/${req.file.path.replace('\\', '/')}`,
      fileType: req.file.mimetype,
      module: req.params.moduleId
    });

    mod.lectures.push(lecture._id);
    await mod.save();

    res.status(201).json({ success: true, data: lecture });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Create/Start Live Session
// @route   POST /api/modules/:moduleId/live
// @access  Private (Faculty/Admin)
router.post('/:moduleId/live', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const mod = await Module.findById(req.params.moduleId).populate('course');
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });

    if (mod.course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const roomId = `room-${Date.now()}`;
    const liveSession = await LiveSession.create({
      topic: req.body.topic,
      roomId,
      isActive: true,
      module: req.params.moduleId
    });

    mod.liveSessions.push(liveSession._id);
    await mod.save();

    res.status(201).json({ success: true, data: liveSession });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    End Live Session
// @route   PUT /api/modules/live/:sessionId/end
// @access  Private (Faculty/Admin)
router.put('/live/:sessionId/end', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const session = await LiveSession.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const mod = await Module.findById(session.module).populate('course');
    if (mod.course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    session.isActive = false;
    await session.save();

    res.status(200).json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Delete module
// @route   DELETE /api/modules/:moduleId
// @access  Private (Faculty/Admin)
router.delete('/:moduleId', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const mod = await Module.findById(req.params.moduleId).populate('course');
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });

    if (mod.course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Remove from Course
    const course = await Course.findById(mod.course._id);
    course.modules = course.modules.filter(id => id.toString() !== mod._id.toString());
    await course.save();

    await Module.findByIdAndDelete(req.params.moduleId);
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Delete lecture
// @route   DELETE /api/modules/lectures/:lectureId
// @access  Private (Faculty/Admin)
router.delete('/lectures/:lectureId', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.lectureId);
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

    const mod = await Module.findById(lecture.module).populate('course');
    if (mod.course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Remove from Module
    mod.lectures = mod.lectures.filter(id => id.toString() !== lecture._id.toString());
    await mod.save();

    await Lecture.findByIdAndDelete(req.params.lectureId);
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Delete live session
// @route   DELETE /api/modules/live/:sessionId
// @access  Private (Faculty/Admin)
router.delete('/live/:sessionId', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const session = await LiveSession.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const mod = await Module.findById(session.module).populate('course');
    if (mod.course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Remove from Module
    mod.liveSessions = mod.liveSessions.filter(id => id.toString() !== session._id.toString());
    await mod.save();

    await LiveSession.findByIdAndDelete(req.params.sessionId);
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
