const router = require("express").Router();
const {
  saveProgress,
  getProgress
} = require("../controllers/progressController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.post("/save", saveProgress);
router.get("/", getProgress);

module.exports = router;
