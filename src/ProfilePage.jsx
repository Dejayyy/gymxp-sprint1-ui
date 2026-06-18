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
  Apple,
  Save,
  LogIn,
} from "lucide-react";

const API_BASE = "http://localhost:8000";

const GOAL_OPTIONS = ["Lean muscle", "Build strength", "Lose weight", "Improve endurance"];
const EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const EQUIPMENT_OPTIONS = ["Home only", "Gym only", "Home + gym"];
const SESSION_OPTIONS = [30, 45, 60, 75, 90];

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
              <input
                type="text"
                placeholder="What should we call you?"
                value={form.display_name ?? ""}
                onChange={(e) => updateField("display_name", e.target.value)}
              />
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
              <input
                type="number"
                min="0"
                placeholder="Years"
                value={form.age ?? ""}
                onChange={(e) => updateField("age", e.target.value)}
              />
            </span>
          </label>

          <label className="fieldGroup">
            <span>Height (cm)</span>
            <span className="inputWrap">
              <Ruler size={18} />
              <input
                type="number"
                min="0"
                placeholder="cm"
                value={form.height_cm ?? ""}
                onChange={(e) => updateField("height_cm", e.target.value)}
              />
            </span>
          </label>

          <label className="fieldGroup">
            <span>Weight (kg)</span>
            <span className="inputWrap">
              <Scale size={18} />
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="kg"
                value={form.weight_kg ?? ""}
                onChange={(e) => updateField("weight_kg", e.target.value)}
              />
            </span>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="sectionTitle profileSection">
          <h2>Training preferences</h2>
          <span>Used to shape your plan</span>
        </div>

        <div className="profileGrid">
          <label className="fieldGroup">
            <span>Primary goal</span>
            <span className="inputWrap">
              <Target size={18} />
              <select value={form.goal ?? ""} onChange={(e) => updateField("goal", e.target.value)}>
                {GOAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </span>
          </label>

          <label className="fieldGroup">
            <span>Experience level</span>
            <span className="inputWrap">
              <Activity size={18} />
              <select value={form.experience ?? ""} onChange={(e) => updateField("experience", e.target.value)}>
                {EXPERIENCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </span>
          </label>

          <label className="fieldGroup">
            <span>Equipment access</span>
            <span className="inputWrap">
              <Dumbbell size={18} />
              <select value={form.equipment ?? ""} onChange={(e) => updateField("equipment", e.target.value)}>
                {EQUIPMENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </span>
          </label>

          <label className="fieldGroup">
            <span>Session length (min)</span>
            <span className="inputWrap">
              <CalendarClock size={18} />
              <select
                value={form.session_length ?? ""}
                onChange={(e) => updateField("session_length", e.target.value)}
              >
                {SESSION_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option} min</option>
                ))}
              </select>
            </span>
          </label>

          <label className="fieldGroup">
            <span>Workouts per week</span>
            <span className="inputWrap">
              <Activity size={18} />
              <input
                type="number"
                min="1"
                max="7"
                placeholder="Days"
                value={form.days_per_week ?? ""}
                onChange={(e) => updateField("days_per_week", e.target.value)}
              />
            </span>
          </label>

          <label className="fieldGroup">
            <span>Diet preference</span>
            <span className="inputWrap">
              <Apple size={18} />
              <input
                type="text"
                placeholder="e.g. High protein"
                value={form.diet_pref ?? ""}
                onChange={(e) => updateField("diet_pref", e.target.value)}
              />
            </span>
          </label>
        </div>

        <label className="fieldGroup profileWide">
          <span>Injuries or movements to avoid</span>
          <span className="inputWrap inputWrap--textarea">
            <ShieldCheck size={18} />
            <textarea
              rows={3}
              placeholder="e.g. Avoid high-impact knee movements"
              value={form.constraints ?? ""}
              onChange={(e) => updateField("constraints", e.target.value)}
            />
          </span>
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
