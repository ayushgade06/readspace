import path from "path";
import dotenv from "dotenv";

// For local development the settings come from the .env file in the
// repository root. In Docker and Kubernetes there is no .env file and the
// values are passed as real environment variables instead.
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
