# SOCRA — Socratic Cognitive Retrieval Assistant (Backend)

SOCRA is an AI-powered adaptive learning platform that transforms uploaded academic documents into personalized study experiences using Socratic dialogue, spaced-repetition flashcards, and adaptive quizzes — all mapped to Bloom's Taxonomy levels. It integrates with Canvas LMS to sync course content and analyze student performance automatically.

## Live Deployment

| Component | URL |
|-----------|-----|
| **Frontend (Web App)** | [https://socra-frontend.onrender.com](https://socra-frontend.onrender.com) |
| **Backend API** | [https://socra-backend.onrender.com](https://socra-backend.onrender.com) |
| **AI Service** | [https://socra-ai-service.onrender.com](https://socra-ai-service.onrender.com) |

---

## Table of Contents

- [Core Functionalities](#core-functionalities)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Algorithms & Custom Logic](#algorithms--custom-logic)
- [Deployment Plan](#deployment-plan)
- [Environment Variables](#environment-variables)
- [Related Files](#related-files)

---

## Core Functionalities

### 1. Document Processing & Knowledge Extraction
- Upload academic documents (PDF, TXT) via Supabase storage
- AI service extracts **Knowledge Units** — discrete concepts with topic, excerpt, and Bloom's level
- Each document generates a structured study-ready knowledge graph

### 2. Socratic Dialogue Sessions
- AI-powered Socratic tutoring that progressively challenges students through Bloom's levels (Remember → Understand → Apply → Analyse → Evaluate → Create)
- Adaptive follow-up questions based on student responses
- Tracks dialogue turns with associated Bloom level progression

### 3. Adaptive Quiz Generation
- AI generates multiple-choice questions aligned to specific Knowledge Units and Bloom levels
- Confidence-rated responses (GUESSING, UNSURE, CONFIDENT)
- Detailed explanations with source excerpts for review

### 4. Spaced Repetition Flashcards (SM-2 Algorithm)
- AI-generated flashcards from Knowledge Units
- Full SM-2 spaced repetition scheduling with ease factor adjustment
- Self-rating system (FORGOT, HARD, GOOD, EASY) drives review intervals
- Mastery states: MASTERED, SHAKY, FORGOTTEN

### 5. Canvas LMS Integration
- OAuth2-based Canvas token management for secure API access
- Sync course content (pages, files, modules) into SOCRA documents
- Fetch and analyze quiz/assignment submissions with AI-powered performance insights
- Automatic weak topic identification and personalized study suggestions

### 6. Performance Analytics & Notifications
- Knowledge gap analysis aggregating mastery across all documents + Canvas performance
- Per-topic mastery tracking with last-reviewed timestamps
- Automated notifications for quiz/assignment performance (email + in-app)
- Daily background job syncs Canvas data and triggers AI analysis

### 7. Authentication & User Management
- JWT-based authentication with email verification
- Password reset via token-based email flow
- Role-based access (STUDENT, INSTRUCTOR)
- Study streak tracking

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js (Express 5) |
| **AI Service** | Python (FastAPI + Uvicorn) |
| **Database** | PostgreSQL (Neon serverless) |
| **ORM** | Prisma |
| **File Storage** | Supabase Storage |
| **LLM Providers** | Google Gemini 2.0 Flash (primary), Groq Llama 3.3 70B (fallback) |
| **Authentication** | JWT + bcrypt |
| **Email** | Nodemailer (SMTP) |
| **LMS Integration** | Canvas REST API + LTI 1.3 |
| **Scheduling** | node-cron |
| **Validation** | Zod |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend (React)                       │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼─────────────────────────────┐
│               Node.js / Express Backend                    │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────────┐  │
│  │  Auth   │ │Documents │ │ Study  │ │ Canvas Sync   │  │
│  │  Routes │ │  Routes  │ │ Routes │ │   + Analysis  │  │
│  └────┬────┘ └────┬─────┘ └───┬────┘ └──────┬────────┘  │
│       │           │            │              │           │
│  ┌────▼───────────▼────────────▼──────────────▼────────┐ │
│  │              Service Layer                           │ │
│  │  auth · document · study · flashcard · analytics    │ │
│  │  canvas-api · canvas-sync · canvas-analysis         │ │
│  │  notification · email · sm2 · ai                    │ │
│  └────────────────────────┬────────────────────────────┘ │
└───────────────────────────┼──────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐
│  PostgreSQL   │  │ Python AI Svc │  │   Supabase    │
│  (Neon DB)    │  │ (FastAPI)     │  │   Storage     │
│  via Prisma   │  │ Gemini/Groq   │  │   (Files)     │
└───────────────┘  └───────┬───────┘  └───────────────┘
                           │
                   ┌───────▼───────┐
                   │ Canvas LMS    │
                   │ REST API      │
                   └───────────────┘
```

---

## Project Structure

```
socra-backend/
├── server.js                    # Entry point — starts Express + cron jobs
├── package.json                 # Node.js dependencies & scripts
├── prisma/
│   ├── schema.prisma            # Database schema (models, enums, relations)
│   └── migrations/              # Database migration history
├── src/
│   ├── app.js                   # Express app configuration (CORS, middleware, routes)
│   ├── controllers/             # Request handlers (thin layer)
│   │   ├── auth.controller.js
│   │   ├── document.controller.js
│   │   ├── study.controller.js
│   │   ├── flashcard.controller.js
│   │   ├── analytics.controller.js
│   │   ├── canvas.controller.js
│   │   └── notification.controller.js
│   ├── services/                # Business logic layer
│   │   ├── ai.service.js        # AI service HTTP client with retry logic
│   │   ├── auth.service.js      # JWT auth, registration, password reset
│   │   ├── document.service.js  # Upload, processing orchestration
│   │   ├── study.service.js     # Socratic + Quiz session management
│   │   ├── flashcard.service.js # SM-2 flashcard lifecycle
│   │   ├── sm2.service.js       # SM-2 algorithm implementation
│   │   ├── analytics.service.js # Knowledge gap + mastery analytics
│   │   ├── canvas-api.service.js    # Canvas REST API client
│   │   ├── canvas-oauth.service.js  # Canvas OAuth2 token management
│   │   ├── canvas-sync.service.js   # Course content sync → Documents
│   │   ├── canvas-analysis.service.js # Performance analysis pipeline
│   │   ├── notification.service.js  # In-app + push notifications
│   │   ├── email.service.js     # SMTP email dispatch
│   │   └── lti.service.js       # LTI 1.3 integration
│   ├── middleware/              # Express middleware
│   │   ├── auth.middleware.js   # JWT verification
│   │   ├── canvas.middleware.js # Canvas token validation
│   │   ├── error.middleware.js  # Centralized error handling
│   │   ├── upload.middleware.js # Multer file upload config
│   │   └── validate.middleware.js # Zod schema validation
│   ├── routes/                  # Route definitions
│   ├── validators/              # Zod request schemas
│   ├── jobs/
│   │   └── canvas-sync.job.js   # Daily cron: sync & analyze Canvas data
│   ├── lib/
│   │   ├── prisma.js            # Prisma client singleton
│   │   └── supabase.js          # Supabase client singleton
│   └── utils/
│       ├── constants.js         # App constants (SM-2 defaults, mastery thresholds)
│       ├── jwt.utils.js         # JWT sign/verify helpers
│       ├── logger.js            # Structured logging utility
│       └── response.utils.js   # Standardized API response helpers
├── ai-service/                  # Python AI microservice
│   ├── main.py                  # FastAPI app with endpoints
│   ├── llm_service.py          # LLM orchestration (Gemini + Groq fallback)
│   ├── schemas.py              # Pydantic request/response models
│   ├── config.py               # Environment configuration
│   └── requirements.txt        # Python dependencies
└── docs/
    └── plans/                   # Architecture & integration docs
```

---

## Prerequisites

- **Node.js** ≥ 18.x
- **Python** ≥ 3.10
- **PostgreSQL** database (or [Neon](https://neon.tech) serverless account)
- **Supabase** project (for file storage)
- **Google AI Studio** API key (Gemini) or **Groq** API key
- **npm** or **yarn** package manager

---

## Installation & Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/chartine-uwase/socra-backend.git
cd socra-backend
```

### Step 2: Install Node.js Dependencies

```bash
npm install
```

### Step 3: Install Python AI Service Dependencies

```bash
cd ai-service
pip install -r requirements.txt
cd ..
```

### Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```env
# ─── Database ────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# ─── Server ──────────────────────────────────────────────
PORT=8000
FRONTEND_URL="http://localhost:5173"
CLIENT_URL="http://localhost:5173"

# ─── Authentication ──────────────────────────────────────
JWT_SECRET="your-secure-random-secret-key"
JWT_EXPIRES_IN="7d"

# ─── AI Service ──────────────────────────────────────────
AI_SERVICE_URL="http://localhost:8001"
AI_SERVICE_API_KEY="your-shared-secret-key"

# ─── Supabase (File Storage) ─────────────────────────────
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# ─── Canvas Integration ──────────────────────────────────
CANVAS_TOKEN_ENCRYPTION_KEY="64-char-hex-encryption-key"

# ─── Email (SMTP) ────────────────────────────────────────
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="SOCRA <noreply@socra.app>"
```

Create a `.env` file in the `ai-service/` directory:

```env
GEMINI_API_KEY="your-gemini-api-key"
GROQ_API_KEY="your-groq-api-key"
AI_SERVICE_API_KEY="your-shared-secret-key"  # Must match backend
```

### Step 5: Set Up the Database

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev
```

### Step 6: (Optional) View Database with Prisma Studio

```bash
npx prisma studio
```

---

## Running the Application

### Start the Backend Server (Development)

```bash
npm run dev
```

The server starts on `http://localhost:8000` with hot-reload via nodemon.

### Start the AI Service

```bash
cd ai-service
python main.py
```

The AI service starts on `http://localhost:8001`.

### Start Both Services (Recommended)

Open two terminal sessions:

```bash
# Terminal 1 — Backend
npm run dev

# Terminal 2 — AI Service
cd ai-service && python main.py
```

### Production Start

```bash
npm start
```

---

## API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login with credentials |
| GET | `/api/auth/verify-email/:token` | Verify email address |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| GET | `/api/auth/me` | Get current user profile |

### Documents (`/api/documents`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload document for AI processing |
| GET | `/api/documents` | List user's documents |
| GET | `/api/documents/:id` | Get document details + knowledge units |
| DELETE | `/api/documents/:id` | Delete a document |

### Study Sessions (`/api/study`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/study/socratic/start` | Start Socratic dialogue session |
| POST | `/api/study/socratic/respond` | Submit response in dialogue |
| POST | `/api/study/quiz/generate` | Generate quiz questions |
| POST | `/api/study/quiz/submit` | Submit quiz responses |
| GET | `/api/study/sessions` | Get study session history |

### Flashcards (`/api/flashcards`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/flashcards/generate` | Generate flashcards for a document |
| GET | `/api/flashcards/due` | Get flashcards due for review |
| POST | `/api/flashcards/:id/review` | Submit flashcard review (SM-2) |
| GET | `/api/flashcards` | List all user flashcards |

### Analytics (`/api/analytics`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/knowledge-gap` | Get knowledge gap analysis |
| GET | `/api/analytics/dashboard` | Get dashboard statistics |

### Canvas Integration (`/api/canvas`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/canvas/connect` | Connect Canvas account (OAuth) |
| GET | `/api/canvas/courses` | List synced Canvas courses |
| POST | `/api/canvas/courses/:id/sync` | Sync course content |
| GET | `/api/canvas/performance` | Get Canvas performance data |

### Notifications (`/api/notifications`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user notifications |
| PATCH | `/api/notifications/:id/read` | Mark notification as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |

---

## Algorithms & Custom Logic

### SM-2 Spaced Repetition Algorithm

The flashcard system implements the **SuperMemo SM-2** algorithm for optimal review scheduling:

```
Quality Rating: FORGOT(1), HARD(2), GOOD(3), EASY(5)

If quality < 3 (failed):
  → Reset repetitions to 0
  → Reset interval to 1 day

If quality ≥ 3 (passed):
  → Repetition 0: interval = 1 day
  → Repetition 1: interval = 6 days
  → Repetition n: interval = previous_interval × ease_factor

Ease Factor Update:
  EF' = EF + (0.1 - (5 - q) × (0.08 + (5 - q) × 0.02))
  EF' = max(EF', 1.3)  // Minimum ease factor

Mastery Classification:
  interval ≥ 21 days → MASTERED
  interval ≥ 6 days  → SHAKY
  otherwise          → FORGOTTEN
```

### Bloom's Taxonomy Adaptive Progression

Socratic sessions progressively escalate through cognitive levels:
1. **REMEMBER** — Recall facts and basic concepts
2. **UNDERSTAND** — Explain ideas and concepts
3. **APPLY** — Use information in new situations
4. **ANALYSE** — Draw connections and relationships
5. **EVALUATE** — Justify decisions and positions
6. **CREATE** — Produce original work or ideas

The AI dynamically adjusts the Bloom level based on response quality.

### Knowledge Gap Analysis

Combines two data sources for comprehensive gap identification:
- **Document mastery** — Per-topic aggregation of Knowledge Unit mastery percentages
- **Canvas performance** — Weak topics identified from quiz/assignment submission analysis

The algorithm merges these datasets, prioritizing topics with low mastery and recent poor Canvas performance.

### LLM Fallback Strategy

The AI service implements a dual-provider strategy:
1. **Primary**: Google Gemini 2.0 Flash — fast, cost-effective
2. **Fallback**: Groq Llama 3.3 70B — used when Gemini fails
3. **Retry logic**: Backend retries AI calls up to 4 times with 20s delays on 502 errors

---

## Deployment Plan

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            RENDER CLOUD PLATFORM                             │
│                                                                             │
│  ┌───────────────────────┐         ┌───────────────────────┐               │
│  │   Frontend (React)    │         │   Backend API (Node)   │               │
│  │   Static Site          │  HTTPS  │   Web Service          │               │
│  │                        ├────────►│   Port: 8000           │               │
│  │   Build: npm run build │         │   Build: npm install   │               │
│  │   Dist: dist/          │         │         + prisma gen   │               │
│  └───────────────────────┘         │   Start: npm start     │               │
│                                     └──────────┬────────────┘               │
│                                                 │                            │
│                          ┌──────────────────────┼──────────────────┐        │
│                          │                      │                  │        │
│                          ▼                      ▼                  ▼        │
│  ┌───────────────────────────┐  ┌─────────────────────┐  ┌──────────────┐ │
│  │   AI Service (Python)      │  │  Canvas LMS API      │  │  SMTP Email  │ │
│  │   Web Service              │  │  (External)          │  │  (External)  │ │
│  │                            │  │                      │  │              │ │
│  │   Build: pip install -r    │  │  alueducation.       │  │  Gmail /     │ │
│  │          requirements.txt  │  │  instructure.com     │  │  SendGrid    │ │
│  │   Start: uvicorn main:app  │  └─────────────────────┘  └──────────────┘ │
│  │   Port: $PORT             │                                              │
│  │                            │                                              │
│  │   ┌─────────────────────┐ │                                              │
│  │   │ Gemini 2.0 Flash    │ │  ◄── Primary LLM                            │
│  │   │ (Google AI Studio)  │ │                                              │
│  │   ├─────────────────────┤ │                                              │
│  │   │ Groq Llama 3.3 70B  │ │  ◄── Fallback LLM                           │
│  │   └─────────────────────┘ │                                              │
│  └───────────────────────────┘                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
        │                                       │
        │ Keep-alive ping (every 13 min)        │ Prisma ORM
        │                                       │
        ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────┐
│   NEON (PostgreSQL)  │              │   SUPABASE           │
│                      │              │                      │
│   Serverless DB      │              │   File Storage       │
│   Auto-scaling       │              │   (S3-compatible)    │
│   SSL connections    │              │                      │
│                      │              │   Buckets:           │
│   Tables: 14 models │              │   - documents        │
│   Enums: 7          │              │                      │
└──────────────────────┘              └──────────────────────┘
```

### Data Flow

```
User Upload → Backend API → Supabase Storage (file saved)
                  │
                  ▼
         AI Service (extract knowledge units from document)
                  │
                  ▼
         Neon DB (store document + knowledge units)
                  │
                  ▼
         Ready for Study (Socratic / Quiz / Flashcards)

Canvas Sync (daily cron @ 02:00 UTC):
         Backend → Canvas API (fetch submissions)
                  │
                  ▼
         AI Service (analyze performance, identify weak topics)
                  │
                  ▼
         Neon DB (store results) → Notification (email + in-app)
```

### Platform & Tools

| Component | Platform | Configuration | Reason |
|-----------|----------|---------------|--------|
| Backend API | [Render](https://render.com) Web Service | Node.js, auto-deploy from `main` | Free tier, zero-config deploys |
| AI Service | [Render](https://render.com) Web Service | Python 3.10+, root dir: `ai-service/` | Same platform, internal networking |
| Database | [Neon](https://neon.tech) | PostgreSQL 15, serverless | Auto-scaling, branching, free tier |
| File Storage | [Supabase](https://supabase.com) | S3-compatible object storage | 1GB free, signed URLs, RLS |
| Frontend | [Render](https://render.com) Static Site | React SPA with client-side routing | CDN distribution, rewrite rules |
| LLM (Primary) | [Google AI Studio](https://aistudio.google.com) | Gemini 2.0 Flash | Fast inference, generous free quota |
| LLM (Fallback) | [Groq](https://groq.com) | Llama 3.3 70B Versatile | Ultra-fast fallback, free tier |

### Deployment Steps

#### 1. Database (Neon)
```
1. Create project on neon.tech
2. Copy the DATABASE_URL connection string
3. Run migrations: npx prisma migrate deploy
```

#### 2. Backend API (Render)
```
1. Connect GitHub repository to Render
2. Create Web Service:
   - Build Command: npm install && npx prisma generate
   - Start Command: npm start
   - Environment: Node
3. Set all environment variables (see .env template above)
4. Deploy — auto-deploys on push to main
```

#### 3. AI Service (Render)
```
1. Create separate Web Service for ai-service/ directory:
   - Root Directory: ai-service
   - Build Command: pip install -r requirements.txt
   - Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
   - Environment: Python 3
2. Set environment variables: GEMINI_API_KEY, GROQ_API_KEY, AI_SERVICE_API_KEY
3. Deploy
```

#### 4. Keep-Alive Strategy
The backend pings the AI service every 13 minutes to prevent Render free-tier cold starts:
```javascript
setInterval(() => axios.get(`${AI_SERVICE_URL}/health`), 13 * 60 * 1000);
```

#### 5. Post-Deployment Verification
```
✓ GET /health → { "status": "ok" }
✓ POST /api/auth/register → creates user in Neon DB
✓ POST /api/documents/upload → file stored in Supabase, AI processing triggered
✓ GET /api/flashcards/due → returns SM-2 scheduled cards
✓ Canvas sync cron job runs daily at 02:00 UTC
```

### Environments

| Environment | Backend URL | Frontend URL | Database |
|-------------|-------------|--------------|----------|
| **Development** | `http://localhost:8000` | `http://localhost:5173` | Local PostgreSQL or Neon dev branch |
| **Production** | `https://socra-backend.onrender.com` | `https://socra-frontend.onrender.com` | Neon main branch |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default: 8000) |
| `JWT_SECRET` | Yes | Secret for JWT token signing |
| `JWT_EXPIRES_IN` | No | Token expiry (default: "7d") |
| `FRONTEND_URL` | Yes | Comma-separated allowed origins |
| `AI_SERVICE_URL` | Yes | Python AI service base URL |
| `AI_SERVICE_API_KEY` | Yes | Shared key between backend ↔ AI service |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase admin key for storage |
| `CANVAS_TOKEN_ENCRYPTION_KEY` | Yes | 64-char hex key for encrypting Canvas tokens |
| `SMTP_HOST` | No | SMTP server hostname |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | Sender address for emails |

---

## Related Files

| File | Purpose |
|------|---------|
| [server.js](server.js) | Application entry point, health ping, cron scheduler |
| [src/app.js](src/app.js) | Express app setup, CORS, middleware, route mounting |
| [prisma/schema.prisma](prisma/schema.prisma) | Complete database schema (14 models, 7 enums) |
| [src/services/sm2.service.js](src/services/sm2.service.js) | SM-2 spaced repetition algorithm |
| [src/services/ai.service.js](src/services/ai.service.js) | AI service client with retry logic |
| [src/services/canvas-analysis.service.js](src/services/canvas-analysis.service.js) | Canvas performance analysis pipeline |
| [src/services/analytics.service.js](src/services/analytics.service.js) | Knowledge gap computation |
| [src/jobs/canvas-sync.job.js](src/jobs/canvas-sync.job.js) | Daily cron job for Canvas sync |
| [ai-service/llm_service.py](ai-service/llm_service.py) | LLM orchestration (Gemini + Groq fallback) |
| [ai-service/main.py](ai-service/main.py) | FastAPI endpoints for AI processing |
| [ai-service/schemas.py](ai-service/schemas.py) | Pydantic validation schemas |
| [docs/plans/](docs/plans/) | Architecture documentation & integration guides |

---

## Scripts

```bash
npm run dev        # Start dev server with hot-reload (nodemon)
npm start          # Start production server
npm run migrate    # Run Prisma migrations
npm run generate   # Regenerate Prisma client
npm run studio     # Open Prisma Studio (DB GUI)
```

---
