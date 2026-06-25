const authService = require("../services/auth.service");

const VALID_UNIVERSITIES = [
  "AFRICAN_LEADERSHIP_UNIVERSITY",
  "UNIVERSITY_OF_RWANDA",
  "ADVENTIST_UNIVERSITY_OF_CENTRAL_AFRICA",
  "INES_RUHENGERI",
  "KIGALI_INDEPENDENT_UNIVERSITY",
  "RWANDA_POLYTECHNIC",
  "CARNEGIE_MELLON_UNIVERSITY_AFRICA",
  "OTHER",
];

async function register(req, res, next) {
  try {
    const { email, password, fullName, university } = req.body;

    if (!email || !password || !fullName || !university) {
      return res.status(400).json({ error: "email, password, fullName, and university are required" });
    }

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    if (!VALID_UNIVERSITIES.includes(university)) {
      return res.status(400).json({ error: `Invalid university. Must be one of: ${VALID_UNIVERSITIES.join(", ")}` });
    }

    const user = await authService.register({ email, password, fullName, university });
    res.status(201).json({ message: "User registered successfully", user });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const result = await authService.login({ email, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const resetToken = await authService.forgotPassword({ email });
    // In production, remove resetToken from response and send via email
    res.json({
      message: "If an account with that email exists, a password reset link has been sent",
      ...(resetToken && { resetToken }),
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "token and newPassword are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    await authService.resetPassword({ token, newPassword });
    res.json({ message: "Password has been reset successfully" });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, forgotPassword, resetPassword };
