-- ReadSpace schema.
-- Safe to run more than once: nothing is dropped or overwritten.

CREATE TABLE IF NOT EXISTS seats (
    id          SERIAL PRIMARY KEY,
    seat_number INTEGER NOT NULL UNIQUE,
    section     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available', 'occupied')),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity (
    id         SERIAL PRIMARY KEY,
    seat_id    INTEGER NOT NULL REFERENCES seats (id),
    action     TEXT NOT NULL CHECK (action IN ('occupy', 'release')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_created_at_idx ON activity (created_at DESC);
