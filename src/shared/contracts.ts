/**
 * Playlist payload returned by backend APIs and consumed by the frontend.
 */
export type PlaylistDto = {
  playlistId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  totalVideoViewsSum: number;
  orderedDurationsSec: number[];
};
