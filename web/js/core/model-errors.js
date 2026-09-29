/** @typedef {'cancelled'|'offline'|'blocked'|'load_failed'|'run_failed'} ModelFailureCategory */

/**
 * @param {unknown} err
 * @param {'load'|'run'} phase
 * @returns {{ category: ModelFailureCategory, detail: string }}
 */
export function classifyModelFailure(err, phase = "load") {
  const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
  const lower = message.toLowerCase();

  if (lower.includes("cancel")) {
    return { category: "cancelled", detail: message };
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network error") ||
    lower.includes("offline") ||
    lower.includes("err_internet_disconnected")
  ) {
    return { category: "offline", detail: message };
  }
  if (
    lower.includes("content security policy") ||
    lower.includes("csp") ||
    lower.includes("refused to connect") ||
    lower.includes("blocked by")
  ) {
    return { category: "blocked", detail: message };
  }
  if (phase === "load") {
    return { category: "load_failed", detail: message };
  }
  return { category: "run_failed", detail: message };
}

/**
 * @param {ModelFailureCategory} category
 * @param {(key: string, vars?: Record<string, string|number>) => string} t
 */
export function modelFailureMessage(category, t) {
  const key = `model_error_${category}`;
  return t(key);
}
