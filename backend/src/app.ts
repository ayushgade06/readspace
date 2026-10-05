import fs from "fs";
import path from "path";
import express, { NextFunction, Request, Response } from "express";
import { pool } from "./db";
import { httpMetrics, metricsHandler, occupyActions, releaseActions } from "./metrics";
import { ApiError, SeatAction, changeSeat, getStats, listActivity, listSeats } from "./seats";

const frontendDir = path.resolve(__dirname, "../../frontend/dist");

// Seat IDs arrive via URL parameters and are validated here before
// being forwarded to the database layer.
function parseSeatId(value: string): number {
  if (!/^\d{1,9}$/.test(value) || Number(value) < 1) {
    throw new ApiError(400, "Seat id must be a positive number.");
  }
  return Number(value);
}

// Detects well-known pg-driver error codes that indicate the database
// is unreachable, so the API can return a 503 instead of a generic 500.
function isDatabaseDown(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  const code = e.code ?? "";
  return (
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN", "ECONNRESET"].includes(code) ||
    code.startsWith("08") ||
    code.startsWith("57P") ||
    /timeout|terminated/i.test(e.message ?? "")
  );
}

export function createApp() {
  const app = express();
  app.use(express.json());
  // Seat data changes all the time, so always send a full 200 response
  // instead of "304 Not Modified".
  app.set("etag", false);

    // Emit one log line per completed request. Suppress successful /health
    // and /metrics calls to avoid noise from Kubernetes probes and Prometheus.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const quiet = req.path === "/health" || req.path === "/metrics";
      if (quiet && res.statusCode < 400) return;
      console.log(
        `${new Date().toISOString()} ${req.method} ${req.originalUrl} ` +
          `${res.statusCode} ${Date.now() - start}ms`
      );
    });
    next();
  });

  app.use(httpMetrics);

  // Scraped by Prometheus.
  app.get("/metrics", metricsHandler);

  // Used by the Kubernetes readiness probe: the pod only receives traffic
  // while it can reach the database.
  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "up" });
    } catch (err) {
      console.error(`Health check failed: ${(err as Error).message}`);
      res.status(503).json({ status: "error", database: "down" });
    }
  });

  app.get("/api/seats", async (_req, res) => {
    res.json(await listSeats());
  });

  app.get("/api/stats", async (_req, res) => {
    res.json(await getStats());
  });

  app.get("/api/activity", async (_req, res) => {
    res.json(await listActivity(20));
  });

  const seatAction = (action: SeatAction) => async (req: Request, res: Response) => {
    const id = parseSeatId(String(req.params.id));
    const seat = await changeSeat(id, action);
    (action === "occupy" ? occupyActions : releaseActions).inc();
    res.json({ message: `Seat ${seat.seatNumber} is now ${seat.status}.`, seat });
  };

  app.post("/api/seats/:id/occupy", seatAction("occupy"));
  app.post("/api/seats/:id/release", seatAction("release"));

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Endpoint not found." });
  });

  // The built React frontend. It exists in the Docker image (and after
  // "npm run build" in frontend/); in development Vite serves it instead.
  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));
  }

  // Central error handler: every error becomes a JSON response.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (isDatabaseDown(err)) {
      console.error(`Database unavailable on ${req.method} ${req.originalUrl}: ${(err as Error).message}`);
      res.status(503).json({ error: "Database unavailable." });
      return;
    }
    console.error(`Unexpected error on ${req.method} ${req.originalUrl}:`, err);
    res.status(500).json({ error: "Unexpected server error." });
  });

  return app;
}
