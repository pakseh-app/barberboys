CREATE TABLE free_cut_vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif',
  source TEXT NOT NULL DEFAULT 'stempel',
  created_at INTEGER NOT NULL,
  redeemed_at INTEGER
);
--> statement-breakpoint
CREATE UNIQUE INDEX free_cut_vouchers_code_unique ON free_cut_vouchers (code);
