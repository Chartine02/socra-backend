const { success, error } = require("../../../src/utils/response.utils");
const { mockResponse } = require("../../helpers");

describe("response.utils", () => {
  describe("success()", () => {
    it("returns 200 with data by default", () => {
      const res = mockResponse();
      success(res, { id: 1 });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1 },
      });
    });

    it("includes message when provided", () => {
      const res = mockResponse();
      success(res, { id: 1 }, "Created");

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1 },
        message: "Created",
      });
    });

    it("uses custom status code", () => {
      const res = mockResponse();
      success(res, null, "Created", 201);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("handles null data", () => {
      const res = mockResponse();
      success(res, null);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });
  });

  describe("error()", () => {
    it("returns 500 by default", () => {
      const res = mockResponse();
      error(res, "Something went wrong");

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Something went wrong",
      });
    });

    it("uses custom status code", () => {
      const res = mockResponse();
      error(res, "Not found", 404);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("includes errors when provided", () => {
      const res = mockResponse();
      const fieldErrors = { email: ["Invalid email"] };
      error(res, "Validation failed", 400, fieldErrors);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Validation failed",
        errors: fieldErrors,
      });
    });
  });
});
