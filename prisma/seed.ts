import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, StreamStatus } from "@prisma/client";

import { buildDatabaseUrl } from "../lib/database-url";

// Runs as its own process, so it loads .env and builds its own client rather
// than importing lib/prisma.ts (which is marked "server-only" for Next.js).
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // No .env file — rely on the ambient environment (Docker passes env_file).
}

const connectionString = buildDatabaseUrl();
if (!connectionString) {
  console.error("Database non configurato: imposta DB_NAME, DB_USER e DB_PASSWORD.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const sections = ["A", "B", "C", "D", "E"];

  for (let year = 1; year <= 5; year += 1) {
    for (const section of sections) {
      await prisma.class.upsert({
        where: { year_section: { year, section } },
        update: {},
        create: {
          year,
          section,
          displayName: `${year}${section}`,
        },
      });
    }
  }

  const existing = await prisma.stream.findFirst();
  if (!existing) {
    await prisma.stream.create({
      data: {
        title: "Assemblea d'istituto",
        // Placeholder: replace with the real embed URL from the admin panel.
        embedUrl: "https://www.youtube.com/embed/aqz-KE-bpKQ",
        status: StreamStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
