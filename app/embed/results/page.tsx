import { ResultsEmbedClient } from "@/components/stream/results-embed-client";
import { getActiveQuestion, getResultsForQuestion } from "@/lib/questions";

export const dynamic = "force-dynamic";

export default async function EmbedResultsPage() {
  const question = await getActiveQuestion();
  const results = question ? await getResultsForQuestion(question.id) : null;

  return <ResultsEmbedClient initialQuestion={question} initialResults={results} />;
}
