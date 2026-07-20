const { validate } = require("../../../src/middleware/validate.middleware");
const { mockRequest, mockResponse, mockNext } = require("../../helpers");
const { z } = require("zod");

describe("Validate Middleware", () => {
  const testSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    age: z.number().int().min(0).optional(),
  });

  const middleware = validate(testSchema);

  it("calls next() on valid body", () => {
    const req = mockRequest({ body: { name: "Test", email: "test@example.com" } });
    const res = mockResponse();
    const next = mockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("replaces req.body with parsed data (strips unknown fields)", () => {
    const req = mockRequest({
      body: { name: "Test", email: "test@example.com", extra: "should be stripped" },
    });
    const res = mockResponse();
    const next = mockNext();

    middleware(req, res, next);

    expect(req.body).toEqual({ name: "Test", email: "test@example.com" });
    expect(req.body).not.toHaveProperty("extra");
  });

  it("returns 400 with field errors on invalid body", () => {
    const req = mockRequest({ body: { name: "", email: "not-email" } });
    const res = mockResponse();
    const next = mockNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Validation failed",
        errors: expect.any(Object),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", () => {
    const req = mockRequest({ body: {} });
    const res = mockResponse();
    const next = mockNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
