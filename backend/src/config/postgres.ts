import pg from "pg";

const { Pool } = pg;

const postgresPool = new Pool(
  process.env.PG_CONNECTION_STRING
    ? { connectionString: process.env.PG_CONNECTION_STRING }
    : {
        host: process.env.PG_HOST || "localhost",
        port: Number(process.env.PG_PORT || 5432),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE || "postgres",
      }
);

export { postgresPool };

export const closePostgresPool = async (): Promise<void> => {
  await postgresPool.end();
};
