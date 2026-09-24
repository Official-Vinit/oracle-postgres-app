import { Router } from "express";
import {
  health,
  oracleTables,
  postgresTables,
  oracleTableData,
  postgresTableData,
  postgresTablesMetadata,
  getOracleTableColumnsController,
  getOracleTableMetadataController,
  getPostgresTableMetadataController,
  getSelectedOracleMetadataController,
  createPostgresTablesController,
  schemaDesignController,
  applyAiSchemaController,
} from "../controllers/database.controller.js";

const router = Router();

router.get("/health", health);

router.get("/oracle/tables", oracleTables);
//router.get("/oracle/tables/:table", oracleTableData);
router.get("/oracle/tables/:tableName",getOracleTableColumnsController);
router.get("/oracle/tables/:tableName/metadata", getOracleTableMetadataController);
router.post("/oracle/metadata", getSelectedOracleMetadataController);

router.get("/postgres/tables", postgresTables);
router.get("/postgres/metadata", postgresTablesMetadata);
router.get("/postgres/tables/:tableName/metadata", getPostgresTableMetadataController);
router.get("/postgres/tables/:table", postgresTableData);
router.post("/postgres/tables", createPostgresTablesController);

router.post("/schema-design", schemaDesignController);
router.post("/postgres/apply-ai-schema", applyAiSchemaController);


export default router;
