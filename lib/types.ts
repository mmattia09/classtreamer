export type StreamStatusResponse =
  | { status: "no_stream" }
  | { status: "scheduled"; embedUrl?: string; streamId: string; title: string; scheduledAt?: string | null }
  | { status: "live"; embedUrl: string; streamId: string; title: string };

export type QuestionPayload = {
  id: string;
  text: string;
  inputType: "OPEN" | "WORD_COUNT" | "SCALE" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  audienceType: "CLASS" | "INDIVIDUAL";
  options?: string[];
  settings?: Record<string, number>;
  timerSeconds?: number | null;
  openedAt?: string | null;
  resultsVisible: boolean;
  streamId: string;
};

export type ResultEntry = {
  label: string;
  value: number;
};

export type AnswerSubmission = {
  value: string;
  classLabel?: string | null;
};

export type ResultsPayload = {
  questionId: string;
  type: QuestionPayload["inputType"];
  totalAnswers: number;
  entries: ResultEntry[];
  latestAnswers?: string[];
  latestSubmissions?: AnswerSubmission[];
};
