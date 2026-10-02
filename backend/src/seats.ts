import { pool } from "./db";

export type SeatStatus = "available" | "occupied";
export type SeatAction = "occupy" | "release";

// An error that carries the HTTP status code the API should answer with.
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const seatColumns = `id, seat_number AS "seatNumber", section, status, updated_at AS "updatedAt"`;

export async function listSeats() {
  const result = await pool.query(`SELECT ${seatColumns} FROM seats ORDER BY seat_number`);
  return result.rows;
}

export async function getStats() {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'occupied')::int AS occupied
     FROM seats`
  );
  const { total, occupied } = result.rows[0];
  const percentage = total === 0 ? 0 : (occupied / total) * 100;
  return {
    total,
    occupied,
    available: total - occupied,
    occupancyPercentage: Math.round(percentage * 100) / 100,
  };
}

export async function listActivity(limit: number) {
  const result = await pool.query(
    `SELECT a.id, a.seat_id AS "seatId", s.seat_number AS "seatNumber",
            s.section, a.action, a.created_at AS "createdAt"
     FROM activity a
     JOIN seats s ON s.id = a.seat_id
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// Occupies or releases a seat and records the action.
// The UPDATE only matches when the seat is in the opposite state, so two
// requests for the same seat cannot both succeed, even across replicas.
export async function changeSeat(id: number, action: SeatAction) {
  const from: SeatStatus = action === "occupy" ? "available" : "occupied";
  const to: SeatStatus = action === "occupy" ? "occupied" : "available";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE seats SET status = $1, updated_at = now()
       WHERE id = $2 AND status = $3
       RETURNING ${seatColumns}`,
      [to, id, from]
    );

    if (updated.rowCount === 0) {
      await client.query("ROLLBACK");
      const existing = await client.query("SELECT seat_number FROM seats WHERE id = $1", [id]);
      if (existing.rowCount === 0) {
        throw new ApiError(404, "Seat not found.");
      }
      throw new ApiError(409, `Seat ${existing.rows[0].seat_number} is already ${to}.`);
    }

    await client.query("INSERT INTO activity (seat_id, action) VALUES ($1, $2)", [id, action]);
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (err) {
    if (!(err instanceof ApiError)) {
      await client.query("ROLLBACK").catch(() => {});
    }
    throw err;
  } finally {
    client.release();
  }
}
