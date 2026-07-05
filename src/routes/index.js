const { Router } = require("express");
const axios = require("axios");
const authRoutes = require("./auth.routes");
const documentRoutes = require("./document.routes");
const studyRoutes = require("./study.routes");
const flashcardRoutes = require("./flashcard.routes");
const analyticsRoutes = require("./analytics.routes");
const canvasRoutes = require("./canvas.routes");

const router = Router();

// Wake endpoint — frontend calls this on page load to pre-warm the AI service
router.get("/wake", async (req, res) => {
  try {
    await axios.get(`${process.env.AI_SERVICE_URL}/health`, { timeout: 60000 });
    res.json({ status: "ok" });
  } catch {
    res.json({ status: "waking" });
  }
});

router.use("/auth", authRoutes);
router.use("/documents", documentRoutes);
router.use("/study", studyRoutes);
router.use("/flashcards", flashcardRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/canvas", canvasRoutes);

module.exports = router;
