const { error } = require("../utils/response.utils");

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const formatted = result.error.flatten().fieldErrors;
      return error(res, "Validation failed", 400, formatted);
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
