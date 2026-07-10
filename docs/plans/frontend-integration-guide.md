# Frontend Integration Guide: Canvas Performance Analysis & Notifications

## Overview

The backend now supports Canvas quiz/assignment performance analysis with AI-generated learning suggestions, delivered through in-app notifications and email. This guide covers all the new API endpoints and recommended UI patterns.

All responses follow the standard wrapper: `{ success: true, data: { ... } }`.  
All endpoints require the `Authorization: Bearer <token>` header.

---

## 1. Notification System

### 1a. Notification Bell (Header/Navbar)

Poll the unread count to show a badge on a bell icon.

```
GET /api/notifications/unread-count
```

**Response:**
```json
{
  "success": true,
  "data": { "count": 3 }
}
```

**Recommended:** Poll every 60 seconds, or call after triggering analysis.

---

### 1b. Notification List (Dropdown or Page)

```
GET /api/notifications?limit=20&offset=0&unreadOnly=false
```

| Query Param  | Type    | Default | Description                     |
|--------------|---------|---------|---------------------------------|
| `limit`      | number  | 20      | Max 50                          |
| `offset`     | number  | 0       | Pagination offset               |
| `unreadOnly` | string  | "false" | Set to "true" for unread only   |

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "QUIZ_PERFORMANCE",
        "title": "Quiz Results: Midterm Quiz - Chapter 5",
        "message": "You scored 65% on Midterm Quiz. You struggled with cellular respiration and enzyme kinetics.",
        "data": {
          "quizSubmissionId": "uuid",
          "scorePercent": 65,
          "weakTopics": ["Cellular Respiration", "Enzyme Kinetics"],
          "suggestions": [
            {
              "topic": "Cellular Respiration",
              "suggestion": "Review the electron transport chain process...",
              "priority": "high"
            }
          ],
          "encouragement": "You did well on photosynthesis and cell structure!"
        },
        "isRead": false,
        "createdAt": "2026-07-10T10:00:00.000Z"
      }
    ],
    "total": 12,
    "limit": 20,
    "offset": 0
  }
}
```

**Notification `type` values:**

| Type                     | Icon suggestion | Description                    |
|--------------------------|-----------------|--------------------------------|
| `QUIZ_PERFORMANCE`       | 📝 / clipboard  | Quiz graded + AI suggestions   |
| `ASSIGNMENT_PERFORMANCE` | 📄 / document   | Assignment graded + suggestions|
| `STUDY_SUGGESTION`       | 💡 / lightbulb  | General study recommendation   |
| `WEEKLY_DIGEST`          | 📊 / chart      | Weekly performance summary     |
| `SYSTEM`                 | ⚙️ / gear       | System notification            |

**Notification `data` shape by type:**

For `QUIZ_PERFORMANCE`:
```ts
{
  quizSubmissionId: string;
  scorePercent: number | null;
  weakTopics: string[];
  suggestions: { topic: string; suggestion: string; priority: "high" | "medium" | "low" }[];
  encouragement: string;
}
```

For `ASSIGNMENT_PERFORMANCE`:
```ts
{
  assignmentSubmissionId: string;
  scorePercent: number | null;
  suggestions: { topic: string; suggestion: string; priority: "high" | "medium" | "low" }[];
  encouragement: string;
}
```

---

### 1c. Mark Notification as Read

```
PATCH /api/notifications/:id/read
```

Call when the user clicks/opens a notification.

**Response:** Returns the updated notification object.

---

### 1d. Mark All as Read

```
PATCH /api/notifications/read-all
```

**Response:**
```json
{ "success": true, "data": { "message": "All notifications marked as read" } }
```

---

## 2. Canvas Performance Analysis

### 2a. List Quizzes for a Course

```
GET /api/canvas/quizzes?canvasCourseId=12345
```

Returns raw Canvas quiz objects (title, points_possible, quiz_type, etc.). Useful for showing a list of available quizzes before analysis results exist.

---

### 2b. Get Analyzed Quiz Results

```
GET /api/canvas/quiz-results?canvasCourseId=<optional>
```

Returns only quizzes that have been **graded and analyzed** by AI. If `canvasCourseId` is omitted, returns results across all courses.

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid",
        "quizTitle": "Midterm Quiz - Chapter 5",
        "score": 13,
        "pointsPossible": 20,
        "scorePercent": 65,
        "attemptNumber": 1,
        "submittedAt": "2026-07-08T14:30:00.000Z",
        "weakTopics": ["Cellular Respiration", "Enzyme Kinetics"],
        "suggestions": [
          {
            "topic": "Cellular Respiration",
            "suggestion": "Review the electron transport chain process. Focus on how ATP is produced in each stage.",
            "priority": "high"
          },
          {
            "topic": "Enzyme Kinetics",
            "suggestion": "Practice Michaelis-Menten problems. Focus on substrate concentration vs reaction rate.",
            "priority": "medium"
          }
        ],
        "course": { "courseName": "Biology 101" }
      }
    ]
  }
}
```

---

### 2c. Get Analyzed Assignment Results

```
GET /api/canvas/assignment-results?canvasCourseId=<optional>
```

Returns only assignments that have been **graded and analyzed** by AI.

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid",
        "assignmentTitle": "Lab Report: Cell Division",
        "score": 78,
        "pointsPossible": 100,
        "scorePercent": 78,
        "grade": "B+",
        "submittedAt": "2026-07-05T09:00:00.000Z",
        "gradedAt": "2026-07-07T16:00:00.000Z",
        "suggestions": [
          {
            "topic": "Methodology Section",
            "suggestion": "Be more specific about your experimental controls...",
            "priority": "high"
          }
        ],
        "course": { "courseName": "Biology 101" }
      }
    ]
  }
}
```

---

### 2d. Manually Trigger Analysis

```
POST /api/canvas/analyze
```

No body required. Triggers a full sync + analysis cycle for the current user: fetches all quiz/assignment submissions from Canvas, stores new graded ones, and runs AI analysis on any unanalyzed submissions.

**Response:**
```json
{
  "success": true,
  "data": {
    "quizzesSynced": 3,
    "assignmentsSynced": 5,
    "analyzed": 2,
    "errors": []
  }
}
```

> **Note:** This can take 10-30 seconds depending on how many submissions need AI analysis. Show a loading state.

---

## 3. Suggested UI Structure

### 3a. Notification Bell Component

```
┌─────────────────────────────────┐
│  🔔 (3)                        │  ← Badge from /unread-count
│  ┌───────────────────────────┐  │
│  │ 📝 Quiz Results: Midterm  │  │  ← type === QUIZ_PERFORMANCE
│  │ You scored 65%. Focus on  │  │
│  │ Cellular Respiration...   │  │
│  │ 2 hours ago        • NEW  │  │
│  ├───────────────────────────┤  │
│  │ 📄 Assignment Graded:     │  │  ← type === ASSIGNMENT_PERFORMANCE
│  │ Lab Report scored 78%...  │  │
│  │ 1 day ago                 │  │
│  └───────────────────────────┘  │
│  Mark all as read               │
└─────────────────────────────────┘
```

### 3b. Performance Dashboard Page

```
┌─────────────────────────────────────────────────────────┐
│  Canvas Performance                    [Sync Now ↻]     │
│                                                         │
│  ┌─── Quizzes ────────────────────────────────────────┐ │
│  │ Midterm Quiz          65%  ████████░░░░  Jul 8     │ │
│  │ ├ Weak: Cellular Respiration, Enzyme Kinetics      │ │
│  │ └ 💡 Review electron transport chain...            │ │
│  │                                                     │ │
│  │ Pop Quiz #3           90%  █████████████ Jul 5     │ │
│  │ └ ✅ Great work! Keep it up.                       │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─── Assignments ────────────────────────────────────┐ │
│  │ Lab Report            78%  B+  ██████████░░ Jul 7  │ │
│  │ └ 💡 Be more specific about controls...            │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3c. Notification Detail View (when clicking a notification)

Show the full `data` payload:
- Score with a visual indicator (progress bar or donut chart)
- Weak topics as colored tags/chips
- Suggestions as an ordered list, styled by priority (🔴 high, 🟡 medium, 🟢 low)
- Encouragement section at the bottom with a positive tone

---

## 4. Recommended Data Flow

```
User opens app
  │
  ├─► GET /api/notifications/unread-count  →  show badge
  │
  ├─► User clicks bell
  │     └─► GET /api/notifications?limit=10  →  show dropdown
  │           └─► User clicks notification
  │                 ├─► PATCH /api/notifications/:id/read
  │                 └─► Show detail view from notification.data
  │
  ├─► User navigates to Performance page
  │     ├─► GET /api/canvas/quiz-results        →  render quiz cards
  │     └─► GET /api/canvas/assignment-results   →  render assignment cards
  │
  └─► User clicks "Sync Now"
        └─► POST /api/canvas/analyze  →  show loading → refresh results
              (creates new notifications for any newly analyzed submissions)
```

---

## 5. TypeScript Types (for reference)

```ts
type NotificationType =
  | "QUIZ_PERFORMANCE"
  | "ASSIGNMENT_PERFORMANCE"
  | "STUDY_SUGGESTION"
  | "WEEKLY_DIGEST"
  | "SYSTEM";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: QuizPerformanceData | AssignmentPerformanceData | Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

interface PerformanceSuggestion {
  topic: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
}

interface QuizPerformanceData {
  quizSubmissionId: string;
  scorePercent: number | null;
  weakTopics: string[];
  suggestions: PerformanceSuggestion[];
  encouragement: string;
}

interface AssignmentPerformanceData {
  assignmentSubmissionId: string;
  scorePercent: number | null;
  suggestions: PerformanceSuggestion[];
  encouragement: string;
}

interface QuizResult {
  id: string;
  quizTitle: string;
  score: number | null;
  pointsPossible: number | null;
  scorePercent: number | null;
  attemptNumber: number;
  submittedAt: string | null;
  weakTopics: string[] | null;
  suggestions: PerformanceSuggestion[] | null;
  course: { courseName: string };
}

interface AssignmentResult {
  id: string;
  assignmentTitle: string;
  score: number | null;
  pointsPossible: number | null;
  scorePercent: number | null;
  grade: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  suggestions: PerformanceSuggestion[] | null;
  course: { courseName: string };
}

interface AnalysisCycleResult {
  quizzesSynced: number;
  assignmentsSynced: number;
  analyzed: number;
  errors: string[];
}
```

---

## 6. Edge Cases to Handle

| Scenario | What happens | Frontend handling |
|----------|-------------|-------------------|
| No Canvas connected | `/canvas/analyze` returns 404 or empty | Show "Connect Canvas" prompt |
| No graded quizzes yet | `/quiz-results` returns empty array | Show empty state: "No graded quizzes found" |
| Analysis in progress | `POST /analyze` takes 10-30s | Show loading spinner, disable button |
| AI service down | Returns 502 error | Show toast: "Analysis unavailable, try later" |
| Email not configured | Emails silently skipped | No frontend impact |
| Notification count is 0 | `unread-count` returns 0 | Hide badge or show no badge |
