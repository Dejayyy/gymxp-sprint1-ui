import React, { useEffect, useState } from "react";
import { Sparkles, Flame, Utensils, RefreshCw, Salad, LogIn } from "lucide-react";

const API_BASE = "http://localhost:8000";

const SLOT_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function NutritionPage({ onShowLogin }) {
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | empty | unauthenticated | error
  const [generating, setGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setStatus("unauthenticated");
      return;
    }

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/nutrition-plan`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          localStorage.removeItem("userToken");
          setStatus("unauthenticated");
          return;
        }
        if (response.status === 404) {
          setStatus("empty");
          return;
        }
        if (!response.ok) {
          setStatus("error");
          setErrorMessage("We couldn't load your plan. Try again in a moment.");
          return;
        }

        setPlan(await response.json());
        setStatus("ready");
      } catch (error) {
        setStatus("error");
        setErrorMessage("Cannot reach backend server. Is Uvicorn running on port 8000?");
      }
    })();
  }, []);

  const generate = async () => {
    setErrorMessage("");
    setGenerating(true);

    const token = localStorage.getItem("userToken");
    if (!token) {
      setStatus("unauthenticated");
      setGenerating(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/nutrition-plan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.removeItem("userToken");
        setStatus("unauthenticated");
        return;
      }

      const data = await response.json();
      if (response.ok) {
        setPlan(data);
        setStatus("ready");
      } else {
        // 503 means a missing API key or the model call failed.
        setErrorMessage(data.detail || "We couldn't generate a plan. Try again.");
      }
    } catch (error) {
      setErrorMessage("Cannot reach backend server. Is Uvicorn running on port 8000?");
    } finally {
      setGenerating(false);
    }
  };

  if (status === "loading") {
    return (
      <section className="panel nutritionPage">
        <p className="profileLoading">Loading your plan…</p>
      </section>
    );
  }

  if (status === "unauthenticated") {
    return (
      <section className="panel nutritionPage profileEmpty">
        <span className="loginIcon">
          <Salad size={24} />
        </span>
        <h2>Sign in to build a nutrition plan</h2>
        <p>Your plan is generated from the goals and preferences on your profile.</p>
        <button className="primaryBtn" type="button" onClick={onShowLogin}>
          <LogIn size={18} />
          <span>Go to sign in</span>
        </button>
      </section>
    );
  }

  if (status === "empty") {
    return (
      <section className="panel nutritionPage profileEmpty">
        <span className="loginIcon">
          <Sparkles size={24} />
        </span>
        <h2>No plan yet</h2>
        <p>Generate a day of meals tailored to your goal, training, and dietary preferences.</p>
        {errorMessage && <div className="formAlert formAlert--error">{errorMessage}</div>}
        <button className="primaryBtn" type="button" onClick={generate} disabled={generating}>
          <Sparkles size={18} />
          <span>{generating ? "Generating…" : "Generate today's plan"}</span>
        </button>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="panel nutritionPage profileEmpty">
        <h2>Plan unavailable</h2>
        <p>{errorMessage}</p>
      </section>
    );
  }

  const t = plan.targets;

  return (
    <div className="nutritionPage">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Today's nutrition</p>
            <h1>Your meal plan</h1>
          </div>
          <button className="secondaryBtn" type="button" onClick={generate} disabled={generating}>
            <RefreshCw size={18} />
            <span>{generating ? "Generating…" : "Regenerate"}</span>
          </button>
        </div>

        {errorMessage && <div className="formAlert formAlert--error">{errorMessage}</div>}

        <div className="targetGrid">
          <article className="stat consistency">
            <span>Calories</span>
            <strong>{t.calories}</strong>
          </article>
          <article className="stat progression">
            <span>Protein</span>
            <strong>{t.protein_g}g</strong>
          </article>
          <article className="stat">
            <span>Carbs</span>
            <strong>{t.carbs_g}g</strong>
          </article>
          <article className="stat">
            <span>Fat</span>
            <strong>{t.fat_g}g</strong>
          </article>
          <article className="stat recovery">
            <span>Water</span>
            <strong>{t.water_ml}ml</strong>
          </article>
        </div>
      </section>

      <section className="coachPanel">
        <div className="coachIcon">
          <Sparkles size={24} />
        </div>
        <div>
          <h2>Why this plan</h2>
          <p>{plan.summary}</p>
        </div>
      </section>

      {plan.meals.map((meal) => (
        <section className="panel mealCard" key={meal.id}>
          <div className="mealHead">
            <div>
              <p className="eyebrow">{SLOT_LABELS[meal.slot] || meal.slot}</p>
              <h3>{meal.name}</h3>
            </div>
            <span className="mealKcal">
              <Flame size={16} /> {meal.macros.calories} kcal
            </span>
          </div>

          {meal.description && <p className="mealDesc">{meal.description}</p>}

          <ul className="mealItems">
            {meal.items.map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <strong>{item.qty}</strong>
              </li>
            ))}
          </ul>

          <div className="mealMacros">
            <span>P {meal.macros.protein_g}g</span>
            <span>C {meal.macros.carbs_g}g</span>
            <span>F {meal.macros.fat_g}g</span>
          </div>
        </section>
      ))}
    </div>
  );
}

export default NutritionPage;
