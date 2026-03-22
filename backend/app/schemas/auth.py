from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class SessionUser(BaseModel):
    id: int
    username: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: SessionUser


class AdminAccessUpdateRequest(BaseModel):
    username: str
    current_password: str
    new_password: str = ""


class AdminAccessUpdateResponse(BaseModel):
    message: str
    user: SessionUser
