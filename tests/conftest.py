import os

# app.db requires DATABASE_URL at import time; tests use in-memory SQLite.
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.crud  # noqa: F401  -- import order matches the app; avoids a crud<->sync cycle
from app import models


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    tables = [models.Org.__table__, models.Account.__table__, models.Holding.__table__]
    models.Base.metadata.create_all(engine, tables=tables)
    session = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
