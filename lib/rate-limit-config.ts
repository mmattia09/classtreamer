/**
 * Per-IP flood guards.
 *
 * Everything the students do is rate limited per device, because a school NATs
 * every phone behind one public address. These per-IP limits exist only to bound
 * a script hammering the endpoint, so they have to sit well above what a real
 * assembly produces: a 1000-student school answering a question all at once is
 * 1000 requests from a single address within a few seconds.
 *
 * They are configurable because "how big is your school" is not something the
 * code can know. A load test with 500 students behind one address hit the
 * previous hard-coded 300-per-10s guard and 200 of them were rejected.
 */

function readLimit(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name]?.trim() ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Answers accepted from one address per window. Default fits ~3000 students. */
export function getAnswerIpLimit() {
  return readLimit("ANSWER_IP_RATE_LIMIT", 3000);
}

export const ANSWER_IP_WINDOW_SECONDS = 10;

/** Audience questions accepted from one address per window. */
export function getAudienceQuestionIpLimit() {
  return readLimit("AUDIENCE_QUESTION_IP_RATE_LIMIT", 600);
}

export const AUDIENCE_QUESTION_IP_WINDOW_SECONDS = 60;
