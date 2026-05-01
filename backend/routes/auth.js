const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');
const { getOTPVerificationEmailTemplate } = require('../utils/emailTemplate');

const router = express.Router();

const getSignedJwtToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d'
  });
};

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otpCode = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'student',
      isApproved: role === 'faculty' ? false : true, // Admin approves faculty
      otpCode,
      otpExpiry,
    });

    // Send OTP email
    try {
      await sendEmail({
        email: user.email,
        subject: 'LMS - Email Verification OTP',
        html: getOTPVerificationEmailTemplate(otpCode, user.name),
      });
    } catch (error) {
      console.error('Email send error:', error);
      // We can continue, maybe email fails but user is registered. They can resend OTP.
    }

    const token = getSignedJwtToken(user._id);

    res.status(201).json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide an email and password' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.role === 'faculty' && !user.isApproved) {
      return res.status(403).json({ success: false, message: 'Your faculty account is pending admin approval' });
    }

    const token = getSignedJwtToken(user._id);

    res.status(200).json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Verify Email
// @route   POST /api/auth/verify-email
// @access  Private (or Public if using email in body)
router.post('/verify-email', protect, async (req, res) => {
  try {
    const { otpCode } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    if (user.otpCode !== otpCode) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Private
router.post('/resend-otp', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    // Cooldown check
    if (user.otpExpiry && new Date() < new Date(user.otpExpiry.getTime() - 4.5 * 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Please wait before requesting a new OTP' });
    }

    const otpCode = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.otpCode = otpCode;
    user.otpExpiry = otpExpiry;
    await user.save();

    try {
      await sendEmail({
        email: user.email,
        subject: 'LMS - Your New OTP',
        html: getOTPVerificationEmailTemplate(otpCode, user.name),
      });
    } catch (error) {
      console.error('Email send error:', error);
    }

    res.status(200).json({ success: true, message: 'OTP resent successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('enrolledCourses', 'title');
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
