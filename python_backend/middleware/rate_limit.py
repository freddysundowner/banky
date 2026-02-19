"""
Simple in-memory rate limiter for authentication endpoints.
Prevents brute-force attacks on login and registration.
"""

import time
from collections import defaultdict
from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self):
        self._attempts: dict[str, list[float]] = defaultdict(list)
    
    def _cleanup(self, key: str, window: int):
        now = time.time()
        self._attempts[key] = [t for t in self._attempts[key] if now - t < window]
    
    def check(self, key: str, max_attempts: int, window_seconds: int):
        self._cleanup(key, window_seconds)
        if len(self._attempts[key]) >= max_attempts:
            raise HTTPException(
                status_code=429,
                detail=f"Too many attempts. Please try again in {window_seconds // 60} minutes."
            )
        self._attempts[key].append(time.time())
    
    def reset(self, key: str):
        self._attempts.pop(key, None)


login_limiter = RateLimiter()
register_limiter = RateLimiter()


def check_login_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    login_limiter.check(f"login:{client_ip}", max_attempts=10, window_seconds=900)


def check_register_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    register_limiter.check(f"register:{client_ip}", max_attempts=5, window_seconds=3600)


def reset_login_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    login_limiter.reset(f"login:{client_ip}")


forgot_password_limiter = RateLimiter()


def check_forgot_password_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    forgot_password_limiter.check(f"forgot_password:{client_ip}", max_attempts=5, window_seconds=900)
