export type StreamStatusResponse =
  | { status: "no_stream" }
  | { status: "scheduled"; embedUrl?: string; streamId: string; title: string; scheduledAt?: string | null }
  | { status: "live"; embedUrl: string; streamId: string; title: string; liveStartedAt?: string | null };

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
  percentage?: number;
};

export type AnswerSubmission = {
  id: string;
  value: string;
  classLabel?: string | null;
  createdAt?: string;
};

export type ResultsPayload = {
  questionId: string;
  type: QuestionPayload["inputType"];
  questionText?: string;
  totalAnswers: number;
  entries: ResultEntry[];
  latestAnswers?: string[];
  latestSubmissions?: AnswerSubmission[];
  average?: number | null;
  scale?: {
    min: number;
    max: number;
    step: number;
  };
};

export type ViewerQuestionPayload = {
  id: string;
  streamId: string | null;
  streamTitle: string | null;
  text: string;
  classYear: number | null;
  classSection: string | null;
  createdAt: string;
};

export type StoredEmbedState =
  | {
      kind: "none";
    }
  | {
      kind: "question";
      questionId: string;
      selectedAnswerIds?: string[];
      featuredAnswerId?: string | null;
    }
  | {
      kind: "viewer-question";
      viewerQuestionId: string;
    };

export type EmbedPayload =
  | {
      kind: "none";
    }
  | {
      kind: "question";
      question: QuestionPayload;
      results: ResultsPayload;
      featuredAnswerId?: string | null;
      selectedAnswerIds?: string[];
    }
  | {
      kind: "viewer-question";
      viewerQuestion: ViewerQuestionPayload;
    };
