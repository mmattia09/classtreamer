# Classtreamer

[![CI](https://img.shields.io/github/actions/workflow/status/mmattia09/classtreamer/ci.yml?branch=main&label=CI&style=for-the-badge)](https://github.com/mmattia09/classtreamer/actions/workflows/ci.yml)
[![Docker image](https://img.shields.io/github/actions/workflow/status/mmattia09/classtreamer/docker-image.yml?branch=main&label=docker&style=for-the-badge)](https://github.com/mmattia09/classtreamer/actions/workflows/docker-image.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

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
  page. Rate limited per device.
- **OBS overlay** — `/embed/results` is a transparent browser source showing the
  current results or a highlighted audience question, updating itself as answers
  come in. For open answers the control room picks which submissions go on
  screen, and can feature one of them.
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
- **Theme** — light, dark or follow the system, applied before the first paint.

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

Everything runs on an isolated `classtreamer` Docker network. Postgres and Redis
are published on `127.0.0.1` only, so they are reachable from this machine for
development but never from the network — drop those mappings in production. If
5432 or 6379 are already taken, set `DB_HOST_PORT` and `REDIS_HOST_PORT` rather
than editing the Compose file.

The app image is also built by GitHub Actions and published to
`ghcr.io/mmattia09/classtreamer` on every push to `main` and every `v*.*.*` tag.

### Configuration

| Variable                              | Purpose                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `ADMIN_PASSWORD`                      | Control room password. A value starting with `$2` is treated as a bcrypt hash.  |
| `SESSION_SECRET`                      | Signs the admin session cookie (`openssl rand -base64 32`).                     |
| `SESSION_COOKIE_SECURE`               | `true` to force the `Secure` flag. Leave empty to decide from the request.      |
| `PUBLIC_URL`                          | Public URL of the app. Used for redirects and for the QR code on the displays.  |
| `PORT`                                | Host port the app is published on.                                             |
| `DB_NAME` · `DB_USER` · `DB_PASSWORD` | Postgres credentials. The connection URL is derived from them.                  |
| `DB_HOST_PORT` · `REDIS_HOST_PORT`    | Host ports for the containers, loopback only. Change them on a collision.       |

The app refuses to start in production without `ADMIN_PASSWORD` and a real
`SESSION_SECRET` rather than falling back to a guessable default. Changing
`ADMIN_PASSWORD` invalidates every session already issued.

## Usage

1. Sign in at `/admin`, open **Impostazioni** and enter your classes —
   `1A-E, 2A-E, 3A-D, INSEGNANTI` and so on. The app name and logo are set here
   too.
2. Create a stream under **Stream → Nuova stream**: title, the embed URL of the
   player (YouTube, Vimeo, your own), when it starts, which classes may see it,
   and the questions you want ready. Leave the class list empty to show it
   everywhere.
3. Open each classroom on `/` and pick year and section — the choice is
   remembered on that device, so a projector is set up only once.
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

## Support

Questions and bug reports → [GitHub Issues](https://github.com/mmattia09/classtreamer/issues).

## Roadmap

- **Per-class questions** — a live question currently reaches every classroom
  watching; targeting a single class would help mixed assemblies.
- **Prisma migrations** — the schema is applied with `db push`; real migrations
  would make upgrading an existing database safer.
- **Multi-instance realtime** — Socket.IO broadcasts within a single process, so
  running more than one app container needs the Redis adapter.

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
bun run lint && bun run typecheck && bun run build
```

Schema changes go in `prisma/schema.prisma` and are applied with
`bun run prisma:push`. The connection URL is never written by hand: it is
derived from the `DB_*` variables in `lib/database-url.ts`, which both the app
and the Prisma CLI import.

## Authors and acknowledgment

Made by [@mmattia09](https://github.com/mmattia09). Originally written with
OpenAI Codex, then reviewed, hardened and updated with
[Claude Code](https://claude.com/claude-code).

## License

[MIT](LICENSE).

## Project status

**Stable / maintenance** — the app covers what its author needs for school
assemblies. Bug fixes and small improvements land as needed; the roadmap above
is best-effort.
