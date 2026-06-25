const authService = require("../services/auth.service");
const { success } = require("../utils/response.utils");

async function register(req, res, next) {
  try {
    const { email, password, fullName, university } = req.body;
    const result = await authService.register({ email, password, fullName, university });
    return success(res, result.user, "User registered successfully", 201);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;
    await authService.verifyEmail({ token });
    return success(res, null, "Email verified successfully");
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    await authService.forgotPassword({ email });
    return success(res, null, "If an account with that email exists, a password reset link has been sent");
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword({ token, newPassword });
    return success(res, null, "Password has been reset successfully");
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, verifyEmail, forgotPassword, resetPassword, getMe };
