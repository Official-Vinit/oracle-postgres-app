import oracledb from "oracledb";

let pool: oracledb.Pool | null = null;

const user = process.env.ORACLE_USER;
const password = process.env.ORACLE_PASSWORD;
const connectString = process.env.ORACLE_CONNECT_STRING;

export const getOraclePool = async (): Promise<oracledb.Pool> => {
  if (pool) return pool;

  if (!user || !password || !connectString) {
    throw new Error("Oracle environment variables are not configured");
  }

  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

  pool = await oracledb.createPool({
    user,
    password,
    connectString,
    poolMin: 1,
    poolMax: 5,
    poolIncrement: 1,
  });

  return pool;
};

export const closeOraclePool = async (): Promise<void> => {
  if (pool) {
    await pool.close(10);
    pool = null;
  }
};
