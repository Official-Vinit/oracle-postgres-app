from fastapi import APIRouter

from app.transformation.pipeline import execute_table_management

router = APIRouter()


@router.post("/transformation")
async def transformation(data: dict):

    if "result" not in data:
        return {
            "status": "error",
            "message": "result is required."
        }

    result = data["result"]

    if result.get("source") != "oracle":
        return {
            "status": "error",
            "message": "Unsupported source. Only 'oracle' is supported."
        }

    if result.get("target") != "postgresql":
        return {
            "status": "error",
            "message": "Unsupported target. Only 'postgresql' is supported."
        }

    if "table_management" not in result:
        return {
            "status": "error",
            "message": "table_management is required."
        }

    try:
        execute_table_management(
            result["table_management"]
        )

        return {
            "status": "success",
            "message": "Transformation completed successfully."
        }

    except Exception as error:

        return {
            "status": "error",
            "message": "Transformation failed.",
            "details": str(error)
        }