const crypto = require("crypto");
const axios = require("axios");
const prisma = require("../lib/prisma");

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// ─── Simple encryption for tokens at rest ─────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.CANVAS_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error("CANVAS_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
  }
  return crypto.scryptSync(key, "socra-canvas-salt", 32);
}

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

function decrypt(encryptedText) {
  const [ivHex, tagHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ─── Store Personal Access Token ──────────────────────────────────────────

async function storePersonalToken({ userId, canvasBaseUrl, accessToken }) {
  if (!canvasBaseUrl || !accessToken) {
    throw createAppError("canvasBaseUrl and accessToken are required", 400);
  }

  // Trim whitespace/newlines that may have been copied
  const cleanToken = accessToken.trim();
  const cleanUrl = canvasBaseUrl.replace(/\/+$/, ""); // remove trailing slash

  // Validate the token by making a test API call
  try {
    const res = await axios.get(`${cleanUrl}/api/v1/users/self`, {
      headers: { Authorization: `Bearer ${cleanToken}` },
    });
    console.log("Canvas auth success:", res.data.name);
  } catch (err) {
    console.error("Canvas auth failed:", {
      status: err.response?.status,
      body: err.response?.data,
      url: `${cleanUrl}/api/v1/users/self`,
    });
    throw createAppError(
      `Canvas authentication failed (${err.response?.status || "network error"}): ${err.response?.data?.message || err.message}`,
      401
    );
  }

  // Store encrypted token (personal tokens don't expire, so set far-future date)
  await prisma.canvasToken.upsert({
    where: { userId_canvasBaseUrl: { userId, canvasBaseUrl: cleanUrl } },
    create: {
      userId,
      canvasBaseUrl: cleanUrl,
      accessToken: encrypt(cleanToken),
      refreshToken: encrypt("personal_token"), // placeholder — personal tokens don't refresh
      expiresAt: new Date("2099-12-31"),
    },
    update: {
      accessToken: encrypt(cleanToken),
      expiresAt: new Date("2099-12-31"),
    },
  });

  return { success: true };
}

// ─── Retrieve Valid Token ─────────────────────────────────────────────────

async function getValidToken(userId, canvasBaseUrl) {
  const tokenRecord = await prisma.canvasToken.findUnique({
    where: { userId_canvasBaseUrl: { userId, canvasBaseUrl } },
  });

  if (!tokenRecord) {
    throw createAppError("No Canvas token found. Please add your Canvas access token in settings.", 401);
  }

  return decrypt(tokenRecord.accessToken);
}

// ─── Check if user has a token stored ─────────────────────────────────────

async function hasToken(userId, canvasBaseUrl) {
  const tokenRecord = await prisma.canvasToken.findUnique({
    where: { userId_canvasBaseUrl: { userId, canvasBaseUrl } },
  });
  return !!tokenRecord;
}

// ─── Remove stored token ──────────────────────────────────────────────────

async function removeToken(userId, canvasBaseUrl) {
  await prisma.canvasToken.deleteMany({
    where: { userId, canvasBaseUrl },
  });
  return { success: true };
}

module.exports = {
  storePersonalToken,
  getValidToken,
  hasToken,
  removeToken,
};
