const WatchProgress = require("../models/WatchProgress");

const saveProgress = async (req, res) => {

  const incoming = req.body;

  if (
    !incoming.animeTitle ||
    !incoming.episode
  ) {
    return res.status(400).json({
      message: "Invalid Data"
    });
  }

  const progress =
    await WatchProgress.findOneAndUpdate(
      {
        user: req.user._id,
        animeTitle: incoming.animeTitle
      },
      {
        user: req.user._id,
        animeTitle: incoming.animeTitle,
        episode: incoming.episode,
        currentTime: incoming.currentTime || 0,
        duration: incoming.duration || 0,
        url: incoming.url || "",
        type: incoming.type || "Anime",
        updatedAt:
          incoming.updatedAt ||
          new Date().toISOString()
      },
      {
        new: true,
        upsert: true
      }
    );

  const io = req.app.get("io");

  if (io) {
    io.emit("history-updated");
  }

  res.json({
    message: "Saved Successfully",
    progress
  });

};

const getProgress = async (req, res) => {

  const history =
    await WatchProgress.find({
      user: req.user._id
    }).sort({
      updatedAt: -1
    });

  res.json(history);

};

module.exports = {
  saveProgress,
  getProgress
};
