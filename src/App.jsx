import { useState } from "react";
import AuthPage from "./AuthPage";
import ProfilePage from "./ProfilePage";
import NutritionPage from "./NutritionPage";
// import WorkoutSuggestionsPage from "./WorkoutSuggestionsPage";
import WorkoutSuggestionsPage2 from "./WorkoutSuggestionsPage2";

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

function Header({ activeView, onShowHome, onShowLogin, onShowProfile, onShowNutrition, onShowWorkouts2 }) {
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
        <button
          className={activeView === "workouts2" ? "active" : ""}
          type="button"
          onClick={onShowWorkouts2}
        >
          Workouts
        </button>
        <button type="button">Progress</button>
        <button
          className={activeView === "nutrition" ? "active" : ""}
          type="button"
          onClick={onShowNutrition}
        >
          Nutrition
        </button>
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

// function LoginPage({ onShowHome }) {
//   // 1. Create states to hold the text the user types in
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [errorMessage, setErrorMessage] = useState('');

//   // 2. The function that triggers when the user clicks "Sign In"
//   const handleLoginSubmit = async (event) => {
//     event.preventDefault(); // Stop the page from refreshing
//     setErrorMessage('');    // Clear any old errors

//     // FastAPI's OAuth2 system expects data formatted as standard Form Data
//     const formData = new FormData();
//     formData.append('username', email); // We pass the email string as the "username" parameter
//     formData.append('password', password);

//     try {
//       // Send the POST request to your running backend
//       const response = await fetch('http://localhost:8000/login', {
//         method: 'POST',
//         body: formData,
//       });

//       const data = await response.json();

//       if (response.ok) {
//         // Success! Save the secure token to the browser storage
//         localStorage.setItem('userToken', data.access_token);
        
//         // Use the prop William built to instantly switch the screen to the Home Dashboard!
//         onShowHome(); 
//       } else {
//         // If your backend throws a 401 (Invalid credentials), show it on screen
//         setErrorMessage(data.detail || 'Login failed. Please try again.');
//       }
//     } catch (error) {
//       setErrorMessage('Cannot reach backend server. Make sure Uvicorn is running!');
//     }
//   };
//   return (
//     <section className="loginPage" aria-label="GymXP sign in">
//       <div className="loginStory">
//         <img
//           src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80"
//           alt="Athlete training with battle ropes"
//         />
//         <div className="loginStoryContent">
//           <p className="eyebrow">AI workout intelligence</p>
//           <h1>Train with a plan that adapts before you stall.</h1>
//           <div className="loginMetrics" aria-label="Training highlights">
//             <span>
//               <strong>45m</strong>
//               Smart session
//             </span>
//             <span>
//               <strong>+8%</strong>
//               Weekly volume
//             </span>
//             <span>
//               <strong>78</strong>
//               Recovery score
//             </span>
//           </div>
//         </div>
//       </div>


// {/* 3. Link the form submission directly to our new function */}
//       <form className="loginPanel" onSubmit={handleLoginSubmit}>
//         <div className="loginPanelHeader">
//           <span className="loginIcon">
//             <BrainCircuit size={24} />
//           </span>
//           <div>
//             <p className="eyebrow">Welcome back</p>
//             <h2>Sign in to GymXP</h2>
//           </div>
//         </div>

//         <label className="fieldGroup">
//           <span>Email</span>
//           <span className="inputWrap">
//             <Mail size={18} />
//             {/* 4. Connect the email input to React state */}
//             <input 
//               type="email" 
//               placeholder="you@example.com" 
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               required
//             />
//           </span>
//         </label>

//         <label className="fieldGroup">
//           <span>Password</span>
//           <span className="inputWrap">
//             <LockKeyhole size={18} />
//             {/* 5. Connect the password input to React state */}
//             <input 
//               type="password" 
//               placeholder="Enter password" 
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//             />
//           </span>
//         </label>

//         <div className="loginOptions">
//           <label className="rememberChoice">
//             <input type="checkbox" />
//             <span>Remember me</span>
//           </label>
//           <button className="textButton" type="button">
//             Forgot password
//           </button>
//         </div>

//         {/* 6. Changed type from "button" to "submit" so hitting enter or clicking triggers the form submission */}
//         <button className="primaryBtn loginSubmit" type="submit">
//           <span>Sign in</span>
//           <ArrowRight size={18} />
//         </button>

//         <button
//           className="secondaryBtn demoButton"
//           type="button"
//           onClick={onShowHome}
//         >
//           <Dumbbell size={18} />
//           <span>View demo dashboard</span>
//         </button>

//         <p className="signupPrompt">
//           New to GymXP? <button type="button">Create an account</button>
//         </p>
//       </form>
//     </section>
//   );
// }

function App() {
  const [activeView, setActiveView] = useState("home");
  const showHome = () => setActiveView("home");
  const showLogin = () => setActiveView("login");
  const showProfile = () => setActiveView("profile");
  const showNutrition = () => setActiveView("nutrition");
  const showWorkouts2 = () => setActiveView("workouts2");

  return (
    <main className="appShell">
      <Header
        activeView={activeView}
        onShowHome={showHome}
        onShowLogin={showLogin}
        onShowProfile={showProfile}
        onShowNutrition={showNutrition}
        onShowWorkouts2={showWorkouts2}
      />

      {activeView === "login" ? (
        // changes to link to AuthPage.jsx, which has the login form and logic, instead of the Home dashboard  
        <AuthPage onShowHome={showHome} />
      ) : activeView === "profile" ? (
        <ProfilePage onShowLogin={showLogin} />
      ) : activeView === "nutrition" ? (
        <NutritionPage onShowLogin={showLogin} />
      ) : activeView === "workouts2" ? (
        <WorkoutSuggestionsPage2 onShowLogin={showLogin} />
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
            <ProfilePanel onShowProfile={showProfile} />
            <NutritionPanel />
          </aside>
        </div>
      )}
    </main>
  );
}

export default App;
