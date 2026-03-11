import { AnswerPageClient } from "@/components/answer-page-client";
import { buildAppConfig } from "@/lib/app-config";
import { getActiveQuestion } from "@/lib/questions";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AnswerPage() {
  const question = await getActiveQuestion();
  const settings = await getAppSettings();
  const { name } = buildAppConfig(settings);

  return (
    <AnswerPageClient
      initialQuestion={question?.audienceType === "INDIVIDUAL" ? question : null}
      appName={name}
    />
  );
}
