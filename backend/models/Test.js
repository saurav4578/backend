const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswerIndex: { type: Number, required: true },
  marks: { type: Number, default: 1 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  timeLimit: { type: Number, default: 0 } // seconds per question, 0 means use global timer
});

const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  duration: { type: Number, default: 0 }, // total duration in minutes
  negativeMarking: { type: Number, default: 0 }, // marks to deduct for wrong answer
  shuffleQuestions: { type: Boolean, default: true },
  isAdaptive: { type: Boolean, default: false },
  resultsPublished: { type: Boolean, default: false },
  questions: [questionSchema],
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Test', testSchema);
