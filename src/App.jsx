import { useState } from "react";
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

function Header({ activeView, onShowHome, onShowLogin }) {
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
        <button type="button">Profile</button>
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

function ProfilePanel() {
  return (
    <section className="panel profilePanel">
      <div className="sectionTitle">
        <h2>Goal profile</h2>
        <span>Active</span>
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

function LoginPage({ onShowHome }) {
  return (
    <section className="loginPage" aria-label="GymXP sign in">
      <div className="loginStory">
        <img
          src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80"
          alt="Athlete training with battle ropes"
        />
        <div className="loginStoryContent">
          <p className="eyebrow">AI workout intelligence</p>
          <h1>Train with a plan that adapts before you stall.</h1>
          <div className="loginMetrics" aria-label="Training highlights">
            <span>
              <strong>45m</strong>
              Smart session
            </span>
            <span>
              <strong>+8%</strong>
              Weekly volume
            </span>
            <span>
              <strong>78</strong>
              Recovery score
            </span>
          </div>
        </div>
      </div>

      <form className="loginPanel" onSubmit={(event) => event.preventDefault()}>
        <div className="loginPanelHeader">
          <span className="loginIcon">
            <BrainCircuit size={24} />
          </span>
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2>Sign in to GymXP</h2>
          </div>
        </div>

        <label className="fieldGroup">
          <span>Email</span>
          <span className="inputWrap">
            <Mail size={18} />
            <input type="email" placeholder="you@example.com" />
          </span>
        </label>

        <label className="fieldGroup">
          <span>Password</span>
          <span className="inputWrap">
            <LockKeyhole size={18} />
            <input type="password" placeholder="Enter password" />
          </span>
        </label>

        <div className="loginOptions">
          <label className="rememberChoice">
            <input type="checkbox" />
            <span>Remember me</span>
          </label>
          <button className="textButton" type="button">
            Forgot password
          </button>
        </div>

        <button className="primaryBtn loginSubmit" type="button">
          <span>Sign in</span>
          <ArrowRight size={18} />
        </button>

        <button
          className="secondaryBtn demoButton"
          type="button"
          onClick={onShowHome}
        >
          <Dumbbell size={18} />
          <span>View demo dashboard</span>
        </button>

        <p className="signupPrompt">
          New to GymXP? <button type="button">Create an account</button>
        </p>
      </form>
    </section>
  );
}

function App() {
  const [activeView, setActiveView] = useState("home");
  const showHome = () => setActiveView("home");
  const showLogin = () => setActiveView("login");

  return (
    <main className="appShell">
      <Header
        activeView={activeView}
        onShowHome={showHome}
        onShowLogin={showLogin}
      />

      {activeView === "login" ? (
        <LoginPage onShowHome={showHome} />
      ) : (
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
            <ProfilePanel />
            <NutritionPanel />
          </aside>
        </div>
      )}
    </main>
  );
}

export default App;
