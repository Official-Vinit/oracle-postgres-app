from fastapi import APIRouter

from app.migration.pipeline import execute_migration


router = APIRouter()


@router.post("/migration")
async def migration(data: dict):

    if data.get("source") != "oracle":
        return {
            "status": "error",
            "message": "Unsupported source. Only 'oracle' is supported."
        }

    if data.get("target") != "postgresql":
        return {
            "status": "error",
            "message": "Unsupported target. Only 'postgresql' is supported."
        }

    if "data_extraction" not in data:
        return {
            "status": "error",
            "message": "data_extraction is required."
        }

    if "data_management" not in data:
        return {
            "status": "error",
            "message": "data_management is required."
        }

    try:
        execute_migration(
            data["data_extraction"],
            data["data_management"],
        )

        return {
            "status": "success",
            "message": "Migration completed successfully."
        }

    except Exception as error:

        return {
            "status": "error",
            "message": "Migration failed.",
            "details": str(error)
        }