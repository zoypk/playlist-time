/**
 * Centralized configuration and constants for the yttime application.
 * Single source of truth for magic numbers, strings, and other configuration values.
 */

/** Storage key for persisted UI state (sorting, ranges, preferences) */
export const STORAGE_KEY = "yttime:v1";

/** Storage key for playlist cache data */
export const PLAYLIST_CACHE_KEY = "yttime:playlist-cache:v1";

/**
 * Client-side cache TTL for playlist metadata.
 * After this duration, cached data is considered stale and refreshed from API.
 * Currently 5 minutes.
 */
export const CLIENT_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Query staleness time for React Query.
 * Data is considered fresh for this duration; if exceeded, background refetch triggered.
 * Currently 5 minutes.
 */
export const QUERY_STALE_TIME_MS = 1000 * 60 * 5;

/**
 * Query cache time for React Query.
 * Cache persists in memory for this duration; if exceeded, garbage collected.
 * Currently 1 hour.
 */
export const QUERY_CACHE_TIME_MS = 1000 * 60 * 60;

/**
 * Built-in playback speed presets offered to users.
 * Selected speeds chosen for common viewing scenarios (commute, background, study).
 * Users can also input custom speeds between 0.1 and 3.0x.
 */
export const BUILT_IN_SPEEDS = [1, 1.25, 1.5, 1.75, 2] as const;

/**
 * Column definitions for playback speed metrics in the playlist table.
 * Maps each built-in speed to a column with label and display format.
 */
export const SPEED_COLUMNS = BUILT_IN_SPEEDS.map((speed) => ({
  id: `speed_${String(speed).replace(".", "_")}`,
  label: `${speed.toFixed(2)}x`,
  speed,
}));

/** Default sorting configuration when no sort preference persisted */
export const DEFAULT_SORTING = [{ id: "speed_1", desc: true }];

/**
 * Debounce duration for localStorage writes.
 * Prevents excessive storage transactions during rapid state changes.
 * Currently 1000ms (1 second).
 */
export const STORAGE_DEBOUNCE_MS = 1000;

/**
 * Maximum debounce duration for localStorage writes.
 * Ensures state persists within reasonable time even during continuous activity.
 * Currently 10000ms (10 seconds).
 */
export const STORAGE_MAX_WAIT_MS = 10000;
