const multer = require("multer");
const { errorHandler } = require("../../../src/middleware/error.middleware");
const { mockRequest, mockResponse, mockNext } = require("../../helpers");

describe("Error Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
  });

  it("handles Multer LIMIT_FILE_SIZE error", () => {
    const err = new multer.MulterError("LIMIT_FILE_SIZE");
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "File too large (max 10MB)",
    });
  });

  it("handles other Multer errors", () => {
    const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE");
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it("handles file type restriction errors", () => {
    const err = new Error("Only PDF and plain text files are allowed");
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Only PDF and plain text files are allowed",
    });
  });

  it("handles Prisma P2002 (unique constraint) errors", () => {
    const err = { code: "P2002", message: "Unique constraint failed" };
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Already exists",
    });
  });

  it("handles Prisma P2025 (not found) errors", () => {
    const err = { code: "P2025", message: "Record not found" };
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Not found",
    });
  });

  it("handles custom AppError with statusCode", () => {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Forbidden",
    });
  });

  it("handles unhandled errors with 500", () => {
    const err = new Error("Something broke");
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Something broke",
    });
  });

  it("returns generic message when error has no message", () => {
    const err = new Error();
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
