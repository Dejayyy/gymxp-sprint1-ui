import React from "react";
import {
  Activity,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Dumbbell,
  Flame,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

const suggestions = [
  {
    title: "Upper Push Strength",
    match: "94%",
    duration: "45 min",
    intensity: "Moderate",
    focus: "Chest, shoulders, triceps",
    reason: "Best fit for your strength goal with low knee load and gym equipment available.",
    moves: ["Dumbbell bench press", "Seated shoulder press", "Cable fly", "Rope pushdown"],
    tone: "progression",
  },
  {
    title: "Full Body Foundation",
    match: "88%",
    duration: "40 min",
    intensity: "Balanced",
    focus: "Total body technique",
    reason: "Keeps weekly volume moving while leaving recovery room after your last hard session.",
    moves: ["Goblet squat", "Incline row", "Romanian deadlift", "Plank hold"],
    tone: "consistency",
  },
  {
    title: "Recovery Conditioning",
    match: "82%",
    duration: "30 min",
    intensity: "Light",
    focus: "Mobility and cardio",
    reason: "Useful when soreness is high or sleep drops below target.",
    moves: ["Bike intervals", "Hip mobility", "Band pull-aparts", "Breathing cooldown"],
    tone: "recovery",
  },
];

const modelInputs = [
  ["Goal", "Lean muscle"],
  ["Experience", "Beginner"],
  ["Equipment", "Home + gym"],
  ["Session", "45 min"],
  ["Constraints", "Knee friendly"],
  ["Recovery", "Moderate"],
];

function WorkoutSuggestionsPage() {
  return (
    <div className="workoutSuggestionsPage">
      <section className="panel suggestionsHero">
        <div className="suggestionsHeroText">
          <p className="eyebrow">ML workout suggestions</p>
          <h1>Recommended sessions for your next workout</h1>
          <p>
            This page is ready for the model output. For now, the interface shows
            polished sample recommendations based on profile, equipment, goals,
            and recent training feedback.
          </p>

          <div className="actionRow">
            <button className="primaryBtn" type="button">
              <Sparkles size={18} />
              <span>Use top suggestion</span>
            </button>
            <button className="secondaryBtn" type="button">
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="modelCard" aria-label="Model readiness">
          <span className="modelIcon">
            <BrainCircuit size={28} />
          </span>
          <strong>Model endpoint pending</strong>
          <div className="modelScore">
            <span>Confidence preview</span>
            <b>94%</b>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="sectionTitle">
          <h2>Ranking inputs</h2>
          <span>Profile based</span>
        </div>

        <div className="inputSummaryGrid">
          {modelInputs.map(([label, value]) => (
            <article className="inputSummary" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="suggestionGrid">
        {suggestions.map((suggestion, index) => (
          <article className="panel suggestionCard" key={suggestion.title}>
            <div className="suggestionHead">
              <span className={`stepNumber ${suggestion.tone}`}>0{index + 1}</span>
              <div>
                <p className="eyebrow">Suggestion {index + 1}</p>
                <h2>{suggestion.title}</h2>
              </div>
              <span className="statusPill">{suggestion.match} match</span>
            </div>

            <div className="suggestionMeta">
              <span>
                <CalendarClock size={17} /> {suggestion.duration}
              </span>
              <span>
                <Flame size={17} /> {suggestion.intensity}
              </span>
              <span>
                <Target size={17} /> {suggestion.focus}
              </span>
            </div>

            <p className="suggestionReason">{suggestion.reason}</p>

            <div className="exercisePreview">
              {suggestion.moves.map((move) => (
                <span key={move}>
                  <CheckCircle2 size={16} />
                  {move}
                </span>
              ))}
            </div>

            <div className="suggestionActions">
              <button className="primaryBtn" type="button">
                <Dumbbell size={18} />
                <span>Select workout</span>
              </button>
              <button className="secondaryBtn iconOnlyBtn" type="button" aria-label="View workout details">
                <Activity size={18} />
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="coachPanel">
        <div className="coachIcon">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h2>How suggestions will adapt</h2>
          <p>
            Once the model is connected, these cards can be populated from
            ranked predictions using goals, equipment, workout history,
            constraints, and recovery signals.
          </p>
        </div>
      </section>
    </div>
  );
}

export default WorkoutSuggestionsPage;
