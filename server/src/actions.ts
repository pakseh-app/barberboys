import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import * as schema from "./schema";

const branchOut = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  phone: z.string(),
  openTime: z.string(),
  closeTime: z.string(),
  active: z.boolean(),
  sortOrder: z.number(),
});

const serviceOut = z.object({
  id: z.number(),
  branchId: z.number(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  durationMin: z.number(),
  active: z.boolean(),
  sortOrder: z.number(),
});

const barberOut = z.object({
  id: z.number(),
  branchId: z.number(),
  name: z.string(),
  specialty: z.string(),
  bio: z.string(),
  experienceYears: z.number(),
  photoAsset: z.string(),
  photoUrl: z.string().nullable(),
  workDays: z.array(z.number()),
  startTime: z.string(),
  endTime: z.string(),
  active: z.boolean(),
  sortOrder: z.number(),
  avgRating: z.number(),
  reviewCount: z.number(),
});

const bookingOut = z.object({
  id: z.number(),
  memberId: z.number().nullable(),
  freeCutUsed: z.boolean(),
  branchId: z.number(),
  branchName: z.string(),
  serviceId: z.number(),
  serviceName: z.string(),
  barberId: z.number(),
  barberName: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  date: z.string(),
  time: z.string(),
  status: z.string(),
  paymentMethod: z.string(),
  paymentStatus: z.string(),
  price: z.number(),
  promoCode: z.string().nullable(),
  discount: z.number(),
  totalPrice: z.number(),
  notes: z.string(),
  createdAt: z.string(),
});

const reviewOut = z.object({
  id: z.number(),
  branchId: z.number().nullable(),
  barberId: z.number().nullable(),
  barberName: z.string(),
  customerName: z.string(),
  rating: z.number(),
  comment: z.string(),
  createdAt: z.string(),
});

const galleryOut = z.object({
  id: z.number(),
  title: z.string(),
  styleTag: z.string(),
  imageAsset: z.string(),
  imageUrl: z.string().nullable(),
  isSlide: z.boolean(),
  sortOrder: z.number(),
});

const customerPhotoOut = z.object({
  id: z.number(),
  customerName: z.string(),
  style: z.string(),
  imageUrl: z.string(),
  createdAt: z.string(),
});

const photoUpload = z.object({
  dataBase64: z.string().min(100).max(8_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const PHOTO_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function storePhoto(
  ctx: Ctx,
  folder: string,
  photo: { dataBase64: string; mimeType: string },
): Promise<string> {
  const ext = PHOTO_MIME_EXT[photo.mimeType];
  if (!ext) throw new Error("Format foto harus JPG, PNG, atau WebP.");
  const bytes = Buffer.from(photo.dataBase64, "base64");
  if (bytes.length === 0) throw new Error("Foto kosong atau rusak, coba foto lain.");
  if (bytes.length > 5 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB.");
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  await ctx.blobs.put(key, bytes, { contentType: photo.mimeType });
  return key;
}

async function deletePhotoBlob(ctx: Ctx, key: string): Promise<void> {
  if (!key) return;
  try {
    await ctx.blobs.delete(key);
  } catch {
    // Blob cleanup is best-effort; the database row is the source of truth.
  }
}

const promoOut = z.object({
  id: z.number(),
  code: z.string(),
  description: z.string(),
  discountType: z.string(),
  discountValue: z.number(),
  minSpend: z.number(),
  maxUses: z.number().nullable(),
  usedCount: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  active: z.boolean(),
});

type BarberRow = typeof schema.barbers.$inferSelect;
type BookingRow = typeof schema.bookings.$inferSelect;

function barberToOut(
  b: BarberRow,
  ratings: Map<number, { sum: number; count: number }>,
  photoUrl: string | null = null,
): z.infer<typeof barberOut> {
  const r = ratings.get(b.id);
  return {
    id: b.id,
    branchId: b.branchId,
    name: b.name,
    specialty: b.specialty,
    bio: b.bio,
    experienceYears: b.experienceYears,
    photoAsset: b.photoAsset,
    photoUrl,
    workDays: b.workDays
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n)),
    startTime: b.startTime,
    endTime: b.endTime,
    active: b.active === 1,
    sortOrder: b.sortOrder,
    avgRating: r && r.count > 0 ? Math.round((r.sum / r.count) * 10) / 10 : 0,
    reviewCount: r ? r.count : 0,
  };
}

const memberOut = z.object({
  id: z.number(),
  name: z.string(),
  phone: z.string(),
  stamps: z.number(),
  freeCuts: z.number(),
  totalVisits: z.number(),
  createdAt: z.string(),
});

type MemberRow = typeof schema.members.$inferSelect;

function memberToOut(m: MemberRow): z.infer<typeof memberOut> {
  return {
    id: m.id,
    name: m.name,
    phone: m.phone,
    stamps: m.stamps,
    freeCuts: m.freeCuts,
    totalVisits: m.totalVisits,
    createdAt: m.createdAt.toISOString(),
  };
}

const voucherOut = z.object({
  id: z.number(),
  memberId: z.number(),
  memberName: z.string(),
  memberPhone: z.string(),
  code: z.string(),
  status: z.string(),
  source: z.string(),
  createdAt: z.string(),
  redeemedAt: z.string().nullable(),
});

type VoucherRow = typeof schema.freeCutVouchers.$inferSelect;

function voucherToOut(
  v: VoucherRow,
  memberName: string,
  memberPhone: string,
): z.infer<typeof voucherOut> {
  return {
    id: v.id,
    memberId: v.memberId,
    memberName,
    memberPhone,
    code: v.code,
    status: v.status,
    source: v.source,
    createdAt: v.createdAt.toISOString(),
    redeemedAt: v.redeemedAt ? v.redeemedAt.toISOString() : null,
  };
}

async function generateVoucherCode(ctx: Ctx): Promise<string> {
  const db = ctx.db<typeof schema>();
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = "";
    for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const code = `BBV-${suffix}`;
    const existing = await db
      .select({ id: schema.freeCutVouchers.id })
      .from(schema.freeCutVouchers)
      .where(eq(schema.freeCutVouchers.code, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  return `BBV-${Date.now().toString(36).toUpperCase()}`;
}

async function insertVoucher(ctx: Ctx, memberId: number, source: string): Promise<void> {
  const db = ctx.db<typeof schema>();
  const code = await generateVoucherCode(ctx);
  await db.insert(schema.freeCutVouchers).values({ memberId, code, status: "aktif", source });
}

// Keeps a member's open vouchers (aktif / menunggu persetujuan) in sync with
// their freeCuts balance — including members who earned free cuts before
// vouchers existed. Extra open vouchers are cancelled, never deleted.
async function syncMemberVouchers(ctx: Ctx, member: MemberRow, source = "stempel"): Promise<void> {
  const db = ctx.db<typeof schema>();
  const open = await db
    .select()
    .from(schema.freeCutVouchers)
    .where(
      and(
        eq(schema.freeCutVouchers.memberId, member.id),
        ne(schema.freeCutVouchers.status, "terpakai"),
        ne(schema.freeCutVouchers.status, "dibatalkan"),
      ),
    )
    .orderBy(asc(schema.freeCutVouchers.id));
  if (open.length < member.freeCuts) {
    for (let i = open.length; i < member.freeCuts; i++) {
      await insertVoucher(ctx, member.id, source);
    }
  } else if (open.length > member.freeCuts) {
    const excess = open.slice(member.freeCuts).filter((v) => v.status === "aktif");
    for (const v of excess) {
      await db
        .update(schema.freeCutVouchers)
        .set({ status: "dibatalkan" })
        .where(eq(schema.freeCutVouchers.id, v.id));
    }
  }
}

// Loyalty target: how many stamps (finished visits) a member must collect
// for 1 free cut. Admin-adjustable in Pengaturan via the settings key
// "stamps_for_free_cut"; default 10, accepted range 2–50.
const STAMPS_TARGET_DEFAULT = 10;

function parseStampsTarget(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 2 && n <= 50 ? n : STAMPS_TARGET_DEFAULT;
}

async function getStampsTarget(ctx: Ctx): Promise<number> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "stamps_for_free_cut"))
    .limit(1);
  return parseStampsTarget(rows[0]?.value);
}

async function hashPin(pin: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`barberboys:${pin}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Supabase ────────────────────────────────────────────────────────────
// Koneksi ke proyek Supabase pemilik (URL + publishable key dari pemilik).
// Publishable key memang aman dibagikan publik, tetapi ia tidak bisa
// membuat tabel lewat API — tabel dibuat pemilik lewat file SQL di menu
// Admin → Supabase (supabase/barberboys_supabase.sql). Server berbicara ke
// Supabase lewat REST API-nya (PostgREST): memeriksa status tabel,
// mengirim (upsert) semua data aplikasi, dan menarik data kembali.
// Nilai di settings ("supabase_url" / "supabase_publishable_key") bisa
// menimpa bawaan ini bila pemilik mengganti proyek/key nanti.
const SUPABASE_DEFAULT_URL = "https://sewuniqlgslrydxmppcm.supabase.co";
const SUPABASE_DEFAULT_KEY = "sb_publishable_p9W29tDOxuT2Q4kI4iT47A_UgGcvK6L";

// PIN admin awal untuk instalasi baru dibaca dari environment (BARBERBOYS_ADMIN_PIN).
// Tidak ada PIN bawaan di dalam kode: kalau variabel ini kosong dan belum ada PIN
// tersimpan, login admin tidak bisa dipakai sampai PIN diatur. Segera ganti PIN lewat Pengaturan.
const DEFAULT_ADMIN_PIN = process.env.BARBERBOYS_ADMIN_PIN ?? "";

type SbConfig = { url: string; key: string };

async function getSupabaseConfig(ctx: Ctx): Promise<SbConfig> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.settings)
    .where(inArray(schema.settings.key, ["supabase_url", "supabase_publishable_key"]));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    url: (map.get("supabase_url") ?? SUPABASE_DEFAULT_URL).replace(/\/+$/, ""),
    key: map.get("supabase_publishable_key") ?? SUPABASE_DEFAULT_KEY,
  };
}

async function sbFetch(cfg: SbConfig, path: string, init?: RequestInit): Promise<Response> {
  const doFetch = (): Promise<Response> =>
    fetch(`${cfg.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  try {
    return await doFetch();
  } catch {
    // Ulangi sekali untuk gangguan jaringan sesaat (koneksi terputus di
    // tengah jalan); error kedua diteruskan ke pemanggil apa adanya.
    return doFetch();
  }
}

async function sbErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; code?: string };
    if (body.code === "PGRST205" || (body.message ?? "").includes("schema cache"))
      return "Tabel belum dibuat di Supabase — jalankan dulu file SQL dari menu Admin → Supabase (SQL Editor), lalu coba lagi.";
    if (body.message) return body.message;
  } catch {
    // Badan error tidak terbaca; pakai status HTTP saja.
  }
  return `Supabase menjawab HTTP ${res.status}.`;
}

type SbRemoteRow = Record<string, unknown>;

const sbBool = (n: number): boolean => n === 1;
const sbInt = (v: unknown): number => (v === true ? 1 : typeof v === "number" ? v : 0);
const sbStr = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const sbStrOrNull = (v: unknown): string | null => (v == null ? null : String(v));
const sbNum = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const sbNumOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const sbDate = (v: unknown): Date | null => {
  if (v == null) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

type SbTableDef = {
  name: string;
  label: string;
  conflictKey: "id" | "key";
  loadLocal: (ctx: Ctx) => Promise<SbRemoteRow[]>;
  applyRemote: (ctx: Ctx, rows: SbRemoteRow[]) => Promise<number>;
};

// Urutan mengikuti relasi antar-tabel di Supabase (foreign key): tabel
// induk dikirim/diisi lebih dulu daripada tabel yang merujuknya.
const SB_TABLES: SbTableDef[] = [
  {
    name: "branches",
    label: "Lokasi",
    conflictKey: "id",
    loadLocal: async (ctx) => {
      const rows = await ctx.db<typeof schema>().select().from(schema.branches);
      return rows.map((r) => ({
        id: r.id, name: r.name, address: r.address, phone: r.phone,
        open_time: r.openTime, close_time: r.closeTime,
        active: sbBool(r.active), sort_order: r.sortOrder,
      }));
    },
    applyRemote: async (ctx, rows) => {
      const db = ctx.db<typeof schema>();
      let n = 0;
      for (const r of rows) {
        const v = {
          id: sbNum(r.id), name: sbStr(r.name), address: sbStr(r.address), phone: sbStr(r.phone),
          openTime: sbStr(r.open_time) || "09:00", closeTime: sbStr(r.close_time) || "21:00",
          active: sbInt(r.active), sortOrder: sbNum(r.sort_order),
        };
        await db.insert(schema.branches).values(v).onConflictDoUpdate({ target: schema.branches.id, set: v });
        n++;
      }
      return n;
    },
  },
  {
    name: "services",
    label: "Layanan",
    conflictKey: "id",
    loadLocal: async (ctx) => {
      const rows = await ctx.db<typeof schema>().select().from(schema.services);
      return rows.map((r) => ({
        id: r.id, branch_id: r.branchId, name: r.name, description: r.description,
        price: r.price, duration_min: r.durationMin,
        active: sbBool(r.active), sort_order: r.sortOrder,
      }));
    },
    applyRemote: async (ctx, rows) => {
      const db = ctx.db<typeof schema>();
      let n = 0;
      for (const r of rows) {
        const v = {
          id: sbNum(r.id), branchId: sbNum(r.branch_id), name: sbStr(r.name),
          description: sbStr(r.description), price: sbNum(r.price),
          durationMin: sbNum(r.duration_min) || 30, active: sbInt(r.active), sortOrder: sbNum(r.sort_order),
        };
        await db.insert(schema.services).values(v).onConflictDoUpdate({ target: schema.services.id, set: v });
        n++;
      }
      return n;
    },
  },
  {
    name: "barbers",
    label: "Kapster",
    conflictKey: "id",
    loadLocal: async (ctx) => {
      const rows = await ctx.db<typeof schema>().select().from(schema.barbers);
      return rows.map((r) => ({
        id: r.id, branch_id: r.branchId, name: r.name, specialty: r.specialty, bio: r.bio,
        experience_years: r.experienceYears, photo_asset: r.photoAsset, photo_blob_key: r.photoBlobKey, work_days: r.workDays,
        start_time: r.startTime, end_time: r.endTime,
        active: sbBool(r.active), sort_order: r.sortOrder,
      }));
    },
    applyRemote: async (ctx, rows) => {
      const db = ctx.db<typeof schema>();
      let n = 0;
      for (const r of rows) {
        const v = {
          id: sbNum(r.id), branchId: sbNum(r.branch_id), name: sbStr(r.name),
          specialty: sbStr(r.specialty), bio: sbStr(r.bio),
          experienceYears: sbNum(r.experience_years), photoAsset: sbStr(r.photo_asset),
          photoBlobKey: sbStr(r.photo_blob_key),
          workDays: sbStr(r.work_days) || "0,1,2,3,4,5,6",
          startTime: sbStr(r.start_time) || "09:00", endTime: sbStr(r.end_time) || "21:00",
          active: sbInt(r.active), sortOrder: sbNum(r.sort_order),
        };
        await db.insert(schema.barbers).values(v).onConflictDoUpdate({ target: schema.barbers.id, set: v });
        n++;
      }
      return n;
    },
  },
  {
    name: "members",
    label: "Member & Stempel",
    conflictKey: "id",
    loadLocal: async (ctx) => {
      const rows = await ctx.db<typeof schema>().select().from(schema.members);
      return rows.map((r) => ({
        id: r.id, name: r.name, phone: r.phone, pin_hash: r.pinHash,
        stamps: r.stamps, free_cuts: r.freeCuts, total_visits: r.totalVisits,
        created_at: r.createdAt.toISOString(),
      }));
    },
    applyRemote: async (ctx, rows) => {
      const db = ctx.db<typeof schema>();
      let n = 0;
      for (const r of rows) {
        const v = {
          id: sbNum(r.id), name: sbStr(r.name), phone: sbStr(r.phone), pinHash: sbStr(r.pin_hash),
          stamps: sbNum(r.stamps), freeCuts: sbNum(r.free_cuts), totalVisits: sbNum(r.total_visits),
          createdAt: sbDate(r.created_at) ?? new Date(),
        };
        await db.insert(schema.members).values(v).onConflictDoUpdate({ target: schema.members.id, set: v });
        n++;
      }
      return n;
    },
  },
  {
    name: "promos",
    label: "Promo",
    conflictKey: "id",
    loadLocal: async (ctx) => {
      const rows = await ctx.db<typeof schema>().select().from(schema.promos);
      return rows.map((r) => ({
        id: r.id, code: r.code, description: r.description, discount_type: r.discountType,
        discount_value: r.discountValue, min_spend: r.minSpend, max_uses: r.maxUses,
        used_count: r.usedCount, start_date: r.startDate, end_date: r.endDate,
        active: sbBool(r.active), created_at: r.createdAt.toISOString(),
      }));
    },
    applyRemote: async (ctx, rows) => {
      const db = ctx.db<typeof schema>();
      let n = 0;
      for (const r of rows) {
        const v = {
          id: sbNum(r.id), code: sbStr(r.code), description: sbStr(r.description),
          discountType: (sbStr(r.discount_type) === "nominal" ? "nominal" : "persen") as "persen" | "nominal",
          discountValue: sbNum(r.discount_value), minSpend: sbNum(r.min_spend),
          maxUses: sbNumOrNull(r.max_uses), usedCount: sbNum(r.used_count),
          startDate: sbStr(r.start_date), endDate: sbStr(r.end_date),
          active: sbInt(r.active), createdAt: sbDate(r.created_at) ?? new Date(),
        };
        await db.insert(schema.promos).values(v).onConflictDoUpdate({ target: schema.promos.id, set: v });
        n++;
      }
      return n;
    },
  },
  {
    name: "settings",
    label: "Pengaturan (termasuk hash PIN admin & target stempel)",
    conflictKey: "key",
    loadLocal: async (ctx) => {
      const rows = await ctx.db<typeof schema>().select().from(schema.settings);
      return rows.map((r) => ({ key: r.key, value: r.value }));
    },
    applyRemote: async (ctx, rows) => {
      const db = ctx.db<typeof schema>();
      let n = 0;
      for (const r of rows) {
        const key = sbStr(r.key);
        if (!key) continue;
        const value = sbStr(r.value);
        await db
          .insert(schema.settings)
          .values({ key, value })
          .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
        n++;
      }
      return n;
    },
  },
  {
    name: "bookings",
    label: "Booking",
    conflictKey: "id",
    loadLocal: async (ctx) => {
      const rows = await ctx.db<typeof schema>().select().from(schema.bookings);
      return rows.map((r) => ({
        id: r.id, member_id: r.memberId, branch_id: r.branchId, service_id: r.serviceId,
        barber_id: r.barberId, customer_name: r.customerName, customer_phone: r.customerPhone,
        date: r.date, time: r.time, status: r.status, prev_status: r.prevStatus,
        payment_method: r.paymentMethod, payment_status: r.paymentStatus,
        price: r.price, promo_code: r.promoCode, discount: r.discount,
        stamp_granted: sbBool(r.stampGranted), free_cut_used: sbBool(r.freeCutUsed),
        total_price: r.totalPrice, notes: r.notes, created_at: r.createdAt.toISOString(),
      }));
    },
    applyRemote: async (ctx, rows) => {
      const db = ctx.db<typeof schema>();
      let n = 0;
      for (const r of rows) {
        const v = {
          id: sbNum(r.id), memberId: sbNumOrNull(r.member_id), branchId: sbNum(r.branch_id),
          serviceId: sbNum(r.service_id), barberId: sbNum(r.barber_id),
          customerName: sbStr(r.customer_name), customerPhone: sbStr(r.customer_phone),
          date: sbStr(r.date), time: sbStr(r.time),
          status: sbStr(r.status) as BookingRow["status"],
          prevStatus: sbStrOrNull(r.prev_status),
          paymentMethod: (sbStr(r.payment_method) === "qris" ? "qris" : "tunai") as BookingRow["paymentMethod"],
          paymentStatus: sbStr(r.payment_status) as BookingRow["paymentStatus"],
          price: sbNum(r.price), promoCode: sbStrOrNull(r.promo_code), discount: sbNum(r.discount),
          stampGranted: sbInt(r.stamp_granted), freeCutUsed: sbInt(r.free_cut_used),
          totalPrice: sbNum(r.total_price), notes: sbStr(r.notes),
          createdAt: sbDate(r.created_at) ?? new Date(),
        };
        await db.insert(schema.bookings).values(v).onConflictDoUpdate({ target: schema.bookings.id, set: v });
        n++;
      }
      return n;
    },
  },
  {
    name: "free_cut_vouchers",
    label: "Voucher Potong Gratis",
    conflictKey: "id",
    loadLocal: async (ctx) => {
      const rows = await ctx.db<typeof schema>().select().from(schema.freeCutVouchers);
      return rows.map((r) => ({
        id: r.id, member_id: r.memberId, code: r.code, status: r.status, source: r.source,
        created_at: r.createdAt.toISOString(),
        redeemed_at: r.redeemedAt ? r.redeemedAt.toISOString() : null,
      }));
    },
    applyRemote: async (ctx, rows) => {
      const db = ctx.db<typeof schema>();
      let n = 0;
      for (const r of rows) {
        const v = {
          id: sbNum(r.id), memberId: sbNum(r.member_id), code: sbStr(r.code),
          status: sbStr(r.status) as VoucherRow["status"],
          source: sbStr(r.source) || "stempel",
          createdAt: sbDate(r.created_at) ?? new Date(),
          redeemedAt: sbDate(r.redeemed_at),
        };
        await db.insert(schema.freeCutVouchers).values(v).onConflictDoUpdate({ target: schema.freeCutVouchers.id, set: v });
        n++;
      }
      return n;
    },
  },
  {
    name: "reviews",
    label: "Ulasan",
    conflictKey: "id",
    loadLocal: async (ctx) => {
      const rows = await ctx.db<typeof schema>().select().from(schema.reviews);
      return rows.map((r) => ({
        id: r.id, branch_id: r.branchId, barber_id: r.barberId,
        customer_name: r.customerName, rating: r.rating, comment: r.comment,
        created_at: r.createdAt.toISOString(),
      }));
    },
    applyRemote: async (ctx, rows) => {
      const db = ctx.db<typeof schema>();
      let n = 0;
      for (const r of rows) {
        const v = {
          id: sbNum(r.id), branchId: sbNumOrNull(r.branch_id), barberId: sbNumOrNull(r.barber_id),
          customerName: sbStr(r.customer_name), rating: sbNum(r.rating), comment: sbStr(r.comment),
          createdAt: sbDate(r.created_at) ?? new Date(),
        };
        await db.insert(schema.reviews).values(v).onConflictDoUpdate({ target: schema.reviews.id, set: v });
        n++;
      }
      return n;
    },
  },
  {
    name: "gallery_items",
    label: "Galeri",
    conflictKey: "id",
    loadLocal: async (ctx) => {
      const rows = await ctx.db<typeof schema>().select().from(schema.galleryItems);
      return rows.map((r) => ({
        id: r.id, title: r.title, style_tag: r.styleTag, image_asset: r.imageAsset,
        image_blob_key: r.imageBlobKey, is_slide: sbBool(r.isSlide), sort_order: r.sortOrder,
      }));
    },
    applyRemote: async (ctx, rows) => {
      const db = ctx.db<typeof schema>();
      let n = 0;
      for (const r of rows) {
        const v = {
          id: sbNum(r.id), title: sbStr(r.title), styleTag: sbStr(r.style_tag),
          imageAsset: sbStr(r.image_asset), imageBlobKey: sbStr(r.image_blob_key),
          isSlide: sbInt(r.is_slide), sortOrder: sbNum(r.sort_order),
        };
        await db.insert(schema.galleryItems).values(v).onConflictDoUpdate({ target: schema.galleryItems.id, set: v });
        n++;
      }
      return n;
    },
  },
  {
    name: "customer_photos",
    label: "Foto Pelanggan",
    conflictKey: "id",
    loadLocal: async (ctx) => {
      const rows = await ctx.db<typeof schema>().select().from(schema.customerPhotos);
      return rows.map((r) => ({
        id: r.id, customer_name: r.customerName, style: r.style,
        image_blob_key: r.imageBlobKey, created_at: r.createdAt.toISOString(),
      }));
    },
    applyRemote: async (ctx, rows) => {
      const db = ctx.db<typeof schema>();
      let n = 0;
      for (const r of rows) {
        const v = {
          id: sbNum(r.id), customerName: sbStr(r.customer_name), style: sbStr(r.style),
          imageBlobKey: sbStr(r.image_blob_key), createdAt: sbDate(r.created_at) ?? new Date(),
        };
        await db.insert(schema.customerPhotos).values(v).onConflictDoUpdate({ target: schema.customerPhotos.id, set: v });
        n++;
      }
      return n;
    },
  },
];

async function sbUpsert(cfg: SbConfig, def: SbTableDef, rows: SbRemoteRow[]): Promise<void> {
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const res = await sbFetch(cfg, `${def.name}?on_conflict=${def.conflictKey}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(await sbErrorMessage(res));
  }
}

async function sbFetchAll(cfg: SbConfig, def: SbTableDef): Promise<SbRemoteRow[]> {
  const out: SbRemoteRow[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const res = await sbFetch(cfg, `${def.name}?select=*&order=${def.conflictKey}.asc`, {
      headers: { Range: `${from}-${from + pageSize - 1}` },
    });
    if (!res.ok) throw new Error(await sbErrorMessage(res));
    const rows = (await res.json()) as SbRemoteRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

type NameMaps = {
  branchName: Map<number, string>;
  serviceName: Map<number, string>;
  barberName: Map<number, string>;
};

async function loadNameMaps(ctx: Ctx): Promise<NameMaps> {
  const db = ctx.db<typeof schema>();
  const [branchRows, serviceRows, barberRows] = await Promise.all([
    db.select().from(schema.branches),
    db.select().from(schema.services),
    db.select().from(schema.barbers),
  ]);
  return {
    branchName: new Map(branchRows.map((b) => [b.id, b.name])),
    serviceName: new Map(serviceRows.map((s) => [s.id, s.name])),
    barberName: new Map(barberRows.map((b) => [b.id, b.name])),
  };
}

function enrichBookings(rows: BookingRow[], maps: NameMaps): Array<z.infer<typeof bookingOut>> {
  return rows.map((r) => ({
    id: r.id,
    memberId: r.memberId,
    freeCutUsed: r.freeCutUsed === 1,
    branchId: r.branchId,
    branchName: maps.branchName.get(r.branchId) ?? "",
    serviceId: r.serviceId,
    serviceName: maps.serviceName.get(r.serviceId) ?? "",
    barberId: r.barberId,
    barberName: maps.barberName.get(r.barberId) ?? "",
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    date: r.date,
    time: r.time,
    status: r.status,
    paymentMethod: r.paymentMethod,
    paymentStatus: r.paymentStatus,
    price: r.price,
    promoCode: r.promoCode,
    discount: r.discount,
    totalPrice: r.totalPrice,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));
}

export const Actions = {
  getBootstrap: defineAction({
    description:
      "Loads everything the storefront needs: shop settings, branches, services, barbers with ratings, gallery (with uploaded-photo URLs), customer result photos, reviews, active promos, and headline stats.",
    request: z.object({}),
    response: z.object({
      settings: z.record(z.string(), z.string()),
      qrisImageUrl: z.string().nullable(),
      branches: z.array(branchOut),
      services: z.array(serviceOut),
      barbers: z.array(barberOut),
      gallery: z.array(galleryOut),
      customerPhotos: z.array(customerPhotoOut),
      reviews: z.array(reviewOut),
      promos: z.array(promoOut),
      stats: z.object({
        branchCount: z.number(),
        barberCount: z.number(),
        serviceCount: z.number(),
        reviewCount: z.number(),
        avgRating: z.number(),
        bookingCount: z.number(),
      }),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const [settingRows, branchRows, serviceRows, barberRows, galleryRows, customerPhotoRows, reviewRows, promoRows, bookingRows] =
        await Promise.all([
          db.select().from(schema.settings),
          db.select().from(schema.branches).orderBy(asc(schema.branches.sortOrder), asc(schema.branches.id)),
          db.select().from(schema.services).orderBy(asc(schema.services.sortOrder), asc(schema.services.id)),
          db.select().from(schema.barbers).orderBy(asc(schema.barbers.sortOrder), asc(schema.barbers.id)),
          db.select().from(schema.galleryItems).orderBy(asc(schema.galleryItems.sortOrder), asc(schema.galleryItems.id)),
          db.select().from(schema.customerPhotos).orderBy(desc(schema.customerPhotos.id)).limit(60),
          db.select().from(schema.reviews).orderBy(desc(schema.reviews.id)).limit(60),
          db.select().from(schema.promos).orderBy(asc(schema.promos.endDate)),
          db.select({ id: schema.bookings.id }).from(schema.bookings),
        ]);
      const [galleryOutRows, customerPhotoOutRows] = await Promise.all([
        Promise.all(
          galleryRows.map(async (g) => ({
            id: g.id,
            title: g.title,
            styleTag: g.styleTag,
            imageAsset: g.imageAsset,
            imageUrl: g.imageBlobKey ? await ctx.blobs.getUrl(g.imageBlobKey) : null,
            isSlide: g.isSlide === 1,
            sortOrder: g.sortOrder,
          })),
        ),
        Promise.all(
          customerPhotoRows.map(async (p) => ({
            id: p.id,
            customerName: p.customerName,
            style: p.style,
            imageUrl: await ctx.blobs.getUrl(p.imageBlobKey),
            createdAt: p.createdAt.toISOString(),
          })),
        ),
      ]);
      const settings: Record<string, string> = {};
      let qrisBlobKey = "";
      for (const s of settingRows) {
        if (s.key === "admin_pin_hash") continue;
        // Kunci koneksi Supabase hanya dipakai server (status/sinkronisasi
        // di menu Admin → Supabase), tidak dikirim ke klien.
        if (s.key === "supabase_publishable_key" || s.key === "supabase_url") continue;
        if (s.key === "qris_image_blob_key") {
          qrisBlobKey = s.value;
          continue;
        }
        settings[s.key] = s.value;
      }
      // The loyalty target always reaches the client normalized (default 10),
      // so every "X dari N stempel" label uses the admin's current setting.
      settings.stamps_for_free_cut = String(parseStampsTarget(settings.stamps_for_free_cut));
      const qrisImageUrl = qrisBlobKey ? await ctx.blobs.getUrl(qrisBlobKey) : null;
      const ratings = new Map<number, { sum: number; count: number }>();
      let ratingSum = 0;
      for (const r of reviewRows) {
        ratingSum += r.rating;
        if (r.barberId != null) {
          const cur = ratings.get(r.barberId) ?? { sum: 0, count: 0 };
          cur.sum += r.rating;
          cur.count += 1;
          ratings.set(r.barberId, cur);
        }
      }
      const barberName = new Map(barberRows.map((b) => [b.id, b.name]));
      // Foto unggahan kapster (bila ada) di-resolve ke URL seperti galeri;
      // klien menampilkan photoUrl lebih dulu daripada foto bawaan.
      const barberOutRows = await Promise.all(
        barberRows.map(async (b) =>
          barberToOut(b, ratings, b.photoBlobKey ? await ctx.blobs.getUrl(b.photoBlobKey) : null),
        ),
      );
      const today = new Date().toISOString().slice(0, 10);
      return {
        settings,
        qrisImageUrl,
        branches: branchRows.map((b) => ({
          id: b.id,
          name: b.name,
          address: b.address,
          phone: b.phone,
          openTime: b.openTime,
          closeTime: b.closeTime,
          active: b.active === 1,
          sortOrder: b.sortOrder,
        })),
        services: serviceRows.map((s) => ({
          id: s.id,
          branchId: s.branchId,
          name: s.name,
          description: s.description,
          price: s.price,
          durationMin: s.durationMin,
          active: s.active === 1,
          sortOrder: s.sortOrder,
        })),
        barbers: barberOutRows,
        gallery: galleryOutRows,
        customerPhotos: customerPhotoOutRows,
        reviews: reviewRows.map((r) => ({
          id: r.id,
          branchId: r.branchId,
          barberId: r.barberId,
          barberName: r.barberId != null ? (barberName.get(r.barberId) ?? "") : "",
          customerName: r.customerName,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
        })),
        promos: promoRows
          .filter((p) => p.active === 1 && p.startDate <= today && p.endDate >= today)
          .map((p) => ({
            id: p.id,
            code: p.code,
            description: p.description,
            discountType: p.discountType,
            discountValue: p.discountValue,
            minSpend: p.minSpend,
            maxUses: p.maxUses,
            usedCount: p.usedCount,
            startDate: p.startDate,
            endDate: p.endDate,
            active: true,
          })),
        stats: {
          branchCount: branchRows.filter((b) => b.active === 1).length,
          barberCount: barberRows.filter((b) => b.active === 1).length,
          serviceCount: serviceRows.filter((s) => s.active === 1).length,
          reviewCount: reviewRows.length,
          avgRating:
            reviewRows.length > 0
              ? Math.round((ratingSum / reviewRows.length) * 10) / 10
              : 0,
          bookingCount: bookingRows.length,
        },
      };
    },
  }),

  getAvailability: defineAction({
    description:
      "Returns the times already booked for one barber on one date, so the booking form can disable taken slots.",
    request: z.object({
      barberId: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    response: z.object({ bookedTimes: z.array(z.string()) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ time: schema.bookings.time })
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.barberId, args.barberId),
            eq(schema.bookings.date, args.date),
            ne(schema.bookings.status, "dibatalkan"),
          ),
        );
      return { bookedTimes: rows.map((r) => r.time) };
    },
  }),

  validatePromo: defineAction({
    description:
      "Checks a promo code against a price and booking date and returns the discount it would give.",
    request: z.object({
      code: z.string().trim().min(1).max(40),
      price: z.number().int().min(0),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    response: z.object({
      valid: z.boolean(),
      message: z.string(),
      discount: z.number(),
      promoCode: z.string(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const code = args.code.toUpperCase();
      const rows = await db
        .select()
        .from(schema.promos)
        .where(eq(schema.promos.code, code))
        .limit(1);
      const p = rows[0];
      if (!p || p.active !== 1) {
        return { valid: false, message: "Kode promo tidak ditemukan.", discount: 0, promoCode: code };
      }
      if (args.date < p.startDate || args.date > p.endDate) {
        return { valid: false, message: "Kode promo tidak berlaku pada tanggal ini.", discount: 0, promoCode: code };
      }
      if (p.maxUses != null && p.usedCount >= p.maxUses) {
        return { valid: false, message: "Kuota kode promo ini sudah habis.", discount: 0, promoCode: code };
      }
      if (args.price < p.minSpend) {
        return {
          valid: false,
          message: `Minimal belanja untuk kode ini Rp${p.minSpend.toLocaleString("id-ID")}.`,
          discount: 0,
          promoCode: code,
        };
      }
      const discount =
        p.discountType === "persen"
          ? Math.floor((args.price * p.discountValue) / 100)
          : Math.min(p.discountValue, args.price);
      return { valid: true, message: "Kode promo berhasil dipakai.", discount, promoCode: code };
    },
  }),

  createBooking: defineAction({
    description:
      "Creates a booking after re-checking the slot and promo server-side; returns the saved booking with names resolved.",
    request: z.object({
      branchId: z.number().int().positive(),
      serviceId: z.number().int().positive(),
      barberId: z.number().int().positive(),
      customerName: z.string().trim().min(2).max(80),
      customerPhone: z.string().trim().min(8).max(20),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      paymentMethod: z.enum(["qris", "tunai"]),
      promoCode: z.string().trim().max(40).optional(),
      memberId: z.number().int().positive().nullable().optional(),
      useFreeCut: z.boolean().optional(),
      notes: z.string().trim().max(300).optional(),
    }),
    response: z.object({ booking: bookingOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [branchRows, serviceRows, barberRows] = await Promise.all([
        db.select().from(schema.branches).where(eq(schema.branches.id, args.branchId)).limit(1),
        db.select().from(schema.services).where(eq(schema.services.id, args.serviceId)).limit(1),
        db.select().from(schema.barbers).where(eq(schema.barbers.id, args.barberId)).limit(1),
      ]);
      const branch = branchRows[0];
      const service = serviceRows[0];
      const barber = barberRows[0];
      if (!branch || branch.active !== 1) throw new Error("Cabang tidak ditemukan atau sedang tutup.");
      if (!service || service.active !== 1 || service.branchId !== args.branchId)
        throw new Error("Layanan tidak tersedia di cabang ini.");
      if (!barber || barber.active !== 1 || barber.branchId !== args.branchId)
        throw new Error("Kapster tidak tersedia di cabang ini.");
      const weekday = new Date(`${args.date}T00:00:00`).getDay();
      const workDays = barber.workDays.split(",").map((s) => Number(s.trim()));
      if (!workDays.includes(weekday)) throw new Error("Kapster libur pada hari itu. Pilih hari atau kapster lain.");
      if (args.time < barber.startTime || args.time >= barber.endTime)
        throw new Error("Jam di luar jam kerja kapster.");
      const clash = await db
        .select({ id: schema.bookings.id })
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.barberId, args.barberId),
            eq(schema.bookings.date, args.date),
            eq(schema.bookings.time, args.time),
            ne(schema.bookings.status, "dibatalkan"),
          ),
        )
        .limit(1);
      if (clash.length > 0) throw new Error("Slot jam ini baru saja terisi. Pilih jam lain.");

      let memberRow: MemberRow | undefined;
      if (args.memberId) {
        const mRows = await db.select().from(schema.members).where(eq(schema.members.id, args.memberId)).limit(1);
        memberRow = mRows[0];
        if (!memberRow) throw new Error("Akun member tidak ditemukan. Coba login ulang.");
      }
      const useFreeCut = Boolean(args.useFreeCut && memberRow && memberRow.freeCuts > 0);
      let discount = 0;
      let appliedPromo: string | null = null;
      let promoRow: typeof schema.promos.$inferSelect | undefined;
      if (useFreeCut) {
        discount = service.price;
      } else if (args.promoCode) {
        const code = args.promoCode.toUpperCase();
        const rows = await db.select().from(schema.promos).where(eq(schema.promos.code, code)).limit(1);
        promoRow = rows[0];
        if (
          promoRow &&
          promoRow.active === 1 &&
          args.date >= promoRow.startDate &&
          args.date <= promoRow.endDate &&
          (promoRow.maxUses == null || promoRow.usedCount < promoRow.maxUses) &&
          service.price >= promoRow.minSpend
        ) {
          discount =
            promoRow.discountType === "persen"
              ? Math.floor((service.price * promoRow.discountValue) / 100)
              : Math.min(promoRow.discountValue, service.price);
          appliedPromo = code;
        }
      }
      const totalPrice = Math.max(0, service.price - discount);
      const inserted = await db
        .insert(schema.bookings)
        .values({
          memberId: memberRow ? memberRow.id : null,
          branchId: args.branchId,
          serviceId: args.serviceId,
          barberId: args.barberId,
          customerName: args.customerName,
          customerPhone: args.customerPhone,
          date: args.date,
          time: args.time,
          status: "menunggu",
          paymentMethod: args.paymentMethod,
          paymentStatus: useFreeCut ? "lunas" : args.paymentMethod === "tunai" ? "belum_bayar" : "menunggu_verifikasi",
          price: service.price,
          promoCode: appliedPromo,
          discount,
          freeCutUsed: useFreeCut ? 1 : 0,
          totalPrice,
          notes: args.notes ?? "",
        })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error("Booking gagal disimpan.");
      if (promoRow && appliedPromo) {
        await db
          .update(schema.promos)
          .set({ usedCount: promoRow.usedCount + 1 })
          .where(eq(schema.promos.id, promoRow.id));
      }
      if (useFreeCut && memberRow) {
        // Memakai potong gratis = memakai voucher: voucher aktif tertua
        // ditandai terpakai dan stempel member direset ulang dari 0.
        await db
          .update(schema.members)
          .set({ freeCuts: memberRow.freeCuts - 1, stamps: 0 })
          .where(eq(schema.members.id, memberRow.id));
        const openVouchers = await db
          .select()
          .from(schema.freeCutVouchers)
          .where(
            and(
              eq(schema.freeCutVouchers.memberId, memberRow.id),
              eq(schema.freeCutVouchers.status, "aktif"),
            ),
          )
          .orderBy(asc(schema.freeCutVouchers.id))
          .limit(1);
        const v = openVouchers[0];
        if (v) {
          await db
            .update(schema.freeCutVouchers)
            .set({ status: "terpakai", redeemedAt: new Date() })
            .where(eq(schema.freeCutVouchers.id, v.id));
        }
      }
      ctx.invalidateQueries();
      return {
        booking: {
          id: row.id,
          memberId: row.memberId,
          freeCutUsed: row.freeCutUsed === 1,
          branchId: row.branchId,
          branchName: branch.name,
          serviceId: row.serviceId,
          serviceName: service.name,
          barberId: row.barberId,
          barberName: barber.name,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          date: row.date,
          time: row.time,
          status: row.status,
          paymentMethod: row.paymentMethod,
          paymentStatus: row.paymentStatus,
          price: row.price,
          promoCode: row.promoCode,
          discount: row.discount,
          totalPrice: row.totalPrice,
          notes: row.notes,
          createdAt: row.createdAt.toISOString(),
        },
      };
    },
  }),

  findBookingsByPhone: defineAction({
    description: "Looks up a customer's bookings by their phone number.",
    request: z.object({ phone: z.string().trim().min(8).max(20) }),
    response: z.object({ bookings: z.array(bookingOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.customerPhone, args.phone))
        .orderBy(desc(schema.bookings.date), desc(schema.bookings.time))
        .limit(50);
      return { bookings: enrichBookings(rows, await loadNameMaps(ctx)) };
    },
  }),

  createReview: defineAction({
    description: "Adds a customer review, optionally tied to a barber and branch.",
    request: z.object({
      customerName: z.string().trim().min(2).max(80),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(500).optional(),
      barberId: z.number().int().positive().nullable().optional(),
      branchId: z.number().int().positive().nullable().optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.reviews)
        .values({
          customerName: args.customerName,
          rating: args.rating,
          comment: args.comment ?? "",
          barberId: args.barberId ?? null,
          branchId: args.branchId ?? null,
        })
        .returning({ id: schema.reviews.id });
      const row = inserted[0];
      if (!row) throw new Error("Ulasan gagal disimpan.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listBookingsAdmin: defineAction({
    description: "Lists bookings for the admin dashboard, optionally filtered by branch and date.",
    request: z.object({
      branchId: z.number().int().positive().nullable().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    }),
    response: z.object({ bookings: z.array(bookingOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const conds = [];
      if (args.branchId) conds.push(eq(schema.bookings.branchId, args.branchId));
      if (args.date) conds.push(eq(schema.bookings.date, args.date));
      const rows = await db
        .select()
        .from(schema.bookings)
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(schema.bookings.date), asc(schema.bookings.time))
        .limit(300);
      return { bookings: enrichBookings(rows, await loadNameMaps(ctx)) };
    },
  }),

  getAdminPendingCounts: defineAction({
    description:
      "Counts items waiting for admin action — new bookings, cancellation requests, QRIS payments awaiting verification, and free-cut voucher redemption requests — powering the red notification badges on the admin menus.",
    request: z.object({}),
    response: z.object({
      newBookings: z.number(),
      cancelRequests: z.number(),
      paymentVerifications: z.number(),
      voucherRequests: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const bookingRows = await db
        .select({ status: schema.bookings.status, paymentStatus: schema.bookings.paymentStatus })
        .from(schema.bookings)
        .where(ne(schema.bookings.status, "dibatalkan"));
      const voucherRows = await db
        .select({ id: schema.freeCutVouchers.id })
        .from(schema.freeCutVouchers)
        .where(eq(schema.freeCutVouchers.status, "menunggu_persetujuan"));
      return {
        newBookings: bookingRows.filter((b) => b.status === "menunggu").length,
        cancelRequests: bookingRows.filter((b) => b.status === "menunggu_pembatalan").length,
        paymentVerifications: bookingRows.filter((b) => b.paymentStatus === "menunggu_verifikasi").length,
        voucherRequests: voucherRows.length,
      };
    },
  }),

  updateBooking: defineAction({
    description: "Updates a booking's status, payment status, or payment method from the admin dashboard.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["menunggu", "dikonfirmasi", "selesai", "dibatalkan", "menunggu_pembatalan"]).optional(),
      paymentStatus: z.enum(["belum_bayar", "menunggu_verifikasi", "lunas"]).optional(),
      paymentMethod: z.enum(["qris", "tunai"]).optional(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const patch: Partial<BookingRow> = {};
      if (args.status) patch.status = args.status;
      // Moving a booking out of the cancellation-pending state by hand also
      // clears the remembered previous status.
      if (args.status && args.status !== "menunggu_pembatalan") patch.prevStatus = null;
      if (args.paymentStatus) patch.paymentStatus = args.paymentStatus;
      if (args.paymentMethod) patch.paymentMethod = args.paymentMethod;
      if (Object.keys(patch).length === 0) return { ok: true };
      await db.update(schema.bookings).set(patch).where(eq(schema.bookings.id, args.id));
      // Loyalty: a finished haircut earns the member 1 stamp; once the stamps
      // reach the admin-configured target (Pengaturan, default 10) they
      // convert to 1 free cut. A while loop also settles members whose stamp
      // balance already passes a target the admin just lowered.
      if (args.status === "selesai") {
        const rows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, args.id)).limit(1);
        const bk = rows[0];
        if (bk && bk.memberId != null && bk.stampGranted !== 1) {
          const mRows = await db.select().from(schema.members).where(eq(schema.members.id, bk.memberId)).limit(1);
          const m = mRows[0];
          if (m) {
            const target = await getStampsTarget(ctx);
            let stamps = m.stamps + 1;
            let freeCuts = m.freeCuts;
            let earnedFreeCuts = 0;
            while (stamps >= target) {
              stamps -= target;
              freeCuts += 1;
              earnedFreeCuts += 1;
            }
            await db
              .update(schema.members)
              .set({ stamps, freeCuts, totalVisits: m.totalVisits + 1 })
              .where(eq(schema.members.id, m.id));
            await db
              .update(schema.bookings)
              .set({ stampGranted: 1 })
              .where(eq(schema.bookings.id, args.id));
            // Stempel yang mencapai target otomatis menjadi voucher potong
            // gratis yang bisa diunduh member sebagai PNG dan ditukar di barber.
            for (let i = 0; i < earnedFreeCuts; i++) await insertVoucher(ctx, m.id, "stempel");
          }
        }
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  requestBookingCancellation: defineAction({
    description:
      "Customer requests cancellation of their own booking (verified by the booking's phone number). The booking moves to menunggu_pembatalan and keeps its previous status until an admin approves or rejects the cancellation.",
    request: z.object({
      bookingId: z.number().int().positive(),
      phone: z.string().trim().min(8).max(20),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, args.bookingId)).limit(1);
      const bk = rows[0];
      if (!bk) throw new Error("Booking tidak ditemukan.");
      if (bk.customerPhone !== args.phone)
        throw new Error("Nomor HP tidak cocok dengan booking ini.");
      if (bk.status === "menunggu_pembatalan")
        throw new Error("Pembatalan booking ini sudah diajukan dan sedang menunggu persetujuan admin.");
      if (bk.status === "selesai")
        throw new Error("Booking yang sudah selesai tidak bisa dibatalkan.");
      if (bk.status === "dibatalkan")
        throw new Error("Booking ini sudah dibatalkan.");
      await db
        .update(schema.bookings)
        .set({ status: "menunggu_pembatalan", prevStatus: bk.status })
        .where(eq(schema.bookings.id, bk.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  approveBookingCancellation: defineAction({
    description:
      "Admin approves a pending booking cancellation: the booking becomes dibatalkan and its time slot is freed.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, args.id)).limit(1);
      const bk = rows[0];
      if (!bk) throw new Error("Booking tidak ditemukan.");
      if (bk.status !== "menunggu_pembatalan")
        throw new Error("Booking ini tidak sedang menunggu persetujuan pembatalan.");
      await db
        .update(schema.bookings)
        .set({ status: "dibatalkan", prevStatus: null })
        .where(eq(schema.bookings.id, bk.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  rejectBookingCancellation: defineAction({
    description:
      "Admin rejects a pending booking cancellation: the booking returns to the status it had before the cancellation was requested.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, args.id)).limit(1);
      const bk = rows[0];
      if (!bk) throw new Error("Booking tidak ditemukan.");
      if (bk.status !== "menunggu_pembatalan")
        throw new Error("Booking ini tidak sedang menunggu persetujuan pembatalan.");
      const restored =
        bk.prevStatus === "dikonfirmasi" || bk.prevStatus === "menunggu" ? bk.prevStatus : "menunggu";
      await db
        .update(schema.bookings)
        .set({ status: restored, prevStatus: null })
        .where(eq(schema.bookings.id, bk.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getFinanceReport: defineAction({
    description:
      "Computes the finance report from paid bookings: daily series, week and month totals, and breakdowns per service, barber, and branch.",
    request: z.object({ branchId: z.number().int().positive().nullable().optional() }),
    response: z.object({
      todayTotal: z.number(),
      weekTotal: z.number(),
      monthTotal: z.number(),
      allTimeTotal: z.number(),
      paidCount: z.number(),
      daily: z.array(z.object({ date: z.string(), total: z.number(), count: z.number() })),
      monthly: z.array(z.object({ month: z.string(), total: z.number(), count: z.number() })),
      byService: z.array(z.object({ name: z.string(), total: z.number(), count: z.number() })),
      byBarber: z.array(z.object({ name: z.string(), total: z.number(), count: z.number() })),
      byBranch: z.array(z.object({ name: z.string(), total: z.number(), count: z.number() })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const conds = [
        eq(schema.bookings.paymentStatus, "lunas" as const),
        ne(schema.bookings.status, "dibatalkan" as const),
      ];
      if (args.branchId) conds.push(eq(schema.bookings.branchId, args.branchId));
      const rows = await db
        .select()
        .from(schema.bookings)
        .where(and(...conds))
        .orderBy(asc(schema.bookings.date));
      const [serviceRows, barberRows, branchRows] = await Promise.all([
        db.select().from(schema.services),
        db.select().from(schema.barbers),
        db.select().from(schema.branches),
      ]);
      const serviceName = new Map(serviceRows.map((s) => [s.id, s.name]));
      const barberName = new Map(barberRows.map((b) => [b.id, b.name]));
      const branchName = new Map(branchRows.map((b) => [b.id, b.name]));

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const monthStr = todayStr.slice(0, 7);
      const dayMs = 24 * 60 * 60 * 1000;
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
      const weekStart = monday.toISOString().slice(0, 10);
      const sunday = new Date(monday.getTime() + 6 * dayMs);
      const weekEnd = sunday.toISOString().slice(0, 10);

      let todayTotal = 0;
      let weekTotal = 0;
      let monthTotal = 0;
      let allTimeTotal = 0;
      const dailyMap = new Map<string, { total: number; count: number }>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * dayMs).toISOString().slice(0, 10);
        dailyMap.set(d, { total: 0, count: 0 });
      }
      const monthlyMap = new Map<string, { total: number; count: number }>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        monthlyMap.set(d.toISOString().slice(0, 7), { total: 0, count: 0 });
      }
      const agg = (map: Map<string, { name: string; total: number; count: number }>, key: string, name: string, amt: number) => {
        const cur = map.get(key) ?? { name, total: 0, count: 0 };
        cur.total += amt;
        cur.count += 1;
        map.set(key, cur);
      };
      const byService = new Map<string, { name: string; total: number; count: number }>();
      const byBarber = new Map<string, { name: string; total: number; count: number }>();
      const byBranch = new Map<string, { name: string; total: number; count: number }>();

      for (const r of rows) {
        allTimeTotal += r.totalPrice;
        if (r.date === todayStr) todayTotal += r.totalPrice;
        if (r.date >= weekStart && r.date <= weekEnd) weekTotal += r.totalPrice;
        if (r.date.startsWith(monthStr)) monthTotal += r.totalPrice;
        const dEntry = dailyMap.get(r.date);
        if (dEntry) {
          dEntry.total += r.totalPrice;
          dEntry.count += 1;
        }
        const mEntry = monthlyMap.get(r.date.slice(0, 7));
        if (mEntry) {
          mEntry.total += r.totalPrice;
          mEntry.count += 1;
        }
        agg(byService, String(r.serviceId), serviceName.get(r.serviceId) ?? "Layanan terhapus", r.totalPrice);
        agg(byBarber, String(r.barberId), barberName.get(r.barberId) ?? "Kapster terhapus", r.totalPrice);
        agg(byBranch, String(r.branchId), branchName.get(r.branchId) ?? "Cabang terhapus", r.totalPrice);
      }
      const sortDesc = (m: Map<string, { name: string; total: number; count: number }>) =>
        [...m.values()].sort((a, b) => b.total - a.total);
      return {
        todayTotal,
        weekTotal,
        monthTotal,
        allTimeTotal,
        paidCount: rows.length,
        daily: [...dailyMap.entries()].map(([date, v]) => ({ date, total: v.total, count: v.count })),
        monthly: [...monthlyMap.entries()].map(([month, v]) => ({ month, total: v.total, count: v.count })),
        byService: sortDesc(byService),
        byBarber: sortDesc(byBarber),
        byBranch: sortDesc(byBranch),
      };
    },
  }),

  saveBranch: defineAction({
    description: "Creates or updates a branch from the admin dashboard.",
    request: z.object({
      id: z.number().int().positive().nullable().optional(),
      name: z.string().trim().min(2).max(80),
      address: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(20).optional(),
      openTime: z.string().regex(/^\d{2}:\d{2}$/),
      closeTime: z.string().regex(/^\d{2}:\d{2}$/),
      active: z.boolean(),
      sortOrder: z.number().int().min(0).max(999).optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const values = {
        name: args.name,
        address: args.address ?? "",
        phone: args.phone ?? "",
        openTime: args.openTime,
        closeTime: args.closeTime,
        active: args.active ? 1 : 0,
        sortOrder: args.sortOrder ?? 0,
      };
      if (args.id) {
        await db.update(schema.branches).set(values).where(eq(schema.branches.id, args.id));
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db.insert(schema.branches).values(values).returning({ id: schema.branches.id });
      const row = inserted[0];
      if (!row) throw new Error("Cabang gagal disimpan.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  deleteBranch: defineAction({
    description: "Deletes a branch that has no services, barbers, or bookings attached.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [svcs, brbs, bks] = await Promise.all([
        db.select({ id: schema.services.id }).from(schema.services).where(eq(schema.services.branchId, args.id)).limit(1),
        db.select({ id: schema.barbers.id }).from(schema.barbers).where(eq(schema.barbers.branchId, args.id)).limit(1),
        db.select({ id: schema.bookings.id }).from(schema.bookings).where(eq(schema.bookings.branchId, args.id)).limit(1),
      ]);
      if (svcs.length > 0 || brbs.length > 0 || bks.length > 0)
        throw new Error("Cabang masih punya layanan, kapster, atau booking. Nonaktifkan saja cabang ini.");
      await db.delete(schema.branches).where(eq(schema.branches.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  saveService: defineAction({
    description: "Creates or updates a service (with price and duration) for one branch.",
    request: z.object({
      id: z.number().int().positive().nullable().optional(),
      branchId: z.number().int().positive(),
      name: z.string().trim().min(2).max(80),
      description: z.string().trim().max(300).optional(),
      price: z.number().int().min(0).max(10000000),
      durationMin: z.number().int().min(5).max(480),
      active: z.boolean(),
      sortOrder: z.number().int().min(0).max(999).optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const values = {
        branchId: args.branchId,
        name: args.name,
        description: args.description ?? "",
        price: args.price,
        durationMin: args.durationMin,
        active: args.active ? 1 : 0,
        sortOrder: args.sortOrder ?? 0,
      };
      if (args.id) {
        await db.update(schema.services).set(values).where(eq(schema.services.id, args.id));
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db.insert(schema.services).values(values).returning({ id: schema.services.id });
      const row = inserted[0];
      if (!row) throw new Error("Layanan gagal disimpan.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  deleteService: defineAction({
    description: "Deletes a service that has never been booked.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const used = await db
        .select({ id: schema.bookings.id })
        .from(schema.bookings)
        .where(eq(schema.bookings.serviceId, args.id))
        .limit(1);
      if (used.length > 0) throw new Error("Layanan sudah pernah dibooking. Nonaktifkan saja layanan ini.");
      await db.delete(schema.services).where(eq(schema.services.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  saveBarber: defineAction({
    description:
      "Creates or updates a barber: name, specialty, bio, experience, work days and hours, active flag — and the photo. The photo can be an admin-uploaded file (stored as a blob and shown everywhere the barber appears) or a built-in asset; clearUploadedPhoto switches back to the built-in photo.",
    request: z.object({
      id: z.number().int().positive().nullable().optional(),
      branchId: z.number().int().positive(),
      name: z.string().trim().min(2).max(80),
      specialty: z.string().trim().max(120).optional(),
      bio: z.string().trim().max(500).optional(),
      experienceYears: z.number().int().min(0).max(60),
      photoAsset: z.string().max(40).optional(),
      photo: photoUpload.optional(),
      clearUploadedPhoto: z.boolean().optional(),
      workDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      active: z.boolean(),
      sortOrder: z.number().int().min(0).max(999).optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      let existing: BarberRow | undefined;
      if (args.id) {
        const rows = await db.select().from(schema.barbers).where(eq(schema.barbers.id, args.id)).limit(1);
        existing = rows[0];
        if (!existing) throw new Error("Kapster tidak ditemukan.");
      }
      let photoAsset = args.photoAsset ?? existing?.photoAsset ?? "";
      let photoBlobKey = existing?.photoBlobKey ?? "";
      if (args.photo) {
        // Foto unggahan baru menggantikan foto lama (bawaan atau unggahan).
        photoBlobKey = await storePhoto(ctx, "barbers", args.photo);
        photoAsset = "";
        if (existing && existing.photoBlobKey && existing.photoBlobKey !== photoBlobKey) {
          await deletePhotoBlob(ctx, existing.photoBlobKey);
        }
      } else if (args.clearUploadedPhoto) {
        // Admin memilih kembali ke foto bawaan: hapus berkas unggahan.
        if (photoBlobKey) await deletePhotoBlob(ctx, photoBlobKey);
        photoBlobKey = "";
      } else if (photoBlobKey) {
        // Foto unggahan masih dipakai — pilihan foto bawaan diabaikan
        // supaya menyimpan profil tidak menghapus foto unggahan.
        photoAsset = existing?.photoAsset ?? "";
      }
      const values = {
        branchId: args.branchId,
        name: args.name,
        specialty: args.specialty ?? "",
        bio: args.bio ?? "",
        experienceYears: args.experienceYears,
        photoAsset,
        photoBlobKey,
        workDays: [...new Set(args.workDays)].sort((a, b) => a - b).join(","),
        startTime: args.startTime,
        endTime: args.endTime,
        active: args.active ? 1 : 0,
        sortOrder: args.sortOrder ?? 0,
      };
      if (args.id) {
        await db.update(schema.barbers).set(values).where(eq(schema.barbers.id, args.id));
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db.insert(schema.barbers).values(values).returning({ id: schema.barbers.id });
      const row = inserted[0];
      if (!row) throw new Error("Kapster gagal disimpan.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  deleteBarber: defineAction({
    description: "Deletes a barber who has no bookings, including their uploaded photo file if any.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const used = await db
        .select({ id: schema.bookings.id })
        .from(schema.bookings)
        .where(eq(schema.bookings.barberId, args.id))
        .limit(1);
      if (used.length > 0) throw new Error("Kapster sudah punya booking. Nonaktifkan saja kapster ini.");
      const rows = await db
        .select({ photoBlobKey: schema.barbers.photoBlobKey })
        .from(schema.barbers)
        .where(eq(schema.barbers.id, args.id))
        .limit(1);
      await db.delete(schema.barbers).where(eq(schema.barbers.id, args.id));
      const row = rows[0];
      if (row) await deletePhotoBlob(ctx, row.photoBlobKey);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  saveGalleryItem: defineAction({
    description:
      "Creates or updates a gallery photo entry. The photo can be an uploaded owner photo (stored as a blob) or a built-in photo asset; entries flagged as slides feed the home hero slider.",
    request: z.object({
      id: z.number().int().positive().nullable().optional(),
      title: z.string().trim().min(2).max(80),
      styleTag: z.string().trim().max(60).optional(),
      imageAsset: z.string().max(40).optional(),
      photo: photoUpload.optional(),
      isSlide: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(999).optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      let existing: typeof schema.galleryItems.$inferSelect | undefined;
      if (args.id) {
        const rows = await db
          .select()
          .from(schema.galleryItems)
          .where(eq(schema.galleryItems.id, args.id))
          .limit(1);
        existing = rows[0];
        if (!existing) throw new Error("Foto galeri tidak ditemukan.");
      }
      let imageAsset = args.imageAsset ?? existing?.imageAsset ?? "fade1";
      let imageBlobKey = existing?.imageBlobKey ?? "";
      if (args.photo) {
        imageBlobKey = await storePhoto(ctx, "gallery", args.photo);
        imageAsset = "";
        if (existing && existing.imageBlobKey && existing.imageBlobKey !== imageBlobKey) {
          await deletePhotoBlob(ctx, existing.imageBlobKey);
        }
      } else if (args.imageAsset) {
        // Owner picked a built-in photo again: drop any uploaded photo.
        if (imageBlobKey) await deletePhotoBlob(ctx, imageBlobKey);
        imageBlobKey = "";
      }
      const values = {
        title: args.title,
        styleTag: args.styleTag ?? "",
        imageAsset,
        imageBlobKey,
        isSlide: args.isSlide ? 1 : 0,
        sortOrder: args.sortOrder ?? 0,
      };
      if (args.id) {
        await db.update(schema.galleryItems).set(values).where(eq(schema.galleryItems.id, args.id));
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db.insert(schema.galleryItems).values(values).returning({ id: schema.galleryItems.id });
      const row = inserted[0];
      if (!row) throw new Error("Foto galeri gagal disimpan.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  deleteGalleryItem: defineAction({
    description: "Deletes a gallery photo entry and its uploaded photo file, if any.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ imageBlobKey: schema.galleryItems.imageBlobKey })
        .from(schema.galleryItems)
        .where(eq(schema.galleryItems.id, args.id))
        .limit(1);
      await db.delete(schema.galleryItems).where(eq(schema.galleryItems.id, args.id));
      const row = rows[0];
      if (row) await deletePhotoBlob(ctx, row.imageBlobKey);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  uploadCustomerPhoto: defineAction({
    description:
      "Uploads a customer's haircut result photo with the customer's name and haircut style; the photo is stored as a blob and shown on the Foto Pelanggan page.",
    request: z.object({
      customerName: z.string().trim().min(2).max(80),
      style: z.string().trim().max(60).optional(),
      photo: photoUpload,
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const imageBlobKey = await storePhoto(ctx, "customers", args.photo);
      const inserted = await db
        .insert(schema.customerPhotos)
        .values({ customerName: args.customerName, style: args.style ?? "", imageBlobKey })
        .returning({ id: schema.customerPhotos.id });
      const row = inserted[0];
      if (!row) throw new Error("Foto pelanggan gagal disimpan.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  deleteCustomerPhoto: defineAction({
    description: "Deletes a customer photo entry and its stored photo file.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ imageBlobKey: schema.customerPhotos.imageBlobKey })
        .from(schema.customerPhotos)
        .where(eq(schema.customerPhotos.id, args.id))
        .limit(1);
      await db.delete(schema.customerPhotos).where(eq(schema.customerPhotos.id, args.id));
      const row = rows[0];
      if (row) await deletePhotoBlob(ctx, row.imageBlobKey);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  savePromo: defineAction({
    description: "Creates or updates a promo/voucher code with discount type, validity dates, and usage cap.",
    request: z.object({
      id: z.number().int().positive().nullable().optional(),
      code: z.string().trim().min(3).max(40),
      description: z.string().trim().max(200).optional(),
      discountType: z.enum(["persen", "nominal"]),
      discountValue: z.number().int().min(1).max(10000000),
      minSpend: z.number().int().min(0).max(10000000).optional(),
      maxUses: z.number().int().min(1).max(1000000).nullable().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      active: z.boolean(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (args.discountType === "persen" && args.discountValue > 100)
        throw new Error("Potongan persen tidak boleh lebih dari 100%.");
      if (args.endDate < args.startDate) throw new Error("Tanggal selesai harus setelah tanggal mulai.");
      const code = args.code.toUpperCase();
      const dup = await db.select({ id: schema.promos.id }).from(schema.promos).where(eq(schema.promos.code, code));
      if (dup.some((d) => d.id !== args.id)) throw new Error("Kode promo ini sudah dipakai promo lain.");
      const values = {
        code,
        description: args.description ?? "",
        discountType: args.discountType,
        discountValue: args.discountValue,
        minSpend: args.minSpend ?? 0,
        maxUses: args.maxUses ?? null,
        startDate: args.startDate,
        endDate: args.endDate,
        active: args.active ? 1 : 0,
      };
      if (args.id) {
        await db.update(schema.promos).set(values).where(eq(schema.promos.id, args.id));
        ctx.invalidateQueries();
        return { id: args.id };
      }
      const inserted = await db.insert(schema.promos).values(values).returning({ id: schema.promos.id });
      const row = inserted[0];
      if (!row) throw new Error("Promo gagal disimpan.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  deletePromo: defineAction({
    description: "Deletes a promo code.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.promos).where(eq(schema.promos.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listPromosAdmin: defineAction({
    description: "Lists all promo codes including inactive and expired ones, for the admin dashboard.",
    request: z.object({}),
    response: z.object({ promos: z.array(promoOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.promos).orderBy(desc(schema.promos.id));
      return {
        promos: rows.map((p) => ({
          id: p.id,
          code: p.code,
          description: p.description,
          discountType: p.discountType,
          discountValue: p.discountValue,
          minSpend: p.minSpend,
          maxUses: p.maxUses,
          usedCount: p.usedCount,
          startDate: p.startDate,
          endDate: p.endDate,
          active: p.active === 1,
        })),
      };
    },
  }),

  saveSettings: defineAction({
    description: "Saves shop profile settings (name, tagline, contact, social) and the loyalty stamp target from the admin dashboard.",
    request: z.object({
      values: z.record(z.string().max(60), z.string().max(500)),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const entries = Object.entries(args.values);
      if (entries.length === 0) return { ok: true };
      for (const [key, value] of entries) {
        if (key === "stamps_for_free_cut") {
          const n = Number(value);
          if (!Number.isInteger(n) || n < 2 || n > 50)
            throw new Error("Jumlah kunjungan untuk 1x potong gratis harus angka bulat antara 2 dan 50.");
        }
      }
      for (const [key, value] of entries) {
        await db
          .insert(schema.settings)
          .values({ key, value })
          .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  registerMember: defineAction({
    description: "Registers a new loyalty member account with name, phone, and PIN.",
    request: z.object({
      name: z.string().trim().min(2).max(80),
      phone: z.string().trim().min(8).max(20),
      pin: z.string().regex(/^\d{4,6}$/),
    }),
    response: z.object({ member: memberOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select({ id: schema.members.id })
        .from(schema.members)
        .where(eq(schema.members.phone, args.phone))
        .limit(1);
      if (existing.length > 0)
        throw new Error("Nomor HP ini sudah terdaftar sebagai member. Silakan login.");
      const inserted = await db
        .insert(schema.members)
        .values({ name: args.name, phone: args.phone, pinHash: await hashPin(args.pin) })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error("Pendaftaran member gagal.");
      ctx.invalidateQueries();
      return { member: memberToOut(row) };
    },
  }),

  loginMember: defineAction({
    description: "Logs a member in with phone number and PIN.",
    request: z.object({
      phone: z.string().trim().min(8).max(20),
      pin: z.string().regex(/^\d{4,6}$/),
    }),
    response: z.object({ member: memberOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.members).where(eq(schema.members.phone, args.phone)).limit(1);
      const m = rows[0];
      if (!m || m.pinHash !== (await hashPin(args.pin)))
        throw new Error("Nomor HP atau PIN salah.");
      return { member: memberToOut(m) };
    },
  }),

  getMemberProfile: defineAction({
    description: "Returns a member's loyalty state (stamps, free cuts, visits) and their booking history.",
    request: z.object({ memberId: z.number().int().positive() }),
    response: z.object({ member: memberOut, bookings: z.array(bookingOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.members).where(eq(schema.members.id, args.memberId)).limit(1);
      const m = rows[0];
      if (!m) throw new Error("Akun member tidak ditemukan.");
      const bRows = await db
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.memberId, args.memberId))
        .orderBy(desc(schema.bookings.date), desc(schema.bookings.time))
        .limit(50);
      return { member: memberToOut(m), bookings: enrichBookings(bRows, await loadNameMaps(ctx)) };
    },
  }),

  listMembersAdmin: defineAction({
    description: "Lists all loyalty members for the admin dashboard.",
    request: z.object({}),
    response: z.object({ members: z.array(memberOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.members).orderBy(desc(schema.members.totalVisits), asc(schema.members.name));
      return { members: rows.map(memberToOut) };
    },
  }),

  setMemberLoyalty: defineAction({
    description: "Admin adjustment of a member's stamp count and available free cuts.",
    request: z.object({
      memberId: z.number().int().positive(),
      stamps: z.number().int().min(0).max(49),
      freeCuts: z.number().int().min(0).max(100),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.members).where(eq(schema.members.id, args.memberId)).limit(1);
      const m = rows[0];
      if (!m) throw new Error("Akun member tidak ditemukan.");
      const target = await getStampsTarget(ctx);
      if (args.stamps >= target)
        throw new Error(
          `Stempel harus 0–${target - 1} — ${target} stempel otomatis menjadi 1 potong gratis. Ubah targetnya di Pengaturan bila perlu.`,
        );
      await db
        .update(schema.members)
        .set({ stamps: args.stamps, freeCuts: args.freeCuts })
        .where(eq(schema.members.id, args.memberId));
      await syncMemberVouchers(ctx, { ...m, stamps: args.stamps, freeCuts: args.freeCuts }, "admin");
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getMemberVouchers: defineAction({
    description:
      "Returns a member's free-cut vouchers (downloadable PNG entitlements earned from collected stamps), creating any missing voucher rows for free cuts earned earlier.",
    request: z.object({ memberId: z.number().int().positive() }),
    response: z.object({ vouchers: z.array(voucherOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.members).where(eq(schema.members.id, args.memberId)).limit(1);
      const m = rows[0];
      if (!m) throw new Error("Akun member tidak ditemukan.");
      await syncMemberVouchers(ctx, m);
      const vRows = await db
        .select()
        .from(schema.freeCutVouchers)
        .where(eq(schema.freeCutVouchers.memberId, m.id))
        .orderBy(desc(schema.freeCutVouchers.id))
        .limit(50);
      return { vouchers: vRows.map((v) => voucherToOut(v, m.name, m.phone)) };
    },
  }),

  requestVoucherRedemption: defineAction({
    description:
      "Member flags one of their active free-cut vouchers as ready to redeem at the shop; it then waits for admin approval in the app.",
    request: z.object({
      memberId: z.number().int().positive(),
      voucherId: z.number().int().positive(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.freeCutVouchers)
        .where(eq(schema.freeCutVouchers.id, args.voucherId))
        .limit(1);
      const v = rows[0];
      if (!v || v.memberId !== args.memberId) throw new Error("Voucher tidak ditemukan.");
      if (v.status === "terpakai") throw new Error("Voucher ini sudah dipakai.");
      if (v.status === "dibatalkan") throw new Error("Voucher ini sudah dibatalkan.");
      if (v.status === "aktif") {
        await db
          .update(schema.freeCutVouchers)
          .set({ status: "menunggu_persetujuan" })
          .where(eq(schema.freeCutVouchers.id, v.id));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listVouchersAdmin: defineAction({
    description:
      "Lists all free-cut vouchers with member names for the admin dashboard, including vouchers waiting for redemption approval.",
    request: z.object({}),
    response: z.object({ vouchers: z.array(voucherOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const memberRows = await db.select().from(schema.members);
      for (const m of memberRows) await syncMemberVouchers(ctx, m);
      const vRows = await db
        .select()
        .from(schema.freeCutVouchers)
        .orderBy(desc(schema.freeCutVouchers.id))
        .limit(200);
      const memberById = new Map(memberRows.map((m) => [m.id, m]));
      return {
        vouchers: vRows.map((v) => {
          const m = memberById.get(v.memberId);
          return voucherToOut(v, m?.name ?? "Member terhapus", m?.phone ?? "");
        }),
      };
    },
  }),

  approveVoucherRedemption: defineAction({
    description:
      "Admin approves a member's free-cut voucher redemption at the shop: the voucher is marked used, the member's free-cut balance drops by one, and their stamps reset to zero.",
    request: z.object({ voucherId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.freeCutVouchers)
        .where(eq(schema.freeCutVouchers.id, args.voucherId))
        .limit(1);
      const v = rows[0];
      if (!v) throw new Error("Voucher tidak ditemukan.");
      if (v.status === "terpakai") throw new Error("Voucher ini sudah dipakai.");
      if (v.status === "dibatalkan") throw new Error("Voucher ini sudah dibatalkan.");
      const mRows = await db.select().from(schema.members).where(eq(schema.members.id, v.memberId)).limit(1);
      const m = mRows[0];
      if (!m) throw new Error("Akun member pemilik voucher tidak ditemukan.");
      await db
        .update(schema.freeCutVouchers)
        .set({ status: "terpakai", redeemedAt: new Date() })
        .where(eq(schema.freeCutVouchers.id, v.id));
      // Setelah voucher digunakan, stempel member direset ulang dari 0.
      await db
        .update(schema.members)
        .set({ freeCuts: Math.max(0, m.freeCuts - 1), stamps: 0 })
        .where(eq(schema.members.id, m.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  rejectVoucherRedemption: defineAction({
    description:
      "Admin declines a pending free-cut voucher redemption request; the voucher returns to active so the member keeps it.",
    request: z.object({ voucherId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.freeCutVouchers)
        .where(eq(schema.freeCutVouchers.id, args.voucherId))
        .limit(1);
      const v = rows[0];
      if (!v) throw new Error("Voucher tidak ditemukan.");
      if (v.status === "terpakai") throw new Error("Voucher ini sudah dipakai.");
      if (v.status === "menunggu_persetujuan") {
        await db
          .update(schema.freeCutVouchers)
          .set({ status: "aktif" })
          .where(eq(schema.freeCutVouchers.id, v.id));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  uploadQrisImage: defineAction({
    description:
      "Uploads the shop's QRIS payment code image from the admin dashboard; it is stored as a blob and shown automatically to customers who pick QRIS payment when booking.",
    request: z.object({ photo: photoUpload }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const key = await storePhoto(ctx, "qris", args.photo);
      const rows = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, "qris_image_blob_key"))
        .limit(1);
      const oldKey = rows[0]?.value ?? "";
      await db
        .insert(schema.settings)
        .values({ key: "qris_image_blob_key", value: key })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value: key } });
      if (oldKey && oldKey !== key) await deletePhotoBlob(ctx, oldKey);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteQrisImage: defineAction({
    description: "Removes the shop's uploaded QRIS payment code image and its stored file.",
    request: z.object({}),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      void args;
      const rows = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, "qris_image_blob_key"))
        .limit(1);
      const key = rows[0]?.value ?? "";
      await db.delete(schema.settings).where(eq(schema.settings.key, "qris_image_blob_key"));
      if (key) await deletePhotoBlob(ctx, key);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  // Admin auth seam: the client only ever sends the PIN to these two actions;
  // the hash lives server-side (settings key "admin_pin_hash", SHA-256) and is
  // never returned to the client. To move auth to Supabase later, replace the
  // settings-table lookup inside verifyAdminPin/changeAdminPin with a Supabase
  // query against the same hashed value — the login flow does not change.
  verifyAdminPin: defineAction({
    description: "Checks an admin PIN against the stored PIN hash (no default PIN in code; first PIN comes from BARBERBOYS_ADMIN_PIN).",
    request: z.object({ pin: z.string().min(1).max(40) }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, "admin_pin_hash")).limit(1);
      const stored = rows[0]?.value ?? (DEFAULT_ADMIN_PIN ? await hashPin(DEFAULT_ADMIN_PIN) : "");
      return { ok: stored === (await hashPin(args.pin)) };
    },
  }),

  changeAdminPin: defineAction({
    description: "Changes the admin PIN after verifying the current one.",
    request: z.object({
      currentPin: z.string().min(1).max(40),
      newPin: z.string().min(4).max(40),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, "admin_pin_hash")).limit(1);
      const stored = rows[0]?.value ?? (DEFAULT_ADMIN_PIN ? await hashPin(DEFAULT_ADMIN_PIN) : "");
      if (stored !== (await hashPin(args.currentPin))) throw new Error("PIN lama salah.");
      if (args.newPin === args.currentPin) throw new Error("PIN baru harus berbeda dari PIN lama.");
      const value = await hashPin(args.newPin);
      await db
        .insert(schema.settings)
        .values({ key: "admin_pin_hash", value })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getSupabaseStatus: defineAction({
    description:
      "Checks the connection to the owner's Supabase project: whether the REST API answers and, per app table, whether the table exists there and how many rows it holds versus the app's own data.",
    request: z.object({}),
    response: z.object({
      url: z.string(),
      reachable: z.boolean(),
      ready: z.boolean(),
      tables: z.array(
        z.object({
          name: z.string(),
          label: z.string(),
          exists: z.boolean(),
          localCount: z.number(),
          remoteCount: z.number().nullable(),
          error: z.string().nullable(),
        }),
      ),
    }),
    async handler(ctx) {
      const cfg = await getSupabaseConfig(ctx);
      let reachable = true;
      const tables: Array<{
        name: string;
        label: string;
        exists: boolean;
        localCount: number;
        remoteCount: number | null;
        error: string | null;
      }> = [];
      for (const def of SB_TABLES) {
        const localCount = (await def.loadLocal(ctx)).length;
        let exists = false;
        let remoteCount: number | null = null;
        let error: string | null = null;
        try {
          const res = await sbFetch(cfg, `${def.name}?select=${def.conflictKey}`, {
            headers: { Prefer: "count=exact", Range: "0-0" },
          });
          if (res.ok) {
            exists = true;
            const total = res.headers.get("content-range")?.split("/")[1];
            remoteCount = total && total !== "*" ? Number(total) : null;
          } else {
            error = await sbErrorMessage(res);
          }
        } catch {
          reachable = false;
          error = "Tidak bisa menghubungi Supabase — periksa koneksi internet server.";
        }
        tables.push({ name: def.name, label: def.label, exists, localCount, remoteCount, error });
      }
      if (tables.some((t) => t.error && !t.error.includes("belum dibuat"))) reachable = false;
      return { url: cfg.url, reachable, ready: tables.every((t) => t.exists), tables };
    },
  }),

  pushSupabaseData: defineAction({
    description:
      "Pushes (upserts) every app row — branches, services, barbers, members with loyalty stamps and PIN hashes, promos, settings including the admin PIN hash and stamp target, bookings, free-cut vouchers, reviews, gallery, and customer photos — into the matching Supabase tables. Per-table failures (for example tables not created yet) are reported, not thrown.",
    request: z.object({}),
    response: z.object({
      ok: z.boolean(),
      tables: z.array(
        z.object({
          name: z.string(),
          label: z.string(),
          pushed: z.number(),
          error: z.string().nullable(),
        }),
      ),
    }),
    async handler(ctx) {
      const cfg = await getSupabaseConfig(ctx);
      const tables: Array<{ name: string; label: string; pushed: number; error: string | null }> = [];
      for (const def of SB_TABLES) {
        const rows = await def.loadLocal(ctx);
        try {
          await sbUpsert(cfg, def, rows);
          tables.push({ name: def.name, label: def.label, pushed: rows.length, error: null });
        } catch (e) {
          tables.push({
            name: def.name,
            label: def.label,
            pushed: 0,
            error: e instanceof Error ? e.message : "Gagal mengirim ke Supabase.",
          });
        }
      }
      return { ok: tables.every((t) => t.error == null), tables };
    },
  }),

  pullSupabaseData: defineAction({
    description:
      "Pulls every row from the Supabase tables back into the app database (upsert by id/key), so edits made in Supabase or from another connected client show up in the app. Local rows with the same id are overwritten by the Supabase version.",
    request: z.object({}),
    response: z.object({
      ok: z.boolean(),
      tables: z.array(
        z.object({
          name: z.string(),
          label: z.string(),
          pulled: z.number(),
          error: z.string().nullable(),
        }),
      ),
    }),
    async handler(ctx) {
      const cfg = await getSupabaseConfig(ctx);
      const tables: Array<{ name: string; label: string; pulled: number; error: string | null }> = [];
      for (const def of SB_TABLES) {
        try {
          const rows = await sbFetchAll(cfg, def);
          const applied = await def.applyRemote(ctx, rows);
          tables.push({ name: def.name, label: def.label, pulled: applied, error: null });
        } catch (e) {
          tables.push({
            name: def.name,
            label: def.label,
            pulled: 0,
            error: e instanceof Error ? e.message : "Gagal menarik dari Supabase.",
          });
        }
      }
      ctx.invalidateQueries();
      return { ok: tables.every((t) => t.error == null), tables };
    },
  }),

  seedCatalog: defineAction({
    description:
      "One-time starter catalog: inserts example branches, services, barbers, gallery, promos, and shop settings only when the database is still empty.",
    request: z.object({}),
    response: z.object({ seeded: z.boolean() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select({ id: schema.branches.id }).from(schema.branches).limit(1);
      if (existing.length > 0) return { seeded: false };

      const settingsRows: Array<[string, string]> = [
        ["shop_name", "BARBERBOYS"],
        ["tagline", "Potong Rapi, Pulang Ganteng"],
        ["about", "Barbershop untuk pria yang peduli penampilan. Kapster berpengalaman, alat steril, dan suasana santai di tempat kami."],
        ["phone", "0812-3456-7890"],
        ["whatsapp", "6281234567890"],
        ["instagram", "@barberboys.id"],
        ["email", "halo@barberboys.id"],
        ["social_whatsapp", "https://wa.me/6281234567890"],
        ["social_instagram", "https://instagram.com/barberboys.id"],
        ["social_tiktok", "https://tiktok.com/@barberboys.id"],
        ["social_facebook", "https://facebook.com/barberboys.id"],
        ["stamps_for_free_cut", "10"],
      ];
      for (const [key, value] of settingsRows) {
        await db.insert(schema.settings).values({ key, value });
      }
      if (DEFAULT_ADMIN_PIN) {
        await db.insert(schema.settings).values({ key: "admin_pin_hash", value: await hashPin(DEFAULT_ADMIN_PIN) });
      }

      const branchData = [
        { name: "BARBERBOYS Pusat", address: "Jl. Merdeka No. 88, Bandung", phone: "0812-3456-7890", openTime: "09:00", closeTime: "21:00", sortOrder: 0 },
        { name: "BARBERBOYS Dago", address: "Jl. Ir. H. Juanda No. 120, Bandung", phone: "0813-9876-5432", openTime: "10:00", closeTime: "22:00", sortOrder: 1 },
      ];
      const branchIds: number[] = [];
      for (const b of branchData) {
        const ins = await db.insert(schema.branches).values({ ...b, active: 1 }).returning({ id: schema.branches.id });
        const row = ins[0];
        if (row) branchIds.push(row.id);
      }

      const serviceData: Array<{ name: string; description: string; price: number; durationMin: number }> = [
        { name: "Potong Rambut Dewasa", description: "Konsultasi gaya, potong, cuci, dan styling pomade.", price: 50000, durationMin: 45 },
        { name: "Potong Rambut Anak", description: "Potong rambut untuk anak usia 5–12 tahun.", price: 35000, durationMin: 30 },
        { name: "Cukur Jenggot & Kumis", description: "Cukur rapi dengan handuk hangat dan after shave.", price: 30000, durationMin: 30 },
        { name: "Paket Ganteng (Potong + Cukur)", description: "Potong rambut plus cukur jenggot, cuci, dan pijat kepala.", price: 70000, durationMin: 60 },
        { name: "Creambath & Pijat", description: "Creambath menyegarkan plus pijat kepala dan bahu.", price: 45000, durationMin: 45 },
        { name: "Semir & Pewarnaan", description: "Pewarnaan rambut natural atau fashion, termasuk cuci.", price: 90000, durationMin: 75 },
      ];
      for (const branchId of branchIds) {
        for (let i = 0; i < serviceData.length; i++) {
          const s = serviceData[i];
          if (!s) continue;
          await db.insert(schema.services).values({ branchId, ...s, active: 1, sortOrder: i });
        }
      }

      const barberData: Array<{
        branchIdx: number;
        name: string;
        specialty: string;
        bio: string;
        experienceYears: number;
        photoAsset: string;
        workDays: string;
        startTime: string;
        endTime: string;
      }> = [
        { branchIdx: 0, name: "Rizky Pratama", specialty: "Fade & Skin Fade", bio: "Spesialis fade dengan detail garis yang bersih. Selalu update tren potongan pria terbaru.", experienceYears: 7, photoAsset: "barber1", workDays: "1,2,3,4,5,6", startTime: "09:00", endTime: "21:00" },
        { branchIdx: 0, name: "Dimas Anggara", specialty: "Klasik & Pompadour", bio: "Ahli gaya klasik dan pompadour. Teliti, rapi, dan enak diajak konsultasi gaya.", experienceYears: 5, photoAsset: "barber2", workDays: "0,1,2,3,4,5", startTime: "09:00", endTime: "21:00" },
        { branchIdx: 1, name: "Fajar Nugroho", specialty: "Modern & Textured Crop", bio: "Fokus pada potongan modern dan textured crop yang mudah diatur sehari-hari.", experienceYears: 6, photoAsset: "cut1", workDays: "1,2,3,4,5,6", startTime: "10:00", endTime: "22:00" },
        { branchIdx: 1, name: "Bima Saputra", specialty: "Jenggot & Grooming", bio: "Spesialis perawatan jenggot dan grooming lengkap, dari cukur handuk hangat sampai styling.", experienceYears: 4, photoAsset: "fade2", workDays: "0,2,3,4,5,6", startTime: "10:00", endTime: "22:00" },
      ];
      for (let i = 0; i < barberData.length; i++) {
        const b = barberData[i];
        if (!b) continue;
        const branchId = branchIds[b.branchIdx];
        if (branchId == null) continue;
        await db.insert(schema.barbers).values({
          branchId,
          name: b.name,
          specialty: b.specialty,
          bio: b.bio,
          experienceYears: b.experienceYears,
          photoAsset: b.photoAsset,
          workDays: b.workDays,
          startTime: b.startTime,
          endTime: b.endTime,
          active: 1,
          sortOrder: i,
        });
      }

      const galleryData = [
        { title: "Skin Fade Rapi", styleTag: "Fade", imageAsset: "fade1", isSlide: 1, sortOrder: 0 },
        { title: "Textured Crop Modern", styleTag: "Crop", imageAsset: "fade3", isSlide: 0, sortOrder: 1 },
        { title: "Proses Potong Detail", styleTag: "Proses", imageAsset: "cut1", isSlide: 1, sortOrder: 2 },
        { title: "Fade + Styling", styleTag: "Fade", imageAsset: "fade2", isSlide: 0, sortOrder: 3 },
        { title: "Suasana Barbershop", styleTag: "Interior", imageAsset: "interior", isSlide: 1, sortOrder: 4 },
        { title: "Kursi Klasik Kami", styleTag: "Interior", imageAsset: "hero", isSlide: 1, sortOrder: 5 },
      ];
      for (const g of galleryData) {
        await db.insert(schema.galleryItems).values(g);
      }

      const promoData = [
        { code: "GANTENG10", description: "Diskon 10% untuk semua layanan, minimal belanja Rp50.000.", discountType: "persen" as const, discountValue: 10, minSpend: 50000, maxUses: 200, startDate: "2026-01-01", endDate: "2026-12-31" },
        { code: "HEMAT15RB", description: "Potongan langsung Rp15.000 untuk Paket Ganteng dan pewarnaan.", discountType: "nominal" as const, discountValue: 15000, minSpend: 70000, maxUses: null, startDate: "2026-01-01", endDate: "2026-12-31" },
      ];
      for (const p of promoData) {
        await db.insert(schema.promos).values({ ...p, active: 1, usedCount: 0 });
      }

      ctx.invalidateQueries();
      return { seeded: true };
    },
  }),
} satisfies ActionsModule;
