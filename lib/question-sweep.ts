import "server-only";

import { createLogger } from "@/lib/logger";
import { closeExpiredQuestions } from "@/lib/questions";

const log = createLogger("question-sweep");

/**
 * How often expired questions are swept. This is state hygiene, not a security
 * boundary: the answer endpoint already rejects late submissions with 410 and
 * the clients hide the form when their countdown reaches zero, so a few seconds
 * of lag closes nothing that was still open to answers.
 */
const SWEEP_INTERVAL_MS = 5_000;

type GlobalWithSweep = typeof globalThis & {
  __questionSweep?: ReturnType<typeof setInterval>;
};

/**
 * Runs the sweep on a timer from the server process, which is the single place
 * that closes questions. Previously every read did it, so one expiry produced a
 * write and a broadcast per connected client.
 */
export function startExpiredQuestionSweep() {
  const globalForSweep = globalThis as GlobalWithSweep;

  // Guard against double registration across hot reloads in development.
  if (globalForSweep.__questionSweep) {
    return;
  }

  const timer = setInterval(() => {
    void closeExpiredQuestions().catch((error) => {
      // Never let a failed sweep take down the process; the next tick retries.
      log.error("Chiusura delle domande scadute non riuscita", error);
    });
  }, SWEEP_INTERVAL_MS);

  // Do not keep the process alive just for this.
  timer.unref?.();

  globalForSweep.__questionSweep = timer;
  log.info("Sweep delle domande scadute avviato", { intervalMs: SWEEP_INTERVAL_MS });
}
