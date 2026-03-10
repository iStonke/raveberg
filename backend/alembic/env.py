from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.base import Base
from app.models.admin_session import AdminSession  # noqa: F401
from app.models.admin_user import AdminUser  # noqa: F401
from app.models.app_state import AppState  # noqa: F401
from app.models.display_status import DisplayStatus  # noqa: F401
from app.models.selfie_state import SelfieState  # noqa: F401
from app.models.setting import Setting  # noqa: F401
from app.models.upload import Upload  # noqa: F401
from app.models.video_asset import VideoAsset  # noqa: F401
from app.models.video_state import VideoState  # noqa: F401
from app.models.visualizer_state import VisualizerState  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.database_url
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
