const test = require("node:test");
const assert = require("node:assert/strict");
const WatchProgress = require("../models/WatchProgress");
const { saveProgress, updateProgress, deleteProgress, validMedia } = require("../controllers/progressController");

const userId = "64b000000000000000000001";
const recordId = "64b000000000000000000002";

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
      body,
      params,
      user: { _id: userId },
      app: { get: () => ({ to: (room) => ({ emit: (event) => events.push({ room, event }) }) }) }
    },
    events
  };
}

test("saveProgress upserts records into the authenticated user's library", async () => {
  const original = WatchProgress.findOneAndUpdate;
  let filter;
  try {
    WatchProgress.findOneAndUpdate = async (query) => { filter = query; return { _id: recordId }; };
    const { req, events } = requestHarness({ animeTitle: "Arcane", episode: "S1E1" });
    const res = responseHarness();
    await saveProgress(req, res);

    assert.deepEqual(filter, { user: userId, animeTitle: "Arcane" });
    assert.equal(res.statusCode, 200);
    assert.equal(events[0].room, `user:${userId}`);
  } finally {
    WatchProgress.findOneAndUpdate = original;
  }
});

test("updateProgress scopes edits by both record id and account", async () => {
  const original = WatchProgress.findOneAndUpdate;
  let filter;
  try {
    WatchProgress.findOneAndUpdate = async (query) => { filter = query; return { _id: recordId }; };
    const { req } = requestHarness({ animeTitle: "Arcane", episode: "S1E2" }, { id: recordId });
    const res = responseHarness();
    await updateProgress(req, res);

    assert.deepEqual(filter, { _id: recordId, user: userId });
    assert.equal(res.statusCode, 200);
  } finally {
    WatchProgress.findOneAndUpdate = original;
  }
});

test("deleteProgress scopes removals by both record id and account", async () => {
  const original = WatchProgress.findOneAndDelete;
  let filter;
  try {
    WatchProgress.findOneAndDelete = async (query) => { filter = query; return { _id: recordId }; };
    const { req, events } = requestHarness({}, { id: recordId });
    const res = responseHarness();
    await deleteProgress(req, res);

    assert.deepEqual(filter, { _id: recordId, user: userId });
    assert.equal(res.statusCode, 200);
    assert.equal(events.length, 1);
  } finally {
    WatchProgress.findOneAndDelete = original;
  }
});

test("validMedia trims fields and applies safe defaults", () => {
  assert.deepEqual(validMedia({ animeTitle: "  Arcane ", episode: " Movie " }), {
    animeTitle: "Arcane",
    episode: "Movie",
    currentTime: 0,
    duration: 0,
    type: "Anime",
    url: ""
  });
});

test("validMedia accepts supported media fields", () => {
  assert.deepEqual(validMedia({
    animeTitle: "Dune: Part Two",
    episode: "Movie",
    currentTime: 120,
    duration: 9000,
    type: "Movies",
    url: "https://example.com/watch"
  }), {
    animeTitle: "Dune: Part Two",
    episode: "Movie",
    currentTime: 120,
    duration: 9000,
    type: "Movies",
    url: "https://example.com/watch"
  });
});

test("validMedia rejects incomplete, oversized, and unsafe records", () => {
  assert.equal(validMedia(null), null);
  assert.equal(validMedia({ animeTitle: "One Piece" }), null);
  assert.equal(validMedia({ animeTitle: "X".repeat(251), episode: "Episode 1" }), null);
  assert.equal(validMedia({ animeTitle: "One Piece", episode: "Episode 1", currentTime: -1 }), null);
  assert.equal(validMedia({ animeTitle: "One Piece", episode: "Episode 1", url: "javascript:alert(1)" }), null);
});
