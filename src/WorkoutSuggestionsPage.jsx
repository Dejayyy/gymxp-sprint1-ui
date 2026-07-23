import React, { useState } from 'react';

/* ------------------------------------------------------------------ */
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

const API_BASE = "http://localhost:8000";
function WorkoutSuggestionsPage({ onShowLogin }) {

  const [user, setUser] = useState({user_id: 59});
  //const [wo_data, setData] = useState(null);

  const [prediction1, setPrediction1] = useState(["Awaiting", "Generation"]);
  const [prediction2, setPrediction2] = useState(["Awaiting", "Generation"]);
  const [prediction3, setPrediction3] = useState(["Awaiting", "Generation"]);

  const [fName, setfName] = useState("Awaiting Generation");
  const [lName, setlName] = useState("Awaiting Generation");
  const [goal, setGoal] = useState("Awaiting Generation");
  const [exp, setExp] = useState("Awaiting Generation");
  const [con, setCon] = useState("Awaiting Generation");
  const [recovery, setRecovery] = useState("Awaiting Generation")
  const [equipment, setEquipment] = useState("Awaiting Generation")
  const [time, setTime] = useState("Awaiting Generation")
  const [time1, setTime1] = useState("Awaiting Generation")
  const [time2, setTime2] =  useState("Awaiting Generation")
  const [time3, setTime3]  = useState("Awaiting Generation")
  const [focus1, setFocus1] =  useState("Awaiting Generation")
  const [focus2, setFocus2]  = useState("Awaiting Generation")
  const [wo_intensity, setIntensity]  = useState("Awaiting Generation")

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const suggestions = [
  {
    title: "Workout 1",
    match: "94%",
    duration: time1,
    intensity: wo_intensity,
    focus: focus1 + " " + focus2,
    reason: "Best fit for your strength goal with low knee load and gym equipment available.",
    moves: prediction1,
    tone: "progression",
  },
  {
    title: "Workout 2",
    match: "88%",
    duration: time2,
    intensity: wo_intensity,
    focus: focus1 + " " + focus2,
    reason: "Keeps weekly volume moving while leaving recovery room after your last hard session.",
    moves: prediction2,
    tone: "consistency",
  },
  {
    title: "Workout 3",
    match: "82%",
    duration: time3,
    intensity: wo_intensity,
    focus: focus1 + " " + focus2,
    reason: "Useful when soreness is high or sleep drops below target.",
    moves: prediction3,
    tone: "recovery",
  },
  ];

  const modelInputs = [
  ["Goal", goal],
  ["Experience", exp],
  ["Equipment", equipment],
  ["Session", time],
  ["Constraints", con],
  ["Recovery", recovery],
  ];

  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: parseInt(e.target.value) || 0 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/predict-workout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });

      if (!response.ok) {
        throw new Error(`Server returned status code: ${response.status}`);
      }

      const result = await response.json();
      console.log(result);
      //setPrediction(result);
      setPrediction1(result.wo1);
      setPrediction2(result.wo2);
      setPrediction3(result.wo3);
      
      setfName(result.first_name);
      setlName(result.last_name);
      setGoal(result.goal);
      setExp(result.experience_level);
      setCon(result.constraints);
      setRecovery(result.recovery);
      setEquipment(result.equipment);
      setTime(result.time);
      setTime1(result.time1);
      setTime2(result.time2);
      setTime3(result.time3);
      setFocus1(result.focus1);
      setFocus2(result.focus2);
      setIntensity(result.wo_intensity);

    } catch (err) {
      setError(err.message || "Failed to communicate with the ML server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workoutSuggestionsPage">
      <section className="panel suggestionsHero">
        <div className="suggestionsHeroText">
          <p className="eyebrow">ML workout suggestions</p>
          <h1>Recommended sessions for your next workout</h1>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <label>
              User ID:
              <input type="number" name="user_id" value={user.user_id} onChange={handleChange} style={{ width: '100%', padding: '8px' }} />
            </label>
            <button type="submit" disabled={loading} style={{ padding: '10px', cursor: 'pointer', background: '#007BFF', color: '#fff', border: 'none' }}>
              {loading ? 'Calculating...' : 'Workout Suggestion'}
            </button>
          </form>
          <div className="actionRow">
            <button className="primaryBtn" type="button" onClick={handleSubmit}>
              <Sparkles size={18} />
              <span>Use top suggestion</span>
            </button>
            <button className="secondaryBtn" type="button">
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
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
