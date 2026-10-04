const mongoose = require("mongoose");

const WatchProgressSchema =
  new mongoose.Schema({

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    animeTitle: {
      type: String,
      required: true
    },

    episode: {
      type: String,
      required: true
    },

    currentTime: {
      type: Number,
      default: 0
    },

    duration: {
      type: Number,
      default: 0
    },

    url: {
      type: String,
      default: ""
    },

    type: {
      type: String,
      default: "Anime",
      maxlength: 40
    },

    provider: { type: String, default: "legacy", maxlength: 24 },
    providerId: { type: String, default: "", maxlength: 160 },
    genres: { type: [String], default: [] },
    releaseYear: { type: Number, min: 1888, max: 2200, default: null },
    format: { type: String, default: "", maxlength: 60 },
    synopsis: { type: String, default: "", maxlength: 1600 },
    status: {
      type: String,
      enum: ["Plan to watch", "Watching", "Completed", "Paused", "Dropped"],
      default: "Watching"
    },
    rating: { type: Number, min: 0, max: 10, default: null },
    favorite: { type: Boolean, default: false },
    notes: { type: String, default: "", maxlength: 1000 },
    lastHistoryCheckpointTime: { type: Number, default: 0 },
    lastHistoryEpisode: { type: String, default: "" },
    historySeeded: { type: Boolean, default: true },

    updatedAt: {
      type: String
    }

  });

WatchProgressSchema.index(
  { user: 1, animeTitle: 1 },
  { unique: true }
);

WatchProgressSchema.index({ user: 1, provider: 1, providerId: 1 });

module.exports =
  mongoose.model(
    "WatchProgress",
    WatchProgressSchema
  );
