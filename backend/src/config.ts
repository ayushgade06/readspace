import path from "path";
import dotenv from "dotenv";

// In local development, settings are loaded from the .env file at the
// repository root. When running inside Docker or Kubernetes, no .env file
// is present and all values are injected as real environment variables.
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Configuration error: environment variable ${name} is not set.`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  db: {
    host: required("DB_HOST"),
    port: Number(process.env.DB_PORT) || 5432,
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
  },
};
