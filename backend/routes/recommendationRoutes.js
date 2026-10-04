const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const { getRecommendations, recommendWithAi, dismissRecommendation } = require("../controllers/recommendationController");
router.use(protect);
router.get("/", getRecommendations);
router.post("/ai", recommendWithAi);
router.post("/dismiss", dismissRecommendation);
module.exports = router;
