from typing import List, Union, Optional
from pydantic import AnyHttpUrl, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "ACCESSWAY AI — Accessible Campus Navigator API"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    APP_ENVIRONMENT: Optional[str] = None
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS configuration
    CORS_ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    @field_validator("CORS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Database & Supabase settings
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/accessway"
    SUPABASE_URL: str = "https://placeholder-project.supabase.co"
    SUPABASE_SERVICE_ROLE_KEY: str = "placeholder-service-role-key"

    # Security & Auth
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD_HASH: str = "$2b$12$placeholderHashForDevOnly"
    JWT_SECRET_KEY: str = "temporary-development-jwt-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 120

    # Safety & Demonstration
    IS_SYNTHETIC_DATA_MODE: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if v and isinstance(v, str):
            v_clean = v.strip()
            if v_clean.startswith("postgresql://"):
                return v_clean.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif v_clean.startswith("sqlite://") and not v_clean.startswith("sqlite+aiosqlite://"):
                return v_clean.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return v

    @model_validator(mode="after")
    def validate_production_configuration(self) -> "Settings":
        # Synchronize APP_ENV and APP_ENVIRONMENT
        if self.APP_ENVIRONMENT:
            self.APP_ENV = self.APP_ENVIRONMENT.strip().lower()
        else:
            self.APP_ENV = self.APP_ENV.strip().lower()

        if self.APP_ENV == "production":
            db = self.DATABASE_URL.lower().strip()
            if not db or "placeholder" in db or "your_password_here" in db:
                raise ValueError("PRODUCTION_CONFIG_ERROR: DATABASE_URL must be configured with authentic production credentials.")
            if "sqlite" in db:
                raise ValueError("PRODUCTION_CONFIG_ERROR: SQLite is strictly forbidden in production. PostgreSQL connection is mandatory.")
            if not (db.startswith("postgresql+asyncpg://") or db.startswith("postgresql://")):
                raise ValueError("PRODUCTION_CONFIG_ERROR: DATABASE_URL must use PostgreSQL dialect.")

            sb_url = self.SUPABASE_URL.lower().strip()
            if not sb_url or "placeholder" in sb_url:
                raise ValueError("PRODUCTION_CONFIG_ERROR: SUPABASE_URL must be configured with authentic project URL in production.")

            sb_key = self.SUPABASE_SERVICE_ROLE_KEY.strip()
            if not sb_key or sb_key.startswith("placeholder"):
                raise ValueError("PRODUCTION_CONFIG_ERROR: SUPABASE_SERVICE_ROLE_KEY must be configured with authentic secret in production.")

            jwt_key = self.JWT_SECRET_KEY.strip()
            if not jwt_key or "temporary-development" in jwt_key or len(jwt_key) < 32:
                raise ValueError("PRODUCTION_CONFIG_ERROR: JWT_SECRET_KEY must be a cryptographically secure key (minimum 32 characters) in production.")

        return self


settings = Settings()
