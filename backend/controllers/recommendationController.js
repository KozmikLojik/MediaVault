const { randomUUID } = require("node:crypto");
const { pool } = require("../config/db");
const catalog = require("../data/recommendationCatalog");

const getRecommendations = async (req, res) => {
  const [libraryResult, feedbackResult] = await Promise.all([
    pool.query("SELECT anime_title, type, genres, rating, favorite, status FROM watch_progress WHERE user_id = $1", [req.user._id]),
    pool.query("SELECT provider_id FROM recommendation_feedback WHERE user_id = $1", [req.user._id])
  ]);
  const library = libraryResult.rows;
  const seenTitles = new Set(library.map((item) => item.anime_title.trim().toLowerCase()));
  const dismissed = new Set(feedbackResult.rows.map((item) => item.provider_id));
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
  return res.json({ recommendations, method: "genre, format, favorite and rating matches" });
};

const dismissRecommendation = async (req, res) => {
  const { providerId } = req.body || {};
  if (typeof providerId !== "string" || !catalog.some((item) => item.id === providerId)) return res.status(400).json({ message: "Unknown recommendation." });
  await pool.query(
    `INSERT INTO recommendation_feedback (id, user_id, provider_id) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, provider_id) DO UPDATE SET action = 'dismiss'`,
    [randomUUID(), req.user._id, providerId]
  );
  return res.json({ message: "Recommendation hidden." });
};

module.exports = { getRecommendations, dismissRecommendation };
