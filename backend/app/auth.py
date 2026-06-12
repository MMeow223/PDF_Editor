import hashlib
import hmac
import secrets

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from .db import get_db

SESSION_COOKIE = "session"
SESSION_DAYS = 30
_PBKDF2_ITERATIONS = 210_000

router = APIRouter(prefix="/auth", tags=["auth"])


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), _PBKDF2_ITERATIONS
    )
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt, digest = stored.split("$", 1)
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), _PBKDF2_ITERATIONS
    )
    return hmac.compare_digest(candidate.hex(), digest)


def user_for_token(token: str):
    return get_db().execute(
        """SELECT u.id, u.username FROM sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.token = ? AND s.created_at > datetime('now', ?)""",
        (token, f"-{SESSION_DAYS} days"),
    ).fetchone()


def owns_document(user_id: int, doc_id: str) -> bool:
    row = get_db().execute(
        "SELECT 1 FROM documents WHERE id = ? AND owner_id = ?", (doc_id, user_id)
    ).fetchone()
    return row is not None


def _start_session(response: Response, user_id: int) -> None:
    token = secrets.token_hex(32)
    db = get_db()
    db.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    db.commit()
    response.set_cookie(
        SESSION_COOKIE, token,
        httponly=True, samesite="lax", max_age=SESSION_DAYS * 86400,
    )


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[\w.@-]+$")
    password: str = Field(min_length=6, max_length=128)


@router.post("/register", status_code=201)
def register(creds: Credentials, response: Response):
    db = get_db()
    existing = db.execute(
        "SELECT 1 FROM users WHERE username = ?", (creds.username,)
    ).fetchone()
    if existing:
        raise HTTPException(409, "Username already taken")
    cur = db.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (creds.username, hash_password(creds.password)),
    )
    user_id = cur.lastrowid
    # First account adopts documents uploaded before auth existed
    if db.execute("SELECT COUNT(*) c FROM users").fetchone()["c"] == 1:
        db.execute("UPDATE documents SET owner_id = ? WHERE owner_id IS NULL", (user_id,))
    db.commit()
    _start_session(response, user_id)
    return {"id": user_id, "username": creds.username}


@router.post("/login")
def login(creds: Credentials, response: Response):
    row = get_db().execute(
        "SELECT id, password_hash FROM users WHERE username = ?", (creds.username,)
    ).fetchone()
    if row is None or not verify_password(creds.password, row["password_hash"]):
        raise HTTPException(401, "Invalid username or password")
    _start_session(response, row["id"])
    return {"id": row["id"], "username": creds.username}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        db = get_db()
        db.execute("DELETE FROM sessions WHERE token = ?", (token,))
        db.commit()
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@router.get("/me")
def me(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    user = user_for_token(token) if token else None
    if user is None:
        raise HTTPException(401, "Not authenticated")
    return {"id": user["id"], "username": user["username"]}
