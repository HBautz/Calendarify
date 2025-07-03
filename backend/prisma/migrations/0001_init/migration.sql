CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users, event types, etc will be created by Prisma

-- Booking exclusion constraint
ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap EXCLUDE USING gist (
  "user_id" WITH =,
  tstzrange("starts_at", "ends_at") WITH &&
);
