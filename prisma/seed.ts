import { PrismaClient, StreamStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const classes = ["A", "B", "C", "D", "E"];

  for (let year = 1; year <= 5; year += 1) {
    for (const section of classes) {
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
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
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
