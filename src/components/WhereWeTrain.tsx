import RevealWrapper from "./RevealWrapper";

const TRAINING_PATHS = [
  {
    label: "Indoor",
    title: "Partner-platform courts",
    body: "Dallas Indoor, The Grove, Life Time, TeachMe.To, and Samuel-Grand each keep their required booking path.",
    meta: "We route you to the right system",
  },
  {
    label: "Outdoor",
    title: "Public courts, direct booking",
    body: "Free public courts across DFW are the simplest path when weather, court traffic, and location line up.",
    meta: "Schedule the lesson time here",
  },
  {
    label: "Flexible",
    title: "Mario helps you choose",
    body: "Not sure where to train? Pick a lesson time and Mario will recommend the cleanest court or platform path.",
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
          Choose the route that fits your court. Public courts book here; indoor
          clubs and marketplaces stay inside their required reservation systems.
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
            Dallas Indoor and The Grove use PodPlay, Life Time uses its member
            booking system, TeachMe.To stays on TeachMe.To, and Samuel-Grand
            court reservations go through Impact Activities.
          </p>
        </div>
      </RevealWrapper>
    </section>
  );
}
