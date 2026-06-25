const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { signToken } = require("../utils/jwt.utils");

const SALT_ROUNDS = 12;

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function register({ email, password, fullName, university }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw createAppError("A user with this email already exists", 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const emailVerifyToken = crypto.randomBytes(32).toString("hex");

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      university,
      emailVerifyToken,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      university: true,
      role: true,
      createdAt: true,
    },
  });

  // TODO: Send verification email with emailVerifyToken
  return { user, emailVerifyToken };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw createAppError("Invalid email or password", 401);
  }

  if (!user.isEmailVerified) {
    throw createAppError("Please verify your email before logging in", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw createAppError("Invalid email or password", 401);
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      university: user.university,
      role: user.role,
    },
  };
}

async function verifyEmail({ token }) {
  const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } });
  if (!user) {
    throw createAppError("Invalid verification token", 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifyToken: null },
  });
}

async function forgotPassword({ email }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // Silent — prevent enumeration

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  await prisma.user.update({
    where: { email },
    data: {
      resetToken: hashedToken,
      resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  // TODO: Send reset email
  return resetToken;
}

async function resetPassword({ token, newPassword }) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      resetToken: hashedToken,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    throw createAppError("Invalid or expired reset token", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });
}

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      university: true,
      role: true,
      studyStreak: true,
      lastStudiedAt: true,
      createdAt: true,
    },
  });
  if (!user) {
    throw createAppError("User not found", 404);
  }
  return user;
}

module.exports = { register, login, verifyEmail, forgotPassword, resetPassword, getMe };
