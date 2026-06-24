const router = require("express").Router();

const { JSONFilePreset } = require("lowdb/node");

router.post("/save", async (req, res) => {

  const db = await JSONFilePreset(
    "./data/db.json",
    { watchHistory: [] }
  );

  const incoming = req.body;

  if (
    !incoming.animeTitle ||
    !incoming.episode
  ) {
    return res.status(400).json({
      message: "Invalid Data"
    });
  }

  console.log("INCOMING:");
  console.log(incoming);

  const existingIndex =
    db.data.watchHistory.findIndex(
      item =>
        item.animeTitle === incoming.animeTitle
    );

  console.log("INDEX:", existingIndex);

  if (existingIndex !== -1) {

    db.data.watchHistory[existingIndex] = incoming;

  } else {

    db.data.watchHistory.push(incoming);

  }

  await db.write();

  res.json({
    message: "Saved Successfully"
  });

});

router.get("/", async (req, res) => {

  const db = await JSONFilePreset(
    "./data/db.json",
    { watchHistory: [] }
  );

  res.json(db.data.watchHistory);

});

module.exports = router;