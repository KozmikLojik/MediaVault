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
      default: "Anime"
    },

    updatedAt: {
      type: String
    }

  });

WatchProgressSchema.index(
  { user: 1, animeTitle: 1 },
  { unique: true }
);

module.exports =
  mongoose.model(
    "WatchProgress",
    WatchProgressSchema
  );
