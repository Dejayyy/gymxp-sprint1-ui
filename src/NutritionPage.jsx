import React, { useMemo, useEffect, useState, useRef } from "react";
import {
  Sparkles, Flame, RefreshCw, Salad, LogIn, Star, Check, X, Heart,
  CalendarDays, ShoppingCart, Minus, Plus, LayoutGrid, GripVertical, ArrowLeftRight,
  ChevronLeft, ChevronRight,
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

  const [view, setView] = useState("schedule"); // schedule | shopping | planner
  const [people, setPeople] = useState(1);
  const [shopping, setShopping] = useState(null);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [shoppingError, setShoppingError] = useState("");
  const [checkedItems, setCheckedItems] = useState(() => new Set());
  const [expandedItems, setExpandedItems] = useState(() => new Set());
  const [replaceChoiceFor, setReplaceChoiceFor] = useState(null); // entry_id showing the swap-scope choice
  const [replacingEntryId, setReplacingEntryId] = useState(null); // entry_id currently mid-swap

  const [library, setLibrary] = useState(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(true);
  const dragPayloadRef = useRef(null); // what's being dragged — not state, drag events fire too fast to wait on renders
  const [draggingSlot, setDraggingSlot] = useState(null); // slot of whatever's mid-drag, for drop-target highlighting
  const [dropTargetId, setDropTargetId] = useState(null); // entry_id currently hovered while dragging

  const openPlan = (data) => {
    setPlan(data);
    const o = todayOffset(data);
    setSelectedDay(o < 0 ? 0 : o);
    setShopping(null); // list is stale after a new plan
    setLibrary(null);
  };

  // For in-place edits (liked toggle aside) that change ingredients — swap-a-meal —
  // without jumping the user away from the day they're looking at.
  const updatePlan = (data) => {
    setPlan(data);
    setShopping(null); // ingredients may have changed
    setLibrary(null);  // rotation may have changed
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

  // Fetch the meal library whenever the planner tab is opened (and not already cached).
  useEffect(() => {
    if (view !== "planner" || !plan || library) return;
    let cancelled = false;

    (async () => {
      setLibraryLoading(true);
      setLibraryError("");
      try {
        const response = await fetch(`${API_BASE}/schedule/library`, { headers: authHeaders() });
        if (!response.ok) {
          if (!cancelled) setLibraryError("We couldn't load your meal library. Try again.");
          return;
        }
        const data = await response.json();
        if (!cancelled) setLibrary(data);
      } catch (error) {
        if (!cancelled) setLibraryError("Cannot reach backend server. Is Uvicorn running on port 8000?");
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [view, plan, library]);

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

  // A meal (by meal_id) can appear on several days in the rotation, so liking it
  // on one card should reflect everywhere it shows up — not just this entry.
  const patchMealLiked = (mealId, liked) =>
    setPlan((prev) => prev && ({
      ...prev,
      days: prev.days.map((d) => ({
        ...d,
        entries: d.entries.map((e) => (e.meal.id === mealId ? { ...e, meal: { ...e.meal, liked } } : e)),
      })),
    }));

  const toggleLiked = async (meal) => {
    const next = !meal.liked;
    patchMealLiked(meal.id, next);
    try {
      const response = await fetch(`${API_BASE}/meals/${meal.id}/liked`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ liked: next }),
      });
      if (response.status === 401) {
        localStorage.removeItem("userToken");
        setStatus("unauthenticated");
        return;
      }
      if (!response.ok) patchMealLiked(meal.id, !next);
    } catch (error) {
      patchMealLiked(meal.id, !next);
    }
  };

  // "Try another meal" — scope "single" swaps just this occurrence, "all" swaps
  // every day this meal appears on and flags it so future plans avoid it too.
  const replaceMeal = async (entry, scope) => {
    setReplaceChoiceFor(null);
    setReplacingEntryId(entry.entry_id);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE}/schedule/entries/${entry.entry_id}/replace-meal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ scope }),
      });
      if (response.status === 401) {
        localStorage.removeItem("userToken");
        setStatus("unauthenticated");
        return;
      }
      const data = await response.json();
      if (response.ok) {
        updatePlan(data);
      } else {
        setErrorMessage(data.detail || "Could not find a replacement. Try again.");
      }
    } catch (error) {
      setErrorMessage("Cannot reach backend server. Is Uvicorn running on port 8000?");
    } finally {
      setReplacingEntryId(null);
    }
  };

  // --- Planner drag & drop ---
  // Native HTML5 DnD, no extra library — the payload lives in a ref (not state)
  // since dragstart/dragover fire far faster than React wants to re-render.
  const handleLibraryDragStart = (meal) => (event) => {
    dragPayloadRef.current = { type: "library", mealId: meal.id, slot: meal.slot };
    setDraggingSlot(meal.slot);
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleEntryDragStart = (entry) => (event) => {
    dragPayloadRef.current = { type: "entry", entryId: entry.entry_id, slot: entry.slot };
    setDraggingSlot(entry.slot);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    dragPayloadRef.current = null;
    setDraggingSlot(null);
    setDropTargetId(null);
  };

  const handleDragOverEntry = (entry) => (event) => {
    if (!dragPayloadRef.current) return;
    event.preventDefault(); // required to allow a drop
    setDropTargetId(entry.entry_id);
  };

  const handleDropOnEntry = (targetEntry) => async (event) => {
    event.preventDefault();
    const payload = dragPayloadRef.current;
    dragPayloadRef.current = null;
    setDraggingSlot(null);
    setDropTargetId(null);
    if (!payload) return;

    if (payload.slot !== targetEntry.slot) {
      setErrorMessage(
        `That's a ${SLOT_LABELS[payload.slot] || payload.slot} option and can't go in the ${SLOT_LABELS[targetEntry.slot] || targetEntry.slot} slot.`
      );
      return;
    }
    if (payload.type === "library" && payload.mealId === targetEntry.meal.id) return;
    if (payload.type === "entry" && payload.entryId === targetEntry.entry_id) return;

    setErrorMessage("");
    try {
      const response = payload.type === "library"
        ? await fetch(`${API_BASE}/schedule/entries/${targetEntry.entry_id}/assign`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ meal_id: payload.mealId }),
          })
        : await fetch(`${API_BASE}/schedule/entries/swap`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ entry_id_a: payload.entryId, entry_id_b: targetEntry.entry_id }),
          });

      if (response.status === 401) {
        localStorage.removeItem("userToken");
        setStatus("unauthenticated");
        return;
      }
      const data = await response.json();
      if (response.ok) {
        updatePlan(data);
      } else {
        setErrorMessage(data.detail || "Could not update the plan. Try again.");
      }
    } catch (error) {
      setErrorMessage("Cannot reach backend server. Is Uvicorn running on port 8000?");
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

      {/* Switch between the schedule, shopping list, and planner. */}
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
        <button
          type="button"
          role="tab"
          aria-selected={view === "planner"}
          className={view === "planner" ? "active" : ""}
          onClick={() => setView("planner")}
        >
          <LayoutGrid size={17} /> Planner
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
                      <div className="mealHeadActions">
                        <button
                          type="button"
                          className={`likeBtn${entry.meal.liked ? " likeBtn--on" : ""}`}
                          onClick={() => toggleLiked(entry.meal)}
                          aria-pressed={entry.meal.liked}
                          aria-label={entry.meal.liked ? "Unlike this meal" : "Like this meal"}
                        >
                          <Heart size={16} />
                        </button>
                        <span className="mealKcal"><Flame size={16} /> {entry.meal.macros.calories} kcal</span>
                      </div>
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

                    {replaceChoiceFor === entry.entry_id ? (
                      <div className="replaceChoice">
                        <span>Swap this meal —</span>
                        <button type="button" className="textButton" onClick={() => replaceMeal(entry, "single")}>
                          Just today
                        </button>
                        <button type="button" className="textButton textButton--danger" onClick={() => replaceMeal(entry, "all")}>
                          I dislike this one
                        </button>
                        <button type="button" className="textButton" onClick={() => setReplaceChoiceFor(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="tryAnotherBtn"
                        onClick={() => setReplaceChoiceFor(entry.entry_id)}
                        disabled={replacingEntryId === entry.entry_id}
                      >
                        <RefreshCw size={15} />
                        <span>{replacingEntryId === entry.entry_id ? "Finding a swap…" : "Try another"}</span>
                      </button>
                    )}

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
      ) : view === "shopping" ? (
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
      ) : (
        <div className="plannerLayout">
          {libraryOpen ? (
            <aside className="plannerLibrary">
              <div className="panel plannerLibraryPanel">
                <div className="plannerLibraryHead">
                  <div>
                    <p className="eyebrow">Drag onto a day</p>
                    <h2>Meal library</h2>
                  </div>
                  <button
                    type="button"
                    className="secondaryBtn iconOnlyBtn"
                    onClick={() => setLibraryOpen(false)}
                    aria-label="Collapse meal library"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>

                {libraryError && <div className="formAlert formAlert--error">{libraryError}</div>}
                {libraryLoading && <p className="profileLoading">Loading your meals…</p>}

                {!libraryLoading && library && (
                  <div className="libraryGroupsScroll">
                    <div className="libraryGroups">
                      {Object.keys(SLOT_LABELS)
                        .filter((slot) => library.library[slot]?.length)
                        .map((slot) => (
                          <div className="libraryGroup" key={slot}>
                            <h3 className="libraryGroupTitle">
                              <i className={`slotDot ${slot}`} /> {SLOT_LABELS[slot]}
                            </h3>
                            <div className="libraryCards">
                              {library.library[slot].map((meal) => (
                                <div
                                  className={`libraryCard${draggingSlot && draggingSlot !== slot ? " libraryCard--dim" : ""}`}
                                  key={meal.id}
                                  draggable
                                  onDragStart={handleLibraryDragStart(meal)}
                                  onDragEnd={handleDragEnd}
                                >
                                  <GripVertical size={14} className="libraryCardGrip" />
                                  <span className="libraryCardName">{meal.name}</span>
                                  <span className="libraryCardKcal">{meal.macros.calories} kcal</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          ) : (
            <button
              type="button"
              className="plannerLibraryToggle"
              onClick={() => setLibraryOpen(true)}
              aria-label="Open meal library"
            >
              <ChevronRight size={18} />
              <span>Meal library</span>
            </button>
          )}

          <section className="panel plannerBoard">
            <div className="sectionTitle">
              <h2>Two-week plan</h2>
              <span><ArrowLeftRight size={14} /> Drag to rearrange</span>
            </div>

            <div className="plannerGrid">
              {plan.days.map((day) => {
                const { weekday, day: dayNum } = dayLabels(day.date);
                const isToday = day.day_offset === today;
                return (
                  <div className={`plannerDay${isToday ? " plannerDay--today" : ""}`} key={day.day_offset}>
                    <div className="plannerDayHead">
                      <span>{weekday}</span>
                      <strong>{dayNum}</strong>
                    </div>
                    {day.entries.map((entry) => (
                      <div
                        className={`plannerSlotCard${dropTargetId === entry.entry_id ? " plannerSlotCard--over" : ""}${draggingSlot && draggingSlot !== entry.slot ? " plannerSlotCard--dim" : ""}`}
                        key={entry.entry_id}
                        draggable
                        onDragStart={handleEntryDragStart(entry)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOverEntry(entry)}
                        onDrop={handleDropOnEntry(entry)}
                        title={entry.meal.name}
                      >
                        <i className={`slotDot ${entry.slot}`} />
                        <span>{entry.meal.name}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default NutritionPage;
