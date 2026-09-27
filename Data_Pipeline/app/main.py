from fastapi import FastAPI

from app.transformation.route import router as transformation_router
from app.migration.route import router as migration_router

app = FastAPI()

app.include_router(transformation_router)
app.include_router(migration_router)