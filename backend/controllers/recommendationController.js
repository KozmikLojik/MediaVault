const WatchProgress = require("../models/WatchProgress");
const RecommendationFeedback = require("../models/RecommendationFeedback");
const catalog = require("../data/recommendationCatalog");

const getRecommendations = async (req, res) => {
  const [library, feedback] = await Promise.all([
    WatchProgress.find({ user: req.user._id }).select("animeTitle type genres rating favorite status").lean(),
    RecommendationFeedback.find({ user: req.user._id }).select("providerId").lean()
  ]);
  const seenTitles = new Set(library.map((item) => item.animeTitle.trim().toLowerCase()));
  const dismissed = new Set(feedback.map((item) => item.providerId));
  const genreScores = new Map();
  for (const item of library) {
    const weight = (item.favorite ? 2 : 1) + (Number(item.rating) >= 8 ? 1 : 0);
    for (const genre of item.genres || []) genreScores.set(genre.toLowerCase(), (genreScores.get(genre.toLowerCase()) || 0) + weight);
  }
  const preferences = new Set(library.map((item) => item.type).filter(Boolean));
  const recommendations = catalog.filter((item) => !seenTitles.has(item.title.toLowerCase()) && !dismissed.has(item.id)).map((item) => {
    const matchedGenres = item.genres.filter((genre) => genreScores.has(genre.toLowerCase()));
    const typeMatch = preferences.has(item.type) ? 1 : 0;
    const score = matchedGenres.reduce((sum, genre) => sum + genreScores.get(genre.toLowerCase()), 0) + typeMatch + item.rating / 10;
    const reason = matchedGenres.length ? `Because you enjoy ${matchedGenres.slice(0, 2).join(" and ")}` : typeMatch ? `A highly rated ${item.type.toLowerCase()} pick` : `A highly rated pick (${item.rating}/10)`;
    return { ...item, score: Number(score.toFixed(1)), reason };
  }).sort((a, b) => b.score - a.score).slice(0, 8);
  res.json({ recommendations, method: "genre, format, favorite and rating matches" });
};

const dismissRecommendation = async (req, res) => {
  const { providerId } = req.body || {};
  if (typeof providerId !== "string" || !catalog.some((item) => item.id === providerId)) return res.status(400).json({ message: "Unknown recommendation." });
  await RecommendationFeedback.findOneAndUpdate({ user: req.user._id, providerId }, { action: "dismiss" }, { upsert: true, new: true, runValidators: true });
  res.json({ message: "Recommendation hidden." });
};

module.exports = { getRecommendations, dismissRecommendation };
