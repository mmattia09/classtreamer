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
  const question = await prisma.question.findUnique({
    where: { id },
    include: { answers: { orderBy: { createdAt: "asc" } } },
  });

  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = [["Domanda", "Tipo", "Classe", "Risposta", "Creato il"]];
  question.answers.forEach((answer) => {
    rows.push([
      question.text,
      question.inputType,
      formatClassLabel(answer.classYear, answer.classSection),
      formatAnswerValue(question.inputType, answer.value),
      answer.createdAt.toISOString(),
    ]);
  });

  const csv = rows.map((row) => row.map((v) => escapeCsv(String(v ?? ""))).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="question-${id}.csv"`,
    },
  });
}
