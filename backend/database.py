import os
from databases import Database
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "")
DB_NAME = os.getenv("DB_NAME", "petdev")
WORKSPACE_DB_NAME = os.getenv("WORKSPACE_DB_NAME", "WORKSPACE")

# We create two Database instances, one for petdev (queryPet) and one for WORKSPACE (queryWorkspace)
PET_DB_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASS}@{DB_HOST}:3306/{DB_NAME}"
WORKSPACE_DB_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASS}@{DB_HOST}:3306/{WORKSPACE_DB_NAME}"

pet_db = Database(PET_DB_URL, pool_recycle=300, min_size=1, max_size=10)
workspace_db = Database(WORKSPACE_DB_URL, pool_recycle=300, min_size=1, max_size=10)

async def connect_dbs():
    await pet_db.connect()
    await workspace_db.connect()

async def disconnect_dbs():
    await pet_db.disconnect()
    await workspace_db.disconnect()
