import { NextResponse } from "next/server";

import { getActiveQuestion, getCurrentStreamStatus, getResultsForQuestion } from "@/lib/questions";

export async function GET() {
  const stream = await getCurrentStreamStatus();
  const question = await getActiveQuestion();

  return NextResponse.json({
    stream,
    question,
    results: question ? await getResultsForQuestion(question.id) : null,
  });
}
