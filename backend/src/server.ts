import "dotenv/config";
import express from "express";
import cors from "cors";
import databaseRouter from "./routes/database.routes.js";
import { closeOraclePool } from "./config/oracle.js";
import { closePostgresPool } from "./config/postgres.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(
  cors()
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Oracle + PostgreSQL API is running" });
});

app.use("/api", databaseRouter);

const server = app.listen(PORT, "0.0.0.0",() => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log("Open http://localhost:5000/api/health to test both databases.");
});

const shutdown = async () => {
  server.close(async () => {
    await Promise.allSettled([closeOraclePool(), closePostgresPool()]);
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
