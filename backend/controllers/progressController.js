const { randomUUID } = require("node:crypto");
const { pool } = require("../config/db");
const { toProgress, toEvent } = require("../models/serialize");

const validStatuses = ["Plan to watch", "Watching", "Completed", "Paused", "Dropped"];
const validMetadata = (body = {}) => {
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

const validMedia = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const animeTitle = typeof body.animeTitle === "string" ? body.animeTitle.trim() : "";
  const episode = typeof body.episode === "string" ? body.episode.trim() : "";
  const currentTime = Number(body.currentTime ?? 0);
  const duration = Number(body.duration ?? 0);
  const type = typeof body.type === "string" ? body.type.trim() : "Anime";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!animeTitle || animeTitle.length > 250 || !episode || episode.length > 160) return null;
  if (!Number.isFinite(currentTime) || currentTime < 0 || currentTime > 86400 || !Number.isFinite(duration) || duration < 0 || duration > 86400) return null;
  if (!type || type.length > 40) return null;
  if (url) {
    try { if (!["http:", "https:"].includes(new URL(url).protocol)) return null; } catch { return null; }
    if (url.length > 2048) return null;
  }
  return { animeTitle, episode, currentTime, duration, type, url };
};

const emitHistoryUpdated = (req) => req.app.get("io")?.to(`user:${req.user._id}`).emit("history-updated");
const fieldColumns = {
  animeTitle: "anime_title", episode: "episode", currentTime: "current_seconds", duration: "duration", url: "url", type: "type",
  provider: "provider", providerId: "provider_id", genres: "genres", releaseYear: "release_year", format: "format", synopsis: "synopsis",
  status: "status", rating: "rating", favorite: "favorite", notes: "notes"
};
const dbValue = (value) => Array.isArray(value) ? JSON.stringify(value) : value;

const logWatchEvent = async (progress, eventType) => {
  if (!progress) return;
  await pool.query(
    `INSERT INTO watch_events (id, user_id, progress_id, title, episode, current_seconds, duration, event_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [randomUUID(), progress.user_id, progress.id, progress.anime_title, progress.episode, progress.current_seconds, progress.duration, eventType]
  );
};

const saveProgress = async (req, res) => {
  const media = validMedia(req.body);
  if (!media) return res.status(400).json({ message: "Enter a title and episode, and use valid progress values and an http(s) link." });

  const metadata = validMetadata(req.body);
  const { rows: previousRows } = await pool.query("SELECT * FROM watch_progress WHERE user_id = $1 AND anime_title = $2 AND type = $3", [req.user._id, media.animeTitle, media.type]);
  const existing = previousRows[0];
  const changedEpisode = existing && existing.episode !== media.episode;
  const checkpointDue = !existing || !existing.last_history_checkpoint_time || Date.now() - Number(existing.last_history_checkpoint_time) >= 5 * 60 * 1000 || changedEpisode;
  const fields = { ...media, ...metadata };
  if (checkpointDue) {
    fields.lastHistoryCheckpointTime = Date.now();
    fields.lastHistoryEpisode = media.episode;
  }

  const entries = Object.entries(fields).map(([key, value]) => [
    fieldColumns[key] || (key === "lastHistoryCheckpointTime" ? "last_history_checkpoint_time" : "last_history_episode"), dbValue(value)
  ]);
  const columns = ["id", "user_id", ...entries.map(([column]) => column)];
  const values = [randomUUID(), req.user._id, ...entries.map(([, value]) => value)];
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const updates = entries.map(([column]) => `${column} = EXCLUDED.${column}`);
  updates.push("updated_at = NOW()");
  const sql = `INSERT INTO watch_progress (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT (user_id, anime_title, type) DO UPDATE SET ${updates.join(", ")} RETURNING *`;
  const { rows } = await pool.query(sql, values);
  const progress = rows[0];
  if (checkpointDue && (!existing || changedEpisode || media.currentTime > Number(existing.current_seconds || 0))) {
    await logWatchEvent(progress, existing ? "progress" : "started");
  }
  emitHistoryUpdated(req);
  return res.json({ message: "Saved successfully", progress: toProgress(progress) });
};

const importProgress = async (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    return res.status(400).json({ message: "Import between 1 and 100 titles at a time." });
  }
  const prepared = items.map((item) => {
    const media = validMedia(item);
    return media ? { media, metadata: validMetadata(item) } : null;
  });
  if (prepared.some((item) => !item)) return res.status(400).json({ message: "One or more imported titles have invalid details." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const { media, metadata } of prepared) {
      const fields = { ...media, ...metadata };
      await client.query(
        `INSERT INTO watch_progress
          (id, user_id, anime_title, episode, current_seconds, duration, url, type, provider, provider_id, genres, release_year, format, synopsis, status, rating, favorite, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (user_id, anime_title, type) DO UPDATE SET
          episode = EXCLUDED.episode,
          type = EXCLUDED.type,
          provider = EXCLUDED.provider,
          provider_id = CASE WHEN EXCLUDED.provider_id <> '' THEN EXCLUDED.provider_id ELSE watch_progress.provider_id END,
          genres = CASE WHEN EXCLUDED.genres <> '[]'::jsonb THEN EXCLUDED.genres ELSE watch_progress.genres END,
          release_year = COALESCE(EXCLUDED.release_year, watch_progress.release_year),
          format = COALESCE(NULLIF(EXCLUDED.format, ''), watch_progress.format),
          synopsis = COALESCE(NULLIF(EXCLUDED.synopsis, ''), watch_progress.synopsis),
          status = EXCLUDED.status,
          rating = COALESCE(EXCLUDED.rating, watch_progress.rating),
          updated_at = NOW()`,
        [
          randomUUID(), req.user._id, media.animeTitle, media.episode, media.currentTime, media.duration, media.url, media.type,
          fields.provider || "import", fields.providerId || "", JSON.stringify(fields.genres || []), fields.releaseYear ?? null,
          fields.format || "", fields.synopsis || "", fields.status || "Plan to watch", fields.rating ?? null,
          fields.favorite === true, fields.notes || ""
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  emitHistoryUpdated(req);
  return res.json({ message: "List imported successfully.", imported: prepared.length });
};

const getProgress = async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM watch_progress WHERE user_id = $1 ORDER BY updated_at DESC", [req.user._id]);
  for (const row of rows) {
    if (!row.history_seeded) {
      await pool.query(
        `INSERT INTO watch_events (id, user_id, progress_id, title, episode, current_seconds, duration, event_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'snapshot') ON CONFLICT (progress_id) WHERE event_type = 'snapshot' DO NOTHING`,
        [randomUUID(), row.user_id, row.id, row.anime_title, row.episode, row.current_seconds, row.duration]
      );
      await pool.query("UPDATE watch_progress SET history_seeded = TRUE WHERE id = $1", [row.id]);
      row.history_seeded = true;
    }
    if (!row.provider_id) {
      const slug = row.anime_title.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (slug) {
        row.provider = "mediavault";
        row.provider_id = `title:${slug}`;
        await pool.query("UPDATE watch_progress SET provider = $1, provider_id = $2 WHERE id = $3", [row.provider, row.provider_id, row.id]);
      }
    }
  }
  return res.json(rows.map(toProgress));
};

const isRecordId = (id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);

const updateProgress = async (req, res) => {
  if (!isRecordId(req.params.id)) return res.status(400).json({ message: "Invalid media record." });
  const media = validMedia(req.body);
  if (!media) return res.status(400).json({ message: "Please provide valid media details." });
  const { rows: previousRows } = await pool.query("SELECT * FROM watch_progress WHERE id = $1 AND user_id = $2", [req.params.id, req.user._id]);
  const existing = previousRows[0];
  if (!existing) return res.status(404).json({ message: "Media record not found." });

  const entries = Object.entries({ ...media, ...validMetadata(req.body) }).map(([key, value]) => [fieldColumns[key], dbValue(value)]);
  const values = entries.map(([, value]) => value);
  const sets = entries.map(([column], index) => `${column} = $${index + 1}`);
  sets.push("updated_at = NOW()");
  values.push(req.params.id, req.user._id);
  const { rows } = await pool.query(`UPDATE watch_progress SET ${sets.join(", ")} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`, values);
  const progress = rows[0];
  if (!progress) return res.status(404).json({ message: "Media record not found." });
  if (progress.episode !== existing.episode || Number(progress.current_seconds) > Number(existing.current_seconds)) await logWatchEvent(progress, "progress");
  emitHistoryUpdated(req);
  return res.json({ message: "Updated successfully", progress: toProgress(progress) });
};

const deleteProgress = async (req, res) => {
  if (!isRecordId(req.params.id)) return res.status(400).json({ message: "Invalid media record." });
  const { rows } = await pool.query("DELETE FROM watch_progress WHERE id = $1 AND user_id = $2 RETURNING id", [req.params.id, req.user._id]);
  if (!rows[0]) return res.status(404).json({ message: "Media record not found." });
  emitHistoryUpdated(req);
  return res.json({ message: "Removed successfully" });
};

const getWatchEvents = async (req, res) => {
  if (!isRecordId(req.params.id)) return res.status(400).json({ message: "Invalid media record." });
  const owned = await pool.query("SELECT id FROM watch_progress WHERE id = $1 AND user_id = $2", [req.params.id, req.user._id]);
  if (!owned.rows[0]) return res.status(404).json({ message: "Media record not found." });
  const { rows } = await pool.query("SELECT * FROM watch_events WHERE progress_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 100", [req.params.id, req.user._id]);
  return res.json(rows.map(toEvent));
};

module.exports = { saveProgress, importProgress, getProgress, updateProgress, deleteProgress, getWatchEvents, validMedia, validMetadata };
