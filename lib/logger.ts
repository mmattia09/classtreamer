/**
 * Minimal structured logger.
 *
 * Several failures used to be swallowed by a bare `catch {}` — Redis going
 * down, the overlay state failing to load — because the app is designed to
 * degrade rather than break. Degrading silently is right for the user and
 * wrong for whoever is running the assembly: this keeps the behaviour and
 * makes the cause visible.
 *
 * One JSON object per line, so `docker compose logs` stays greppable and a log
 * collector can parse it without a format to configure.
 */

type Level = "debug" | "info" | "warn" | "error";

type Fields = Record<string, unknown>;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function activeLevel(): Level {
  const configured = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (configured && configured in LEVELS) {
    return configured as Level;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

/** Errors do not survive JSON.stringify, so they are unwrapped by hand. */
function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      error: error.message,
      errorName: error.name,
      // The stack is noise in production logs but invaluable in development.
      ...(process.env.NODE_ENV === "production" ? {} : { stack: error.stack }),
    };
  }
  if (error === undefined) return {};
  return { error: String(error) };
}

function emit(level: Level, scope: string, message: string, fields?: Fields, error?: unknown) {
  if (LEVELS[level] < LEVELS[activeLevel()]) return;

  const entry = {
    level,
    scope,
    message,
    time: new Date().toISOString(),
    ...fields,
    ...describeError(error),
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * A logger bound to one area of the app, so entries can be filtered by scope:
 * `docker compose logs app | grep '"scope":"redis"'`.
 */
export function createLogger(scope: string) {
  return {
    debug: (message: string, fields?: Fields) => emit("debug", scope, message, fields),
    info: (message: string, fields?: Fields) => emit("info", scope, message, fields),
    warn: (message: string, fields?: Fields, error?: unknown) =>
      emit("warn", scope, message, fields, error),
    error: (message: string, error?: unknown, fields?: Fields) =>
      emit("error", scope, message, fields, error),
  };
}

export type Logger = ReturnType<typeof createLogger>;
