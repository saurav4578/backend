const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lectures: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' }],
  liveSessions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LiveSession' }],
  tests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }]
}, { timestamps: true });

module.exports = mongoose.model('Module', moduleSchema);
