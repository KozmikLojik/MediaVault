const mongoose = require("mongoose");
const RecommendationFeedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  providerId: { type: String, required: true, maxlength: 160 },
  action: { type: String, enum: ["dismiss"], default: "dismiss" }
}, { timestamps: true });
RecommendationFeedbackSchema.index({ user: 1, providerId: 1 }, { unique: true });
module.exports = mongoose.model("RecommendationFeedback", RecommendationFeedbackSchema);
