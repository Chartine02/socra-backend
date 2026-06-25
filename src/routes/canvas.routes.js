const { Router } = require("express");
const canvasController = require("../controllers/canvas.controller");
const { verifyLtiLaunch } = require("../middleware/canvas.middleware");

const router = Router();

router.post("/launch", verifyLtiLaunch, canvasController.ltiLaunch);

module.exports = router;
