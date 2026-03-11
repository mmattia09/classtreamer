import { NextResponse } from "next/server";

import { getActiveQuestion, getResultsForQuestion } from "@/lib/questions";

export async function GET() {
  const question = await getActiveQuestion();
  if (!question) {
    return NextResponse.json({ question: null, results: null });
  }

  return NextResponse.json({
    question,
    results: await getResultsForQuestion(question.id),
  });
}
