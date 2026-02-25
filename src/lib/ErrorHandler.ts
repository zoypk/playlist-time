/**
 * Centralized error handling and classification system.
 * Single source of truth for error types, categorization, and user-friendly messaging.
 */

/** Discriminated union of possible error categories */
export type ErrorCategory = "invalid" | "unavailable" | "quota" | "network" | "unknown";

/** Map of error categories to user-friendly messages */
const ERROR_MESSAGES: Record<ErrorCategory, string> = {
  invalid: "Invalid playlist URL or ID.",
  unavailable: "Playlist is private, deleted, or unavailable.",
  quota: "YouTube API quota exceeded. Try again in a bit.",
  network: "Network/server error while fetching playlist.",
  unknown: "Unexpected error while loading this playlist."
};

/** Map of error categories to badge display labels */
const ERROR_BADGE_LABELS: Record<ErrorCategory, string> = {
  invalid: "Invalid URL/ID",
  unavailable: "Private/Unavailable",
  quota: "API quota/rate",
  network: "Network",
  unknown: "Error"
};

/**
 * Classifies HTTP status codes and error messages into error categories.
 * Uses both status code and message text for more accurate classification.
 *
 * @param status - HTTP status code from failed request
 * @param message - Error message text (usually from API or exception)
 * @returns {ErrorCategory} Classified error category
 *
 * @example
 * classifyRowError(400, "Invalid playlist ID") // → "invalid"
 * classifyRowError(404, "Not found") // → "unavailable"
 * classifyRowError(429, "Too many requests") // → "quota"
 * classifyRowError(500, "Internal server error") // → "network"
 */
export function classifyRowError(status: number, message: string): ErrorCategory {
  const normalized = message.toLowerCase();

  // 400 Bad Request → usually invalid input
  if (status === 400 || normalized.includes("invalid")) {
    return "invalid";
  }

  // 404 Not Found or mentions of privacy/deletion → unavailable
  if (status === 404 || normalized.includes("notfound") || normalized.includes("private")) {
    return "unavailable";
  }

  // 429 Too Many Requests or 403 Forbidden → rate limiting/quota
  if (status === 429 || status === 403 || normalized.includes("quota") || normalized.includes("limit")) {
    return "quota";
  }

  // 5xx or network errors → network issues
  if (status >= 500 || normalized.includes("network") || normalized.includes("timeout")) {
    return "network";
  }

  // Default to unknown
  return "unknown";
}

/**
 * Gets user-friendly error message for a given error category.
 * Optionally falls back to a custom message if desired.
 *
 * @param category - Error category from classification
 * @param fallback - Optional custom fallback message
 * @returns {string} User-friendly error message
 */
export function getFriendlyError(category: ErrorCategory, fallback?: string): string {
  return ERROR_MESSAGES[category] || fallback || ERROR_MESSAGES.unknown;
}

/**
 * Gets the badge label for displaying error category in UI.
 *
 * @param category - Error category
 * @returns {string} Badge label text
 */
export function getErrorBadgeLabel(category: ErrorCategory): string {
  return ERROR_BADGE_LABELS[category] || "Error";
}

/**
 * Sanitizes error messages for display to client.
 * Hides sensitive API details and returns public-safe error text.
 *
 * @param status - HTTP status code
 * @param reason - Error reason/category
 * @returns {string} Sanitized user-facing error message
 */
export function getPublicErrorMessage(status: number, reason: string): string {
  if (status === 404 || reason.includes("notfound")) {
    return "Playlist not found or is private.";
  }
  if (status === 403 || status === 429) {
    return "Too many requests. Please try again in a few moments.";
  }
  if (status >= 500) {
    return "Server error. Please try again later.";
  }
  return "Unable to fetch playlist. Please check the URL and try again.";
}
