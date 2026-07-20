const { requireInstructor, validateCanvasUrl } = require("../../../src/middleware/canvas.middleware");
const { mockRequest, mockResponse, mockNext } = require("../../helpers");

describe("Canvas Middleware", () => {
  describe("requireInstructor()", () => {
    it("calls next() when user is INSTRUCTOR", () => {
      const req = mockRequest({ user: { role: "INSTRUCTOR" } });
      const res = mockResponse();
      const next = mockNext();

      requireInstructor(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("returns 403 when user is STUDENT", () => {
      const req = mockRequest({ user: { role: "STUDENT" } });
      const res = mockResponse();
      const next = mockNext();

      requireInstructor(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: "Instructor access required" })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 when no user", () => {
      const req = mockRequest({ user: null });
      const res = mockResponse();
      const next = mockNext();

      requireInstructor(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("validateCanvasUrl()", () => {
    it("calls next() when no canvasBaseUrl provided", () => {
      const req = mockRequest({ query: {}, body: {} });
      const res = mockResponse();
      const next = mockNext();

      validateCanvasUrl(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("calls next() for valid HTTPS Canvas URL in query", () => {
      const req = mockRequest({
        query: { canvasBaseUrl: "https://canvas.example.com" },
        body: {},
      });
      const res = mockResponse();
      const next = mockNext();

      validateCanvasUrl(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("calls next() for valid HTTPS Canvas URL in body", () => {
      const req = mockRequest({
        query: {},
        body: { canvasBaseUrl: "https://canvas.example.com" },
      });
      const res = mockResponse();
      const next = mockNext();

      validateCanvasUrl(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("returns 400 for HTTP (non-HTTPS) URL", () => {
      const req = mockRequest({
        query: { canvasBaseUrl: "http://canvas.example.com" },
        body: {},
      });
      const res = mockResponse();
      const next = mockNext();

      validateCanvasUrl(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Canvas URL must use HTTPS" })
      );
    });

    it("returns 400 for invalid URL format", () => {
      const req = mockRequest({
        query: { canvasBaseUrl: "not-a-url" },
        body: {},
      });
      const res = mockResponse();
      const next = mockNext();

      validateCanvasUrl(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid Canvas URL format" })
      );
    });
  });
});
