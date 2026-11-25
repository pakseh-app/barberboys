ALTER TABLE gallery_items ADD COLUMN image_blob_key TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE customer_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT '',
  image_blob_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
