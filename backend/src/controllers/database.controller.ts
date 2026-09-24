import type { Request, Response } from "express";
import {
  getOracleTables,
  getOracleTableData,
  getPostgresTables,
  getPostgresTableData,
  getPostgresTableMetadata,
  getPostgresTablesMetadata,
  testOracleConnection,
  testPostgresConnection,
  getOracleTableColumns,
  getOracleTableMetadata,
  getOracleTablesMetadata,
  createPostgresTablesFromMetadata,
  type PostgresTableMetadata,
} from "../services/database.service.js";

export const health = async (_req: Request, res: Response): Promise<void> => {
  const result = {
    oracle: { connected: false, message: "" },
    postgres: { connected: false, message: "" },
  };

  try {
    result.oracle.message = await testOracleConnection();
    result.oracle.connected = true;
  } catch (error) {
    result.oracle.message = error instanceof Error ? error.message : "Oracle connection failed";
  }

  try {
    result.postgres.message = await testPostgresConnection();
    result.postgres.connected = true;
  } catch (error) {
    result.postgres.message = error instanceof Error ? error.message : "PostgreSQL connection failed";
  }

  const allConnected = result.oracle.connected && result.postgres.connected;

  res.status(allConnected ? 200 : 503).json({
    status: allConnected ? "ok" : "partial",
    ...result,
  });
};

export const oracleTables = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tables = await getOracleTables();
    res.json({ tables });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load Oracle tables" });
  }
};

export const postgresTables = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tables = await getPostgresTables();
    res.json({ tables });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load PostgreSQL tables" });
  }
};

export const postgresTablesMetadata = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tables = await getPostgresTablesMetadata();
    res.json({ tables });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load PostgreSQL table metadata" });
  }
};

export const oracleTableData = async (req: Request, res: Response): Promise<void> => {
  try {
    const table = req.params.table;
    if(Array.isArray(table)){
      res.status(400).json({ message: "Invalid table name" });
      return
    }
    const rows = await getOracleTableData(table);
    res.json({ table, rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load Oracle table data" });
  }
};

export const postgresTableData = async (req: Request, res: Response): Promise<void> => {
  try {
    const table = req.params.table;
    if(Array.isArray(table)){
      res.status(400).json({ message: "Invalid table name" });
      return
    }
    const rows = await getPostgresTableData(table);
    res.json({ table, rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load PostgreSQL table data" });
  }
};

export const getPostgresTableMetadataController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { tableName } = req.params;

    if (Array.isArray(tableName)) {
      res.status(400).json({ message: "Invalid table name" });
      return;
    }

    const metadata = await getPostgresTableMetadata(tableName);
    res.json(metadata);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch PostgreSQL table metadata",
    });
  }
};

export const getOracleTableColumnsController = async (
  req: Request,
  res: Response
) => {
  try {
    const { tableName } = req.params;
    if(Array.isArray(tableName)){
      res.status(400).json({ message: "Invalid table name" });
      return
    }

    const columns = await getOracleTableColumns(tableName);

    res.json({
      tableName,
      columns,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch table columns",
    });
  }
};

export const getOracleTableMetadataController = async (
  req: Request,
  res: Response
) => {
  try {
    const { tableName } = req.params;

    if (Array.isArray(tableName)) {
      res.status(400).json({ message: "Invalid table name" });
      return;
    }

    const metadata = await getOracleTableMetadata(tableName);
    res.json(metadata);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch Oracle table metadata",
    });
  }
};

export const getSelectedOracleMetadataController = async (
  req: Request,
  res: Response
) => {
  try {
    const tables = req.body?.tables;

    if (!Array.isArray(tables) || tables.some((table) => typeof table !== "string")) {
      res.status(400).json({ message: "Request body must include a tables string array" });
      return;
    }

    const metadata = await getOracleTablesMetadata(tables);
    res.json({
      tables: metadata,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch selected Oracle metadata",
    });
  }
};

export const createPostgresTablesController = async (
  req: Request,
  res: Response
) => {
  try {
    const tables = req.body?.tables as PostgresTableMetadata[] | undefined;

    if (!Array.isArray(tables)) {
      res.status(400).json({ message: "Request body must include a tables array" });
      return;
    }

    const createdTables = await createPostgresTablesFromMetadata(tables);
    res.status(201).json({
      message: "PostgreSQL tables created",
      tables: createdTables,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to create PostgreSQL tables",
    });
  }
};

export const schemaDesignController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const aiServiceUrl = process.env.AI_SCHEMA_DESIGN_URL ?? "http://localhost:3000/api/schema-design";
    const response = await fetch(aiServiceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      res.status(response.status).json(
        payload ?? {
          message: "AI schema design service failed",
        }
      );
      return;
    }

    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(502).json({
      message: error instanceof Error ? error.message : "Failed to call AI schema design service",
    });
  }
};

export const applyAiSchemaController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // req.body is the full AI response: { provider, result: { status, summary, issue_reason, target_schema } }
    const aiResult = req.body?.result ?? req.body;
    const status: string = aiResult?.status ?? "";
    const targetSchema = aiResult?.target_schema;
    const tables: PostgresTableMetadata[] | undefined = targetSchema?.tables;

    // If AI said not_recommended, return the reason without creating tables
    if (status === "not_recommended") {
      const reason = aiResult?.issue_reason || aiResult?.summary || "AI did not recommend this transformation.";
      res.status(422).json({
        message: "not_recommended",
        reason,
      });
      return;
    }

    // For recommended or needs_change, create the tables
    if (!Array.isArray(tables) || tables.length === 0) {
      res.status(400).json({ message: "AI response did not include any target tables." });
      return;
    }

    const createdTables = await createPostgresTablesFromMetadata(tables);
    res.status(201).json({
      message: status === "needs_change"
        ? `Tables created with AI corrections: ${aiResult?.summary ?? ""}`
        : "Tables created successfully from AI schema design.",
      tables: createdTables,
      summary: aiResult?.summary ?? "",
      issue_reason: aiResult?.issue_reason ?? "",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to apply AI schema design",
    });
  }
};
