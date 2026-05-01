const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  percentage: { type: Number, required: true },
  answers: [{ type: Number }], // -1 if not attempted, or the index of the selected option
  attemptNumber: { type: Number, default: 1 },
  malpracticeLogs: [{
    type: { type: String }, // 'tab_switch', 'fullscreen_exit', 'window_blur'
    timestamp: { type: Date, default: Date.now }
  }],
  violationCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Result', resultSchema);
