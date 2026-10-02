import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { initDatabase, pool } from "../src/db";

// These tests run against a real PostgreSQL database (the one configured
// through the DB_* variables). Seat state is reset before every test.

const app = createApp();

beforeAll(async () => {
  await initDatabase();
});

beforeEach(async () => {
  await pool.query("DELETE FROM activity");
  await pool.query("UPDATE seats SET status = 'available'");
});

afterAll(async () => {
  await pool.end();
});

describe("GET /health", () => {
  it("reports that the application and database are up", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "up" });
  });
});

describe("GET /api/seats", () => {
  it("returns the seeded seats in seat number order", async () => {
    const res = await request(app).get("/api/seats");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({ seatNumber: 1, section: "Table A", status: "available" });
  });
});

describe("GET /api/stats", () => {
  it("calculates totals from the seats table", async () => {
    const seats = await request(app).get("/api/seats");
    const total = seats.body.length;

    await request(app).post("/api/seats/1/occupy");
    await request(app).post("/api/seats/2/occupy");

    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total,
      occupied: 2,
      available: total - 2,
      occupancyPercentage: Math.round((2 / total) * 10000) / 100,
    });
  });
});

describe("POST /api/seats/:id/occupy", () => {
  it("occupies an available seat and records the activity", async () => {
    const res = await request(app).post("/api/seats/5/occupy");
    expect(res.status).toBe(200);
    expect(res.body.seat).toMatchObject({ id: 5, status: "occupied" });

    const activity = await request(app).get("/api/activity");
    expect(activity.body).toHaveLength(1);
    expect(activity.body[0]).toMatchObject({ seatId: 5, action: "occupy" });
  });

  it("rejects a seat that is already occupied", async () => {
    await request(app).post("/api/seats/5/occupy");
    const res = await request(app).post("/api/seats/5/occupy");
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Seat 5 is already occupied.");

    // The failed attempt must not create a second activity record.
    const activity = await request(app).get("/api/activity");
    expect(activity.body).toHaveLength(1);
  });
});

describe("POST /api/seats/:id/release", () => {
  it("releases an occupied seat and records the activity", async () => {
    await request(app).post("/api/seats/7/occupy");
    const res = await request(app).post("/api/seats/7/release");
    expect(res.status).toBe(200);
    expect(res.body.seat).toMatchObject({ id: 7, status: "available" });

    const activity = await request(app).get("/api/activity");
    expect(activity.body.map((a: { action: string }) => a.action)).toEqual(["release", "occupy"]);
  });

  it("rejects a seat that is already available", async () => {
    const res = await request(app).post("/api/seats/7/release");
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Seat 7 is already available.");
  });
});

describe("invalid seat ids", () => {
  it("returns 404 for a seat that does not exist", async () => {
    const res = await request(app).post("/api/seats/9999/occupy");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Seat not found.");
  });

  it("returns 400 for a seat id that is not a number", async () => {
    const res = await request(app).post("/api/seats/abc/occupy");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Seat id must be a positive number.");
  });
});
