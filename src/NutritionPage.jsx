import React, { useMemo, useEffect, useState } from "react";
import {
  Sparkles, Flame, RefreshCw, Salad, LogIn, Star, Check, X,
  CalendarDays, ShoppingCart, Minus, Plus,
} from "lucide-react";

const API_BASE = "http://localhost:8000";

const SLOT_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

// Aisle order + display labels for grouping the shopping list.
const CATEGORY_LABELS = {
  produce: "Produce",
  protein: "Protein",
  dairy: "Dairy",
  grains: "Grains & starches",
  pantry: "Pantry",
  frozen: "Frozen",
  other: "Other",
};
const CATEGORY_ORDER = ["produce", "protein", "dairy", "grains", "pantry", "frozen", "other"];

// One localStorage key per plan, so checked-off items don't bleed into the next generated plan.
function checkedStorageKey(scheduleId) {
  return `gymxp:shopping-checked:${scheduleId}`;
}

// Round to one decimal and drop a trailing ".0".
function fmtNum(value) {
  const n = Math.round(Number(value) * 10) / 10;
  return Number.isFinite(n) ? String(n) : "";
}

// "150 g", "2" (whole items have no unit shown).
function qtyLabel(quantity, unit) {
  const q = fmtNum(quantity);
  if (!unit || unit === "whole") return q;
  return `${q} ${unit}`;
}

function formatQty(item) {
  return qtyLabel(item.quantity, item.unit);
}

// Which day index is "today" within this plan, or -1 if today falls outside it.
function todayOffset(schedule) {
  const start = new Date(`${schedule.start_date}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((now - start) / 86400000);
  return diff >= 0 && diff < schedule.length_days ? diff : -1;
}

function dayLabels(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    day: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
  };
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("userToken")}` };
}

function NutritionPage({ onShowLogin }) {
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | empty | unauthenticated | error
  const [generating, setGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDay, setSelectedDay] = useState(0);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const [view, setView] = useState("schedule"); // schedule | shopping
  const [people, setPeople] = useState(1);
  const [shopping, setShopping] = useState(null);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [shoppingError, setShoppingError] = useState("");
  const [checkedItems, setCheckedItems] = useState(() => new Set());
  const [expandedItems, setExpandedItems] = useState(() => new Set());

  const openPlan = (data) => {
    setPlan(data);
    const o = todayOffset(data);
    setSelectedDay(o < 0 ? 0 : o);
    setShopping(null); // list is stale after a new plan
  };

  useEffect(() => {
    if (!localStorage.getItem("userToken")) {
      setStatus("unauthenticated");
      return;
    }

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/schedule`, { headers: authHeaders() });
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
        openPlan(await response.json());
        setStatus("ready");
      } catch (error) {
        setStatus("error");
        setErrorMessage("Cannot reach backend server. Is Uvicorn running on port 8000?");
      }
    })();
  }, []);

  // Fetch the shopping list whenever it's shown or the household size changes.
  useEffect(() => {
    if (view !== "shopping" || !plan) return;
    let cancelled = false;

    (async () => {
      setShoppingLoading(true);
      setShoppingError("");
      try {
        const response = await fetch(`${API_BASE}/schedule/shopping-list?people=${people}`, {
          headers: authHeaders(),
        });
        if (!response.ok) {
          if (!cancelled) setShoppingError("We couldn't build your shopping list. Try again.");
          return;
        }
        const data = await response.json();
        if (!cancelled) setShopping(data);
      } catch (error) {
        if (!cancelled) setShoppingError("Cannot reach backend server. Is Uvicorn running on port 8000?");
      } finally {
        if (!cancelled) setShoppingLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [view, people, plan]);

  // Restore checked-off items for this plan. Keyed by schedule_id so a fresh
  // plan (regenerated or newly generated) always starts with a clean list.
  useEffect(() => {
    if (!plan) return;
    try {
      const raw = localStorage.getItem(checkedStorageKey(plan.schedule_id));
      setCheckedItems(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch (error) {
      setCheckedItems(new Set());
    }
    setExpandedItems(new Set());
  }, [plan]);

  const toggleChecked = (itemKey) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      next.has(itemKey) ? next.delete(itemKey) : next.add(itemKey);
      if (plan) {
        try {
          localStorage.setItem(checkedStorageKey(plan.schedule_id), JSON.stringify([...next]));
        } catch (error) {
          // Storage full or unavailable — checked state just won't persist across reloads.
        }
      }
      return next;
    });
  };

  const toggleExpanded = (itemKey) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(itemKey) ? next.delete(itemKey) : next.add(itemKey);
      return next;
    });
  };

  const generate = async (replace = false) => {
    setErrorMessage("");
    setGenerating(true);

    if (!localStorage.getItem("userToken")) {
      setStatus("unauthenticated");
      setGenerating(false);
      return;
    }

    try {
      const url = replace ? `${API_BASE}/schedule?replace=true` : `${API_BASE}/schedule`;
      const response = await fetch(url, { method: "POST", headers: authHeaders() });

      if (response.status === 401) {
        localStorage.removeItem("userToken");
        setStatus("unauthenticated");
        return;
      }
      if (response.status === 409) {
        setConfirmRegen(true);
        return;
      }

      const data = await response.json();
      if (response.ok) {
        openPlan(data);
        setConfirmRegen(false);
        setStatus("ready");
      } else {
        setErrorMessage(data.detail || "We couldn't generate a plan. Try again.");
      }
    } catch (error) {
      setErrorMessage("Cannot reach backend server. Is Uvicorn running on port 8000?");
    } finally {
      setGenerating(false);
    }
  };

  // Mark a meal eaten/skipped. Optimistic: update on screen first, roll back if the call fails.
  const setEntryStatus = async (entry, next) => {
    const previous = entry.status;
    const patchLocal = (value) =>
      setPlan((prev) => prev && ({
        ...prev,
        days: prev.days.map((d) => ({
          ...d,
          entries: d.entries.map((e) => (e.entry_id === entry.entry_id ? { ...e, status: value } : e)),
        })),
      }));

    patchLocal(next);
    try {
      const response = await fetch(`${API_BASE}/schedule/entries/${entry.entry_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) patchLocal(previous);
    } catch (error) {
      patchLocal(previous);
    }
  };

  const today = useMemo(() => (plan ? todayOffset(plan) : -1), [plan]);

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
        <span className="loginIcon"><Salad size={24} /></span>
        <h2>Sign in to build a nutrition plan</h2>
        <p>Your plan is generated from the goals and preferences on your profile.</p>
        <button className="primaryBtn" type="button" onClick={onShowLogin}>
          <LogIn size={18} /><span>Go to sign in</span>
        </button>
      </section>
    );
  }

  if (status === "empty") {
    return (
      <section className="panel nutritionPage profileEmpty">
        <span className="loginIcon"><Sparkles size={24} /></span>
        <h2>No plan yet</h2>
        <p>Generate two weeks of meals tailored to your goal, training, and dietary preferences.</p>
        {errorMessage && <div className="formAlert formAlert--error">{errorMessage}</div>}
        <button className="primaryBtn" type="button" onClick={() => generate(false)} disabled={generating}>
          <Sparkles size={18} /><span>{generating ? "Generating…" : "Generate two-week plan"}</span>
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
  const activeDay = plan.days[selectedDay] || plan.days[0];
  const activeLabels = dayLabels(activeDay.date);

  return (
    <div className="nutritionPage">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Two-week nutrition plan</p>
            <h1>Your meal schedule</h1>
          </div>
          <button className="secondaryBtn" type="button" onClick={() => setConfirmRegen(true)} disabled={generating}>
            <RefreshCw size={18} /><span>Regenerate</span>
          </button>
        </div>

        {/* Regenerating replaces the live plan, so ask before doing it. */}
        {confirmRegen && (
          <div className="confirmBar">
            <span>Regenerating archives your current plan and builds a new one. Continue?</span>
            <div className="confirmBar__actions">
              <button className="secondaryBtn" type="button" onClick={() => setConfirmRegen(false)} disabled={generating}>
                Cancel
              </button>
              <button className="primaryBtn" type="button" onClick={() => generate(true)} disabled={generating}>
                {generating ? "Generating…" : "Replace plan"}
              </button>
            </div>
          </div>
        )}

        {errorMessage && <div className="formAlert formAlert--error">{errorMessage}</div>}

        <div className="targetGrid">
          <article className="stat consistency"><span>Calories</span><strong>{t.calories}</strong></article>
          <article className="stat progression"><span>Protein</span><strong>{t.protein_g}g</strong></article>
          <article className="stat"><span>Carbs</span><strong>{t.carbs_g}g</strong></article>
          <article className="stat"><span>Fat</span><strong>{t.fat_g}g</strong></article>
          <article className="stat recovery"><span>Water</span><strong>{t.water_ml}ml</strong></article>
        </div>
      </section>

      {/* Switch between the schedule and the shopping list. */}
      <div className="planTabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === "schedule"}
          className={view === "schedule" ? "active" : ""}
          onClick={() => setView("schedule")}
        >
          <CalendarDays size={17} /> Schedule
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "shopping"}
          className={view === "shopping" ? "active" : ""}
          onClick={() => setView("shopping")}
        >
          <ShoppingCart size={17} /> Shopping list
        </button>
      </div>

      {view === "schedule" ? (
        <>
          <section className="coachPanel">
            <div className="coachIcon"><Sparkles size={24} /></div>
            <div>
              <h2>Why this plan</h2>
              <p>{plan.summary}</p>
            </div>
          </section>

          {/* Two-week calendar — tap a day to see its meals below. */}
          <section className="panel">
            <div className="sectionTitle">
              <h2>Schedule</h2>
              <span>Meals rotate across 14 days</span>
            </div>

            <div className="calendarGrid">
              {plan.days.map((day) => {
                const { weekday, day: dayNum } = dayLabels(day.date);
                const isToday = day.day_offset === today;
                const isSelected = day.day_offset === selectedDay;
                return (
                  <button
                    key={day.day_offset}
                    type="button"
                    className={`calendarDay${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
                    onClick={() => setSelectedDay(day.day_offset)}
                    aria-pressed={isSelected}
                  >
                    <span className="calendarDayHead">
                      <span>{weekday}</span>
                      <strong>{dayNum}</strong>
                      {isToday && <em>Today</em>}
                    </span>
                    <span className="calendarMeals">
                      {day.entries.map((entry) => (
                        <span
                          className={`calendarMeal${entry.status === "completed" ? " calendarMeal--done" : ""}${entry.status === "skipped" ? " calendarMeal--skipped" : ""}`}
                          key={entry.entry_id}
                        >
                          <i className={`slotDot ${entry.slot}`} />
                          <span>{entry.meal.name}</span>
                          {entry.status === "completed" && <Check size={11} />}
                          {entry.meal.experimental && entry.status === "planned" && <Star size={11} />}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Selected day detail — meals laid out as a card grid, like the Workouts page. */}
          <section className="dayView">
            <div className="dayViewHead">
              <p className="eyebrow">{activeLabels.weekday} · {activeLabels.day}</p>
              <h2>Meals for this day</h2>
            </div>

            <div className="dayMealGrid">
              {activeDay.entries.map((entry) => {
                const done = entry.status === "completed";
                const skipped = entry.status === "skipped";
                return (
                  <article
                    className={`panel mealCard dayEntry${done ? " dayEntry--completed" : ""}${skipped ? " dayEntry--skipped" : ""}`}
                    key={entry.entry_id}
                  >
                    <div className="mealHead">
                      <div>
                        <p className="eyebrow">{SLOT_LABELS[entry.slot] || entry.slot}</p>
                        <h3>
                          {entry.meal.name}
                          {entry.meal.experimental && (
                            <span className="experimentalTag"><Star size={12} /> New</span>
                          )}
                        </h3>
                      </div>
                      <span className="mealKcal"><Flame size={16} /> {entry.meal.macros.calories} kcal</span>
                    </div>

                    {entry.meal.description && <p className="mealDesc">{entry.meal.description}</p>}

                    <ul className="mealItems">
                      {entry.meal.items.map((item, idx) => (
                        <li key={idx}>
                          <span>{item.name}{item.note ? ` · ${item.note}` : ""}</span>
                          <strong>{formatQty(item)}</strong>
                        </li>
                      ))}
                    </ul>

                    <div className="mealMacros">
                      <span>P {entry.meal.macros.protein_g}g</span>
                      <span>C {entry.meal.macros.carbs_g}g</span>
                      <span>F {entry.meal.macros.fat_g}g</span>
                    </div>

                    <div className="mealActions">
                      <button
                        type="button"
                        className={`statusBtn${done ? " statusBtn--done" : ""}`}
                        onClick={() => setEntryStatus(entry, done ? "planned" : "completed")}
                      >
                        <Check size={16} /> Eaten
                      </button>
                      <button
                        type="button"
                        className={`statusBtn${skipped ? " statusBtn--skip" : ""}`}
                        onClick={() => setEntryStatus(entry, skipped ? "planned" : "skipped")}
                      >
                        <X size={16} /> Skip
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <section className="panel shopPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Everything for 14 days</p>
              <h2>Shopping list</h2>
            </div>
            <div className="panelHeaderActions">
              {shopping && shopping.items.length > 0 && (
                <span className="shopProgress">
                  {shopping.items.filter((item) => checkedItems.has(`${item.name}-${item.unit}`)).length}
                  {" / "}
                  {shopping.items.length} checked
                </span>
              )}
              <div className="peopleStepper">
                <span>People</span>
                <button type="button" aria-label="Fewer people" onClick={() => setPeople((n) => Math.max(1, n - 1))}>
                  <Minus size={16} />
                </button>
                <strong>{people}</strong>
                <button type="button" aria-label="More people" onClick={() => setPeople((n) => Math.min(20, n + 1))}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          {shoppingError && <div className="formAlert formAlert--error">{shoppingError}</div>}
          {shoppingLoading && <p className="profileLoading">Building your list…</p>}

          {!shoppingLoading && shopping && shopping.items.length === 0 && (
            <p className="mealDesc">No ingredients found for this plan.</p>
          )}

          {!shoppingLoading && shopping && shopping.items.length > 0 && (() => {
            // Items arrive pre-sorted by category from the backend — group consecutive
            // items under one heading rather than re-sorting on the client.
            const groups = [];
            for (const item of shopping.items) {
              const category = item.category || "other";
              const last = groups[groups.length - 1];
              if (last && last.category === category) {
                last.items.push(item);
              } else {
                groups.push({ category, items: [item] });
              }
            }

            return (
              <div className="shopGroups">
                {groups.map((group) => (
                  <div className="shopGroup" key={group.category}>
                    <h3 className="shopGroupTitle">{CATEGORY_LABELS[group.category] || "Other"}</h3>
                    <div className="shopList">
                      {group.items.map((item) => {
                        const itemKey = `${item.name}-${item.unit}`;
                        const checked = checkedItems.has(itemKey);
                        const expanded = expandedItems.has(itemKey);
                        return (
                          <div className={`shopItem${checked ? " shopItem--checked" : ""}`} key={itemKey}>
                            <div
                              className="shopItemHead"
                              onClick={() => toggleChecked(itemKey)}
                              role="button"
                              tabIndex={0}
                              aria-pressed={checked}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleChecked(itemKey); } }}
                            >
                              <span className="shopCheckbox" aria-hidden="true">
                                {checked && <Check size={14} />}
                              </span>

                              <span className="shopItemMain">
                                <strong>{item.name}</strong>
                                <button
                                  type="button"
                                  className="shopUsesToggle"
                                  onClick={(e) => { e.stopPropagation(); toggleExpanded(itemKey); }}
                                  aria-expanded={expanded}
                                >
                                  {expanded ? "Hide" : "Used in"} {item.uses.length} meal{item.uses.length === 1 ? "" : "s"}
                                </button>
                              </span>

                              <span className="shopQty">{qtyLabel(item.total_quantity, item.unit)}</span>
                            </div>

                            {expanded && (
                              <ul className="shopUses">
                                {item.uses.map((use, i) => (
                                  <li key={i}>
                                    <span className="shopUseMeal">
                                      <i className={`slotDot ${use.slot}`} />
                                      {SLOT_LABELS[use.slot] || use.slot} · {use.meal_name}
                                      <em>{use.occurrences}× · {qtyLabel(use.per_meal_quantity, item.unit)} each</em>
                                    </span>
                                    <span className="shopDays">
                                      {use.days.map((d) => (
                                        <span key={d}>{dayLabels(d).day}</span>
                                      ))}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}
    </div>
  );
}

export default NutritionPage;
