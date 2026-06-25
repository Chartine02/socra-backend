function success(res, data, message, statusCode = 200) {
  const response = { success: true, data };
  if (message) response.message = message;
  return res.status(statusCode).json(response);
}

function error(res, message, statusCode = 500, errors) {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
}

module.exports = { success, error };
