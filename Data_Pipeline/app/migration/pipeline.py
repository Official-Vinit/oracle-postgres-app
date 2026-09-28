from app.database.oracle import get_oracle_connection
from app.database.postgres import get_postgres_connection


VALUES_PLACEHOLDER = "{VALUES_PLACEHOLDER}"


def execute_migration(
    data_extraction: list[str],
    data_management: list[str],
) -> None:
    """
    Extract data from Oracle and load it into PostgreSQL.

    Each SELECT query in data_extraction is mapped to the
    INSERT query at the same position in data_management.
    """

    if not isinstance(data_extraction, list):
        raise TypeError(
            "data_extraction must be a list."
        )

    if not isinstance(data_management, list):
        raise TypeError(
            "data_management must be a list."
        )

    if not data_extraction:
        raise ValueError(
            "data_extraction cannot be empty."
        )

    if not data_management:
        raise ValueError(
            "data_management cannot be empty."
        )

    if len(data_extraction) != len(data_management):
        raise ValueError(
            "data_extraction and data_management "
            "must contain the same number of queries."
        )

    for query in data_extraction:

        if not isinstance(query, str):
            raise TypeError(
                "Each data_extraction item must be a SQL string."
            )

        if not query.strip():
            raise ValueError(
                "data_extraction cannot contain an empty SQL query."
            )

    for query in data_management:

        if not isinstance(query, str):
            raise TypeError(
                "Each data_management item must be a SQL string."
            )

        if not query.strip():
            raise ValueError(
                "data_management cannot contain an empty SQL query."
            )

        if VALUES_PLACEHOLDER not in query:
            raise ValueError(
                "Each data_management query must contain "
                "{VALUES_PLACEHOLDER}."
            )

    with get_oracle_connection() as oracle_connection:

        with get_postgres_connection() as postgres_connection:

            try:

                with oracle_connection.cursor() as oracle_cursor:

                    with postgres_connection.cursor() as postgres_cursor:

                        for index in range(len(data_extraction)):

                            extraction_query = data_extraction[index]
                            management_query = data_management[index]

                            oracle_cursor.execute(
                                extraction_query
                            )

                            rows = oracle_cursor.fetchall()

                            column_count = len(
                                oracle_cursor.description
                            )

                            if column_count == 0:
                                raise ValueError(
                                    "The extraction query returned "
                                    "no columns."
                                )

                            value_placeholders = ", ".join(
                                ["%s"] * column_count
                            )

                            insert_query = management_query.replace(
                                VALUES_PLACEHOLDER,
                                f"({value_placeholders})",
                                1,
                            )

                            if rows:
                                postgres_cursor.executemany(
                                    insert_query,
                                    rows,
                                )

                postgres_connection.commit()

            except Exception:

                postgres_connection.rollback()

                raise