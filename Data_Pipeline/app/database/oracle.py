import oracledb

from app.config import ORACLE_CONFIG


def get_oracle_connection():
    return oracledb.connect(
        user=ORACLE_CONFIG["user"],
        password=ORACLE_CONFIG["password"],
        dsn=ORACLE_CONFIG["dsn"],
    )