import RevealWrapper from "./RevealWrapper";
import { CLIPS } from "@/lib/videos";

/**
 * Clips tied to the concept each one teaches, not a generic video gallery.
 * Nothing downloads until a visitor taps: preload="none" plus a poster frame.
 */
export default function FilmRoom() {
  if (CLIPS.length === 0) return null;

  return (
    <section className="block filmroom" id="filmroom">
      <RevealWrapper>
        <div className="kicker">Film Room</div>
        <h2 className="section-title">
          See the shot
          <br />
          <span className="italic">before you hit it.</span>
        </h2>
        <p className="section-sub">
          The shots we work on, and exactly what to watch for in each one.
        </p>
      </RevealWrapper>
      <div className="clip-grid">
        {CLIPS.map((clip) => (
          <figure className="clip" key={clip.id}>
            <video
              src={clip.src}
              poster={clip.poster}
              preload="none"
              playsInline
              muted
              controls
            />
            <figcaption>
              <span className="clip-concept">{clip.concept}</span>
              <span className="clip-watch">{clip.watchFor}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
