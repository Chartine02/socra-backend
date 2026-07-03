const multer = require("multer");
const { FILE_UPLOAD } = require("../utils/constants");

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (FILE_UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and plain text files are accepted"), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: FILE_UPLOAD.MAX_SIZE_BYTES },
});

module.exports = { upload };
