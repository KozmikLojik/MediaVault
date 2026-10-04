const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../config/db");
const { saveProgress, updateProgress, deleteProgress, validMedia } = require("../controllers/progressController");

const userId = "64b00000-0000-4000-8000-000000000001";
const recordId = "64b00000-0000-4000-8000-000000000002";

function responseHarness() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function requestHarness(body, params = {}) {
  const events = [];
  return {
    req: {
      body, params, user: { _id: userId },
      app: { get: () => ({ to: (room) => ({ emit: (event) => events.push({ room, event }) }) }) }
    },
    events
  };
}

const makeProgressRow = (overrides = {}) => ({
  id: recordId, user_id: userId, anime_title: "Arcane", episode: "S1E1", current_seconds: 0,
  duration: 0, url: "", type: "Anime", genres: [], status: "Watching", favorite: false,
  updated_at: new Date(), ...overrides
});

test("saveProgress upserts progress for the authenticated user and writes an initial event", async () => {
  const originalQuery = pool.query;
  const calls = [];
  try {
    pool.query = async (sql, values) => {
      calls.push({ sql, values });
      if (sql.startsWith("SELECT * FROM watch_progress")) return { rows: [] };
      if (sql.startsWith("INSERT INTO watch_progress")) return { rows: [makeProgressRow()] };
      return { rows: [] };
    };
    const { req, events } = requestHarness({ animeTitle: "Arcane", episode: "S1E1", type: "TV" });
    const res = responseHarness();
    await saveProgress(req, res);

    assert.match(calls[1].sql, /ON CONFLICT \(user_id, anime_title\) DO UPDATE/);
    assert.equal(calls[0].values[0], userId);
    assert.equal(calls[1].values[1], userId);
    assert.match(calls[2].sql, /INSERT INTO watch_events/);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.progress.animeTitle, "Arcane");
    assert.equal(events[0].room, `user:${userId}`);
  } finally {
    pool.query = originalQuery;
  }
});

test("updateProgress scopes updates by both record and account", async () => {
  const originalQuery = pool.query;
  const calls = [];
  try {
    pool.query = async (sql, values) => {
      calls.push({ sql, values });
      if (sql.startsWith("SELECT * FROM watch_progress")) return { rows: [makeProgressRow()] };
      if (sql.startsWith("UPDATE watch_progress")) return { rows: [makeProgressRow({ episode: "S1E2" })] };
      return { rows: [] };
    };
    const { req } = requestHarness({ animeTitle: "Arcane", episode: "S1E2" }, { id: recordId });
    const res = responseHarness();
    await updateProgress(req, res);

    assert.match(calls[1].sql, /WHERE id = \$7 AND user_id = \$8 RETURNING/);
    assert.equal(calls[1].values.at(-2), recordId);
    assert.equal(calls[1].values.at(-1), userId);
    assert.equal(res.statusCode, 200);
  } finally {
    pool.query = originalQuery;
  }
});

test("deleteProgress scopes removals by both record and account", async () => {
  const originalQuery = pool.query;
  let query;
  try {
    pool.query = async (sql, values) => { query = { sql, values }; return { rows: [{ id: recordId }] }; };
    const { req, events } = requestHarness({}, { id: recordId });
    const res = responseHarness();
    await deleteProgress(req, res);

    assert.match(query.sql, /DELETE FROM watch_progress WHERE id = \$1 AND user_id = \$2/);
    assert.deepEqual(query.values, [recordId, userId]);
    assert.equal(res.statusCode, 200);
    assert.equal(events.length, 1);
  } finally {
    pool.query = originalQuery;
  }
});

test("validMedia trims fields, applies safe defaults, and rejects unsafe links", () => {
  assert.deepEqual(validMedia({ animeTitle: "  Arcane ", episode: " Movie " }), {
    animeTitle: "Arcane", episode: "Movie", currentTime: 0, duration: 0, type: "Anime", url: ""
  });
  assert.equal(validMedia({ animeTitle: "One Piece" }), null);
  assert.equal(validMedia({ animeTitle: "X".repeat(251), episode: "Episode 1" }), null);
  assert.equal(validMedia({ animeTitle: "One Piece", episode: "Episode 1", currentTime: -1 }), null);
  assert.equal(validMedia({ animeTitle: "One Piece", episode: "Episode 1", url: "javascript:alert(1)" }), null);
});
