const mongoose = require("mongoose");

const WatchEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  progress: { type: mongoose.Schema.Types.ObjectId, ref: "WatchProgress", required: true, index: true },
  title: { type: String, required: true, maxlength: 250 },
  episode: { type: String, required: true, maxlength: 160 },
  currentTime: { type: Number, default: 0, min: 0 },
  duration: { type: Number, default: 0, min: 0 },
  eventType: { type: String, enum: ["started", "progress", "snapshot"], default: "progress" }
}, { timestamps: true });

WatchEventSchema.index({ user: 1, createdAt: -1 });
WatchEventSchema.index({ progress: 1, eventType: 1 }, { unique: true, partialFilterExpression: { eventType: "snapshot" } });
module.exports = mongoose.model("WatchEvent", WatchEventSchema);
