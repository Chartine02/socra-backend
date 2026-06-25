const documentService = require("../services/document.service");
const { success } = require("../utils/response.utils");

async function upload(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error("File is required");
      err.statusCode = 400;
      throw err;
    }
    const document = await documentService.uploadDocument({
      userId: req.user.id,
      file: req.file,
    });
    return success(res, document, "Document uploaded and processing started", 201);
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const documents = await documentService.getUserDocuments(req.user.id);
    return success(res, documents);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const document = await documentService.getDocumentById(req.params.documentId, req.user.id);
    return success(res, document);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await documentService.deleteDocument(req.params.documentId, req.user.id);
    return success(res, null, "Document deleted successfully");
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, getAll, getOne, remove };
