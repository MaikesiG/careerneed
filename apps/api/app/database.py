import os
from pathlib import Path
from dotenv import find_dotenv, load_dotenv

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# 自动向上查找到项目根目录下的 .env 并加载
load_dotenv(find_dotenv())
# 如果 apps/api/.env 存在，也支持当前工作区覆盖
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://careerneed:Pwd%21%40%23123@localhost:5432/careerneed",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
