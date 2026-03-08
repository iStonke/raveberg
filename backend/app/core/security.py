from __future__ import annotations

import hashlib
import hmac
import secrets


def hash_password(password: str, salt: str | None = None) -> str:
    password_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        password_salt.encode("utf-8"),
        200_000,
    )
    return f"{password_salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    salt, _, known_digest = stored_hash.partition("$")
    if not salt or not known_digest:
        return False

    calculated = hash_password(password, salt).partition("$")[2]
    return hmac.compare_digest(calculated, known_digest)


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
