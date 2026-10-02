const mongoose = require("mongoose");
const WatchProgress = require("../models/WatchProgress");

const validMedia = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const animeTitle = typeof body.animeTitle === "string" ? body.animeTitle.trim() : "";
  const episode = typeof body.episode === "string" ? body.episode.trim() : "";
  const currentTime = Number(body.currentTime ?? 0);
  const duration = Number(body.duration ?? 0);
  const type = typeof body.type === "string" ? body.type.trim() : "Anime";
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!animeTitle || animeTitle.length > 250) return null;
  if (!episode || episode.length > 160) return null;
  if (!Number.isFinite(currentTime) || currentTime < 0 || currentTime > 86400) return null;
  if (!Number.isFinite(duration) || duration < 0 || duration > 86400) return null;
  if (!type || type.length > 40) return null;
  if (url) {
    try {
      if (!["http:", "https:"].includes(new URL(url).protocol)) return null;
    } catch {
      return null;
    }
    if (url.length > 2048) return null;
  }

  return { animeTitle, episode, currentTime, duration, type, url };
};

const emitHistoryUpdated = (req) => {
  req.app.get("io")?.to(`user:${req.user._id}`).emit("history-updated");
};

const saveProgress = async (req, res) => {
  const media = validMedia(req.body);
  if (!media) {
    return res.status(400).json({
      message: "Enter a title and episode, and use valid progress values and an http(s) link."
    });
  }

  const progress = await WatchProgress.findOneAndUpdate(
    { user: req.user._id, animeTitle: media.animeTitle },
    { ...media, user: req.user._id, updatedAt: new Date().toISOString() },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  emitHistoryUpdated(req);
  return res.json({ message: "Saved successfully", progress });
};

const getProgress = async (req, res) => {
  const history = await WatchProgress.find({ user: req.user._id }).sort({ updatedAt: -1 });
  return res.json(history);
};

const updateProgress = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid media record." });
  }

  const media = validMedia(req.body);
  if (!media) {
    return res.status(400).json({ message: "Please provide valid media details." });
  }

  const progress = await WatchProgress.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { ...media, updatedAt: new Date().toISOString() },
    { new: true, runValidators: true }
  );

  if (!progress) return res.status(404).json({ message: "Media record not found." });
  emitHistoryUpdated(req);
  return res.json({ message: "Updated successfully", progress });
};

const deleteProgress = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid media record." });
  }

  const progress = await WatchProgress.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id
  });

  if (!progress) return res.status(404).json({ message: "Media record not found." });
  emitHistoryUpdated(req);
  return res.json({ message: "Removed successfully" });
};

module.exports = { saveProgress, getProgress, updateProgress, deleteProgress, validMedia };
