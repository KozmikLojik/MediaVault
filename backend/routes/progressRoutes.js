const router = require("express").Router();
const {
  saveProgress,
  importProgress,
  getProgress,
  updateProgress,
  deleteProgress,
  getWatchEvents
} = require("../controllers/progressController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.post("/save", saveProgress);
router.post("/import", importProgress);
router.get("/", getProgress);
router.get("/:id/events", getWatchEvents);
router.patch("/:id", updateProgress);
router.delete("/:id", deleteProgress);

module.exports = router;
