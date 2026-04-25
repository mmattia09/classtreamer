import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { getActiveQuestion, getCurrentStreamStatus, getResultsForQuestion } from "@/lib/questions";

export async function GET() {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const stream = await getCurrentStreamStatus();
  const question = await getActiveQuestion();

  return NextResponse.json({
    stream,
    question,
    results: question ? await getResultsForQuestion(question.id) : null,
  });
}
