from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta
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

# --- 3. DEPENDENCY ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 4. FASTAPI APP INITIALIZATION & CORS BRIDGE ---
app = FastAPI()

# Configured exactly once so all endpoints below are accessible by the React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows your Vite frontend port to connect seamlessly
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"], 
)

# --- 5. ENDPOINTS ---

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

@app.get("/protected-profile")
def get_profile(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    return {"message": f"Welcome back, {email}! This is your private health data."}