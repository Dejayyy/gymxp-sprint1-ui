from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
import bcrypt

# --- 1. DATABASE CONFIGURATION ---
# This creates a local SQLite file named "workout_demo.db" in your project folder
DATABASE_URL = "sqlite:///./workout_demo.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Define how our User table looks in SQLite
class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

# Create the database table if it doesn't exist yet
Base.metadata.create_all(bind=engine)

# # --- 2. SECURITY CONFIGURATION ---
# # Security configuration for JWT tokens and password hashing
# SECRET_KEY = "SUPER_SECRET_KEY_FOR_DEMO"  # In production, keep this hidden!
# ALGORITHM = "HS256"
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", truncate_error=False)
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# # Helper functions to handle passwords
# def hash_password(password: str):
#     return pwd_context.hash(password)

# def verify_password(plain_password, hashed_password):
#     return pwd_context.verify(plain_password, hashed_password)

# # Helper function to generate a JWT access token
# def create_access_token(data: dict):
#     to_encode = data.copy()
#     expire = datetime.utcnow() + timedelta(minutes=30)  # Token lasts 30 mins
#     to_encode.update({"exp": expire})
#     return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- 2. MODERN SECURITY CONFIGURATION (No passlib needed) ---
SECRET_KEY = "SUPER_SECRET_KEY_FOR_DEMO"  # In production, keep this hidden!
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Modern native Python-Bcrypt functions
def hash_password(password: str) -> str:
    # Convert text password to bytes, generate a salt, and hash it
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')  # Decode back to a text string for SQLite storage

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Convert both back to bytes to safely compare them
    pwd_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- 3. DEPENDENCY ---
# Yields a database session for each request and closes it when done
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 4. FASTAPI APP & ENDPOINTS ---
app = FastAPI()

@app.post("/register")
def register(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(UserDB).filter(UserDB.username == form_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Hash the password and save to SQLite
    new_user = UserDB(
        username=form_data.username,
        hashed_password=hash_password(form_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": f"User {new_user.username} created successfully!"}

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Look up user in the database
    user = db.query(UserDB).filter(UserDB.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    # Generate and return a secure JWT token
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/protected-profile")
def get_profile(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # This endpoint checks if a valid JWT token was provided
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    return {"message": f"Welcome back, {username}! This is your private health data."}