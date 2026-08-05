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

# ── Migrator ──────────────────────────────────────────────────────────────────
# Used by the db-init service to apply the schema. Keeps the Prisma CLI and tsx
# (both devDependencies) out of the runtime image. Extends `deps` so it reuses
# that layer's node_modules rather than copying it across stages.
FROM deps AS migrator
WORKDIR /app
COPY prisma.config.ts ./prisma.config.ts
COPY prisma ./prisma
COPY lib/app-constants.ts lib/database-url.ts ./lib/
COPY scripts/db-migrate.mjs ./scripts/db-migrate.mjs
RUN bunx prisma generate
USER bun
CMD ["bun", "run", "prisma:migrate"]

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock

# Production dependencies only — no devDependencies, no build tooling.
RUN bun install --production --frozen-lockfile

# The Prisma client is code generated during the build, so it is copied over
# rather than regenerated: `bun install --production` leaves out the CLI that
# would generate it.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/lib/socket-server.cjs ./lib/socket-server.cjs

# Drop privileges: the `bun` user ships with the base image.
RUN chown -R bun:bun /app
USER bun

EXPOSE 3000
CMD ["bun", "run", "start"]
