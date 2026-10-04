const mongoose = require("mongoose");
const WatchProgress = require("../models/WatchProgress");
const WatchEvent = require("../models/WatchEvent");

const validStatuses = ["Plan to watch", "Watching", "Completed", "Paused", "Dropped"];
const validMetadata = (body) => {
  const result = {};
  if (typeof body.provider === "string") result.provider = body.provider.trim().slice(0, 24);
  if (typeof body.providerId === "string") result.providerId = body.providerId.trim().slice(0, 160);
  if (Array.isArray(body.genres)) result.genres = body.genres.filter((g) => typeof g === "string").map((g) => g.trim().slice(0, 40)).filter(Boolean).slice(0, 20);
  if (body.releaseYear === null || body.releaseYear === "") result.releaseYear = null;
  else if (body.releaseYear !== undefined && Number.isInteger(Number(body.releaseYear)) && Number(body.releaseYear) >= 1888 && Number(body.releaseYear) <= 2200) result.releaseYear = Number(body.releaseYear);
  for (const field of ["format", "synopsis", "notes"]) if (typeof body[field] === "string") result[field] = body[field].trim().slice(0, field === "synopsis" ? 1600 : field === "notes" ? 1000 : 60);
  if (validStatuses.includes(body.status)) result.status = body.status;
  if (body.rating === null || body.rating === "") result.rating = null;
  else if (body.rating !== undefined && Number.isFinite(Number(body.rating)) && Number(body.rating) >= 0 && Number(body.rating) <= 10) result.rating = Number(body.rating);
  if (typeof body.favorite === "boolean") result.favorite = body.favorite;
  return result;
};

const logWatchEvent = async (progress, eventType) => {
  if (!progress) return;
  await WatchEvent.create({ user: progress.user, progress: progress._id, title: progress.animeTitle, episode: progress.episode, currentTime: progress.currentTime, duration: progress.duration, eventType });
};

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

  const metadata = validMetadata(req.body);
  const existing = await WatchProgress.findOne({ user: req.user._id, animeTitle: media.animeTitle });
  const changedEpisode = existing && existing.episode !== media.episode;
  const checkpointDue = !existing || !existing.lastHistoryCheckpointTime || Date.now() - existing.lastHistoryCheckpointTime >= 5 * 60 * 1000 || changedEpisode;
  const progress = await WatchProgress.findOneAndUpdate(
    { user: req.user._id, animeTitle: media.animeTitle },
    { $set: { ...media, ...metadata, updatedAt: new Date().toISOString(), ...(checkpointDue ? { lastHistoryCheckpointTime: Date.now(), lastHistoryEpisode: media.episode } : {}) }, $setOnInsert: { user: req.user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  if (checkpointDue && (!existing || changedEpisode || media.currentTime > (existing.currentTime || 0))) await logWatchEvent(progress, existing ? "progress" : "started");

  emitHistoryUpdated(req);
  return res.json({ message: "Saved successfully", progress });
};

const getProgress = async (req, res) => {
  const history = await WatchProgress.find({ user: req.user._id }).sort({ updatedAt: -1 });
  const legacyItems = await WatchProgress.collection.find({ user: req.user._id, historySeeded: { $exists: false } }).toArray();
  for (const item of legacyItems) {
    await WatchEvent.findOneAndUpdate(
      { progress: item._id, eventType: "snapshot" },
      { $setOnInsert: { user: item.user, progress: item._id, title: item.animeTitle, episode: item.episode, currentTime: item.currentTime, duration: item.duration, eventType: "snapshot" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await WatchProgress.updateOne({ _id: item._id, user: req.user._id }, { $set: { historySeeded: true } });
  }
  for (const item of history) {
    if (item.providerId) continue;
    const slug = item.animeTitle.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (slug) {
      item.provider = "mediavault";
      item.providerId = `title:${slug}`;
      await item.save({ validateBeforeSave: true });
    }
  }
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

  const metadata = validMetadata(req.body);
  const existing = await WatchProgress.findOne({ _id: req.params.id, user: req.user._id });
  if (!existing) return res.status(404).json({ message: "Media record not found." });
  const progress = await WatchProgress.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { $set: { ...media, ...metadata, updatedAt: new Date().toISOString() } },
    { new: true, runValidators: true }
  );

  if (!progress) return res.status(404).json({ message: "Media record not found." });
  if (progress.episode !== existing.episode || progress.currentTime > existing.currentTime) await logWatchEvent(progress, "progress");
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
  await WatchEvent.deleteMany({ progress: progress._id, user: req.user._id });
  emitHistoryUpdated(req);
  return res.json({ message: "Removed successfully" });
};

const getWatchEvents = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid media record." });
  const owned = await WatchProgress.exists({ _id: req.params.id, user: req.user._id });
  if (!owned) return res.status(404).json({ message: "Media record not found." });
  const events = await WatchEvent.find({ progress: req.params.id, user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
  return res.json(events);
};

module.exports = { saveProgress, getProgress, updateProgress, deleteProgress, getWatchEvents, validMedia, validMetadata };
