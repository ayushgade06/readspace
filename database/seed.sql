-- Seed data for the PICT reading hall.
-- 8 tables (Table A to Table H) with 6 seats each = 48 seats.
-- Seats 1-6 belong to Table A, 7-12 to Table B, and so on.
--
-- The application reads the seats from this table, so the hall can be
-- resized by changing this file only.

INSERT INTO seats (seat_number, section)
SELECT n, 'Table ' || chr(65 + (n - 1) / 6)
FROM generate_series(1, 48) AS n
ON CONFLICT (seat_number) DO NOTHING;
