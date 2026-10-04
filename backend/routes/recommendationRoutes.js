const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const { getRecommendations, dismissRecommendation } = require("../controllers/recommendationController");
router.use(protect);
router.get("/", getRecommendations);
router.post("/dismiss", dismissRecommendation);
module.exports = router;
