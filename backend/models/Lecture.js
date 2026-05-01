const mongoose = require('mongoose');

const lectureSchema = new mongoose.Schema({
  title: { type: String, required: true },
  fileUrl: { type: String, required: true }, // Path or URL to the video/file
  fileType: { type: String }, // e.g., 'video/mp4', 'application/pdf'
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Lecture', lectureSchema);
