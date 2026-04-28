import RevealWrapper from "./RevealWrapper";

const TRAINING_PATHS = [
  {
    label: "Indoor",
    title: "Weather-proof courts",
    body: "Dallas Indoor Pickleball Club or The Grove when you want a controlled court and no weather guessing.",
    meta: "Court reservation fees may apply",
  },
  {
    label: "Outdoor",
    title: "Public courts, no court fee",
    body: "Free public courts across DFW are available when weather, court traffic, and location line up.",
    meta: "Exact court confirmed after booking",
  },
  {
    label: "Flexible",
    title: "Mario helps you choose",
    body: "Not sure where to train? Pick a lesson time and Mario will recommend the best court for your goals.",
    meta: "Best for first-time students",
  },
];

export default function WhereWeTrain() {
  return (
    <section className="block train-section" id="locations">
      <RevealWrapper>
        <div className="kicker">Where We Train</div>
        <h2 className="section-title">
          Pick the <span className="italic">court setup.</span>
        </h2>
        <p className="section-sub">
          Reserve the lesson time first. Mario confirms the exact court after booking based on your preference, court availability, weather, and any court fee.
        </p>
      </RevealWrapper>
      <RevealWrapper delay={100}>
        <div className="train-options">
          {TRAINING_PATHS.map((path) => (
            <div className="train-card" key={path.label}>
              <div className="train-label">{path.label}</div>
              <h3>{path.title}</h3>
              <p>{path.body}</p>
              <span>{path.meta}</span>
            </div>
          ))}
        </div>
        <div className="train-details">
          <p>
            Outdoor sessions are available across public courts including W.J. Thomas, Churchill, Euless Family Life Center, Lochwood, Casa Linda, Lake Highlands North, Campbell Green, and Davidson Park.
          </p>
          <p>
            Samuel-Grand and Life Time are handled by request when reservation, membership, and venue rules line up.
          </p>
        </div>
      </RevealWrapper>
    </section>
  );
}
