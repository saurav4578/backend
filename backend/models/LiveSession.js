const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  roomId: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: false },
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true }
}, { timestamps: true });

module.exports = mongoose.model('LiveSession', liveSessionSchema);
