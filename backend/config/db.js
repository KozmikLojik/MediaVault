const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DATABASE_POOL_SIZE) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (error) => console.error("Unexpected PostgreSQL connection error:", error.message));

const initializeDatabase = async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Add a PostgreSQL connection URL to the backend environment.");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username VARCHAR(40) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS watch_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      anime_title VARCHAR(250) NOT NULL,
      episode VARCHAR(160) NOT NULL,
      current_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
      duration DOUBLE PRECISION NOT NULL DEFAULT 0,
      url TEXT NOT NULL DEFAULT '',
      type VARCHAR(40) NOT NULL DEFAULT 'Anime',
      provider VARCHAR(24) NOT NULL DEFAULT 'legacy',
      provider_id VARCHAR(160) NOT NULL DEFAULT '',
      genres JSONB NOT NULL DEFAULT '[]'::jsonb,
      release_year INTEGER,
      format VARCHAR(60) NOT NULL DEFAULT '',
      synopsis VARCHAR(1600) NOT NULL DEFAULT '',
      status VARCHAR(24) NOT NULL DEFAULT 'Watching' CHECK (status IN ('Plan to watch', 'Watching', 'Completed', 'Paused', 'Dropped')),
      rating DOUBLE PRECISION CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
      favorite BOOLEAN NOT NULL DEFAULT FALSE,
      notes VARCHAR(1000) NOT NULL DEFAULT '',
      last_history_checkpoint_time BIGINT NOT NULL DEFAULT 0,
      last_history_episode VARCHAR(160) NOT NULL DEFAULT '',
      history_seeded BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, anime_title)
    );
    CREATE INDEX IF NOT EXISTS watch_progress_user_updated_idx ON watch_progress(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS watch_progress_provider_idx ON watch_progress(user_id, provider, provider_id);

    CREATE TABLE IF NOT EXISTS watch_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      progress_id TEXT NOT NULL REFERENCES watch_progress(id) ON DELETE CASCADE,
      title VARCHAR(250) NOT NULL,
      episode VARCHAR(160) NOT NULL,
      current_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
      duration DOUBLE PRECISION NOT NULL DEFAULT 0,
      event_type VARCHAR(16) NOT NULL DEFAULT 'progress' CHECK (event_type IN ('started', 'progress', 'snapshot')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS watch_events_user_created_idx ON watch_events(user_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS watch_events_snapshot_idx ON watch_events(progress_id) WHERE event_type = 'snapshot';

    CREATE TABLE IF NOT EXISTS recommendation_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id VARCHAR(160) NOT NULL,
      action VARCHAR(16) NOT NULL DEFAULT 'dismiss' CHECK (action = 'dismiss'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, provider_id)
    );
  `);
  console.log("PostgreSQL connected; schema ready");
};

module.exports = { pool, initializeDatabase };
