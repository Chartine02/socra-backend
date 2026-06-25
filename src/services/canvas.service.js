const prisma = require("../lib/prisma");
const { signToken } = require("../utils/jwt.utils");

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function handleLtiLaunch(idtoken) {
  if (!idtoken || !idtoken.userInfo) {
    throw createAppError("Invalid LTI launch payload", 401);
  }

  const { name, email } = idtoken.userInfo;
  const canvasUserId = idtoken.user;
  const canvasCourseId = idtoken.platformContext?.context?.id;

  // Determine role from LTI roles
  const roles = idtoken.platformContext?.roles || [];
  const isInstructor = roles.some((r) => r.includes("Instructor"));
  const role = isInstructor ? "INSTRUCTOR" : "STUDENT";

  // Find or create user
  let user = await prisma.user.findFirst({
    where: { OR: [{ email }, { canvasUserId }] },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: email || `canvas_${canvasUserId}@lti.local`,
        fullName: name || "Canvas User",
        university: "African Leadership University (ALU)",
        role,
        canvasUserId,
        canvasCourseId,
        isEmailVerified: true, // LTI users are pre-verified
      },
    });
  } else {
    // Update Canvas fields
    user = await prisma.user.update({
      where: { id: user.id },
      data: { canvasUserId, canvasCourseId, role },
    });
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

module.exports = { handleLtiLaunch };
