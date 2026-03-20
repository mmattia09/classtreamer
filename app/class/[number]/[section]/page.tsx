import { notFound } from "next/navigation";

import { StudentStreamView } from "@/components/stream/student-stream-view";
import { getActiveQuestion, getCurrentStreamStatus, getResultsForQuestion } from "@/lib/questions";
import { prisma } from "@/lib/prisma";
import { getPublicUrl } from "@/lib/server-config";

export const dynamic = "force-dynamic";

export default async function ClassStreamPage({
  params,
}: {
  params: Promise<{ number: string; section: string }>;
}) {
  const { number, section } = await params;
  const year = Number(number);

  if (!Number.isInteger(year) || year < 0 || year > 5) {
    notFound();
  }

  const classroom = await prisma.class.findUnique({
    where: {
      year_section: {
        year,
        section: section.toUpperCase(),
      },
    },
  });

  if (!classroom) {
    notFound();
  }

  const status = await getCurrentStreamStatus({ year, section: section.toUpperCase() });
  const question = await getActiveQuestion();
  const results = question ? await getResultsForQuestion(question.id) : null;

  return (
    <StudentStreamView
      year={year}
      section={section.toUpperCase()}
      initialStatus={status}
      initialQuestion={question}
      initialResults={results}
      baseUrl={getPublicUrl()}
    />
  );
}
