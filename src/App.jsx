import { useState } from "react";
import AuthPage from "./AuthPage";
import ProfilePage from "./ProfilePage";

import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Dumbbell,
  LockKeyhole,
  Mail,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";

const workoutBlocks = [
  ["Warm-up", "8 min mobility", "Shoulders, hips, light cardio"],
  ["Strength", "4 exercises", "Dumbbell press, rows, split squats"],
  ["Technique", "Form focus", "Controlled tempo and full range"],
  ["Cooldown", "6 min recovery", "Breathing and hamstring stretch"],
];

const macroItems = [
  ["Protein", "145g", "On target", "protein"],
  ["Carbs", "210g", "32g left", "carbs"],
  ["Water", "2.1L", "900ml left", "water"],
];

const goals = [
  ["Workout streak", "4 days", "consistency"],
  ["Weekly volume", "+8%", "progression"],
  ["Sleep score", "78", "recovery"],
];

function Header({ activeView, onShowHome, onShowLogin, onShowProfile }) {
  return (
    <header className="topbar">
     <button className="brand brandButton" type="button" onClick={onShowHome}>
        <span className="brandMark">GX</span>
        <span>GymXP</span>
      </button>

      <nav className="navTabs" aria-label="Main navigation">
         <button
          className={activeView === "home" ? "active" : ""}
          type="button"
          onClick={onShowHome}
        >
          Today
        </button>
        <button type="button">Progress</button>
        <button type="button">Nutrition</button>
        <button
          className={activeView === "profile" ? "active" : ""}
          type="button"
          onClick={onShowProfile}
        >
          Profile
        </button>
      </nav>

      <button
        className={`profileChip loginChip ${
          activeView === "login" ? "active" : ""
        }`}
        type="button"
        onClick={onShowLogin}
      >
        <span className="avatar">GX</span>
        <span>Sign in</span>
      </button>
    </header>
  );
}

function TodayPlan() {
  return (
    <section className="panel planPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">AI workout preview</p>
          <h1>Upper body foundations</h1>
        </div>
        <span className="statusPill">Adapted today</span>
      </div>

      <div className="heroMedia">
        <img
          src="https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1100&q=80"
          alt="Person training with dumbbells"
        />
        <div className="heroOverlay">
          <strong>45 min</strong>
          <span>Dumbbells + bench</span>
        </div>
      </div>

      <div className="planMeta">
        <span>
          <Target size={18} /> Build strength
        </span>
        <span>
          <Activity size={18} /> Beginner-safe
        </span>
        <span>
          <ShieldCheck size={18} /> Knee friendly
        </span>
      </div>

      <div className="actionRow">
        <button className="primaryBtn" type="button">
          <Play size={18} /> <span>Start plan</span>
        </button>
        <button className="secondaryBtn" type="button">
          <SlidersHorizontal size={18} /> <span>Adjust</span>
        </button>
      </div>
    </section>
  );
}

function WorkoutList() {
  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>Workout flow</h2>
        <span>Today</span>
      </div>

      <div className="workoutList">
        {workoutBlocks.map(([title, metric, detail], index) => (
          <article className="workoutItem" key={title}>
            <span className="stepNumber">0{index + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{detail}</p>
            </div>
            <strong>{metric}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function CoachNote() {
  return (
    <section className="coachPanel">
      <div className="coachIcon">
        <Sparkles size={24} />
      </div>
      <div>
        <h2>Why this plan</h2>
        <p>
          Intensity is moderate because yesterday&apos;s leg session was marked
          difficult and sleep was below target. Pressing volume stays high while
          knee load stays low.
        </p>
      </div>
    </section>
  );
}

function StatStrip() {
  return (
    <section className="statStrip" aria-label="Progress summary">
      {goals.map(([label, value, tone]) => (
        <article className={`stat ${tone}`} key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

function NutritionPanel() {
  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>Nutrition targets</h2>
        <span>Daily</span>
      </div>

      <div className="macroList">
        {macroItems.map(([label, value, helper, type]) => (
          <div className="macroRow" key={label}>
            <span className={`macroDot ${type}`} />
            <div>
              <strong>{label}</strong>
              <small>{helper}</small>
            </div>
            <b>{value}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfilePanel({ onShowProfile }) {
  return (
    <section className="panel profilePanel">
      <div className="sectionTitle">
        <h2>Goal profile</h2>
        <button className="textButton" type="button" onClick={onShowProfile}>
          Edit
        </button>
      </div>

      <div className="goalMeter">
        <div className="ring">68%</div>
        <div>
          <strong>Lean muscle</strong>
          <p>
            4 workouts weekly, home or gym equipment, avoid high-impact knee
            movements.
          </p>
        </div>
      </div>

      <div className="tags">
        <span>Home + gym</span>
        <span>High protein</span>
        <span>45 min sessions</span>
      </div>
    </section>
  );
}

function App() {
  const [activeView, setActiveView] = useState("home");
  const showHome = () => setActiveView("home");
  const showLogin = () => setActiveView("login");
  const showProfile = () => setActiveView("profile");

  let mainContent;
  if (activeView === "login") {
    // Links to AuthPage.jsx, which holds the login form and logic.
    mainContent = <AuthPage onShowHome={showHome} />;
  } else if (activeView === "profile") {
    mainContent = <ProfilePage onShowLogin={showLogin} />;
  } else {
    mainContent = (
      <div className="dashboard">
        <div className="mainColumn">
          <div className="welcome">
            <p className="eyebrow">Sprint 1 Demo</p>
            <h1>Good morning, William</h1>
            <p>
              Your plan is balanced around goals, equipment, recovery, and
              recent workout feedback.
            </p>
          </div>

          <TodayPlan />
          <WorkoutList />
        </div>

        <aside className="sideColumn">
          <StatStrip />
          <CoachNote />
          <ProfilePanel onShowProfile={showProfile} />
          <NutritionPanel />
        </aside>
      </div>
    );
  }

  return (
    <main className="appShell">
      <Header
        activeView={activeView}
        onShowHome={showHome}
        onShowLogin={showLogin}
        onShowProfile={showProfile}
      />
      {mainContent}
    </main>
  );
}

export default App;
