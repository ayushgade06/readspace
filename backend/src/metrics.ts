import { NextFunction, Request, Response } from "express";
import client from "prom-client";
import { getStats } from "./seats";

export const register = new client.Registry();

// --- Reading hall metrics -------------------------------------------------

// Gauges: values that go up and down. They are read from the database
// every time Prometheus scrapes /metrics.
const seatsTotal = new client.Gauge({
  name: "reading_hall_seats_total",
  help: "Total number of seats in the reading hall",
  registers: [register],
});
const seatsOccupied = new client.Gauge({
  name: "reading_hall_seats_occupied",
  help: "Number of seats currently occupied",
  registers: [register],
});
const seatsAvailable = new client.Gauge({
  name: "reading_hall_seats_available",
  help: "Number of seats currently available",
  registers: [register],
});
const occupancyRatio = new client.Gauge({
  name: "reading_hall_occupancy_ratio",
  help: "Occupied seats divided by total seats (0 to 1)",
  registers: [register],
});

// Counters: values that only go up. Prometheus turns them into rates.
export const occupyActions = new client.Counter({
  name: "reading_hall_occupy_actions_total",
  help: "Number of successful occupy actions",
  registers: [register],
});
export const releaseActions = new client.Counter({
  name: "reading_hall_release_actions_total",
  help: "Number of successful release actions",
  registers: [register],
});

// --- HTTP metrics ---------------------------------------------------------

const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "Number of HTTP requests handled, by method, route and status code",
  labelNames: ["method", "route", "status"],
  registers: [register],
});
const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Time taken to handle HTTP requests, in seconds",
  labelNames: ["method", "route"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

// Counts and times every API request. /health and /metrics are left out so
// that probe and scrape traffic does not hide what users are doing.
export function httpMetrics(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api")) {
    next();
    return;
  }
  const stopTimer = httpDuration.startTimer();
  res.on("finish", () => {
    // Use the route pattern (/api/seats/:id/occupy), not the real URL,
    // so that each seat does not become its own time series.
    const route = req.route ? req.route.path : "unknown";
    httpRequests.inc({ method: req.method, route, status: res.statusCode });
    stopTimer({ method: req.method, route });
  });
  next();
}

export async function metricsHandler(_req: Request, res: Response) {
  try {
    const stats = await getStats();
    seatsTotal.set(stats.total);
    seatsOccupied.set(stats.occupied);
    seatsAvailable.set(stats.available);
    occupancyRatio.set(stats.total === 0 ? 0 : stats.occupied / stats.total);
  } catch (err) {
    // Keep serving the counters even if the database cannot be read.
    console.error(`Metrics: could not read seat counts: ${(err as Error).message}`);
  }
  res.set("Content-Type", register.contentType);
  res.send(await register.metrics());
}
