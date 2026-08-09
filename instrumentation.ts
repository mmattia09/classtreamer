/**
 * Runs once when a server instance boots.
 *
 * Used to start the sweep that closes questions whose timer has expired. It
 * lives here rather than in server.js because that file is CommonJS and loads
 * before Next, so it cannot import the TypeScript modules that reach the
 * database.
 */
export async function register() {
  // Also evaluated for the edge runtime, which has no database access.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startExpiredQuestionSweep } = await import("@/lib/question-sweep");
  startExpiredQuestionSweep();
}
