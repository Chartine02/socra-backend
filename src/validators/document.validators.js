const { z } = require("zod");

const uploadDocumentSchema = z.object({
  // file is handled by multer, not zod
});

module.exports = { uploadDocumentSchema };
