CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  stamps INTEGER NOT NULL DEFAULT 0,
  free_cuts INTEGER NOT NULL DEFAULT 0,
  total_visits INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN member_id INTEGER;
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN stamp_granted INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN free_cut_used INTEGER NOT NULL DEFAULT 0;
