from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Boolean, ForeignKey, DateTime, Date, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta, date
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, field_validator, ValidationError
import os
import json
import bcrypt
import jwt

from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()

# --- 1. DATABASE CONFIGURATION ---
DATABASE_URL = "sqlite:///./workout_demo.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Updated database table to use 'email' instead of 'username'
class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)  # Changed to email
    hashed_password = Column(String)

# Profile data, one row per user.
class ProfileDB(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    display_name = Column(String, default="")
    age = Column(Integer, nullable=True)
    height_cm = Column(Integer, nullable=True)
    weight_kg = Column(Float, nullable=True)
    goal = Column(String, default="Lean muscle")
    experience = Column(String, default="Beginner")
    equipment = Column(String, default="Home + gym")
    session_length = Column(Integer, default=45)
    days_per_week = Column(Integer, default=4)
    constraints = Column(String, default="")  # training/injury note

    # --- dietary preferences (feed the nutrition LLM) ---
    allergies = Column(Text, default="[]")          # JSON array of strings (HARD constraint)
    diet_pattern = Column(String, default="Omnivore")
    macro_focus = Column(String, default="Balanced")  # macro split preference
    disliked_foods = Column(String, default="")
    favorite_foods = Column(String, default="")
    meals_per_day = Column(String, default="3")     # "3" / "4" / "5" / "Intermittent fasting"
    daily_calorie_target = Column(Integer, nullable=True)  # null = let the model compute
    nutrition_notes = Column(String, default="")

    # --- meal variety survey (gives the LLM real signal instead of a blank profile) ---
    preferred_proteins = Column(Text, default="[]")   # JSON array of strings
    favorite_cuisines = Column(Text, default="[]")     # JSON array of strings
    variety_preference = Column(String, default="balanced")  # repeat_ok / balanced / new_daily

# Meals live in their own table so they can be liked, reused, and dragged around the calendar later.
class MealDB(Base):
    __tablename__ = "meals"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    slot = Column(String)                      # breakfast / lunch / dinner / snack
    name = Column(String)
    description = Column(String, default="")
    liked = Column(Boolean, default=False)         # member favourited it -> feeds future prompts
    disliked = Column(Boolean, default=False)      # member explicitly swapped it out -> never repeat
    experimental = Column(Boolean, default=False)  # model tried something new -> star it in the UI
    meal_json = Column(Text)                       # {items: [...], macros: {...}}
    created_at = Column(DateTime, default=datetime.utcnow)

# A two-week plan. Old schedules keep status='archived' so past weeks can be recalled.
class ScheduleDB(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    start_date = Column(Date, default=date.today)
    length_days = Column(Integer, default=14)
    status = Column(String, default="active")  # active / archived
    summary = Column(Text, default="")
    targets_json = Column(Text)                # daily targets for the whole plan
    created_at = Column(DateTime, default=datetime.utcnow)

# One row per meal slot on a day. Status lets the member tick off what they actually ate.
class ScheduleEntryDB(Base):
    __tablename__ = "schedule_entries"
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), index=True)
    meal_id = Column(Integer, ForeignKey("meals.id"))
    day_offset = Column(Integer)               # 0..13 from start_date
    slot = Column(String)
    status = Column(String, default="planned")  # planned / completed / skipped

Base.metadata.create_all(bind=engine)

# create_all only creates missing TABLES, not missing COLUMNS on a table that
# already exists — so a column added after the db file was first created (like
# `disliked` above) needs a one-time ALTER TABLE on existing installs.
def _ensure_column(table: str, column: str, ddl: str):
    with engine.connect() as conn:
        existing = [row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")]
        if column not in existing:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {ddl}")
            conn.commit()

_ensure_column("meals", "disliked", "disliked BOOLEAN DEFAULT 0")
_ensure_column("profiles", "preferred_proteins", "preferred_proteins TEXT DEFAULT '[]'")
_ensure_column("profiles", "favorite_cuisines", "favorite_cuisines TEXT DEFAULT '[]'")
_ensure_column("profiles", "variety_preference", "variety_preference VARCHAR DEFAULT 'balanced'")


# --- 2. SECURITY CONFIGURATION ---
SECRET_KEY = "SUPER_SECRET_KEY_FOR_DEMO"
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + timedelta(minutes=30)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- 3. DEPENDENCY ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserDB:
    creds_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Your session has expired. Sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise creds_error
    except jwt.PyJWTError:
        raise creds_error

    user = db.query(UserDB).filter(UserDB.email == email).first()
    if user is None:
        raise creds_error
    return user

# --- 4. PROFILE SCHEMAS ---
class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    age: Optional[int] = None
    height_cm: Optional[int] = None
    weight_kg: Optional[float] = None
    goal: Optional[str] = None
    experience: Optional[str] = None
    equipment: Optional[str] = None
    session_length: Optional[int] = None
    days_per_week: Optional[int] = None
    constraints: Optional[str] = None
    allergies: Optional[List[str]] = None
    diet_pattern: Optional[str] = None
    macro_focus: Optional[str] = None
    disliked_foods: Optional[str] = None
    favorite_foods: Optional[str] = None
    meals_per_day: Optional[str] = None
    daily_calorie_target: Optional[int] = None
    nutrition_notes: Optional[str] = None
    preferred_proteins: Optional[List[str]] = None
    favorite_cuisines: Optional[List[str]] = None
    variety_preference: Optional[str] = None

def load_json_list(raw: Optional[str]) -> List[str]:
    try:
        return json.loads(raw or "[]")
    except (json.JSONDecodeError, TypeError):
        return []

def load_allergies(profile: ProfileDB) -> List[str]:
    return load_json_list(profile.allergies)

def serialize_profile(user: UserDB, profile: ProfileDB) -> dict:
    return {
        "email": user.email,  # read-only, owned by the account
        "display_name": profile.display_name or "",
        "age": profile.age,
        "height_cm": profile.height_cm,
        "weight_kg": profile.weight_kg,
        "goal": profile.goal,
        "experience": profile.experience,
        "equipment": profile.equipment,
        "session_length": profile.session_length,
        "days_per_week": profile.days_per_week,
        "constraints": profile.constraints or "",
        "allergies": load_allergies(profile),
        "diet_pattern": profile.diet_pattern,
        "macro_focus": profile.macro_focus,
        "disliked_foods": profile.disliked_foods or "",
        "favorite_foods": profile.favorite_foods or "",
        "meals_per_day": profile.meals_per_day,
        "daily_calorie_target": profile.daily_calorie_target,
        "nutrition_notes": profile.nutrition_notes or "",
        "preferred_proteins": load_json_list(profile.preferred_proteins),
        "favorite_cuisines": load_json_list(profile.favorite_cuisines),
        "variety_preference": profile.variety_preference or "balanced",
    }

def get_or_create_profile(user: UserDB, db: Session) -> ProfileDB:
    profile = db.query(ProfileDB).filter(ProfileDB.user_id == user.id).first()
    if profile is None:
        profile = ProfileDB(user_id=user.id, display_name=user.email.split("@")[0])
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

# --- 5. GENERATED-LIBRARY SCHEMAS (the LLM's output contract) ---
# The model returns a LIBRARY of meals to rotate across two weeks, not one meal per day.
# extra=forbid rejects unexpected fields when validating the model's JSON.
class GenMacros(BaseModel):
    model_config = ConfigDict(extra="forbid")
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int

class GenTargets(BaseModel):
    model_config = ConfigDict(extra="forbid")
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int
    water_ml: int

CATEGORY_OPTIONS = ["produce", "protein", "dairy", "grains", "pantry", "frozen", "other"]
Category = Literal["produce", "protein", "dairy", "grains", "pantry", "frozen", "other"]

# Structured quantity + unit so a shopping list can sum and scale ingredients later.
# Free-text like "a handful" can't be aggregated, so the model must give real numbers.
class GenItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str            # canonical ingredient name, e.g. "chicken breast"
    quantity: float
    unit: str            # g / ml / tbsp / tsp / cup / whole / pinch
    note: str = ""       # optional prep note, e.g. "diced"
    category: Category = "other"  # aisle grouping for the shopping list

    # The model sometimes invents a category we didn't list (e.g. "supplement").
    # Rather than failing the whole plan over one mislabeled ingredient, fall
    # back to "other" so generation never breaks on this field.
    @field_validator("category", mode="before")
    @classmethod
    def _coerce_category(cls, value):
        if isinstance(value, str) and value.lower() in CATEGORY_OPTIONS:
            return value.lower()
        return "other"

class GenMeal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot: Literal["breakfast", "lunch", "dinner", "snack"]
    name: str
    description: str
    experimental: bool = False   # true = a new dish beyond the member's usual likes
    items: List[GenItem]
    macros: GenMacros

class GeneratedLibrary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: str
    targets: GenTargets
    meals: List[GenMeal]         # the rotation pool, grouped by slot

# The "try another meal" swap asks for one meal, not a whole library — wrap it
# so the JSON contract still round-trips through the same validation approach.
class GenSingleMeal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    meal: GenMeal

# A large library (many meals per slot, each with several ingredients) is a big
# JSON response, and it only takes one truncated or malformed meal object for
# strict whole-payload validation to throw the entire plan away. Instead: keep
# whatever meals ARE valid and only fail outright if none of them are.
def parse_generated_library(raw_json: str) -> GeneratedLibrary:
    try:
        return GeneratedLibrary.model_validate_json(raw_json)
    except ValidationError:
        pass  # fall through and salvage what we can, below

    data = json.loads(raw_json)  # if the JSON itself is broken, this raises and we give up
    valid_meals = []
    for raw_meal in data.get("meals", []):
        try:
            valid_meals.append(GenMeal.model_validate(raw_meal))
        except ValidationError:
            continue  # drop this one malformed meal, keep the rest of the plan
    if not valid_meals:
        raise ValueError("The model's response didn't contain any usable meals.")

    return GeneratedLibrary(
        summary=data["summary"],
        targets=GenTargets.model_validate(data["targets"]),
        meals=valid_meals,
    )

# --- 6. PROMPT BUILDING ---
SCHEDULE_LENGTH = 14

# How many distinct options to generate per meal slot for the two-week rotation.
# A fixed small pool (the old default was 4) guarantees repeats every few days
# regardless of anything else — this is the single biggest lever on variety.
# Kept modest: each option is a full meal object (name, description, several
# ingredients, macros), and asking for too many in one response risks the
# model truncating or dropping a field partway through.
LIBRARY_SIZE_BY_VARIETY = {
    "repeat_ok": 4,     # member said simpler shopping/prep matters more than novelty
    "balanced": 6,
    "new_daily": 8,
}

# Hard ceiling on slots * library_size — a member with 4 daily slots (e.g.
# breakfast/lunch/dinner/snack) requesting "max variety" would otherwise ask
# for 32 full meal objects in one response.
MAX_TOTAL_LIBRARY_MEALS = 24

def library_size_for(variety_preference: Optional[str], distinct_slot_count: int = 1) -> int:
    size = LIBRARY_SIZE_BY_VARIETY.get(variety_preference, LIBRARY_SIZE_BY_VARIETY["balanced"])
    distinct_slot_count = max(1, distinct_slot_count)
    return max(2, min(size, MAX_TOTAL_LIBRARY_MEALS // distinct_slot_count))

NUTRITION_SYSTEM_PROMPT = """You are GymXP's nutrition coach. You build a two-week eating plan that fits the member's goal and training.

Rules you must always follow:
- ALLERGIES ARE ABSOLUTE. Never include any ingredient the member is allergic to, and never include anything that commonly contains it.
- Respect the member's diet pattern (e.g. vegan, halal) exactly.
- Avoid disliked foods; favor the foods they enjoy.
- Return a LIBRARY of meals to rotate across the two weeks, NOT one unique meal per day. For each requested slot, give the requested number of distinct options. Repetition across days is expected and helps the member buy and prep in bulk.
- Within a single slot's options, maximize variety: don't let one primary protein (e.g. chicken breast) appear in more than about half of that slot's options, and vary cooking style and cuisine (grilled, roasted, stir-fried, braised, cold-prep; Italian, Mexican, Mediterranean, Asian, etc.) rather than defaulting to the same safe preparation repeatedly. This applies even when the member hasn't stated strong preferences — a thin profile is not a reason to play it safe with the same 1-2 proteins.
- Every item must have a numeric quantity and a simple unit so ingredients can be summed into a shopping list. Use canonical ingredient names ("chicken breast", not "grilled chicken breast strips").
- Tag every item with the grocery aisle category it belongs to (produce, protein, dairy, grains, pantry, frozen, other) so the shopping list can be grouped by aisle.
- Each meal's macros should be sensible for its slot; a full day of meals should sum to roughly the daily targets.
- Set experimental=true on options that go beyond the member's stated favourites to introduce something new they may enjoy. Base new ideas on what they already like.
- If no calorie target is given, estimate sensible targets from goal, body stats, and weekly training. Never propose a clinically low calorie target; for medical conditions, advise the member to consult a professional.
- This is general guidance, not medical or clinical advice.

Write a short, specific 'summary' explaining why this plan fits the member, then the targets and the meal library."""

# Groq's JSON mode returns valid JSON but doesn't enforce a schema, so spell out
# the exact shape and validate it with Pydantic afterwards.
PLAN_JSON_SHAPE = """Respond with ONLY a JSON object of this exact shape, no extra text:
{
  "summary": "string",
  "targets": {"calories": int, "protein_g": int, "carbs_g": int, "fat_g": int, "water_ml": int},
  "meals": [
    {
      "slot": "breakfast | lunch | dinner | snack",
      "name": "string",
      "description": "string",
      "experimental": false,
      "items": [
        {"name": "canonical ingredient", "quantity": number, "unit": "g|ml|tbsp|tsp|cup|whole|pinch", "note": "optional", "category": "produce|protein|dairy|grains|pantry|frozen|other"}
      ],
      "macros": {"calories": int, "protein_g": int, "carbs_g": int, "fat_g": int}
    }
  ]
}"""

# Same contract as one entry of PLAN_JSON_SHAPE's "meals" array, wrapped in an
# object — used when swapping out a single meal instead of a whole plan.
SINGLE_MEAL_JSON_SHAPE = """Respond with ONLY a JSON object of this exact shape, no extra text:
{
  "meal": {
    "slot": "breakfast | lunch | dinner | snack",
    "name": "string",
    "description": "string",
    "experimental": false,
    "items": [
      {"name": "canonical ingredient", "quantity": number, "unit": "g|ml|tbsp|tsp|cup|whole|pinch", "note": "optional", "category": "produce|protein|dairy|grains|pantry|frozen|other"}
    ],
    "macros": {"calories": int, "protein_g": int, "carbs_g": int, "fat_g": int}
  }
}"""

# Which slots each day uses, derived from the member's meals-per-day preference.
def slots_for(meals_per_day: str) -> List[str]:
    mapping = {
        "3": ["breakfast", "lunch", "dinner"],
        "4": ["breakfast", "lunch", "dinner", "snack"],
        "5": ["breakfast", "snack", "lunch", "dinner", "snack"],
        "Intermittent fasting": ["lunch", "dinner", "snack"],
    }
    return mapping.get(meals_per_day, ["breakfast", "lunch", "dinner"])

# How many times a member has actually eaten vs. skipped each meal, across every
# schedule they've ever had (not just the active one) — this is the signal that
# lets regeneration improve as the app gets used, not just repeat the last plan.
ADHERENCE_MIN_SAMPLES = 2  # ignore a meal until it's shown up at least this many times

def build_adherence_summary(user_id: int, db: Session):
    rows = (
        db.query(MealDB.name, ScheduleEntryDB.status, func.count(ScheduleEntryDB.id))
        .join(ScheduleEntryDB, ScheduleEntryDB.meal_id == MealDB.id)
        .filter(MealDB.user_id == user_id)
        .group_by(MealDB.name, ScheduleEntryDB.status)
        .all()
    )
    counts = {}
    for name, entry_status, count in rows:
        bucket = counts.setdefault(name, {"completed": 0, "skipped": 0})
        if entry_status in bucket:
            bucket[entry_status] += count

    finished_names, skipped_names = [], []
    for name, c in counts.items():
        total = c["completed"] + c["skipped"]
        if total < ADHERENCE_MIN_SAMPLES:
            continue
        if c["completed"] > c["skipped"]:
            finished_names.append(name)
        elif c["skipped"] > c["completed"]:
            skipped_names.append(name)
    return finished_names, skipped_names

VARIETY_INSTRUCTIONS = {
    "repeat_ok": "The member is fine with meals repeating across the two weeks — simpler shopping and prep matters more to them than novelty. A small rotation pool is fine.",
    "balanced": "The member wants a reasonable mix of familiar and new meals across the two weeks.",
    "new_daily": "The member wants maximum variety — avoid repeating the same meal more than twice across the two weeks if possible.",
}

def build_user_message(
    profile: ProfileDB, distinct_slots: List[str], liked_names: List[str],
    finished_names: Optional[List[str]] = None, skipped_names: Optional[List[str]] = None,
    disliked_names: Optional[List[str]] = None, library_size: int = 8,
) -> str:
    allergies = load_allergies(profile)
    preferred_proteins = load_json_list(profile.preferred_proteins)
    favorite_cuisines = load_json_list(profile.favorite_cuisines)
    variety_preference = profile.variety_preference or "balanced"

    lines = [
        "Build a two-week nutrition plan for this member.",
        "",
        f"Goal: {profile.goal}",
        f"Experience: {profile.experience}",
        f"Training: {profile.days_per_week} days/week, ~{profile.session_length} min sessions",
        f"Age: {profile.age or 'unknown'}, Height: {profile.height_cm or 'unknown'} cm, Weight: {profile.weight_kg or 'unknown'} kg",
        f"Diet pattern: {profile.diet_pattern}",
        f"Macro focus: {profile.macro_focus}",
        f"Allergies (ABSOLUTE — never include): {', '.join(allergies) if allergies else 'none'}",
        f"Disliked foods: {profile.disliked_foods or 'none'}",
        f"Favorite foods: {profile.favorite_foods or 'none'}",
        f"Preferred proteins to feature: {', '.join(preferred_proteins) if preferred_proteins else 'no preference stated — see variety note below'}",
        f"Favorite cuisines to draw from: {', '.join(favorite_cuisines) if favorite_cuisines else 'no preference stated — use a broad mix'}",
        VARIETY_INSTRUCTIONS.get(variety_preference, VARIETY_INSTRUCTIONS["balanced"]),
        f"Meal slots to cover: {', '.join(distinct_slots)}",
        f"For EACH slot above give {library_size} distinct options (a rotation pool, not one meal per day).",
        f"Meals the member already liked (make some new options similar to these): {', '.join(liked_names) if liked_names else 'none yet'}",
    ]

    # Cold start: an all-blank profile is exactly when the model tends to fall
    # back on the same 1-2 "safe" proteins — push it toward range instead.
    if not (profile.favorite_foods or profile.disliked_foods or profile.nutrition_notes
            or preferred_proteins or favorite_cuisines):
        lines.append(
            "The member hasn't shared specific food preferences yet — this is a great chance to "
            "showcase a wide range of proteins (poultry, red meat, fish/seafood, eggs, plant-based) "
            "and cuisines across the options, rather than defaulting to the same 1-2 proteins repeatedly."
        )

    if finished_names:
        lines.append(f"Meals the member reliably finishes (favor more dishes like these): {', '.join(finished_names)}")
    if skipped_names:
        lines.append(f"Meals the member often skips (avoid repeating these; try different flavors or prep): {', '.join(skipped_names)}")
    if disliked_names:
        lines.append(f"Meals the member explicitly disliked and swapped out (never repeat, avoid similar dishes): {', '.join(disliked_names)}")
    if profile.daily_calorie_target:
        lines.append(f"Daily calorie target: {profile.daily_calorie_target} kcal")
    else:
        lines.append("Daily calorie target: estimate it from the info above")
    if profile.nutrition_notes:
        lines.append(f"Other notes: {profile.nutrition_notes}")
    return "\n".join(lines)

# Prompt for the "try another meal" swap — one meal, same slot, distinct from
# whatever's already in that slot's rotation (and, for a full dislike, from the
# meal being replaced).
def build_replacement_message(profile: ProfileDB, slot: str, avoid_names: List[str], liked_names: List[str]) -> str:
    allergies = load_allergies(profile)
    lines = [
        f"Give ONE replacement {slot} option for this member's rotation.",
        "",
        f"Diet pattern: {profile.diet_pattern}",
        f"Macro focus: {profile.macro_focus}",
        f"Allergies (ABSOLUTE — never include): {', '.join(allergies) if allergies else 'none'}",
        f"Disliked foods: {profile.disliked_foods or 'none'}",
        f"Favorite foods: {profile.favorite_foods or 'none'}",
        f"Avoid repeating or closely resembling these meals already in the rotation: {', '.join(avoid_names) if avoid_names else 'none'}",
        f"Meals the member already liked (make something in a similar spirit, but a distinct dish): {', '.join(liked_names) if liked_names else 'none yet'}",
    ]
    if profile.daily_calorie_target:
        lines.append(f"Daily calorie target for the day: {profile.daily_calorie_target} kcal")
    if profile.nutrition_notes:
        lines.append(f"Other notes: {profile.nutrition_notes}")
    return "\n".join(lines)

# Rotate the library across the two weeks. Offsetting repeats keeps a second snack
# on the same day from matching the first.
def build_entries(schedule_id: int, library_by_slot: dict, day_slots: List[str], length_days: int) -> List[ScheduleEntryDB]:
    entries = []
    for day in range(length_days):
        seen = {}
        for slot in day_slots:
            pool = library_by_slot.get(slot, [])
            if not pool:
                continue
            occ = seen.get(slot, 0)
            meal_id = pool[(day + occ) % len(pool)]
            seen[slot] = occ + 1
            entries.append(ScheduleEntryDB(
                schedule_id=schedule_id, meal_id=meal_id,
                day_offset=day, slot=slot, status="planned",
            ))
    return entries

# --- 7. SERIALIZERS ---
_SLOT_ORDER = {"breakfast": 0, "lunch": 1, "dinner": 2, "snack": 3}

def serialize_meal(meal: MealDB) -> dict:
    body = json.loads(meal.meal_json)
    return {
        "id": meal.id,
        "slot": meal.slot,
        "name": meal.name,
        "description": meal.description or "",
        "liked": meal.liked,
        "experimental": meal.experimental,
        "items": body.get("items", []),
        "macros": body.get("macros", {}),
    }

def serialize_schedule(schedule: ScheduleDB, entries: List[ScheduleEntryDB], meals_by_id: dict) -> dict:
    by_day = {}
    for e in entries:
        meal = meals_by_id.get(e.meal_id)
        if meal is None:
            continue
        by_day.setdefault(e.day_offset, []).append({
            "entry_id": e.id,
            "slot": e.slot,
            "status": e.status,
            "meal": serialize_meal(meal),
        })

    days = []
    for offset in range(schedule.length_days):
        day_entries = sorted(by_day.get(offset, []), key=lambda x: _SLOT_ORDER.get(x["slot"], 9))
        days.append({
            "day_offset": offset,
            "date": (schedule.start_date + timedelta(days=offset)).isoformat(),
            "entries": day_entries,
        })

    return {
        "schedule_id": schedule.id,
        "start_date": schedule.start_date.isoformat(),
        "length_days": schedule.length_days,
        "status": schedule.status,
        "summary": schedule.summary,
        "targets": json.loads(schedule.targets_json),
        "days": days,
    }

# Pull a schedule row and hydrate it with its entries + meals.
def serialize_schedule_full(schedule: ScheduleDB, db: Session) -> dict:
    entries = db.query(ScheduleEntryDB).filter(ScheduleEntryDB.schedule_id == schedule.id).all()
    meal_ids = {e.meal_id for e in entries}
    meals = db.query(MealDB).filter(MealDB.id.in_(meal_ids)).all() if meal_ids else []
    return serialize_schedule(schedule, entries, {m.id: m for m in meals})

def load_active_schedule(user: UserDB, db: Session):
    schedule = (
        db.query(ScheduleDB)
        .filter(ScheduleDB.user_id == user.id, ScheduleDB.status == "active")
        .order_by(ScheduleDB.created_at.desc())
        .first()
    )
    if schedule is None:
        return None
    return serialize_schedule_full(schedule, db)

# --- 8. FASTAPI APP & CORS ---
app = FastAPI()

# Configured exactly once so all endpoints below are accessible by the React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows your Vite frontend port to connect seamlessly
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 9. AUTH ENDPOINTS ---
@app.post("/register")
def register(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # form_data.username captures whatever string was passed into the username input slot
    if db.query(UserDB).filter(UserDB.email == form_data.username).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = UserDB(email=form_data.username, hashed_password=hash_password(form_data.password))
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": f"Account for {new_user.email} created successfully!"}

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Check incoming email against the email column in SQLite
    user = db.query(UserDB).filter(UserDB.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# --- 10. PROFILE ENDPOINTS ---
@app.get("/profile")
def read_profile(user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    return serialize_profile(user, get_or_create_profile(user, db))

@app.put("/profile")
def update_profile(updates: ProfileUpdate, user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = get_or_create_profile(user, db)
    changes = updates.model_dump(exclude_unset=True)
    # These three are stored as JSON text, so set them separately.
    for list_field in ("allergies", "preferred_proteins", "favorite_cuisines"):
        if list_field in changes:
            setattr(profile, list_field, json.dumps(changes.pop(list_field)))
    for field, value in changes.items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return serialize_profile(user, profile)

# --- 11. SCHEDULE ENDPOINTS ---
@app.post("/schedule")
def generate_schedule(replace: bool = False, user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    # Refuse to clobber an existing plan unless the client explicitly confirms with ?replace=true.
    active = db.query(ScheduleDB).filter(ScheduleDB.user_id == user.id, ScheduleDB.status == "active").first()
    if active and not replace:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active plan. Confirm to replace it.",
        )

    profile = get_or_create_profile(user, db)
    day_slots = slots_for(profile.meals_per_day)
    distinct_slots = list(dict.fromkeys(day_slots))  # de-duped, order preserved
    liked_names = [m.name for m in db.query(MealDB).filter(MealDB.user_id == user.id, MealDB.liked == True).all()]
    disliked_names = [m.name for m in db.query(MealDB).filter(MealDB.user_id == user.id, MealDB.disliked == True).all()]
    finished_names, skipped_names = build_adherence_summary(user.id, db)
    library_size = library_size_for(profile.variety_preference, len(distinct_slots))

    try:
        # Groq is OpenAI-compatible, so reuse the OpenAI client against its endpoint.
        client = OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=os.environ.get("GROQ_API_KEY"),
        )
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.6,
            max_tokens=8000,  # a full library (up to MAX_TOTAL_LIBRARY_MEALS meals) needs real headroom
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": NUTRITION_SYSTEM_PROMPT + "\n\n" + PLAN_JSON_SHAPE},
                {"role": "user", "content": build_user_message(
                    profile, distinct_slots, liked_names,
                    finished_names=finished_names, skipped_names=skipped_names, disliked_names=disliked_names,
                    library_size=library_size,
                )},
            ],
        )
        library = parse_generated_library(response.choices[0].message.content)
    except Exception as error:
        # Missing key, network failure, or a bad model response.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not generate a plan right now: {error}",
        )

    # Save every library meal, grouped by slot so we can rotate them into days.
    meals_by_slot = {}
    for gm in library.meals:
        row = MealDB(
            user_id=user.id,
            slot=gm.slot,
            name=gm.name,
            description=gm.description,
            experimental=gm.experimental,
            liked=False,
            meal_json=json.dumps({
                "items": [i.model_dump() for i in gm.items],
                "macros": gm.macros.model_dump(),
            }),
        )
        db.add(row)
        meals_by_slot.setdefault(gm.slot, []).append(row)
    db.flush()  # assign meal ids before building entries

    library_by_slot = {slot: [m.id for m in rows] for slot, rows in meals_by_slot.items()}

    # Archive the old active plan so past two weeks can still be recalled.
    db.query(ScheduleDB).filter(
        ScheduleDB.user_id == user.id, ScheduleDB.status == "active"
    ).update({"status": "archived"})

    schedule = ScheduleDB(
        user_id=user.id,
        start_date=date.today(),
        length_days=SCHEDULE_LENGTH,
        status="active",
        summary=library.summary,
        targets_json=json.dumps(library.targets.model_dump()),
    )
    db.add(schedule)
    db.flush()

    for entry in build_entries(schedule.id, library_by_slot, day_slots, SCHEDULE_LENGTH):
        db.add(entry)
    db.commit()

    return load_active_schedule(user, db)

@app.get("/schedule")
def get_schedule(user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    schedule = load_active_schedule(user, db)
    if schedule is None:
        # No plan yet — let the client show a "Generate" empty state.
        raise HTTPException(status_code=404, detail="No active schedule yet.")
    return schedule

# Mark a single meal eaten/skipped. This adherence data feeds future prompts later.
class EntryStatusUpdate(BaseModel):
    status: Literal["planned", "completed", "skipped"]

@app.patch("/schedule/entries/{entry_id}")
def update_entry_status(entry_id: int, update: EntryStatusUpdate,
                        user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    # Join to the schedule so a member can only touch their own entries.
    entry = (
        db.query(ScheduleEntryDB)
        .join(ScheduleDB, ScheduleEntryDB.schedule_id == ScheduleDB.id)
        .filter(ScheduleEntryDB.id == entry_id, ScheduleDB.user_id == user.id)
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Meal not found on your plan.")
    entry.status = update.status
    db.commit()
    return {"entry_id": entry.id, "status": entry.status}

# Favourite/unfavourite a meal. Liking clears any prior dislike signal on it —
# feeds straight into build_user_message's liked_names for future generations.
class MealLikedUpdate(BaseModel):
    liked: bool

@app.patch("/meals/{meal_id}/liked")
def update_meal_liked(meal_id: int, update: MealLikedUpdate,
                      user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    meal = db.query(MealDB).filter(MealDB.id == meal_id, MealDB.user_id == user.id).first()
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found.")
    meal.liked = update.liked
    if update.liked:
        meal.disliked = False
    db.commit()
    return {"id": meal.id, "liked": meal.liked, "disliked": meal.disliked}

# "Try another meal" — swap a single entry's meal, or every occurrence of it in
# the active plan, for a freshly generated alternative in the same slot.
class MealReplaceRequest(BaseModel):
    scope: Literal["single", "all"] = "single"

@app.post("/schedule/entries/{entry_id}/replace-meal")
def replace_meal(entry_id: int, body: MealReplaceRequest,
                 user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    entry = (
        db.query(ScheduleEntryDB)
        .join(ScheduleDB, ScheduleEntryDB.schedule_id == ScheduleDB.id)
        .filter(ScheduleEntryDB.id == entry_id, ScheduleDB.user_id == user.id)
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Meal not found on your plan.")

    old_meal = db.query(MealDB).filter(MealDB.id == entry.meal_id).first()
    if old_meal is None:
        raise HTTPException(status_code=404, detail="Original meal not found.")

    schedule = db.query(ScheduleDB).filter(ScheduleDB.id == entry.schedule_id).first()
    profile = get_or_create_profile(user, db)

    # Meals already in this slot's rotation, so the LLM doesn't hand back a near-duplicate.
    sibling_entries = db.query(ScheduleEntryDB).filter(
        ScheduleEntryDB.schedule_id == schedule.id, ScheduleEntryDB.slot == old_meal.slot,
    ).all()
    sibling_meal_ids = {e.meal_id for e in sibling_entries}
    sibling_meals = db.query(MealDB).filter(MealDB.id.in_(sibling_meal_ids)).all() if sibling_meal_ids else []
    avoid_names = list(dict.fromkeys([m.name for m in sibling_meals]))

    liked_names = [m.name for m in db.query(MealDB).filter(MealDB.user_id == user.id, MealDB.liked == True).all()]

    try:
        client = OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=os.environ.get("GROQ_API_KEY"),
        )
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=1500,  # one meal object — small, but leaves headroom over the default
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": NUTRITION_SYSTEM_PROMPT + "\n\n" + SINGLE_MEAL_JSON_SHAPE},
                {"role": "user", "content": build_replacement_message(profile, old_meal.slot, avoid_names, liked_names)},
            ],
        )
        gm = GenSingleMeal.model_validate_json(response.choices[0].message.content).meal
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not find a replacement right now: {error}",
        )

    new_meal = MealDB(
        user_id=user.id,
        slot=gm.slot,
        name=gm.name,
        description=gm.description,
        experimental=gm.experimental,
        liked=False,
        meal_json=json.dumps({
            "items": [i.model_dump() for i in gm.items],
            "macros": gm.macros.model_dump(),
        }),
    )
    db.add(new_meal)
    db.flush()

    if body.scope == "all":
        # Whole rotation gets the swap, and the old meal is flagged so future
        # generations know to avoid it and anything like it.
        db.query(ScheduleEntryDB).filter(
            ScheduleEntryDB.schedule_id == schedule.id, ScheduleEntryDB.meal_id == old_meal.id,
        ).update({"meal_id": new_meal.id})
        old_meal.disliked = True
        old_meal.liked = False
    else:
        # Just this one day/occurrence — the meal stays in rotation elsewhere.
        entry.meal_id = new_meal.id

    db.commit()
    return load_active_schedule(user, db)

# Past plans, newest first, so the member can recall what they ate.
@app.get("/schedules")
def list_schedules(user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(ScheduleDB)
        .filter(ScheduleDB.user_id == user.id)
        .order_by(ScheduleDB.created_at.desc())
        .all()
    )
    return [
        {
            "schedule_id": r.id,
            "start_date": r.start_date.isoformat(),
            "length_days": r.length_days,
            "status": r.status,
            "summary": r.summary,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]

# Aisle order the shopping list groups items into — mirrors a typical store walk.
CATEGORY_ORDER = ["produce", "protein", "dairy", "grains", "pantry", "frozen", "other"]

# Bump small-unit totals up to the bigger unit once they cross 1000 (1000g -> 1kg),
# since nobody wants to read "2400 g of rice" on a shopping list.
def normalize_unit(total: float, unit: str):
    bump = {"g": "kg", "ml": "l"}
    if unit in bump and total >= 1000:
        return round(total / 1000, 2), bump[unit]
    return round(total, 2), unit

# Aggregate every ingredient across the active plan into one shopping list.
# Quantities are per single serving, so multiply by `people` to feed a household.
# Declared before /schedule/{schedule_id} so the literal path wins over the int route.
@app.get("/schedule/shopping-list")
def shopping_list(people: int = 1, user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    people = max(1, people)

    schedule = (
        db.query(ScheduleDB)
        .filter(ScheduleDB.user_id == user.id, ScheduleDB.status == "active")
        .order_by(ScheduleDB.created_at.desc())
        .first()
    )
    if schedule is None:
        raise HTTPException(status_code=404, detail="No active schedule yet.")

    entries = db.query(ScheduleEntryDB).filter(ScheduleEntryDB.schedule_id == schedule.id).all()
    meals = {m.id: m for m in db.query(MealDB).filter(MealDB.id.in_({e.meal_id for e in entries})).all()} if entries else {}

    # Group by (ingredient name, unit) — different units for the same food can't be summed.
    agg = {}
    for e in entries:
        meal = meals.get(e.meal_id)
        if meal is None:
            continue
        the_date = (schedule.start_date + timedelta(days=e.day_offset)).isoformat()
        for item in json.loads(meal.meal_json).get("items", []):
            name = (item.get("name") or "").strip()
            unit = item.get("unit") or ""
            category = item.get("category") or "other"
            per_meal = float(item.get("quantity") or 0) * people  # scaled to household size
            key = (name.lower(), unit)

            bucket = agg.setdefault(key, {
                "name": name, "unit": unit, "category": category, "total": 0.0, "uses": {},
            })
            bucket["total"] += per_meal

            # One "use" per meal this ingredient appears in; collect the days it's needed.
            use = bucket["uses"].setdefault(meal.id, {
                "meal_name": meal.name,
                "slot": meal.slot,
                "per_meal_quantity": round(per_meal, 2),
                "days": [],
            })
            use["days"].append(the_date)

    items = []
    for bucket in agg.values():
        uses = []
        for u in bucket["uses"].values():
            uses.append({
                "meal_name": u["meal_name"],
                "slot": u["slot"],
                "per_meal_quantity": u["per_meal_quantity"],
                "occurrences": len(u["days"]),
                "days": sorted(set(u["days"])),
                "subtotal": round(u["per_meal_quantity"] * len(u["days"]), 2),
            })
        uses.sort(key=lambda x: (-x["subtotal"], x["meal_name"]))
        total_quantity, unit = normalize_unit(bucket["total"], bucket["unit"])
        items.append({
            "name": bucket["name"],
            "unit": unit,
            "category": bucket["category"],
            "total_quantity": total_quantity,
            "uses": uses,
        })
    items.sort(key=lambda x: (
        CATEGORY_ORDER.index(x["category"]) if x["category"] in CATEGORY_ORDER else len(CATEGORY_ORDER),
        x["name"].lower(),
    ))

    return {
        "people": people,
        "start_date": schedule.start_date.isoformat(),
        "length_days": schedule.length_days,
        "items": items,
    }

# Open any of the member's own plans (active or archived) for read-only viewing.
@app.get("/schedule/{schedule_id}")
def get_schedule_by_id(schedule_id: int,
                       user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    schedule = (
        db.query(ScheduleDB)
        .filter(ScheduleDB.id == schedule_id, ScheduleDB.user_id == user.id)
        .first()
    )
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return serialize_schedule_full(schedule, db)

@app.get("/protected-profile")
def get_profile(user: UserDB = Depends(get_current_user)):
    return {"message": f"Welcome back, {user.email}! This is your private health data."}
