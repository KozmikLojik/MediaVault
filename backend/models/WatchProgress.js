const mongoose = require("mongoose");

const WatchProgressSchema =
  new mongoose.Schema({

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

    updatedAt: {
      type: String
    }

  });

module.exports =
  mongoose.model(
    "WatchProgress",
    WatchProgressSchema
  );