export interface HealthDatabase {
  connected: boolean;
  message: string;
}

export interface HealthResponse {
  status: "ok" | "partial";
  oracle: HealthDatabase;
  postgres: HealthDatabase;
}

export interface TablesResponse {
  tables: string[];
}

export interface RowsResponse {
  table: string;
  rows: Record<string, unknown>[];
}

export interface MetaDataColumn {
  columnName: string;
  dataType: string;
  dataLength: number | null;
  dataPrecision: number | null;
  dataScale: number | null;
  nullable: string;
  dataDefault: string | null;
  columnId: number;
}

export interface MetaDataResponse {
  tableName: string;
  columns: MetaDataColumn[];
  primaryKey?: {
    constraintName: string;
    columns: string[];
  } | null;
  foreignKeys?: {
    constraintName: string;
    columns: string[];
    referencedTable: string;
    referencedColumns: string[];
  }[];
}

export interface SelectedMetadataResponse {
  tables: MetaDataResponse[];
}

export interface TablesMetadataResponse {
  tables: MetaDataResponse[];
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
  primaryKey?: string[] | {
    constraintName: string;
    columns: string[];
  } | null;
  foreignKeys?: PostgresForeignKeyMetadata[];
}

export interface CreatePostgresTablesResponse {
  message: string;
  tables: string[];
}

export interface AiTransformResponse {
  status?: string;
  summary?: string;
  issue_reason?: string;
  target_schema?: {
    tables?: PostgresTableMetadata[];
  };
  tables?: PostgresTableMetadata[];
}

export interface AiSchemaDesignResponse {
  provider?: string;
  result?: {
    status: "recommended" | "needs_change" | "not_recommended";
    summary: string;
    issue_reason: string;
    target_schema?: {
      tables?: PostgresTableMetadata[];
    };
  };
  // fallback if result is at top level
  status?: string;
  summary?: string;
  issue_reason?: string;
  target_schema?: {
    tables?: PostgresTableMetadata[];
  };
}
