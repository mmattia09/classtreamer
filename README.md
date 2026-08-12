# Classtreamer

[![CI](https://img.shields.io/github/actions/workflow/status/mmattia09/classtreamer/ci.yml?branch=main&label=CI&style=for-the-badge)](https://github.com/mmattia09/classtreamer/actions/workflows/ci.yml)
[![Docker image](https://img.shields.io/github/actions/workflow/status/mmattia09/classtreamer/docker-image.yml?branch=main&label=docker&style=for-the-badge)](https://github.com/mmattia09/classtreamer/actions/workflows/docker-image.yml)
[![Release](https://img.shields.io/github/v/release/mmattia09/classtreamer?style=for-the-badge&color=blue)](https://github.com/mmattia09/classtreamer/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Bun](https://img.shields.io/badge/Bun-1.3-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)

A self-hosted platform for streaming a school assembly to every classroom and
getting the room to answer back: each class opens its own page, the stream plays
full screen, and the control room pushes live questions that students answer
either from the classroom display or from their own phone.

Built to run an assembly from a single laptop — an OBS scene, a projector per
room, and a browser. The interface is in Italian. Nothing leaves your server:
there are no student accounts, no sign-ups and no third-party analytics.

## Features

- **A page per classroom** — `/class/1/A` plays the stream full screen with a
  connection indicator. Classes are configured with a compact notation:
  `1A-E, 3A-D, 3E, INSEGNANTI` expands to the whole list, and non-numbered
  classes (staff, guests) live alongside the numbered ones.
- **Live questions, five formats** — open text, word cloud, numeric scale,
  single choice and multiple choice. Results are tallied as answers arrive.
- **Two audiences per question** — *class*, answered once from the classroom
  display, or *individual*, where the display shows a QR code and every student
  answers from their own phone at `/answer`. No app, no sign-in.
- **Optional timer** — per question, with a live countdown on every screen and
  an *extend* control for when the room needs a few more seconds. Late
  submissions are rejected server-side, not just hidden in the UI.
- **Questions from the audience** — students can send a question to the control
  room at any moment during a live, from a pill at the bottom of the stream
  page. They reach the dashboard only, never the other students' screens.
- **OBS overlay** — `/embed/results` is a transparent browser source showing the
  current results or a highlighted audience question, updating itself as answers
  come in. For open answers the control room picks which submissions go on
  screen, and can feature one of them. Everything is sized in viewport units so
  it stays readable from the back of a room.
- **Control room dashboard** — what is live, how many viewers per class,
  incoming audience questions, and one-click controls to open a question, reveal
  its results or close it. An unplanned question can be created and pushed live
  without leaving the page.
- **Stream editor** — title, embed URL, schedule, target classes and a
  drag-and-drop list of prepared questions. A stream targeting no class is
  visible to all of them. Past streams can be duplicated to start the next one.
- **Archive and export** — every past stream and question stays browsable, with
  CSV export per question or per whole stream. The export neutralises cells that
  a spreadsheet would otherwise execute as formulas.
- **One answer per device** — enforced by a database constraint, so a student
  cannot vote twice by resubmitting.
- **Theme** — light, dark or follow the system, applied before the first paint.

## How it works

A single Node process serves the Next.js app and a Socket.IO server side by
side (`server.js`). Everything the control room does is pushed over the socket;
polling exists only as a fallback for when the socket drops.

| Piece | Role |
| ----- | ---- |
| Next.js 16 (App Router) + React 19 | Pages and API routes |
| Socket.IO | Live push to classrooms, phones and the OBS overlay |
| PostgreSQL + Prisma 7 | Streams, questions, answers, settings |
| Redis | Rate limiting |
| Tailwind CSS | Interface |
| Zod | Validation on every write endpoint |

State that belongs to the whole installation — including what the OBS overlay is
currently showing — lives in the database, not in memory or on disk, so a
container restart mid-assembly loses nothing.

## Installation

### Requirements

- [Docker](https://docs.docker.com/get-docker/) with Compose.
- For local development only: [Bun](https://bun.sh) 1.3+.

### Run it

```bash
git clone https://github.com/mmattia09/classtreamer.git && cd classtreamer
cp .env.example .env
# Edit .env — at minimum:
#   ADMIN_PASSWORD → the control room password
#   SESSION_SECRET → openssl rand -base64 32
docker compose up -d --build
```

Compose starts Postgres and Redis, applies the database schema through a
one-shot `db-init` service, then serves the app at <http://localhost:3000>.

Schema changes ship as Prisma migrations, applied on every `docker compose up`.
A database created before migrations existed is baselined automatically on the
first upgrade, so there is nothing to run by hand — and nothing destructive
happens without a human: if the schema has diverged in a way that would lose
data, `db-init` stops and the app does not start.

Everything runs on an isolated `classtreamer` Docker network. Postgres and Redis
are published on `127.0.0.1` only, so they are reachable from this machine for
development but never from the network — drop those mappings in production. If
5432 or 6379 are already taken, set `DB_HOST_PORT` and `REDIS_HOST_PORT` rather
than editing the Compose file.

The app image is also built by GitHub Actions and published to
`ghcr.io/mmattia09/classtreamer` on every push to `main` and every `v*.*.*` tag.

### Configuration

Everything is optional except `ADMIN_PASSWORD` and `SESSION_SECRET`; the rest
have working defaults.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `ADMIN_PASSWORD` | — | Control room password. A value starting with `$2` is treated as a bcrypt hash. **Required.** |
| `SESSION_SECRET` | — | Signs the admin session cookie (`openssl rand -base64 32`). **Required.** |
| `SESSION_COOKIE_SECURE` | auto | `true` to force the `Secure` flag. Empty decides from the request protocol. |
| `PUBLIC_URL` | `http://localhost:3000` | Public URL of the app. Used for the QR code shown on the displays. |
| `PORT` | `3000` | Host port the app is published on. |
| `DB_NAME` · `DB_USER` · `DB_PASSWORD` | `classtreamer` | Postgres credentials. The connection URL is derived from them. |
| `DB_HOST_PORT` · `REDIS_HOST_PORT` | `5432` · `6379` | Host ports for the containers, loopback only. Change them on a collision. |
| `ANSWER_IP_RATE_LIMIT` | `3000` | Answers accepted from one IP address per 10s. See below. |
| `AUDIENCE_QUESTION_IP_RATE_LIMIT` | `600` | Audience questions accepted from one IP address per minute. |
| `LOG_LEVEL` | `info` in production | `debug`, `info`, `warn` or `error`. Logs are one JSON object per line. |

The app refuses to start in production without `ADMIN_PASSWORD` and a real
`SESSION_SECRET` rather than falling back to a guessable default. Changing
`ADMIN_PASSWORD` invalidates every session already issued.

#### About the rate limits

Students are rate limited **per device**, not per IP address, because a school
NATs every phone behind a single public address — a per-IP limit would count a
whole class as one client and reject most of their answers.

The two `*_IP_RATE_LIMIT` values are only a flood guard against a script, and
they sit far above what a real assembly produces. The defaults fit roughly 3000
students answering at the same moment. Raise them if your school is larger; the
per-device protection is unaffected either way.

## Performance

Measured on a production build with the app, Postgres, Redis and the load
generator all on one laptop. A dedicated server does better, not worse.

| Load | Result |
| ---- | ------ |
| 100 answers submitted at once | all accepted, p95 **443 ms** |
| 1000 answers at once | all accepted, p95 **770 ms** |
| 2500 answers at once | all accepted, **611/s**, p95 1.6 s |
| 3000 open sockets + 2000 answers at once | all accepted, p95 **1.19 s**, 393 MB RSS, no errors |

Socket connections cost about 106 KB each: 3000 of them open in 0.7 s and take
the process from 60 MB to roughly 230 MB at rest. A pushed question reaches
1000 connected clients while the API call that triggers it returns in under
200 ms.

This matters because **every phone on `/answer` holds a socket open**, not just
the classroom displays. A 500–1000 student assembly — everyone answering the
same question in the same moment — is comfortably inside these numbers. The
practical ceiling for one instance is around 2000–3000 concurrent users, where
p95 latency climbs towards 1.5–2 s.

Two caveats. The video itself never touches this server: students watching an
embedded YouTube stream load it from YouTube, so the school's own network is
almost always the real bottleneck. And Socket.IO broadcasts within one process,
so running more than one app container would need the Redis adapter.

## Usage

1. Sign in at `/admin`, open **Impostazioni** and enter your classes —
   `1A-E, 2A-E, 3A-D, INSEGNANTI` and so on. The app name and logo are set here
   too.
2. Create a stream under **Stream → Nuova stream**: title, the embed URL of the
   player (YouTube, Vimeo, your own), when it starts, which classes may see it,
   and the questions you want ready. Leave the class list empty to show it
   everywhere.
3. Open each classroom on `/` and pick year and section. Bookmark the resulting
   `/class/[year]/[section]` URL on the projector so it comes back on its own.
4. Once live, push questions one at a time from the dashboard. Individual
   questions put a QR code on the displays and collect answers from phones.
5. In OBS, add a browser source pointing at `<PUBLIC_URL>/embed/results` with a
   transparent background, and choose from the dashboard what it shows.
6. Afterwards, export the answers as CSV from the stream page.

### Routes

| Route                     | What it is                                |
| ------------------------- | ----------------------------------------- |
| `/`                       | Class picker                              |
| `/class/[year]/[section]` | Classroom view: stream and live question  |
| `/answer`                 | Phone page for individual questions       |
| `/embed/results`          | OBS overlay                               |
| `/admin`                  | Control room login                        |
| `/admin/dashboard`        | Live control                              |
| `/admin/streams`          | Streams and archive                       |
| `/admin/classes`          | Classes and branding                      |
| `/api/health`             | Health check — reports database and Redis |

## Privacy and security

The app is designed for minors, so it collects as little as possible.

- **No accounts.** Students never sign in and never give a name. An answer
  carries the class it came from and nothing else.
- **The device cookie is not an identity.** To stop one phone answering twice,
  each device gets a random opaque value in an `httpOnly` cookie. It maps to no
  person, is never displayed, and cannot be read by page scripts.
- **Live events are scoped.** Viewer counts (which include IP addresses) and
  incoming audience questions go to the control room only, never to the
  students' browsers.
- **The admin session** is a signed cookie with the expiry inside the signature,
  checked server-side, and compared in constant time.
- **Write endpoints are validated** with Zod, and URLs that end up in an iframe
  or a favicon are restricted to `http(s)` so a `javascript:` URL cannot get in.

One thing to know: **`/embed/results` and `/api/embed/state` are unauthenticated**,
because OBS loads the overlay without credentials. Anyone who can reach the app
can read the results of the question currently pushed to the overlay. Keep the
app off the public internet, or put the overlay behind your reverse proxy, if
that matters for your setting.

## Backups

Everything lives in the `postgres_data` Docker volume: the classes, the streams
and every answer ever given. There is no automatic backup, and `docker compose
down -v` deletes that volume without asking — so take a dump before upgrading or
before touching the stack:

```bash
docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > classtreamer-$(date +%F).sql.gz
```

To restore into an empty database:

```bash
gunzip -c classtreamer-2026-05-01.sql.gz | docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"
```

Run both with the project's `.env` loaded, or substitute the values by hand. The
dump is plain SQL and includes the migration history, so a restored database
carries on from where it left off.

## Updating

```bash
git pull && docker compose up -d --build
```

Migrations run automatically before the app starts. Take a dump first — see
above. Changing `ADMIN_PASSWORD`, or upgrading across a release that alters the
session format, signs you out; log in again and carry on.

## Troubleshooting

**Signing in bounces me back to the login page.** The session cookie is bound to
the origin you are using. Reach the app by the same hostname you configured, and
avoid mixing `localhost` and `127.0.0.1` in the same session.

**The container never becomes healthy.** `/api/health` reports the database and
Redis separately — `docker compose logs app` shows which one is failing, as a
JSON line with a `scope` field.

**`db-init` exits and the app never starts.** The schema on disk has diverged
from the migrations in a way that would lose data. That stop is deliberate: take
a dump, then reconcile by hand.

**Postgres refuses to start after an upgrade.** Changing the Postgres major
version needs a dump and restore; the old data directory is not read by a newer
server.

**Students get "troppi invii ravvicinati".** If it is one student spamming, that
is the per-device limit working. If it is a whole room at once, raise
`ANSWER_IP_RATE_LIMIT`.

## Support

Questions and bug reports → [GitHub Issues](https://github.com/mmattia09/classtreamer/issues).

## Contributing

Issues and pull requests are welcome. For a development environment:

```bash
bun install
cp .env.example .env
bun run dev:start
```

`bun run dev:start` starts Postgres and Redis, applies the schema, seeds it and
runs the app. It recreates `.env` from `.env.example` every time, so use
`bun run dev` once the environment is set up the way you want it.

Before opening a PR, please make sure these pass — CI runs the same checks:

```bash
bun run lint && bun run typecheck && bun run test && bun run build
```

Tests are plain `bun test`, no extra dependency. The logic worth testing is kept
in pure modules that do not touch the database — class parsing, result tallying,
CSV escaping, timer states, validation schemas, overlay layout — so a test needs
no fixtures and no running server.

Schema changes go in `prisma/schema.prisma`. Generate a migration for them and
commit it alongside the change:

```bash
bun run prisma:migrate:new --name descrizione_della_modifica
```

The connection URL is never written by hand: it is derived from the `DB_*`
variables in `lib/database-url.ts`, which both the app and the Prisma CLI
import.

## Authors and acknowledgment

Made by [@mmattia09](https://github.com/mmattia09). Originally written with
OpenAI Codex, then reviewed, hardened and updated with
[Claude Code](https://claude.com/claude-code).

## License

[MIT](LICENSE).

## Project status

**Stable / maintenance.** The app covers what its author needs for school
assemblies and is used for real ones. Bug fixes and small improvements land as
needed; there is no planned feature work.
