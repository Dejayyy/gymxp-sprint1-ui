import React, { useEffect, useState } from "react";
import {
  User,
  Mail,
  Ruler,
  Scale,
  CalendarClock,
  Target,
  Activity,
  Dumbbell,
  ShieldCheck,
  Salad,
  PieChart,
  AlertTriangle,
  Ban,
  Heart,
  Utensils,
  Flame,
  MessageSquare,
  Plus,
  Save,
  LogIn,
} from "lucide-react";

const API_BASE = "http://localhost:8000";

const GOAL_OPTIONS = ["Lean muscle", "Build strength", "Lose weight", "Improve endurance"];
const EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const EQUIPMENT_OPTIONS = ["Home only", "Gym only", "Home + gym"];
const SESSION_OPTIONS = [30, 45, 60, 75, 90];

const DIET_PATTERNS = [
  "Omnivore", "Vegetarian", "Vegan", "Pescatarian", "Keto",
  "Paleo", "Mediterranean", "Halal", "Kosher", "Other",
];
const MACRO_FOCUS = ["Balanced", "High protein", "Low carb", "High carb", "Custom"];
const MEALS_PER_DAY = ["3", "4", "5", "Intermittent fasting"];
const COMMON_ALLERGENS = ["Nuts", "Dairy", "Gluten", "Shellfish", "Eggs", "Soy", "Fish"];

// --- meal variety survey options ---
const PROTEIN_OPTIONS = [
  "Chicken", "Turkey", "Beef", "Pork", "Fish & seafood", "Eggs", "Tofu & plant-based", "Dairy-based",
];
const CUISINE_OPTIONS = [
  "Italian", "Mexican", "Mediterranean", "Asian", "American", "Indian", "Middle Eastern", "Latin American",
];
const VARIETY_OPTIONS = [
  { value: "repeat_ok", label: "Repeat is fine", helper: "Simpler shopping & prep matters more than novelty" },
  { value: "balanced", label: "Balanced mix", helper: "Some repeats across two weeks is fine" },
  { value: "new_daily", label: "Max variety", helper: "Show me something new as often as possible" },
];

// Keeps numeric inputs controlled without throwing NaN into React state.
function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function ProfilePage({ onShowLogin }) {
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | unauthenticated | error
  const [saving, setSaving] = useState(false);
  const [customAllergen, setCustomAllergen] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setStatus("unauthenticated");
      return;
    }

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          localStorage.removeItem("userToken");
          setStatus("unauthenticated");
          return;
        }
        if (!response.ok) {
          setStatus("error");
          setErrorMessage("We couldn't load your profile. Try again in a moment.");
          return;
        }

        const data = await response.json();
        setForm(data);
        setStatus("ready");
      } catch (error) {
        setStatus("error");
        setErrorMessage("Cannot reach backend server. Is Uvicorn running on port 8000?");
      }
    })();
  }, []);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccessMessage("");
  };

  // Generic toggle for any multi-select chip field (allergies, preferred proteins, cuisines...).
  const toggleListField = (field, value) => {
    setForm((prev) => {
      const set = new Set(prev[field] || []);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...prev, [field]: [...set] };
    });
    setSuccessMessage("");
  };

  const toggleAllergen = (name) => toggleListField("allergies", name);

  const addCustomAllergen = () => {
    const value = customAllergen.trim();
    if (!value) return;
    setForm((prev) => {
      const set = new Set(prev.allergies || []);
      set.add(value);
      return { ...prev, allergies: [...set] };
    });
    setCustomAllergen("");
    setSuccessMessage("");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setSaving(true);

    const token = localStorage.getItem("userToken");
    if (!token) {
      setStatus("unauthenticated");
      setSaving(false);
      return;
    }

    // email is account-owned and read-only, so it never goes in the payload.
    const { email, ...editable } = form;
    const payload = {
      ...editable,
      age: toNumberOrNull(editable.age),
      height_cm: toNumberOrNull(editable.height_cm),
      weight_kg: toNumberOrNull(editable.weight_kg),
      session_length: toNumberOrNull(editable.session_length),
      days_per_week: toNumberOrNull(editable.days_per_week),
      daily_calorie_target: toNumberOrNull(editable.daily_calorie_target),
      allergies: editable.allergies || [],
      preferred_proteins: editable.preferred_proteins || [],
      favorite_cuisines: editable.favorite_cuisines || [],
    };

    try {
      const response = await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        localStorage.removeItem("userToken");
        setStatus("unauthenticated");
        return;
      }

      const data = await response.json();
      if (response.ok) {
        setForm(data);
        setSuccessMessage("Profile saved.");
      } else {
        setErrorMessage(data.detail || "We couldn't save your changes. Try again.");
      }
    } catch (error) {
      setErrorMessage("Cannot reach backend server. Is Uvicorn running on port 8000?");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <section className="panel profilePage">
        <p className="profileLoading">Loading your profile…</p>
      </section>
    );
  }

  if (status === "unauthenticated") {
    return (
      <section className="panel profilePage profileEmpty">
        <span className="loginIcon">
          <User size={24} />
        </span>
        <h2>Sign in to view your profile</h2>
        <p>Your personal details and training preferences live behind your account.</p>
        <button className="primaryBtn" type="button" onClick={onShowLogin}>
          <LogIn size={18} />
          <span>Go to sign in</span>
        </button>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="panel profilePage profileEmpty">
        <h2>Profile unavailable</h2>
        <p>{errorMessage}</p>
      </section>
    );
  }

  // All allergens to show as chips: the common set plus any custom ones added.
  const allergenChips = Array.from(new Set([...COMMON_ALLERGENS, ...(form.allergies || [])]));

  return (
    <form className="profilePage" onSubmit={handleSave}>
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Your account</p>
            <h1>Profile &amp; preferences</h1>
          </div>
          <span className="statusPill">{form.email}</span>
        </div>

        {errorMessage && <div className="formAlert formAlert--error">{errorMessage}</div>}
        {successMessage && <div className="formAlert formAlert--success">{successMessage}</div>}

        <div className="sectionTitle profileSection">
          <h2>Personal information</h2>
        </div>

        <div className="profileGrid">
          <label className="fieldGroup">
            <span>Display name</span>
            <span className="inputWrap">
              <User size={18} />
              <input type="text" placeholder="What should we call you?"
                value={form.display_name ?? ""} onChange={(e) => updateField("display_name", e.target.value)} />
            </span>
          </label>

          <label className="fieldGroup">
            <span>Email</span>
            <span className="inputWrap inputWrap--readonly">
              <Mail size={18} />
              <input type="email" value={form.email} readOnly aria-readonly="true" />
            </span>
          </label>

          <label className="fieldGroup">
            <span>Age</span>
            <span className="inputWrap">
              <CalendarClock size={18} />
              <input type="number" min="0" placeholder="Years"
                value={form.age ?? ""} onChange={(e) => updateField("age", e.target.value)} />
            </span>
          </label>

          <label className="fieldGroup">
            <span>Height (cm)</span>
            <span className="inputWrap">
              <Ruler size={18} />
              <input type="number" min="0" placeholder="cm"
                value={form.height_cm ?? ""} onChange={(e) => updateField("height_cm", e.target.value)} />
            </span>
          </label>

          <label className="fieldGroup">
            <span>Weight (kg)</span>
            <span className="inputWrap">
              <Scale size={18} />
              <input type="number" min="0" step="0.1" placeholder="kg"
                value={form.weight_kg ?? ""} onChange={(e) => updateField("weight_kg", e.target.value)} />
            </span>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="sectionTitle profileSection">
          <h2>Training preferences</h2>
          <span>Shapes your workouts</span>
        </div>

        <div className="profileGrid">
          <label className="fieldGroup">
            <span>Primary goal</span>
            <span className="inputWrap">
              <Target size={18} />
              <select value={form.goal ?? ""} onChange={(e) => updateField("goal", e.target.value)}>
                {GOAL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </span>
          </label>

          <label className="fieldGroup">
            <span>Experience level</span>
            <span className="inputWrap">
              <Activity size={18} />
              <select value={form.experience ?? ""} onChange={(e) => updateField("experience", e.target.value)}>
                {EXPERIENCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </span>
          </label>

          <label className="fieldGroup">
            <span>Equipment access</span>
            <span className="inputWrap">
              <Dumbbell size={18} />
              <select value={form.equipment ?? ""} onChange={(e) => updateField("equipment", e.target.value)}>
                {EQUIPMENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </span>
          </label>

          <label className="fieldGroup">
            <span>Session length (min)</span>
            <span className="inputWrap">
              <CalendarClock size={18} />
              <select value={form.session_length ?? ""} onChange={(e) => updateField("session_length", e.target.value)}>
                {SESSION_OPTIONS.map((o) => <option key={o} value={o}>{o} min</option>)}
              </select>
            </span>
          </label>

          <label className="fieldGroup">
            <span>Workouts per week</span>
            <span className="inputWrap">
              <Activity size={18} />
              <input type="number" min="1" max="7" placeholder="Days"
                value={form.days_per_week ?? ""} onChange={(e) => updateField("days_per_week", e.target.value)} />
            </span>
          </label>
        </div>

        <label className="fieldGroup profileWide">
          <span>Injuries or movements to avoid</span>
          <span className="inputWrap inputWrap--textarea">
            <ShieldCheck size={18} />
            <textarea rows={2} placeholder="e.g. Avoid high-impact knee movements"
              value={form.constraints ?? ""} onChange={(e) => updateField("constraints", e.target.value)} />
          </span>
        </label>
      </section>

      <section className="panel">
        <div className="sectionTitle profileSection">
          <h2>Dietary preferences</h2>
          <span>Feeds your nutrition plan</span>
        </div>

        {/* Allergies are a hard constraint — the plan never includes them. */}
        <label className="fieldGroup profileWide">
          <span>
            <AlertTriangle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Allergies &amp; intolerances — never included in your plan
          </span>
          <div className="chipGroup">
            {allergenChips.map((name) => {
              const on = (form.allergies || []).includes(name);
              return (
                <button key={name} type="button"
                  className={`chip ${on ? "chip--on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleAllergen(name)}>
                  {name}
                </button>
              );
            })}
          </div>
          <span className="inputWrap" style={{ marginTop: 10 }}>
            <Plus size={18} />
            <input type="text" placeholder="Add another, then press Enter"
              value={customAllergen}
              onChange={(e) => setCustomAllergen(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addCustomAllergen(); }
              }} />
          </span>
        </label>

        <div className="profileGrid">
          <label className="fieldGroup">
            <span>Diet pattern</span>
            <span className="inputWrap">
              <Salad size={18} />
              <select value={form.diet_pattern ?? ""} onChange={(e) => updateField("diet_pattern", e.target.value)}>
                {DIET_PATTERNS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </span>
          </label>

          <label className="fieldGroup">
            <span>Macro focus</span>
            <span className="inputWrap">
              <PieChart size={18} />
              <select value={form.macro_focus ?? ""} onChange={(e) => updateField("macro_focus", e.target.value)}>
                {MACRO_FOCUS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </span>
          </label>

          <label className="fieldGroup">
            <span>Meals per day</span>
            <span className="inputWrap">
              <Utensils size={18} />
              <select value={form.meals_per_day ?? ""} onChange={(e) => updateField("meals_per_day", e.target.value)}>
                {MEALS_PER_DAY.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </span>
          </label>

          <label className="fieldGroup">
            <span>Daily calorie target (optional)</span>
            <span className="inputWrap">
              <Flame size={18} />
              <input type="number" min="0" placeholder="Leave blank to auto-calculate"
                value={form.daily_calorie_target ?? ""} onChange={(e) => updateField("daily_calorie_target", e.target.value)} />
            </span>
          </label>

          <label className="fieldGroup">
            <span>Foods you dislike</span>
            <span className="inputWrap">
              <Ban size={18} />
              <input type="text" placeholder="e.g. mushrooms, tofu"
                value={form.disliked_foods ?? ""} onChange={(e) => updateField("disliked_foods", e.target.value)} />
            </span>
          </label>

          <label className="fieldGroup">
            <span>Foods you love</span>
            <span className="inputWrap">
              <Heart size={18} />
              <input type="text" placeholder="e.g. salmon, oats, berries"
                value={form.favorite_foods ?? ""} onChange={(e) => updateField("favorite_foods", e.target.value)} />
            </span>
          </label>
        </div>

        <label className="fieldGroup profileWide">
          <span>Anything else your coach should know</span>
          <span className="inputWrap inputWrap--textarea">
            <MessageSquare size={18} />
            <textarea rows={3} placeholder="e.g. Lactose intolerant but fine with hard cheese; I travel on Tuesdays"
              value={form.nutrition_notes ?? ""} onChange={(e) => updateField("nutrition_notes", e.target.value)} />
          </span>
        </label>
      </section>

      <section className="panel">
        <div className="sectionTitle profileSection">
          <h2>Meal variety survey</h2>
          <span>Helps generation avoid repeats</span>
        </div>
        <p className="surveyIntro">
          The more we know about what you actually like, the less your plan leans on the same
          "safe" chicken-and-rice defaults. Pick as many as apply — none of this is required.
        </p>

        <label className="fieldGroup profileWide">
          <span>Proteins you'd like to see more of</span>
          <div className="chipGroup">
            {PROTEIN_OPTIONS.map((name) => {
              const on = (form.preferred_proteins || []).includes(name);
              return (
                <button key={name} type="button"
                  className={`chip chip--protein ${on ? "chip--on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleListField("preferred_proteins", name)}>
                  {name}
                </button>
              );
            })}
          </div>
        </label>

        <label className="fieldGroup profileWide">
          <span>Cuisines you enjoy</span>
          <div className="chipGroup">
            {CUISINE_OPTIONS.map((name) => {
              const on = (form.favorite_cuisines || []).includes(name);
              return (
                <button key={name} type="button"
                  className={`chip chip--protein ${on ? "chip--on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleListField("favorite_cuisines", name)}>
                  {name}
                </button>
              );
            })}
          </div>
        </label>

        <label className="fieldGroup profileWide">
          <span>How much variety do you want across two weeks?</span>
          <div className="varietyOptions">
            {VARIETY_OPTIONS.map((opt) => {
              const on = (form.variety_preference ?? "balanced") === opt.value;
              return (
                <button key={opt.value} type="button"
                  className={`varietyCard ${on ? "varietyCard--on" : ""}`}
                  aria-pressed={on}
                  onClick={() => updateField("variety_preference", opt.value)}>
                  <strong>{opt.label}</strong>
                  <span>{opt.helper}</span>
                </button>
              );
            })}
          </div>
        </label>

        <div className="actionRow">
          <button className="primaryBtn" type="submit" disabled={saving}>
            <Save size={18} />
            <span>{saving ? "Saving…" : "Save changes"}</span>
          </button>
        </div>
      </section>
    </form>
  );
}

export default ProfilePage;
