import { useEffect, useState } from "react";
import axios from "axios";
import {
  applyAiSchema,
  callSchemaDesign,
  getHealth,
  getOracleTableMetaData,
  getOracleTables,
  getPostgresTables,
  getPostgresTablesMetadata,
  getSelectedOracleMetadata,
} from "./api";
import type {
  AiSchemaDesignResponse,
  HealthResponse,
  MetaDataColumn,
  MetaDataResponse,
} from "./types";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message ?? error.response?.data?.reason;
    return typeof message === "string" ? message : fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

const App = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [oracleTables, setOracleTables] = useState<string[]>([]);
  const [postgresTables, setPostgresTables] = useState<string[]>([]);
  const [oracleMetadata, setOracleMetadata] = useState<Record<string, MetaDataColumn[]>>({});
  const [postgresMetadata, setPostgresMetadata] = useState<Record<string, MetaDataResponse>>({});
  const [selectedOracleTables, setSelectedOracleTables] = useState<string[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [transformStatus, setTransformStatus] = useState("");
  const [transformNote, setTransformNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");

    const healthPromise = getHealth()
      .then(setHealth)
      .catch((error) => {
        console.error(error);
        setError("Could not check database connections.");
      });

    const dataPromise = Promise.all([
      getOracleTables(),
      getPostgresTables(),
      getPostgresTablesMetadata(),
    ])
      .then(async ([oracleData, postgresData, postgresMetadataData]) => {
        const metadataEntries = await Promise.all(
          oracleData.tables.map(async (table) => {
            const metadata = await getOracleTableMetaData(table);
            return [table, metadata.columns] as const;
          })
        );

        setOracleTables(oracleData.tables);
        setPostgresTables(postgresData.tables);
        setOracleMetadata(Object.fromEntries(metadataEntries));
        setPostgresMetadata(
          Object.fromEntries(
            postgresMetadataData.tables.map((table) => [table.tableName, table])
          )
        );
        setSelectedOracleTables((current) =>
          current.filter((table) => oracleData.tables.includes(table))
        );
      })
      .catch((error) => {
        console.error(error);
        setError((current) => current || "Could not load database information.");
      });

    await Promise.allSettled([healthPromise, dataPromise]);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const toggleOracleTable = (table: string) => {
    setSelectedOracleTables((current) =>
      current.includes(table)
        ? current.filter((selectedTable) => selectedTable !== table)
        : [...current, table]
    );
  };

  const runAiTransform = async () => {
    if (selectedOracleTables.length === 0) return;

    setLoading(true);
    setError("");
    setTransformStatus("");
    setTransformNote("");

    try {
      // Step 1: Fetch Oracle metadata for selected tables
      const { tables: selectedMetadata } = await getSelectedOracleMetadata(selectedOracleTables);

      // Step 2: Call AI schema design
      const aiResponse: AiSchemaDesignResponse = await callSchemaDesign(
        { tables: selectedMetadata },
        userQuery
      );

      const result = aiResponse.result ?? aiResponse;
      const status = result?.status;

      // Step 3: Handle not_recommended — show reason, do not create tables
      if (status === "not_recommended") {
        const reason = result?.issue_reason || result?.summary || "AI did not recommend this transformation.";
        setError(`AI: Not recommended — ${reason}`);
        return;
      }

      // Step 4: Apply to Postgres (recommended or needs_change)
      const applyResult = await applyAiSchema(aiResponse);
      setTransformStatus(`${applyResult.message}: ${applyResult.tables.join(", ")}`);

      if (status === "needs_change" && result?.issue_reason) {
        setTransformNote(`Note: AI made corrections — ${result.issue_reason}`);
      }

      // Step 5: Refresh Postgres tables
      const [postgresData, postgresMetadataData] = await Promise.all([
        getPostgresTables(),
        getPostgresTablesMetadata(),
      ]);
      setPostgresTables(postgresData.tables);
      setPostgresMetadata(
        Object.fromEntries(
          postgresMetadataData.tables.map((table) => [table.tableName, table])
        )
      );
    } catch (err) {
      console.error(err);
      // If applyAiSchema returned 422 (not_recommended from backend)
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const reason = err.response.data?.reason ?? "AI did not recommend this transformation.";
        setError(`AI: Not recommended — ${reason}`);
      } else {
        setError(getErrorMessage(err, "Transformation failed."));
      }
    } finally {
      setLoading(false);
    }
  };

  const renderMetadataTable = (columns: MetaDataColumn[]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Column</th>
            <th>Type</th>
            <th>Length</th>
            <th>Precision</th>
            <th>Scale</th>
            <th>Nullable</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.columnName}>
              <td>{column.columnName}</td>
              <td>{column.dataType}</td>
              <td>{column.dataLength ?? ""}</td>
              <td>{column.dataPrecision ?? ""}</td>
              <td>{column.dataScale ?? ""}</td>
              <td>{column.nullable}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderConstraints = (metadata: MetaDataResponse | undefined) => {
    if (!metadata) return null;
    return (
      <div className="constraints">
        <p>
          <strong>PK:</strong>{" "}
          {metadata.primaryKey?.columns.length
            ? `${metadata.primaryKey.constraintName} (${metadata.primaryKey.columns.join(", ")})`
            : "None"}
        </p>
        <p>
          <strong>FK:</strong>{" "}
          {metadata.foreignKeys?.length
            ? metadata.foreignKeys
                .map(
                  (fk) =>
                    `${fk.constraintName} (${fk.columns.join(", ")}) -> ${fk.referencedTable} (${fk.referencedColumns.join(", ")})`
                )
                .join("; ")
            : "None"}
        </p>
      </div>
    );
  };

  return (
    <div className="page">
      <header>
        <div>
          <h1>Oracle + PostgreSQL</h1>
          <p>AI-powered schema migration tool.</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading}>
          {loading ? "Checking..." : "Refresh"}
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="cards">
        <div className="card">
          <h2>Oracle</h2>
          <strong className={health?.oracle.connected ? "ok" : "bad"}>
            {health ? (health.oracle.connected ? "Connected" : "Not connected") : "Checking..."}
          </strong>
          <p>{health ? health.oracle.message : "Checking database connection..."}</p>
        </div>

        <div className="card">
          <h2>PostgreSQL</h2>
          <strong className={health?.postgres.connected ? "ok" : "bad"}>
            {health ? (health.postgres.connected ? "Connected" : "Not connected") : "Checking..."}
          </strong>
          <p>{health ? health.postgres.message : "Checking database connection..."}</p>
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Oracle Tables</h2>

          {oracleTables.length === 0 ? (
            <p className="muted">No Oracle tables found.</p>
          ) : (
            <>
              <div className="toolbar">
                <button
                  onClick={() => void runAiTransform()}
                  disabled={loading || selectedOracleTables.length === 0}
                >
                  {loading ? "Transforming..." : "Transform Selected"}
                </button>
                <span className="muted">{selectedOracleTables.length} selected</span>
              </div>

              <div className="query-input">
                <label htmlFor="userQuery"><strong>AI Query (optional):</strong></label>
                <textarea
                  id="userQuery"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="e.g. Make DEPT_ID NOT NULL, preserve all existing keys and relationships."
                  rows={3}
                />
              </div>

              {oracleTables.map((table) => (
                <section key={table}>
                  <label className="table-title">
                    <input
                      type="checkbox"
                      checked={selectedOracleTables.includes(table)}
                      onChange={() => toggleOracleTable(table)}
                    />
                    <span>{table}</span>
                  </label>
                  {renderMetadataTable(oracleMetadata[table] ?? [])}
                </section>
              ))}
            </>
          )}
        </div>

        <div className="card">
          <h2>PostgreSQL Tables</h2>
          {postgresTables.length === 0 ? (
            <p className="muted">No PostgreSQL tables found.</p>
          ) : (
            <>
              {postgresTables.map((table) => (
                <section key={table}>
                  <h3>{table}</h3>
                  {renderMetadataTable(postgresMetadata[table]?.columns ?? [])}
                  {renderConstraints(postgresMetadata[table])}
                </section>
              ))}
            </>
          )}

          {(transformStatus || transformNote) && (
            <div className="transform-result">
              <h2 className="section-heading">Transform Result</h2>
              {transformStatus && <p className="ok">{transformStatus}</p>}
              {transformNote && <p className="muted">{transformNote}</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default App;
