import oracledb from "oracledb";
import { getOraclePool } from "../config/oracle.js";
import { postgresPool } from "../config/postgres.js";

export interface OracleColumnMetadata {
  columnName: string;
  dataType: string;
  dataLength: number | null;
  dataPrecision: number | null;
  dataScale: number | null;
  nullable: string;
  dataDefault: string | null;
  columnId: number;
}

export interface PrimaryKeyMetadata {
  constraintName: string;
  columns: string[];
}

export interface ForeignKeyMetadata {
  constraintName: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

export interface OracleTableMetadata {
  tableName: string;
  columns: OracleColumnMetadata[];
  primaryKey: PrimaryKeyMetadata | null;
  foreignKeys: ForeignKeyMetadata[];
}

export interface PostgresColumnMetadata {
  columnName: string;
  dataType: string;
  dataLength?: number | null;
  dataPrecision?: number | null;
  dataScale?: number | null;
  nullable?: boolean | string;
  dataDefault?: string | null;
  defaultValue?: string | null;
}

export interface PostgresForeignKeyMetadata {
  constraintName?: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: string;
  onUpdate?: string;
}

export interface PostgresTableMetadata {
  tableName: string;
  columns: PostgresColumnMetadata[];
  primaryKey?: string[] | PrimaryKeyMetadata | null;
  foreignKeys?: PostgresForeignKeyMetadata[];
}

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

export interface DatabaseColumnMetadata {
  columnName: string;
  dataType: string;
  dataLength: number | null;
  dataPrecision: number | null;
  dataScale: number | null;
  nullable: string;
  dataDefault: string | null;
  columnId: number;
}

export interface DatabaseTableMetadata {
  tableName: string;
  columns: DatabaseColumnMetadata[];
  primaryKey: PrimaryKeyMetadata | null;
  foreignKeys: ForeignKeyMetadata[];
}

const isSafeTableName = (tableName: string): boolean => {
  return /^[A-Za-z_][A-Za-z0-9_$#]*$/.test(tableName);
};

const isSafePostgresIdentifier = (identifier: string): boolean => {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier);
};

const quoteIdentifier = (identifier: string): string => {
  if (!isSafePostgresIdentifier(identifier)) {
    throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
};

const quoteLiteral = (value: string): string => {
  return `'${value.replace(/'/g, "''")}'`;
};

const validatePostgresType = (dataType: string): string => {
  const normalized = dataType.trim();
  if (!/^[A-Za-z][A-Za-z0-9_\s(),]*$/.test(normalized)) {
    throw new Error(`Invalid PostgreSQL data type: ${dataType}`);
  }

  return normalized;
};

const toPositiveNumber = (value: number | null | undefined): number | null => {
  return typeof value === "number" && value > 0 ? value : null;
};

const mapColumnType = (column: PostgresColumnMetadata): string => {
  const dataType = column.dataType.trim().toUpperCase();
  const length = toPositiveNumber(column.dataLength);
  const precision = toPositiveNumber(column.dataPrecision);
  const scale = typeof column.dataScale === "number" && column.dataScale >= 0
    ? column.dataScale
    : null;

  if (["VARCHAR", "VARCHAR2", "NVARCHAR2", "CHAR", "NCHAR"].includes(dataType)) {
    return length ? `varchar(${length})` : "varchar";
  }

  if (["NUMBER", "NUMERIC", "DECIMAL"].includes(dataType)) {
    if (precision && scale !== null) {
      return `numeric(${precision}, ${scale})`;
    }

    if (precision) {
      return `numeric(${precision})`;
    }

    return "numeric";
  }

  if (dataType === "DATE" || dataType.startsWith("TIMESTAMP")) {
    return "timestamp";
  }

  if (dataType.includes("CLOB")) {
    return "text";
  }

  if (dataType.includes("BLOB") || dataType === "RAW" || dataType === "LONG RAW") {
    return "bytea";
  }

  return validatePostgresType(column.dataType);
};

const isRequiredColumn = (nullable: boolean | string | undefined): boolean => {
  return nullable === false || nullable === "N";
};

const getPrimaryKeyColumns = (
  primaryKey: PostgresTableMetadata["primaryKey"]
): string[] => {
  if (Array.isArray(primaryKey)) {
    return primaryKey;
  }

  return primaryKey?.columns ?? [];
};

const validateReferentialAction = (action: string | undefined): string | null => {
  if (!action) {
    return null;
  }

  const normalized = action.trim().toUpperCase();
  const allowed = new Set([
    "CASCADE",
    "RESTRICT",
    "NO ACTION",
    "SET NULL",
    "SET DEFAULT",
  ]);

  if (!allowed.has(normalized)) {
    throw new Error(`Invalid referential action: ${action}`);
  }

  return normalized;
};

export const testOracleConnection = async (): Promise<string> => {
  const pool = await getOraclePool();
  const connection = await pool.getConnection();

  try {
    const result = await connection.execute<{ DB_TIME: Date }>(
      "SELECT SYSDATE AS DB_TIME FROM DUAL"
    );

    const row = result.rows?.[0];
    return row?.DB_TIME
      ? `Connected. Oracle time: ${row.DB_TIME.toISOString()}`
      : "Connected to Oracle";
  } finally {
    await connection.close();
  }
};

export const testPostgresConnection = async (): Promise<string> => {
  const result = await postgresPool.query<{ db_time: Date }>(
    "SELECT NOW() AS db_time"
  );

  return `Connected. PostgreSQL time: ${result.rows[0].db_time.toISOString()}`;
};

export const getOracleTables = async (): Promise<string[]> => {
  const pool = await getOraclePool();
  const connection = await pool.getConnection();

  try {
    const result = await connection.execute<{ TABLE_NAME: string }>(
      `SELECT TABLE_NAME
       FROM USER_TABLES
       ORDER BY TABLE_NAME`
    );

    return (result.rows ?? []).map((row) => row.TABLE_NAME);
  } finally {
    await connection.close();
  }
};

export const getPostgresTables = async (): Promise<string[]> => {
  const result = await postgresPool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  return result.rows.map((row) => row.table_name);
};

export const getPostgresTableMetadata = async (
  tableName: string
): Promise<DatabaseTableMetadata> => {
  if (!isSafePostgresIdentifier(tableName)) {
    throw new Error("Invalid PostgreSQL table name");
  }

  const [columnsResult, primaryKeyResult, foreignKeysResult] = await Promise.all([
    postgresPool.query(
      `
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
      `,
      [tableName]
    ),
    postgresPool.query(
      ` 
      SELECT
        tc.constraint_name,
        kcu.column_name,
        kcu.ordinal_position
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
       AND kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema = tc.table_schema
       AND kcu.table_name = tc.table_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
      `,
      [tableName]
    ),
    postgresPool.query(
      `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        kcu.ordinal_position,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
       AND kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema = tc.table_schema
       AND kcu.table_name = tc.table_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_schema = tc.constraint_schema
       AND ccu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.constraint_name, kcu.ordinal_position
      `,
      [tableName]
    ),
  ]);

  const columns = columnsResult.rows.map((row) => ({
    columnName: row.column_name,
    dataType: row.data_type,
    dataLength: row.character_maximum_length,
    dataPrecision: row.numeric_precision,
    dataScale: row.numeric_scale,
    nullable: row.is_nullable === "NO" ? "N" : "Y",
    dataDefault: row.column_default,
    columnId: row.ordinal_position,
  }));

  const primaryKey = primaryKeyResult.rows.length
    ? {
        constraintName: primaryKeyResult.rows[0].constraint_name,
        columns: primaryKeyResult.rows.map((row) => row.column_name),
      }
    : null;

  const foreignKeyMap = new Map<string, ForeignKeyMetadata>();
  for (const row of foreignKeysResult.rows) {
    const current = foreignKeyMap.get(row.constraint_name) ?? {
      constraintName: row.constraint_name,
      columns: [] as string[],
      referencedTable: row.referenced_table,
      referencedColumns: [] as string[],
    };

    current.columns.push(row.column_name);
    current.referencedColumns.push(row.referenced_column);
    foreignKeyMap.set(row.constraint_name, current);
  }

  return {
    tableName,
    columns,
    primaryKey,
    foreignKeys: Array.from(foreignKeyMap.values()),
  };
};

export const getPostgresTablesMetadata = async (): Promise<DatabaseTableMetadata[]> => {
  const tables = await getPostgresTables();
  return Promise.all(tables.map((table) => getPostgresTableMetadata(table)));
};

export const getOracleTableData = async (
  tableName: string
): Promise<Record<string, unknown>[]> => {
  if (!isSafeTableName(tableName)) {
    throw new Error("Invalid Oracle table name");
  }

  const pool = await getOraclePool();
  const connection = await pool.getConnection();

  try {
    const result = await connection.execute<Record<string, unknown>>(
      `SELECT * FROM "${tableName.toUpperCase()}" FETCH FIRST 50 ROWS ONLY`
    );

    return (result.rows ?? []) as Record<string, unknown>[];
  } finally {
    await connection.close();
  }
};

export const getPostgresTableData = async (
  tableName: string
): Promise<Record<string, unknown>[]> => {
  if (!isSafeTableName(tableName)) {
    throw new Error("Invalid PostgreSQL table name");
  }

  const result = await postgresPool.query(
    `SELECT * FROM "${tableName}" LIMIT 50`
  );

  return result.rows;
};

export const getOracleTableColumns = async (
  tableName: string
): Promise<OracleColumnMetadata[]> => {
  const pool = await getOraclePool();
  const connection = await pool.getConnection();

  try {
    const result = await connection.execute(
      `
      SELECT
        column_name,
        data_type,
        data_length,
        data_precision,
        data_scale,
        nullable,
        data_default,
        column_id
      FROM user_tab_columns
      WHERE table_name = :tableName
      ORDER BY column_id
      `,
      {
        tableName: tableName.toUpperCase(),
      }
    );

    return result.rows?.map((row: any) => ({
      columnName: row.COLUMN_NAME,
      dataType: row.DATA_TYPE,
      dataLength: row.DATA_LENGTH,
      dataPrecision: row.DATA_PRECISION,
      dataScale: row.DATA_SCALE,
      nullable: row.NULLABLE,
      dataDefault: row.DATA_DEFAULT,
      columnId: row.COLUMN_ID,
    })) ?? [];
  } finally {
    await connection.close();
  }
};

export const getOracleTableMetadata = async (
  tableName: string
): Promise<OracleTableMetadata> => {
  if (!isSafeTableName(tableName)) {
    throw new Error("Invalid Oracle table name");
  }

  const normalizedTableName = tableName.toUpperCase();
  const pool = await getOraclePool();
  const connection = await pool.getConnection();

  try {
    const [columnsResult, primaryKeyResult, foreignKeysResult] = await Promise.all([
      connection.execute(
        `
        SELECT
          column_name,
          data_type,
          data_length,
          data_precision,
          data_scale,
          nullable,
          data_default,
          column_id
        FROM user_tab_columns
        WHERE table_name = :tableName
        ORDER BY column_id
        `,
        { tableName: normalizedTableName }
      ),
      connection.execute(
        `
        SELECT
          cons.constraint_name,
          cols.column_name,
          cols.position
        FROM user_constraints cons
        JOIN user_cons_columns cols
          ON cols.constraint_name = cons.constraint_name
         AND cols.table_name = cons.table_name
        WHERE cons.table_name = :tableName
          AND cons.constraint_type = 'P'
        ORDER BY cols.position
        `,
        { tableName: normalizedTableName }
      ),
      connection.execute(
        `
        SELECT
          fk.constraint_name,
          fk_cols.column_name,
          fk_cols.position,
          pk.table_name AS referenced_table,
          pk_cols.column_name AS referenced_column
        FROM user_constraints fk
        JOIN user_cons_columns fk_cols
          ON fk_cols.constraint_name = fk.constraint_name
         AND fk_cols.table_name = fk.table_name
        JOIN user_constraints pk
          ON pk.constraint_name = fk.r_constraint_name
        JOIN user_cons_columns pk_cols
          ON pk_cols.constraint_name = pk.constraint_name
         AND pk_cols.position = fk_cols.position
        WHERE fk.table_name = :tableName
          AND fk.constraint_type = 'R'
        ORDER BY fk.constraint_name, fk_cols.position
        `,
        { tableName: normalizedTableName }
      ),
    ]);

    const columns = (columnsResult.rows ?? []).map((row: any) => ({
      columnName: row.COLUMN_NAME,
      dataType: row.DATA_TYPE,
      dataLength: row.DATA_LENGTH,
      dataPrecision: row.DATA_PRECISION,
      dataScale: row.DATA_SCALE,
      nullable: row.NULLABLE,
      dataDefault: row.DATA_DEFAULT,
      columnId: row.COLUMN_ID,
    }));

    const primaryKeyRows = (primaryKeyResult.rows ?? []) as any[];
    const primaryKey = primaryKeyRows.length
      ? {
          constraintName: primaryKeyRows[0].CONSTRAINT_NAME,
          columns: primaryKeyRows.map((row) => row.COLUMN_NAME),
        }
      : null;

    const foreignKeyMap = new Map<string, ForeignKeyMetadata>();
    for (const row of (foreignKeysResult.rows ?? []) as any[]) {
      const current = foreignKeyMap.get(row.CONSTRAINT_NAME) ?? {
        constraintName: row.CONSTRAINT_NAME,
        columns: [] as string[],
        referencedTable: row.REFERENCED_TABLE,
        referencedColumns: [] as string[],
      };

      current.columns.push(row.COLUMN_NAME);
      current.referencedColumns.push(row.REFERENCED_COLUMN);
      foreignKeyMap.set(row.CONSTRAINT_NAME, current);
    }

    return {
      tableName: normalizedTableName,
      columns,
      primaryKey,
      foreignKeys: Array.from(foreignKeyMap.values()),
    };
  } finally {
    await connection.close();
  }
};

export const getOracleTablesMetadata = async (
  tableNames: string[]
): Promise<OracleTableMetadata[]> => {
  const uniqueTables = Array.from(new Set(tableNames.map((table) => table.toUpperCase())));
  return Promise.all(uniqueTables.map((table) => getOracleTableMetadata(table)));
};

export const createPostgresTablesFromMetadata = async (
  tables: PostgresTableMetadata[]
): Promise<string[]> => {
  if (!Array.isArray(tables) || tables.length === 0) {
    throw new Error("No PostgreSQL table metadata provided");
  }

  const createdTables: string[] = [];
  const client = await postgresPool.connect();

  try {
    await client.query("BEGIN");

    for (const table of tables) {
      const tableName = quoteIdentifier(table.tableName);
      const primaryKeyColumns = getPrimaryKeyColumns(table.primaryKey);
      const primaryKeyName = Array.isArray(table.primaryKey)
        ? `${table.tableName}_pk`
        : table.primaryKey?.constraintName ?? `${table.tableName}_pk`;
      const columnDefinitions = table.columns.map((column) => {
        const parts = [
          quoteIdentifier(column.columnName),
          mapColumnType(column),
        ];

        if (isRequiredColumn(column.nullable)) {
          parts.push("NOT NULL");
        }

        const defaultValue = column.defaultValue ?? column.dataDefault;
        if (isNonEmptyString(defaultValue)) {
          parts.push(`DEFAULT ${defaultValue}`);
        }

        return parts.join(" ");
      });

      if (primaryKeyColumns.length) {
        columnDefinitions.push(
          `CONSTRAINT ${quoteIdentifier(primaryKeyName)} PRIMARY KEY (${primaryKeyColumns
            .map(quoteIdentifier)
            .join(", ")})`
        );
      }

      await client.query(
        `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefinitions.join(", ")})`
      );

      for (const column of table.columns) {
        const columnName = quoteIdentifier(column.columnName);
        const columnType = mapColumnType(column);
        const defaultValue = column.defaultValue ?? column.dataDefault;

        await client.query(
          `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnType}`
        );

        await client.query(
          `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE ${columnType} USING ${columnName}::${columnType}`
        );

        if (isNonEmptyString(defaultValue)) {
          await client.query(
            `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} SET DEFAULT ${defaultValue}`
          );
        } else {
          await client.query(
            `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} DROP DEFAULT`
          );
        }

        await client.query(
          `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${
            isRequiredColumn(column.nullable) ? "SET" : "DROP"
          } NOT NULL`
        );
      }
      createdTables.push(table.tableName);

      if (primaryKeyColumns.length) {
        await client.query(
          `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = ${quoteLiteral(primaryKeyName)}
            ) THEN
              ALTER TABLE ${tableName}
              ADD CONSTRAINT ${quoteIdentifier(primaryKeyName)}
              PRIMARY KEY (${primaryKeyColumns.map(quoteIdentifier).join(", ")});
            END IF;
          END $$;
          `
        );
      }
    }

    for (const table of tables) {
      for (const foreignKey of table.foreignKeys ?? []) {
        const constraintName =
          foreignKey.constraintName ??
          `${table.tableName}_${foreignKey.columns.join("_")}_fk`;
        const onDelete = validateReferentialAction(foreignKey.onDelete);
        const onUpdate = validateReferentialAction(foreignKey.onUpdate);
        const actionSql = [
          onDelete ? `ON DELETE ${onDelete}` : "",
          onUpdate ? `ON UPDATE ${onUpdate}` : "",
        ]
          .filter(Boolean)
          .join(" ");

        await client.query(
          `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = ${quoteLiteral(constraintName)}
            ) THEN
              ALTER TABLE ${quoteIdentifier(table.tableName)}
              ADD CONSTRAINT ${quoteIdentifier(constraintName)}
              FOREIGN KEY (${foreignKey.columns.map(quoteIdentifier).join(", ")})
              REFERENCES ${quoteIdentifier(foreignKey.referencedTable)}
              (${foreignKey.referencedColumns.map(quoteIdentifier).join(", ")})
              ${actionSql};
            END IF;
          END $$;
          `
        );
      }
    }

    await client.query("COMMIT");
    return createdTables;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
