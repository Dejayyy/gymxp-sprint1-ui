from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, ForeignKey, DateTime, Date
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta, date
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict
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

# One row per generated plan, kept for history.
class NutritionPlanDB(Base):
    __tablename__ = "nutrition_plans"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    plan_date = Column(Date, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="active")  # active / archived
    plan_json = Column(Text)                   # the GeneratedPlan payload, as JSON

Base.metadata.create_all(bind=engine)

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

def load_allergies(profile: ProfileDB) -> List[str]:
    try:
        return json.loads(profile.allergies or "[]")
    except (json.JSONDecodeError, TypeError):
        return []

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
    }

def get_or_create_profile(user: UserDB, db: Session) -> ProfileDB:
    profile = db.query(ProfileDB).filter(ProfileDB.user_id == user.id).first()
    if profile is None:
        profile = ProfileDB(user_id=user.id, display_name=user.email.split("@")[0])
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

# --- 5. GENERATED-PLAN SCHEMAS (the LLM's output contract) ---
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

class GenItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    qty: str

class GenMeal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    slot: Literal["breakfast", "lunch", "dinner", "snack"]
    name: str
    description: str
    items: List[GenItem]
    macros: GenMacros

class GeneratedPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: str
    targets: GenTargets
    meals: List[GenMeal]

# --- 6. PROMPT BUILDING ---
NUTRITION_SYSTEM_PROMPT = """You are GymXP's nutrition coach. You build one day of eating that fits the member's goal and training.

Rules you must always follow:
- ALLERGIES ARE ABSOLUTE. Never include any ingredient the member is allergic to, and never include anything that commonly contains it.
- Respect the member's diet pattern (e.g. vegan, halal) exactly.
- Avoid disliked foods; favor the foods they enjoy.
- Build exactly the requested number of meals. Each meal's macros should sum to roughly the daily targets.
- If no calorie target is given, estimate sensible targets from goal, body stats, and weekly training. Never propose a clinically low calorie target; for medical conditions, advise the member to consult a professional.
- This is general guidance, not medical or clinical advice.

Write a short, specific 'summary' explaining why this plan fits the member, then the targets and meals."""

# Groq's JSON mode returns valid JSON but doesn't enforce a schema, so spell out
# the exact shape and validate it with Pydantic afterwards.
PLAN_JSON_SHAPE = """Respond with ONLY a JSON object of this exact shape, no extra text:
{
  "summary": "string",
  "targets": {"calories": int, "protein_g": int, "carbs_g": int, "fat_g": int, "water_ml": int},
  "meals": [
    {
      "id": "m1",
      "slot": "breakfast | lunch | dinner | snack",
      "name": "string",
      "description": "string",
      "items": [{"id": "m1-i1", "name": "string", "qty": "string"}],
      "macros": {"calories": int, "protein_g": int, "carbs_g": int, "fat_g": int}
    }
  ]
}"""

def build_user_message(profile: ProfileDB) -> str:
    allergies = load_allergies(profile)
    lines = [
        "Build today's nutrition plan for this member.",
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
        f"Meals per day: {profile.meals_per_day}",
    ]
    if profile.daily_calorie_target:
        lines.append(f"Daily calorie target: {profile.daily_calorie_target} kcal")
    else:
        lines.append("Daily calorie target: estimate it from the info above")
    if profile.nutrition_notes:
        lines.append(f"Other notes: {profile.nutrition_notes}")
    return "\n".join(lines)

# Re-assign stable ids so refinement can reference meals and items.
def normalize_ids(plan: GeneratedPlan) -> dict:
    data = plan.model_dump()
    for m_index, meal in enumerate(data["meals"], start=1):
        meal["id"] = f"m{m_index}"
        for i_index, item in enumerate(meal["items"], start=1):
            item["id"] = f"m{m_index}-i{i_index}"
    return data

def serialize_plan(row: NutritionPlanDB) -> dict:
    plan = json.loads(row.plan_json)
    return {
        "plan_id": row.id,
        "plan_date": row.plan_date.isoformat() if row.plan_date else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "status": row.status,
        **plan,  # summary, targets, meals
    }

# --- 7. FASTAPI APP & CORS ---
app = FastAPI()

# Configured exactly once so all endpoints below are accessible by the React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows your Vite frontend port to connect seamlessly
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 8. AUTH ENDPOINTS ---
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

# --- 9. PROFILE ENDPOINTS ---
@app.get("/profile")
def read_profile(user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    return serialize_profile(user, get_or_create_profile(user, db))

@app.put("/profile")
def update_profile(updates: ProfileUpdate, user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = get_or_create_profile(user, db)
    changes = updates.model_dump(exclude_unset=True)
    # allergies is JSON text, so set it separately.
    if "allergies" in changes:
        profile.allergies = json.dumps(changes.pop("allergies"))
    for field, value in changes.items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return serialize_profile(user, profile)

# --- 10. NUTRITION ENDPOINTS ---
@app.post("/nutrition-plan")
def generate_nutrition_plan(user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = get_or_create_profile(user, db)

    try:
        # Groq is OpenAI-compatible, so reuse the OpenAI client against its endpoint.
        client = OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=os.environ.get("GROQ_API_KEY"),
        )
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.6,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": NUTRITION_SYSTEM_PROMPT + "\n\n" + PLAN_JSON_SHAPE},
                {"role": "user", "content": build_user_message(profile)},
            ],
        )
        plan = GeneratedPlan.model_validate_json(response.choices[0].message.content)
    except Exception as error:
        # Missing key, network failure, or a bad model response.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not generate a plan right now: {error}",
        )

    normalized = normalize_ids(plan)

    # Archive any previous active plan for today, then store the new one.
    today = date.today()
    db.query(NutritionPlanDB).filter(
        NutritionPlanDB.user_id == user.id,
        NutritionPlanDB.plan_date == today,
        NutritionPlanDB.status == "active",
    ).update({"status": "archived"})

    row = NutritionPlanDB(
        user_id=user.id,
        plan_date=today,
        status="active",
        plan_json=json.dumps(normalized),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize_plan(row)

@app.get("/nutrition-plan")
def get_nutrition_plan(user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    row = (
        db.query(NutritionPlanDB)
        .filter(NutritionPlanDB.user_id == user.id, NutritionPlanDB.status == "active")
        .order_by(NutritionPlanDB.created_at.desc())
        .first()
    )
    if row is None:
        # No plan yet — let the client show a "Generate" empty state.
        raise HTTPException(status_code=404, detail="No active nutrition plan yet.")
    return serialize_plan(row)

@app.get("/protected-profile")
def get_profile(user: UserDB = Depends(get_current_user)):
    return {"message": f"Welcome back, {user.email}! This is your private health data."}
