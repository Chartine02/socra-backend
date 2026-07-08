const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const prisma = require("../lib/prisma");
const { signToken } = require("../utils/jwt.utils");

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// ─── JWKS Client Cache ────────────────────────────────────────────────────

const jwksClients = new Map();

function getJwksClient(jwksUri) {
  if (!jwksClients.has(jwksUri)) {
    jwksClients.set(
      jwksUri,
      jwksClient({
        jwksUri,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 600000, // 10 minutes
      })
    );
  }
  return jwksClients.get(jwksUri);
}

// ─── OIDC Login Initiation ───────────────────────────────────────────────

async function initiateOidcLogin({ issuer, loginHint, ltiMessageHint, targetLinkUri }) {
  const platform = await prisma.ltiPlatform.findUnique({ where: { issuer } });
  if (!platform) {
    throw createAppError(`Unknown LTI platform: ${issuer}`, 400);
  }

  const state = crypto.randomBytes(32).toString("hex");
  const nonce = crypto.randomBytes(32).toString("hex");

  // Store state/nonce for validation on callback
  await prisma.ltiState.create({
    data: {
      state,
      nonce,
      payload: { loginHint, ltiMessageHint, targetLinkUri },
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
  });

  // Build OIDC auth redirect URL
  const params = new URLSearchParams({
    scope: "openid",
    response_type: "id_token",
    client_id: platform.clientId,
    redirect_uri: targetLinkUri || `${process.env.BACKEND_URL}/api/canvas/launch/callback`,
    login_hint: loginHint,
    state,
    nonce,
    response_mode: "form_post",
    prompt: "none",
  });

  if (ltiMessageHint) {
    params.set("lti_message_hint", ltiMessageHint);
  }

  return {
    redirectUrl: `${platform.authEndpoint}?${params.toString()}`,
  };
}

// ─── LTI Launch Callback (JWT validation) ────────────────────────────────

async function handleLaunchCallback({ idToken, state }) {
  if (!idToken || !state) {
    throw createAppError("Missing id_token or state", 400);
  }

  // 1. Validate state and retrieve nonce
  const ltiState = await prisma.ltiState.findUnique({ where: { state } });
  if (!ltiState || ltiState.consumed || ltiState.expiresAt < new Date()) {
    throw createAppError("Invalid or expired state", 401);
  }

  // Mark state as consumed
  await prisma.ltiState.update({
    where: { id: ltiState.id },
    data: { consumed: true },
  });

  // 2. Decode JWT header to get kid
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded) {
    throw createAppError("Invalid id_token format", 401);
  }

  const { kid, alg } = decoded.header;
  const payload = decoded.payload;

  // 3. Validate issuer — find platform
  const platform = await prisma.ltiPlatform.findUnique({
    where: { issuer: payload.iss },
  });
  if (!platform) {
    throw createAppError(`Unknown issuer: ${payload.iss}`, 401);
  }

  // 4. Validate audience (client_id)
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(platform.clientId)) {
    throw createAppError("Token audience does not match client_id", 401);
  }

  // 5. Validate nonce
  if (payload.nonce !== ltiState.nonce) {
    throw createAppError("Nonce mismatch", 401);
  }

  // 6. Verify JWT signature using platform JWKS
  const client = getJwksClient(platform.jwksEndpoint);
  const key = await client.getSigningKey(kid);
  const publicKey = key.getPublicKey();

  try {
    jwt.verify(idToken, publicKey, {
      algorithms: [alg || "RS256"],
      issuer: platform.issuer,
      audience: platform.clientId,
    });
  } catch (err) {
    throw createAppError(`JWT verification failed: ${err.message}`, 401);
  }

  // 7. Validate LTI message type
  const messageType =
    payload["https://purl.imsglobal.org/spec/lti/claim/message_type"];
  if (messageType !== "LtiResourceLinkLaunchRequest") {
    throw createAppError(`Unsupported message type: ${messageType}`, 400);
  }

  // 8. Validate LTI version
  const version = payload["https://purl.imsglobal.org/spec/lti/claim/version"];
  if (version !== "1.3.0") {
    throw createAppError(`Unsupported LTI version: ${version}`, 400);
  }

  // 9. Extract user/course context
  const canvasUserId = payload.sub;
  const email = payload.email;
  const name = payload.name || payload.given_name || "Canvas User";

  const context =
    payload["https://purl.imsglobal.org/spec/lti/claim/context"] || {};
  const canvasCourseId = context.id;
  const courseName = context.title || context.label || "";

  const roles =
    payload["https://purl.imsglobal.org/spec/lti/claim/roles"] || [];
  const isInstructor = roles.some(
    (r) =>
      r.includes("Instructor") ||
      r.includes("Administrator") ||
      r.includes("TeachingAssistant")
  );
  const role = isInstructor ? "INSTRUCTOR" : "STUDENT";

  // 10. Find or create SOCRA user
  let user = await prisma.user.findFirst({
    where: { OR: [{ email }, { canvasUserId }] },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: email || `canvas_${canvasUserId}@lti.local`,
        fullName: name,
        university: "African Leadership University (ALU)",
        role,
        canvasUserId,
        canvasCourseId,
        isEmailVerified: true,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { canvasUserId, canvasCourseId, role },
    });
  }

  // 11. Create/update CanvasCourse record
  if (canvasCourseId) {
    await prisma.canvasCourse.upsert({
      where: {
        userId_canvasCourseId_canvasBaseUrl: {
          userId: user.id,
          canvasCourseId,
          canvasBaseUrl: platform.issuer,
        },
      },
      create: {
        userId: user.id,
        canvasCourseId,
        canvasBaseUrl: platform.issuer,
        courseName,
        courseCode: context.label || null,
      },
      update: {
        courseName,
        courseCode: context.label || null,
      },
    });
  }

  // 12. Issue SOCRA JWT
  const token = signToken({ id: user.id, email: user.email, role: user.role });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
    courseContext: {
      canvasCourseId,
      courseName,
      roles,
    },
  };
}

// ─── Register Platform (admin utility) ───────────────────────────────────

async function registerPlatform({
  issuer,
  clientId,
  deploymentId,
  authEndpoint,
  tokenEndpoint,
  jwksEndpoint,
}) {
  return prisma.ltiPlatform.upsert({
    where: { issuer },
    create: { issuer, clientId, deploymentId, authEndpoint, tokenEndpoint, jwksEndpoint },
    update: { clientId, deploymentId, authEndpoint, tokenEndpoint, jwksEndpoint },
  });
}

// ─── Cleanup expired states ──────────────────────────────────────────────

async function cleanupExpiredStates() {
  await prisma.ltiState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

module.exports = {
  initiateOidcLogin,
  handleLaunchCallback,
  registerPlatform,
  cleanupExpiredStates,
};
