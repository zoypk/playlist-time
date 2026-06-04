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
