# JWT Authentication Implementation Plan

## Goal
Implement JWT-based authentication for the SOCRA backend with register, login, forgot-password, and reset-password endpoints.

## User Model
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key, auto-generated |
| email | String | Unique, required |
| password | String | Hashed with bcrypt |
| fullName | String | Required |
| university | Enum | Rwandan universities |
| resetToken | String? | Nullable, for password reset |
| resetTokenExpiry | DateTime? | Nullable, token expiration |
| createdAt | DateTime | Auto-set |
| updatedAt | DateTime | Auto-updated |

### University Enum
- `AFRICAN_LEADERSHIP_UNIVERSITY`
- `UNIVERSITY_OF_RWANDA`
- `ADVENTIST_UNIVERSITY_OF_CENTRAL_AFRICA`
- `INES_RUHENGERI`
- `KIGALI_INDEPENDENT_UNIVERSITY`
- `RWANDA_POLYTECHNIC`
- `CARNEGIE_MELLON_UNIVERSITY_AFRICA`
- `OTHER`

## API Endpoints

### POST /api/auth/register
- **Body**: `{ email, password, fullName, university }`
- **Response**: `201 { message, user: { id, email, fullName, university } }`
- **Errors**: 400 (validation), 409 (email exists)

### POST /api/auth/login
- **Body**: `{ email, password }`
- **Response**: `200 { token, user: { id, email, fullName, university } }`
- **Errors**: 401 (invalid credentials)

### POST /api/auth/forgot-password
- **Body**: `{ email }`
- **Response**: `200 { message }` (always succeeds to prevent email enumeration)
- **Side effect**: Stores hashed reset token + expiry on user record

### POST /api/auth/reset-password
- **Body**: `{ token, newPassword }`
- **Response**: `200 { message }`
- **Errors**: 400 (invalid/expired token)

## Affected Files
- `prisma/schema.prisma` — User model, University enum
- `src/routes/auth.routes.js` — Auth router
- `src/controllers/auth.controller.js` — Request handling
- `src/services/auth.service.js` — Business logic (hash, JWT, reset tokens)
- `src/middleware/auth.middleware.js` — JWT verification middleware
- `src/middleware/error.middleware.js` — Centralized error handling
- `server.js` — Express app setup
- `.env.example` — Environment variable placeholders

## Dependencies
- `prisma` + `@prisma/client` — ORM
- `jsonwebtoken` — JWT signing/verification
- `bcryptjs` — Password hashing
- `crypto` — Reset token generation (built-in)

## Steps
1. Install dependencies
2. Initialize Prisma, create schema with User model
3. Create src/ directory structure
4. Implement auth service
5. Implement auth controller
6. Implement auth routes
7. Implement auth + error middleware
8. Wire up server.js
9. Create .env.example, update .gitignore
10. Run Prisma migration
11. Verify server starts
