const { Router } = require("express");
const documentController = require("../controllers/document.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { upload } = require("../middleware/upload.middleware");

const router = Router();

router.use(authenticate);

router.post("/", upload.single("file"), documentController.upload);
router.get("/", documentController.getAll);
router.get("/:documentId", documentController.getOne);
router.delete("/:documentId", documentController.remove);

module.exports = router;
