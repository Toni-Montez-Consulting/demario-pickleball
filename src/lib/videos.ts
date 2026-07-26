export interface Clip {
  id: string;
  /** The coaching concept the clip demonstrates. */
  concept: string;
  /** One line telling the viewer what to look for. */
  watchFor: string;
  /** MP4 under public/video/ */
  src: string;
  /** Poster frame under public/img/ */
  poster: string;
}

/**
 * Curated by hand. The Film Room section hides itself entirely while this is
 * empty, so the homepage is unchanged until DeMario sends his clips.
 *
 * Self-hosted rather than Instagram-embedded: the embed script blocks render,
 * pulls third-party cookies into the consent banner, and the clips vanish if a
 * post is deleted or archived.
 *
 * Example entry once files land in public/video/:
 *
 *   {
 *     id: "third-shot-drop",
 *     concept: "The third-shot drop",
 *     watchFor: "Paddle face stays open and the contact point is out front.",
 *     src: "/video/third-shot-drop.mp4",
 *     poster: "/img/third-shot-drop.jpg",
 *   }
 */
export const CLIPS: Clip[] = [];
