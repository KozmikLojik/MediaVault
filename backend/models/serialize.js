const toUser = (row) => row && ({
  _id: row.id,
  username: row.username,
  email: row.email,
  createdAt: row.created_at
});

const toProgress = (row) => row && ({
  _id: row.id,
  user: row.user_id,
  animeTitle: row.anime_title,
  episode: row.episode,
  currentTime: Number(row.current_seconds || 0),
  duration: Number(row.duration || 0),
  url: row.url || "",
  type: row.type || "Anime",
  provider: row.provider || "legacy",
  providerId: row.provider_id || "",
  genres: row.genres || [],
  releaseYear: row.release_year == null ? null : Number(row.release_year),
  format: row.format || "",
  synopsis: row.synopsis || "",
  status: row.status || "Watching",
  rating: row.rating == null ? null : Number(row.rating),
  favorite: Boolean(row.favorite),
  notes: row.notes || "",
  lastHistoryCheckpointTime: Number(row.last_history_checkpoint_time || 0),
  lastHistoryEpisode: row.last_history_episode || "",
  historySeeded: Boolean(row.history_seeded),
  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
});

const toEvent = (row) => row && ({
  _id: row.id,
  user: row.user_id,
  progress: row.progress_id,
  title: row.title,
  episode: row.episode,
  currentTime: Number(row.current_seconds || 0),
  duration: Number(row.duration || 0),
  eventType: row.event_type,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
});

module.exports = { toUser, toProgress, toEvent };
