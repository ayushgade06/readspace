import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { config } from "./config";

export const pool = new Pool({
  ...config.db,
  connectionTimeoutMillis: 3000,
});

// Without this handler an idle connection dropped by the database
// would crash the process.
pool.on("error", (err) => {
  console.error(`Database connection error: ${err.message}`);
});

const databaseDir = path.resolve(__dirname, "../../database");

// Creates the tables and inserts the seats if they are not there yet.
// The advisory lock makes sure two replicas starting at the same time
// do not run the scripts simultaneously.
export async function initDatabase(): Promise<void> {
  const schema = fs.readFileSync(path.join(databaseDir, "schema.sql"), "utf8");
  const seed = fs.readFileSync(path.join(databaseDir, "seed.sql"), "utf8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(4000)");
    await client.query(schema);
    await client.query(seed);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// The database container may start a few seconds after the application,
// so the first connection is retried before giving up.
export async function initDatabaseWithRetry(attempts = 10, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await initDatabase();
      console.log(`Database ready at ${config.db.host}:${config.db.port}/${config.db.database}`);
      return;
    } catch (err) {
      const reason = (err as Error).message || (err as { code?: string }).code;
      console.error(
        `Database not reachable at ${config.db.host}:${config.db.port} ` +
          `(attempt ${attempt}/${attempts}): ${reason}`
      );
      if (attempt === attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
