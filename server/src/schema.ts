import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const branches = sqliteTable("branches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  openTime: text("open_time").notNull().default("09:00"),
  closeTime: text("close_time").notNull().default("21:00"),
  active: integer("active").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  branchId: integer("branch_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: integer("price").notNull(),
  durationMin: integer("duration_min").notNull().default(30),
  active: integer("active").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const barbers = sqliteTable("barbers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  branchId: integer("branch_id").notNull(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull().default(""),
  bio: text("bio").notNull().default(""),
  experienceYears: integer("experience_years").notNull().default(0),
  photoAsset: text("photo_asset").notNull().default(""),
  photoBlobKey: text("photo_blob_key").notNull().default(""),
  workDays: text("work_days").notNull().default("0,1,2,3,4,5,6"),
  startTime: text("start_time").notNull().default("09:00"),
  endTime: text("end_time").notNull().default("21:00"),
  active: integer("active").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  pinHash: text("pin_hash").notNull(),
  stamps: integer("stamps").notNull().default(0),
  freeCuts: integer("free_cuts").notNull().default(0),
  totalVisits: integer("total_visits").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const freeCutVouchers = sqliteTable("free_cut_vouchers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id").notNull(),
  code: text("code").notNull(),
  status: text("status", {
    enum: ["aktif", "menunggu_persetujuan", "terpakai", "dibatalkan"],
  })
    .notNull()
    .default("aktif"),
  source: text("source").notNull().default("stempel"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  redeemedAt: integer("redeemed_at", { mode: "timestamp_ms" }),
});

export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id"),
  branchId: integer("branch_id").notNull(),
  serviceId: integer("service_id").notNull(),
  barberId: integer("barber_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: text("status", {
    enum: ["menunggu", "dikonfirmasi", "selesai", "dibatalkan", "menunggu_pembatalan"],
  })
    .notNull()
    .default("menunggu"),
  prevStatus: text("prev_status"),
  paymentMethod: text("payment_method", {
    enum: ["qris", "tunai"],
  })
    .notNull()
    .default("tunai"),
  paymentStatus: text("payment_status", {
    enum: ["belum_bayar", "menunggu_verifikasi", "lunas"],
  })
    .notNull()
    .default("belum_bayar"),
  price: integer("price").notNull(),
  promoCode: text("promo_code"),
  discount: integer("discount").notNull().default(0),
  stampGranted: integer("stamp_granted").notNull().default(0),
  freeCutUsed: integer("free_cut_used").notNull().default(0),
  totalPrice: integer("total_price").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  branchId: integer("branch_id"),
  barberId: integer("barber_id"),
  customerName: text("customer_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const galleryItems = sqliteTable("gallery_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  styleTag: text("style_tag").notNull().default(""),
  imageAsset: text("image_asset").notNull(),
  imageBlobKey: text("image_blob_key").notNull().default(""),
  isSlide: integer("is_slide").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const customerPhotos = sqliteTable("customer_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerName: text("customer_name").notNull(),
  style: text("style").notNull().default(""),
  imageBlobKey: text("image_blob_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const promos = sqliteTable("promos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull(),
  description: text("description").notNull().default(""),
  discountType: text("discount_type", { enum: ["persen", "nominal"] })
    .notNull()
    .default("persen"),
  discountValue: integer("discount_value").notNull(),
  minSpend: integer("min_spend").notNull().default(0),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
