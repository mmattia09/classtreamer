# Classtreamer — Full App Specification

## Overview
Build a full-stack web application called **Classtreamer** to manage live streams
inside a school environment. The app acts as a wrapper around an external stream
embed (provided via URL/iframe), and adds real-time interaction features like
polls, questions, and a live chat.

The app will be deployed via Docker Compose.

---

## Tech Stack (suggested)
- **Frontend**: Next.js 14+ (App Router) with TypeScript and Tailwind CSS
- **Backend**: Next.js API Routes or a separate Fastify/Express service
- **Database**: PostgreSQL (via Docker)
- **Real-time**: Socket.io
- **Cache/Pub-Sub**: Redis (via Docker, used for real-time event broadcasting)
- **ORM**: Prisma
- **Auth**: Simple password-based auth for admin only (no OAuth needed)
- **QR Code**: `qrcode` npm package
- **Charts/Results**: Use Recharts or Chart.js for mentimeter-style result displays
- **Deployment**: Docker Compose with containers for app, PostgreSQL, Redis

---

## Docker Compose Setup
Include the following services:
- `app` — the Next.js application (port 3000)
- `postgres` — PostgreSQL 15
- `redis` — Redis 7
- Persistent volumes for both postgres and redis data
- A `.env.example` file with all required environment variables

---

## App Structure & Routing

```
/                        → Role selection screen
/class                   → Class number selection (1–5)
/class/[number]          → Section selection (A, B, C, D, E...)
/class/[number]/[section]→ Student stream view
/admin                   → Admin login
/admin/dashboard         → Admin panel
/admin/streams           → Stream management
/admin/streams/[id]      → Stream detail + question management
/admin/classes           → Class management
/answer                  → Mobile answer page (no params, always refers to
                           the currently active question on the active stream)
```

---

## Role Selection Screen (`/`)
Show two large buttons:
- **"Sono una Classe"** → goes to `/class`
- **"Sono un Tecnico"** → goes to `/admin`

No auth for the class flow. Everything happens locally, no login required.
Clean, minimal UI.

---

## Class Flow

### `/class` — Year Selection
Show 5 large horizontal buttons labeled `1`, `2`, `3`, `4`, `5`.
Responsive, big touch targets (works on classroom smartboards).

### `/class/[number]` — Section Selection
Show buttons for each available section (fetched from DB, not hardcoded).
Same large horizontal layout.

### `/class/[number]/[section]` — Stream View
No authentication or session required. The class identity (year + section)
is stored locally in the browser (e.g. localStorage or component state)
and sent with socket events and answer submissions.

This screen should:

1. **Poll the stream status every few seconds** (or use WebSocket):
   - `no_stream` → show centered message: *"Nessuna stream programmata attualmente"*
   - `scheduled` → show: *"La stream andrà in onda a breve"* with a subtle
     pulsing indicator
   - `live` → show the stream embed fullscreen (iframe), auto-trigger
     browser fullscreen API

2. **Question Banner (class-type questions)**:
   When a class-type question is pushed live by the admin, show a banner
   **above the stream embed** (not overlapping) with:
   - The question text
   - The appropriate input UI based on question type (see below)
   - A submit button
   - A countdown timer (if set by admin)
   - After submission or timeout, show the live results visualization

3. **Question QR overlay (individual-type questions)**:
   Show a full-screen overlay (dismissible only by admin) with:
   - A large QR code pointing to `https://stream.chilesotti.it/answer`
   - The URL written below the QR code
   - A live counter of how many responses have been received

4. **Live Results Embed**:
   A separate route `/embed/results` (no ID needed, always refers to the
   currently active question) that renders a mentimeter-style animated
   results visualization. Transparent background. Auto-updates via WebSocket.

---

## Question Types
Implement the following question types with appropriate UI for both input
(student side) and results visualization (admin + embed side):

| Type | Input UI | Results Display |
|---|---|---|
| `open` | Textarea | Scrolling word wall / latest answers |
| `word_count` | Text input (single/few words) | Word cloud |
| `scale` | Slider or number input (define min/max/step) | Bar chart or gauge |
| `single_choice` | Radio buttons | Horizontal bar chart |
| `multiple_choice` | Checkboxes | Horizontal bar chart |

All results must **update in real-time** as answers come in (WebSocket).
Animate transitions between result states (e.g., bars growing).

---

## Admin Panel

### Auth
Simple password-based login stored in `.env`. No need for user management.
Single admin account.

### `/admin/dashboard`
Overview with:
- Current stream status (live / scheduled / none)
- Quick actions: go live, end stream, push question
- Count of connected class viewers (by class/section)
- Real-time answer feed for active question

### `/admin/streams` — Stream Management
List of all streams (past and scheduled) with:
- Title, scheduled date/time, stream embed URL
- Status badge (draft / scheduled / live / ended)
- Actions: edit, delete, go live, end

### `/admin/streams/new` and `/admin/streams/[id]` — Stream Editor
Fields:
- Title
- Embed URL (the iframe src from the external stream platform)
- Scheduled date and time
- Target classes (which class/section combos can see this stream)
- List of pre-prepared questions (can be reordered via drag-and-drop)

Each question in the list has:
- Question type selector
- Question text
- Type: `class` or `individual`
- Options (for choice types)
- Timer duration (optional)
- A **"Go Live"** button to push it as the currently active question
- A **"Show Results"** button to push the results to the stream embed

### `/admin/classes` — Class Management
CRUD interface for:
- Year (1–5)
- Section (letter)
- Optional display name

---

## Real-time Architecture
Use **Socket.io** with the following rooms/events:

```text
Rooms:
  stream                     — all viewers (only one stream at a time)
  class:[year]-[section]     — specific class viewers
  admin                      — admin panel

Events (server → client):
  stream:status              — { status: 'no_stream' | 'scheduled' | 'live', embedUrl? }
  question:push              — { question object, type: 'class' | 'individual' }
  question:close             — {}
  results:update             — { results object }
  viewer:count               — { class, section, count }

Events (client → server):
  answer:submit              — { classYear?, classSection?, value }
  viewer:join                — { year, section }
```

---

## `/answer` — Mobile Answer Page
Accessible at `stream.chilesotti.it/answer` — no query params needed.
Always refers to the currently active question on the active stream.

- On load, fetches the currently active question from the server
- Shows the question text and appropriate input UI (same types as above)
- On submit, sends the answer and shows a confirmation screen
- If no question is currently active, show: *"Nessuna domanda attiva al momento"*
- If the question closes while the user is on the page, update the UI accordingly
- Must be **mobile-first**, clean, fast-loading
- No login required

---

## `/embed/results` — OBS Browser Source
Always refers to the currently active question. No params needed.

- Transparent background (`background: transparent`)
- Shows animated real-time results for the active question
- Designed to be overlaid in OBS or similar tools
- Updates via WebSocket
- No UI chrome, no buttons — pure visualization
- If no question is active, render nothing (fully transparent)

---

## Database Schema (Prisma)
Design a schema with at least the following models:
- `Class` (year, section)
- `Stream` (title, embedUrl, scheduledAt, status, targetClasses)
- `Question` (streamId, type, text, questionType [class/individual], options,
  timerSeconds, order, status [draft/live/closed])
- `Answer` (questionId, classYear?, classSection?, value, createdAt)

Only one stream and one question can have status `live` at any given time.
Enforce this at the application level.

---

## Additional Requirements
- All real-time interactions must work without page refresh
- The student view must be usable on a smartboard (large touch targets,
  readable at distance)
- The `/answer` route must be fully mobile-optimized
- Admin panel should show a live preview of what students currently see
- Add a simple **connection status indicator** (green dot = connected,
  red = reconnecting) on both the class view and the answer page
- Debounce answer submissions to prevent spam
- Add basic rate limiting on the answer endpoint (Redis-based)
- All text in Italian
- Use environment variables for: DB connection, Redis URL, admin password,
  base URL, socket config

---

## Deliverables
- Full source code (monorepo or single Next.js app)
- `docker-compose.yml` with all services
- `prisma/schema.prisma`
- `.env.example`
- `README.md` with setup instructions in Italian
- `Dockerfile`
- `DEPLOY.md` with deployment specific instructions

Start by scaffolding the project structure, then implement features in this
order:
1. Docker Compose + DB + Prisma schema
2. Role selection + class navigation (no auth)
3. Stream status display (no_stream / scheduled / live)
4. Admin stream management
5. Real-time socket infrastructure
6. Question system (class-type first, then individual)
7. Results visualization + embed
8. Mobile answer page
9. Polish + rate limiting + connection indicators
```