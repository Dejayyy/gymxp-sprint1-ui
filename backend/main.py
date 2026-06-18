from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
import bcrypt
import jwt

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

# One profile row per user. Kept in a separate table so the existing users
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
    session_length = Column(Integer, default=45)   # minutes per session
    days_per_week = Column(Integer, default=4)
    diet_pref = Column(String, default="High protein")
    constraints = Column(String, default="")       # e.g. "Avoid high-impact knee movements"

# Generates database file and tables safely
Base.metadata.create_all(bind=engine)

# --- 2. SECURITY CONFIGURATION ---
SECRET_KEY = "SUPER_SECRET_KEY_FOR_DEMO"
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- 3. DEPENDENCIES ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Decodes the bearer token and returns the matching user, or raises 401.
# Shared by every endpoint that needs to know who is signed in.
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

# --- 4. SCHEMAS ---
# Everything the client may send when saving the profile. All optional so a
# partial save only touches the fields that were actually edited.
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
    diet_pref: Optional[str] = None
    constraints: Optional[str] = None

def serialize_profile(user: UserDB, profile: ProfileDB) -> dict:
    return {
        "email": user.email,  # read-only, comes from the account
        "display_name": profile.display_name or "",
        "age": profile.age,
        "height_cm": profile.height_cm,
        "weight_kg": profile.weight_kg,
        "goal": profile.goal,
        "experience": profile.experience,
        "equipment": profile.equipment,
        "session_length": profile.session_length,
        "days_per_week": profile.days_per_week,
        "diet_pref": profile.diet_pref,
        "constraints": profile.constraints or "",
    }

def get_or_create_profile(user: UserDB, db: Session) -> ProfileDB:
    profile = db.query(ProfileDB).filter(ProfileDB.user_id == user.id).first()
    if profile is None:
        # Seed a sensible starting profile the first time it's requested.
        profile = ProfileDB(user_id=user.id, display_name=user.email.split("@")[0])
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

# --- 5. FASTAPI APP INITIALIZATION & CORS BRIDGE ---
app = FastAPI()

# Configured exactly once so all endpoints below are accessible by the React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows Vite frontend port to connect seamlessly
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 6. ENDPOINTS ---

@app.post("/register")
def register(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # form_data.username captures whatever string was passed into the username input slot
    existing_user = db.query(UserDB).filter(UserDB.email == form_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = UserDB(
        email=form_data.username,
        hashed_password=hash_password(form_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": f"Account for {new_user.email} created successfully!"}

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Check incoming email against the email column in SQLite
    user = db.query(UserDB).filter(UserDB.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# Returns the signed-in user's profile, creating a default one on first visit.
@app.get("/profile")
def read_profile(user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = get_or_create_profile(user, db)
    return serialize_profile(user, profile)

# Saves edits. Only the fields present in the request body are changed; email
# is owned by the account and cannot be updated here.
@app.put("/profile")
def update_profile(
    updates: ProfileUpdate,
    user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(user, db)
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return serialize_profile(user, profile)

@app.get("/protected-profile")
def get_profile(user: UserDB = Depends(get_current_user)):
    return {"message": f"Welcome back, {user.email}! This is your private health data."}
