import { ResultsEmbedClient } from "@/components/stream/results-embed-client";
import { resolveEmbedPayload } from "@/lib/embed-state";

export const dynamic = "force-dynamic";

export default async function EmbedResultsPage() {
  const embed = await resolveEmbedPayload();

  return <ResultsEmbedClient initialEmbed={embed} />;
}
