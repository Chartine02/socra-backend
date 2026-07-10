# Canvas Performance Analysis & Notifications — Implementation Plan

## Overview

Leverage Canvas quiz and assignment data to analyze student performance, generate AI-powered learning suggestions based on weak areas, and deliver insights via **in-app notifications + email notifications**.

---

## Architecture Summary

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Canvas API  │────▶│ Analysis Service  │────▶│  AI Service  │
│  (quizzes,   │     │ (fetch + store    │     │ (generate    │
│  assignments,│     │  submissions)     │     │  suggestions)│
│  submissions)│     └────────┬─────────┘     └──────────────┘
└──────────────┘              │
                              ▼
                   ┌──────────────────┐
                   │  Notification    │
                   │  Service         │
                   │  (in-app + email)│
                   └──────────────────┘
```

**Trigger:** Background cron job runs every 6 hours, checks for new quiz/assignment submissions, analyzes them, and creates notifications.

---

## Phase 1: New Canvas API Endpoints

**File:** `src/services/canvas-api.service.js`

Add these Canvas REST API calls:

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `getQuizzes()` | `GET /courses/:id/quizzes` | List all quizzes in a course |
| `getQuizSubmissions()` | `GET /courses/:id/quizzes/:qid/submissions` | Get student's quiz submissions (scores) |
| `getQuizSubmissionQuestions()` | `GET /quiz_submissions/:sid/questions` | Get individual question responses (what they got right/wrong) |
| `getAssignmentSubmissions()` | `GET /courses/:id/students/submissions` | Get student's assignment submissions with grades |

> **Note:** We target **Classic Quizzes API**. If the Canvas instance uses New Quizzes, these endpoints return empty and we can add `/api/quiz/v1/` support later.

---

## Phase 2: Database Schema Changes

**File:** `prisma/schema.prisma`

### 2a. Notification Model

```prisma
enum NotificationType {
  QUIZ_PERFORMANCE
  ASSIGNMENT_PERFORMANCE
  STUDY_SUGGESTION
  WEEKLY_DIGEST
  SYSTEM
}

model Notification {
  id          String           @id @default(uuid())
  userId      String
  type        NotificationType
  title       String
  message     String           // Main notification body
  data        Json?            // Structured payload (quiz scores, suggestions, etc.)
  isRead      Boolean          @default(false)
  emailSent   Boolean          @default(false)
  createdAt   DateTime         @default(now())

  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@map("notifications")
}
```

### 2b. Canvas Quiz/Assignment Analysis Models

```prisma
model CanvasQuizSubmission {
  id                  String   @id @default(uuid())
  userId              String
  canvasCourseId      String   // FK to CanvasCourse
  canvasQuizId        String   // Canvas quiz ID
  canvasSubmissionId  String   // Canvas submission ID
  quizTitle           String
  score               Float?
  pointsPossible      Float?
  scorePercent        Float?
  attemptNumber       Int      @default(1)
  submittedAt         DateTime?
  questionResults     Json?    // Array of { questionId, questionText, correct, studentAnswer, correctAnswer }
  weakTopics          Json?    // AI-generated: topics the student struggled with
  suggestions         Json?    // AI-generated: learning suggestions
  analyzed            Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  course              CanvasCourse @relation(fields: [canvasCourseId], references: [id], onDelete: Cascade)

  @@unique([userId, canvasQuizId, canvasSubmissionId])
  @@map("canvas_quiz_submissions")
}

model CanvasAssignmentSubmission {
  id                    String   @id @default(uuid())
  userId                String
  canvasCourseId        String   // FK to CanvasCourse
  canvasAssignmentId    String
  canvasSubmissionId    String
  assignmentTitle       String
  score                 Float?
  pointsPossible        Float?
  scorePercent          Float?
  grade                 String?
  submittedAt           DateTime?
  gradedAt              DateTime?
  submissionComments    Json?    // Instructor feedback
  suggestions           Json?    // AI-generated improvement suggestions
  analyzed              Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  course                CanvasCourse @relation(fields: [canvasCourseId], references: [id], onDelete: Cascade)

  @@unique([userId, canvasAssignmentId, canvasSubmissionId])
  @@map("canvas_assignment_submissions")
}
```

### 2c. User Model Additions

```prisma
// Add to User model:
  emailNotifications  Boolean  @default(true)   // User preference
  notifications       Notification[]
  quizSubmissions     CanvasQuizSubmission[]
  assignmentSubmissions CanvasAssignmentSubmission[]
```

### 2d. CanvasCourse Model Additions

```prisma
// Add to CanvasCourse model:
  quizSubmissions       CanvasQuizSubmission[]
  assignmentSubmissions CanvasAssignmentSubmission[]
```

---

## Phase 3: Canvas Analysis Service

**New file:** `src/services/canvas-analysis.service.js`

### Core functions:

#### `syncQuizData(userId, canvasCourseId, canvasBaseUrl)`
1. Fetch all quizzes for the course via Canvas API
2. For each quiz, fetch the student's submissions
3. For graded submissions not yet stored: fetch question-level responses
4. Store in `CanvasQuizSubmission` (upsert by unique constraint)
5. Return list of new/updated submissions needing analysis

#### `syncAssignmentData(userId, canvasCourseId, canvasBaseUrl)`
1. Fetch all assignments via existing `getAssignments()`
2. Fetch student submissions for each assignment
3. Store in `CanvasAssignmentSubmission` (upsert)
4. Return list of new/updated submissions needing analysis

#### `analyzeQuizPerformance(quizSubmissionId)`
1. Load the quiz submission with question results
2. Call AI service `/analyze-performance` with:
   - Question texts + student answers + correct answers
   - Course context (module content if we have it synced)
3. AI returns: `{ weakTopics: [...], suggestions: [...], summary: "..." }`
4. Update `CanvasQuizSubmission` with `weakTopics`, `suggestions`, `analyzed: true`
5. Create in-app `Notification` (type: `QUIZ_PERFORMANCE`)
6. Send email notification

#### `analyzeAssignmentPerformance(assignmentSubmissionId)`
1. Load the assignment submission with instructor comments
2. Call AI service `/analyze-performance` with:
   - Assignment details + grade + instructor feedback
   - Course context
3. AI returns: `{ suggestions: [...], summary: "..." }`
4. Update `CanvasAssignmentSubmission` with `suggestions`, `analyzed: true`
5. Create in-app `Notification` (type: `ASSIGNMENT_PERFORMANCE`)
6. Send email notification

---

## Phase 4: AI Service Endpoint

**File:** `ai-service/main.py` + `ai-service/llm_service.py`

### New endpoint: `POST /analyze-performance`

**Request:**
```json
{
  "type": "quiz" | "assignment",
  "title": "Midterm Quiz - Chapter 5",
  "scorePercent": 65,
  "questionResults": [
    {
      "questionText": "What is photosynthesis?",
      "studentAnswer": "Converting light to food",
      "correctAnswer": "The process by which plants convert light energy into chemical energy",
      "correct": false
    }
  ],
  "instructorComments": "Need to work on...",  // for assignments
  "courseContext": "Module content summary..."   // optional
}
```

**Response:**
```json
{
  "summary": "You scored 65% on Midterm Quiz. You struggled with cellular respiration and enzyme kinetics.",
  "weakTopics": ["Cellular Respiration", "Enzyme Kinetics"],
  "suggestions": [
    {
      "topic": "Cellular Respiration",
      "suggestion": "Review the electron transport chain process. Focus on understanding how ATP is produced in each stage.",
      "priority": "high"
    },
    {
      "topic": "Enzyme Kinetics",
      "suggestion": "Practice problems on Michaelis-Menten kinetics. Pay attention to the relationship between substrate concentration and reaction rate.",
      "priority": "medium"
    }
  ],
  "encouragement": "You did well on photosynthesis and cell structure topics. Keep building on those strengths!"
}
```

---

## Phase 5: Notification Service

**New file:** `src/services/notification.service.js`

### In-App Notifications:

| Function | Purpose |
|----------|---------|
| `createNotification({ userId, type, title, message, data })` | Create and store notification |
| `getNotifications(userId, { unreadOnly, limit, offset })` | Fetch user's notifications (paginated) |
| `getUnreadCount(userId)` | Count of unread notifications |
| `markAsRead(notificationId, userId)` | Mark single notification read |
| `markAllAsRead(userId)` | Mark all as read |

### Email Notifications:

| Function | Purpose |
|----------|---------|
| `sendPerformanceEmail({ user, type, title, summary, suggestions })` | Send quiz/assignment performance email |

**Email provider:** Use **Nodemailer** with SMTP (works with Gmail, SendGrid, Resend, or any SMTP provider). Add `nodemailer` to dependencies.

**Email template:** A clean HTML email with:
- Performance summary (score, title, course)
- Weak topics highlighted
- Top 3 suggestions
- "Open in SOCRA" CTA button

---

## Phase 6: Background Sync (Cron Job)

**New file:** `src/jobs/canvas-sync.job.js`

**Package:** Add `node-cron` dependency

### Scheduler:

```js
// Runs every 6 hours
cron.schedule('0 */6 * * *', async () => {
  // 1. Find all users with connected Canvas tokens
  // 2. For each user, find their synced courses
  // 3. Call syncQuizData + syncAssignmentData for each course
  // 4. For any new unanalyzed submissions, run analysis
  // 5. Analysis creates notifications + sends emails
});
```

### Safety:
- Skip users whose tokens are expired/invalid
- Use a lock (simple DB flag) to prevent overlapping runs
- Log errors per-user without stopping the batch
- Rate-limit Canvas API calls (respect Canvas 403 rate limits)

---

## Phase 7: API Routes & Controllers

### Notification Routes

**New files:** `src/routes/notification.routes.js`, `src/controllers/notification.controller.js`

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/notifications` | Get user's notifications (paginated) |
| `GET` | `/api/notifications/unread-count` | Get unread count |
| `PATCH` | `/api/notifications/:id/read` | Mark notification as read |
| `PATCH` | `/api/notifications/read-all` | Mark all as read |

### Canvas Analysis Routes (add to existing canvas routes)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/canvas/quizzes` | List quizzes for a course |
| `GET` | `/api/canvas/quiz-results` | Get analyzed quiz results |
| `GET` | `/api/canvas/assignment-results` | Get analyzed assignment results |
| `POST` | `/api/canvas/analyze` | Manually trigger analysis for a course |

### User Preference Route (add to existing auth routes)

| Method | Route | Description |
|--------|-------|-------------|
| `PATCH` | `/api/auth/notification-preferences` | Toggle email notifications |

---

## Phase 8: Validators

**New file:** `src/validators/notification.validators.js`

- Validate pagination params for notification list
- Validate notification ID format

---

## File Summary

| Action | File |
|--------|------|
| **Modify** | `prisma/schema.prisma` — Add 3 new models + user fields |
| **Modify** | `src/services/canvas-api.service.js` — Add quiz/submission endpoints |
| **Modify** | `src/services/ai.service.js` — Add `analyzePerformance()` call |
| **Modify** | `src/routes/index.js` — Register notification routes |
| **Modify** | `src/routes/canvas.routes.js` — Add analysis routes |
| **Modify** | `src/controllers/canvas.controller.js` — Add analysis controllers |
| **Modify** | `ai-service/main.py` — Add `/analyze-performance` endpoint |
| **Modify** | `ai-service/llm_service.py` — Add `analyze_performance()` function |
| **Modify** | `ai-service/schemas.py` — Add request/response schemas |
| **Modify** | `package.json` — Add `nodemailer`, `node-cron` |
| **Create** | `src/services/canvas-analysis.service.js` |
| **Create** | `src/services/notification.service.js` |
| **Create** | `src/services/email.service.js` |
| **Create** | `src/jobs/canvas-sync.job.js` |
| **Create** | `src/routes/notification.routes.js` |
| **Create** | `src/controllers/notification.controller.js` |
| **Create** | `src/validators/notification.validators.js` |
| **Create** | `src/templates/performance-email.html` |

---

## Implementation Order

1. **Database first** — Prisma schema + migration
2. **Canvas API endpoints** — Quiz/submission fetchers
3. **AI endpoint** — `/analyze-performance` in Python service
4. **Analysis service** — Fetch, store, analyze
5. **Notification service** — In-app CRUD
6. **Email service** — Nodemailer setup + templates
7. **Routes & controllers** — Wire everything up
8. **Cron job** — Background sync scheduler
9. **Test end-to-end** — Manual trigger first, then enable cron

---

## Environment Variables Needed

```env
# Email (SMTP)
SMTP_HOST=smtp.gmail.com        # or smtp.resend.com, etc.
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=SOCRA <noreply@socra.app>

# Optional: tune sync interval
CANVAS_SYNC_INTERVAL_HOURS=6
```

---

## Edge Cases Handled

- **No quiz submissions yet** → Skip analysis, no notification
- **Quiz not graded** → Skip until graded (check `workflow_state`)
- **Already analyzed submission** → Unique constraint prevents duplicates
- **Canvas token expired** → Skip user in cron, log warning
- **AI service down** → Mark submission as unanalyzed, retry next cycle
- **User has email notifications disabled** → Skip email, still create in-app notification
- **Classic Quizzes not found** → Gracefully handle empty quiz lists (may be New Quizzes)
