const express = require('express');
const Course = require('../models/Course');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public (or Private depending on needs, assuming logged in user can see courses)
router.get('/', protect, async (req, res) => {
  try {
    let query;
    // Faculty should only see their own courses
    if (req.user.role === 'faculty') {
      query = Course.find({ faculty: req.user.id });
    } else {
      // Students and Admin can see all courses
      query = Course.find();
    }

    const courses = await query.populate('faculty', 'name');
    res.status(200).json({ success: true, data: courses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Get single course (only if enrolled or faculty/admin)
// @route   GET /api/courses/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('faculty', 'name')
      .populate({
        path: 'modules',
        populate: [
          { path: 'lectures' },
          { path: 'liveSessions' },
          { path: 'tests' }
        ]
      });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check access
    if (req.user.role === 'faculty' && course.faculty._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this course' });
    }

    if (req.user.role === 'student' && !course.students.includes(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
    }

    res.status(200).json({ success: true, data: course });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Create new course
// @route   POST /api/courses
// @access  Private (Faculty/Admin)
router.post('/', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    req.body.faculty = req.user.id;
    const course = await Course.create(req.body);
    res.status(201).json({ success: true, data: course });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private (Faculty/Admin)
router.put('/:id', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    let course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Make sure user is course owner
    if (course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this course' });
    }

    course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, data: course });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private (Faculty/Admin)
router.delete('/:id', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (course.faculty.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this course' });
    }

    await Course.findByIdAndDelete(req.params.id); // might need pre-remove hook in model to cascade delete modules
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Enroll in course
// @route   POST /api/courses/:id/enroll
// @access  Private (Student)
router.post('/:id/enroll', protect, authorize('student'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (course.students.includes(req.user.id)) {
      return res.status(400).json({ success: false, message: 'Already enrolled' });
    }

    course.students.push(req.user.id);
    await course.save();

    const user = await User.findById(req.user.id);
    user.enrolledCourses.push(course._id);
    await user.save();

    res.status(200).json({ success: true, message: 'Successfully enrolled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
