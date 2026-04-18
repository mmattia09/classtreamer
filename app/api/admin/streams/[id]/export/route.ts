import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { escapeCsv, formatAnswerValue, formatClassLabel } from "@/lib/export-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const stream = await prisma.stream.findUnique({
    where: { id },
    include: {
      questions: {
        include: {
          answers: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!stream) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = [
    ["Stream", "Domanda", "Tipo", "Classe", "Risposta", "Creato il"],
  ];

  stream.questions.forEach((question) => {
    question.answers.forEach((answer) => {
      rows.push([
        stream.title,
        question.text,
        question.inputType,
        formatClassLabel(answer.classYear, answer.classSection),
        formatAnswerValue(question.inputType, answer.value),
        answer.createdAt.toISOString(),
      ]);
    });
  });

  const csv = rows.map((row) => row.map((value) => escapeCsv(String(value ?? ""))).join(",")).join("\n");
  const filename = `stream-${stream.id}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
