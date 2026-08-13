ARG BUN_VERSION=1.3.14

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generates the Prisma client into node_modules, then builds Next.js.
RUN bun run build

# ── Runtime ───────────────────────────────────────────────────────────────────
# One image for both jobs: serving the app, and applying migrations before it
# starts (the db-init service runs `bun run prisma:migrate` against this same
# image). That is why the Prisma CLI and tsx are production dependencies — they
# add roughly 190 MB (CLI, Studio, pglite, effect, typescript) and buy a single
# tag to publish, pull and keep in sync instead of two.
#
# Ownership is set per COPY rather than with a `chown -R` at the end. A recursive
# chown rewrites every file it touches into a new layer, which duplicated the
# whole node_modules tree and roughly doubled what this image costs to store and
# to pull.
FROM oven/bun:${BUN_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=bun:bun --from=builder /app/package.json ./package.json
COPY --chown=bun:bun --from=builder /app/bun.lock ./bun.lock

# The schema is in place before installing, so the Prisma postinstall has
# everything it needs if it decides to run.
COPY --chown=bun:bun --from=builder /app/prisma ./prisma
COPY --chown=bun:bun --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --chown=bun:bun --from=builder /app/lib/app-constants.ts ./lib/app-constants.ts
COPY --chown=bun:bun --from=builder /app/lib/database-url.ts ./lib/database-url.ts

# Production dependencies only — no build tooling, no linters, no types.
RUN bun install --production --frozen-lockfile

# The client is code generated during the build, so it is copied rather than
# regenerated here.
COPY --chown=bun:bun --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=bun:bun --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --chown=bun:bun --from=builder /app/.next ./.next
COPY --chown=bun:bun --from=builder /app/public ./public
COPY --chown=bun:bun --from=builder /app/server.js ./server.js
COPY --chown=bun:bun --from=builder /app/lib/socket-server.cjs ./lib/socket-server.cjs
COPY --chown=bun:bun --from=builder /app/scripts/db-migrate.mjs ./scripts/db-migrate.mjs

# Drop privileges: the `bun` user ships with the base image. node_modules stays
# root-owned and world-readable — the app only needs to read it, and this way it
# cannot modify its own dependencies at runtime.
USER bun

EXPOSE 3000
CMD ["bun", "run", "start"]
