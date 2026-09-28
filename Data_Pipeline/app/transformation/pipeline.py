from app.database.postgres import get_postgres_connection


def execute_table_management(
    table_management: list[str],
) -> None:
    """
    Execute table-management SQL statements on PostgreSQL
    in the order provided by the application.
    """

    if not isinstance(table_management, list):
        raise TypeError(
            "table_management must be a list."
        )

    if not table_management:
        raise ValueError(
            "table_management cannot be empty."
        )

    for query in table_management:

        if not isinstance(query, str):
            raise TypeError(
                "Each table_management item must be a SQL string."
            )

        if not query.strip():
            raise ValueError(
                "table_management cannot contain an empty SQL query."
            )

    with get_postgres_connection() as postgres_connection:

        try:

            with postgres_connection.cursor() as postgres_cursor:

                for query in table_management:

                    postgres_cursor.execute(query)

            postgres_connection.commit()

        except Exception:

            postgres_connection.rollback()

            raise