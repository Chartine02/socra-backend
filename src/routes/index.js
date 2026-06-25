const { Router } = require("express");
const authRoutes = require("./auth.routes");
const documentRoutes = require("./document.routes");
const studyRoutes = require("./study.routes");
const flashcardRoutes = require("./flashcard.routes");
const analyticsRoutes = require("./analytics.routes");
const canvasRoutes = require("./canvas.routes");

const router = Router();

router.use("/auth", authRoutes);
router.use("/documents", documentRoutes);
router.use("/study", studyRoutes);
router.use("/flashcard", flashcardRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/canvas", canvasRoutes);

module.exports = router;
