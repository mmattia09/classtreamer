import "server-only";

import { createLogger } from "@/lib/logger";
import { getResultsForQuestion } from "@/lib/questions";
import { broadcast, broadcastToAdmins } from "@/lib/socket-bridge";

const log = createLogger("results-broadcast");

/**
 * Coalesced publishing of question results.
 *
 * Every submitted answer used to recompute the full result set (reading every
 * answer row for the question) and broadcast it to every connected client. With
 * a class answering at once that is quadratic in the number of answers, and the
 * payload — which carries the text of every submission — was sent to students
 * too, before the teacher had revealed anything.
 *
 * Now a burst of answers produces at most one recompute per window, students
 * get only the counter they actually render, and the full payload goes to the
 * admin room.
 */

const THROTTLE_MS = 500;

type Pending = {
  timer: ReturnType<typeof setTimeout> | null;
  /** An answer arrived while the window was open. */
  queued: boolean;
};

const pending = new Map<string, Pending>();

async function publish(questionId: string) {
  const results = await getResultsForQuestion(questionId);
  if (!results) return;

  // Two distinct events rather than one filtered by room: admins receive the
  // global emit as well, so sharing a name would have them overwrite the full
  // payload with the summary. Students render the counter; the OBS overlay only
  // needs the nudge to refetch.
  broadcast("results:count", {
    questionId: results.questionId,
    totalAnswers: results.totalAnswers,
  });
  broadcastToAdmins("results:update", results);
}

/**
 * Publish now if the question has been quiet, otherwise fold this answer into
 * the pending window. Leading edge keeps the first answer feeling instant.
 */
export async function publishResultsThrottled(questionId: string) {
  const existing = pending.get(questionId);

  if (existing) {
    existing.queued = true;
    return;
  }

  const entry: Pending = { timer: null, queued: false };
  pending.set(questionId, entry);

  await publish(questionId).catch((error) => {
    // A failed broadcast must not fail the student's submission: the answer is
    // already stored, only the live update is lost.
    log.error("Pubblicazione dei risultati non riuscita", error, { questionId });
  });

  entry.timer = setTimeout(() => {
    const current = pending.get(questionId);
    pending.delete(questionId);
    if (current?.queued) {
      void publish(questionId).catch((error) => {
        log.error("Pubblicazione differita non riuscita", error, { questionId });
      });
    }
  }, THROTTLE_MS);

  // Do not hold the process open for a pending broadcast.
  entry.timer.unref?.();
}

/** Publish immediately, bypassing the window — for admin actions. */
export async function publishResultsNow(questionId: string) {
  const existing = pending.get(questionId);
  if (existing?.timer) {
    clearTimeout(existing.timer);
  }
  pending.delete(questionId);
  await publish(questionId);
}
