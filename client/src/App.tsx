import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
Bar,
BarChart,
CartesianGrid,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import { fileToBase64 } from "@hatch/space-sdk/client";
import type { Actions } from "../../server/src/actions";
import { api, type ApiResponse } from "./api";
import { SUPABASE_SQL } from "./supabaseSql";
import heroImg from "./assets/hero.jpg";
import interiorImg from "./assets/interior.jpg";
import fade1Img from "./assets/fade1.jpg";
import fade2Img from "./assets/fade2.jpg";
import fade3Img from "./assets/fade3.jpg";
import cut1Img from "./assets/cut1.jpg";
import barber1Img from "./assets/barber1.jpg";
import barber2Img from "./assets/barber2.jpg";

const FIELDS = actionFields<typeof Actions>();

const ASSETS: Record<string, string> = {
  hero: heroImg,
  interior: interiorImg,
  fade1: fade1Img,
  fade2: fade2Img,
  fade3: fade3Img,
  cut1: cut1Img,
  barber1: barber1Img,
  barber2: barber2Img,
};
const PHOTO_KEYS = Object.keys(ASSETS);

// Foto galeri bisa berupa foto unggahan pemilik (imageUrl dari server) atau
// foto bawaan (imageAsset). Kembalikan URL yang bisa ditampilkan, atau null.
function photoSrc(g: { imageUrl: string | null; imageAsset: string }): string | null {
  return g.imageUrl ?? ASSETS[g.imageAsset] ?? null;
}

// Foto kapster: foto unggahan admin (photoUrl) didahulukan daripada foto
// bawaan (photoAsset) — sama seperti galeri.
function barberPhotoSrc(b: { photoUrl: string | null; photoAsset: string }): string | null {
  return b.photoUrl ?? ASSETS[b.photoAsset] ?? null;
}

// Akses localStorage/sessionStorage bisa melempar error di sebagian browser
// (mode privat, cookie/storage diblokir untuk iframe, kebijakan perusahaan).
// Error seperti itu TIDAK boleh membuat aplikasi blank: semua akses storage
// lewat helper aman ini — gagal baca dianggap kosong, gagal tulis diabaikan.
function safeStorageGet(kind: "local" | "session", key: string): string | null {
  try {
    return (kind === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function safeStorageSet(kind: "local" | "session", key: string, value: string): void {
  try {
    (kind === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // Abaikan: fitur tetap jalan tanpa penyimpanan persisten.
  }
}
function safeStorageRemove(kind: "local" | "session", key: string): void {
  try {
    (kind === "local" ? window.localStorage : window.sessionStorage).removeItem(key);
  } catch {
    // Abaikan.
  }
}

// Penjaga terakhir: error render apa pun tidak boleh menghasilkan halaman
// kosong. Tampilkan pesan ramah + tombol muat ulang sebagai gantinya.
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 text-[var(--text)]">
          <div className="max-w-sm text-center">
            <p className="font-display text-3xl tracking-wide">
              BARBER<span className="text-[var(--accent)]">BOYS</span>
            </p>
            <p className="mt-3 text-[var(--dim)]">
              Maaf, halaman gagal ditampilkan di browser ini. Coba muat ulang — data booking dan member kamu tetap aman.
            </p>
            <button
              type="button"
              className="mt-5 rounded-full bg-[var(--accent)] px-5 py-2.5 font-semibold text-white"
              onClick={() => window.location.reload()}
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type PhotoData = { dataBase64: string; mimeType: "image/jpeg" | "image/png" | "image/webp"; previewUrl: string };

function PhotoUploadField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: PhotoData | null;
  onChange: (v: PhotoData | null) => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const handle = async (file: File | undefined) => {
    setErr(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErr("Format foto harus JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Ukuran foto maksimal 5 MB.");
      return;
    }
    try {
      const { dataBase64, mimeType } = await fileToBase64(file);
      if (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp") {
        setErr("Format foto harus JPG, PNG, atau WebP.");
        return;
      }
      onChange({ dataBase64, mimeType, previewUrl: URL.createObjectURL(file) });
    } catch {
      setErr("Foto tidak bisa dibaca, coba foto lain.");
    }
  };
  return (
    <div>
      <label className={labelCls} htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={`${inputCls} py-2`}
        onChange={(e) => void handle(e.target.files?.[0])}
      />
      <p className="mt-1 text-xs text-[var(--dim)]">JPG, PNG, atau WebP — maksimal 5 MB.</p>
      {err && <p className="mt-1 text-sm font-semibold text-[var(--red)]" role="alert">{err}</p>}
      {value && (
        <div className="mt-2 flex items-center gap-3">
          <img src={value.previewUrl} alt="Pratinjau foto unggahan" className="h-28 w-28 rounded-[var(--radius)] object-cover" />
          <button type="button" className="text-sm font-bold text-[var(--red)] underline" onClick={() => onChange(null)}>
            Batalkan unggahan
          </button>
        </div>
      )}
    </div>
  );
}

type Bootstrap = ApiResponse<typeof api, "getBootstrap">;
type Branch = Bootstrap["branches"][number];
type Service = Bootstrap["services"][number];
type Barber = Bootstrap["barbers"][number];
type Promo = Bootstrap["promos"][number];
type Booking = ApiResponse<typeof api, "listBookingsAdmin">["bookings"][number];
type Member = ApiResponse<typeof api, "loginMember">["member"];
type Voucher = ApiResponse<typeof api, "listVouchersAdmin">["vouchers"][number];
type Tab = "beranda" | "booking" | "promo" | "galeri" | "pelanggan" | "ulasan" | "member" | "admin";

const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function toLocalISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function todayPlus(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toLocalISO(d);
}
function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDateShort(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTHS[d.getMonth()]?.slice(0, 3) ?? ""}`;
}
function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}
function toMinutes(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}
function slotsFor(barber: Barber, branch: Branch): string[] {
  const start = Math.max(toMinutes(branch.openTime), toMinutes(barber.startTime));
  const end = Math.min(toMinutes(branch.closeTime), toMinutes(barber.endTime));
  const out: string[] = [];
  for (let t = start; t < end; t += 60) {
    const h = String(Math.floor(t / 60)).padStart(2, "0");
    const m = String(t % 60).padStart(2, "0");
    out.push(`${h}:${m}`);
  }
  return out;
}
function workDaysLabel(b: Barber): string {
  if (b.workDays.length >= 7) return "Setiap hari";
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => b.workDays.includes(d))
    .map((d) => DAY_SHORT[d])
    .join(", ");
}

const PAYMENT_LABEL: Record<string, string> = {
  qris: "QRIS",
  tunai: "Bayar di Tempat",
};
const STATUS_LABEL: Record<string, string> = {
  menunggu: "Menunggu Konfirmasi",
  dikonfirmasi: "Dikonfirmasi",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
  menunggu_pembatalan: "Menunggu Persetujuan Pembatalan",
};
const PAYSTATUS_LABEL: Record<string, string> = {
  belum_bayar: "Belum Bayar",
  menunggu_verifikasi: "Menunggu Verifikasi",
  lunas: "Lunas",
};
const VOUCHER_STATUS_LABEL: Record<string, string> = {
  aktif: "Siap Ditukar",
  menunggu_persetujuan: "Menunggu Persetujuan Admin",
  terpakai: "Sudah Dipakai",
  dibatalkan: "Dibatalkan",
};

function voucherTone(status: string): "gold" | "red" | "green" | "dim" {
  if (status === "aktif") return "green";
  if (status === "menunggu_persetujuan") return "gold";
  if (status === "dibatalkan") return "red";
  return "dim";
}

function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  return (
    <span className={`${size} leading-none text-[var(--accent)]`} aria-label={`Rating ${value} dari 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(value) ? "" : "opacity-30"}>
          ★
        </span>
      ))}
    </span>
  );
}

function Badge({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "red" | "green" | "dim" }) {
  const cls =
    tone === "red"
      ? "bg-[#b23a1e] text-white"
      : tone === "green"
        ? "bg-[#3e6b1e] text-white"
        : tone === "dim"
          ? "border border-[var(--border)] bg-[var(--surface2)] text-[var(--dim)]"
          : "bg-[var(--accent)] text-[var(--accent-dark)]";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{children}</span>
  );
}

/** Lencana notifikasi merah berisi jumlah hal yang menunggu tindakan admin. */
function NotifBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span
      role="img"
      aria-label={label}
      className="ml-1.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#d92d20] px-1 align-middle text-[11px] font-bold leading-none text-white shadow-sm"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

type PendingCounts = ApiResponse<typeof api, "getAdminPendingCounts">;

function usePendingCounts() {
  return useQuery({
    queryKey: ["admin-pending"],
    queryFn: () => api.getAdminPendingCounts({}),
    refetchInterval: 30000,
  });
}

function pendingBookingTotal(p: PendingCounts | undefined): number {
  if (!p) return 0;
  return p.newBookings + p.cancelRequests + p.paymentVerifications;
}

function pendingTotal(p: PendingCounts | undefined): number {
  if (!p) return 0;
  return pendingBookingTotal(p) + p.voucherRequests;
}

// Jumlah stempel (kunjungan selesai) yang harus dikumpulkan member untuk
// mendapat 1x potong gratis. Diatur admin di Pengaturan lewat settings
// "stamps_for_free_cut" (bawaan 10, rentang 2–50); server juga menormalisasi
// nilai ini di getBootstrap, jadi di sini cukup dibaca dengan pengaman.
function stampsTarget(settings: Record<string, string> | undefined): number {
  const n = Number(settings?.stamps_for_free_cut);
  return Number.isInteger(n) && n >= 2 && n <= 50 ? n : 10;
}

function statusTone(status: string): "gold" | "red" | "green" | "dim" {
  if (status === "selesai") return "green";
  if (status === "dibatalkan") return "red";
  if (status === "dikonfirmasi") return "gold";
  if (status === "menunggu_pembatalan") return "red";
  return "dim";
}

const inputCls =
  "w-full rounded-[var(--radius)] border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--text)] placeholder:text-[var(--dim)]";
const labelCls = "mb-1.5 block text-base font-bold text-[var(--text)]";
const btnGold =
  "rounded-[var(--radius)] bg-[var(--accent)] px-5 py-2.5 font-bold text-[var(--accent-dark)] shadow-sm disabled:opacity-50";
const btnGhost =
  "rounded-[var(--radius)] border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-[var(--text)] disabled:opacity-50";
const cardCls =
  "rounded-[var(--radius)] border-2 border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_2px_6px_rgba(33,26,16,0.10)]";

function SocialIcons({ settings, size = "h-11 w-11" }: { settings: Record<string, string>; size?: string }) {
  const items: Array<{ key: string; label: string; href?: string; path: React.ReactNode }> = [
    {
      key: "social_whatsapp",
      label: "WhatsApp BARBERBOYS",
      href: waHref(settings.social_whatsapp) ?? waHref(settings.whatsapp),
      path: (
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.2-.7l.5-.6c.1-.2.1-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
      ),
    },
    {
      key: "social_instagram",
      label: "Instagram BARBERBOYS",
      href: settings.social_instagram,
      path: (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="17.2" cy="6.8" r="1.4" />
        </>
      ),
    },
    {
      key: "social_tiktok",
      label: "TikTok BARBERBOYS",
      href: settings.social_tiktok,
      path: (
        <path d="M16.6 3c.4 2.1 1.8 3.6 3.9 3.9v3c-1.5 0-2.9-.5-3.9-1.3v6.5c0 3.5-2.6 6.1-6.1 6.1-3.4 0-6-2.6-6-6 0-3.5 2.8-6.1 6.4-5.9v3.2c-1.7-.4-3.3.8-3.3 2.6 0 1.6 1.3 2.9 3 2.9 1.7 0 3-1.3 3-3.1V3h3Z" />
      ),
    },
    {
      key: "social_facebook",
      label: "Facebook BARBERBOYS",
      href: settings.social_facebook,
      path: (
        <path d="M13.5 21.5v-7h2.5l.4-3h-2.9V9.6c0-.9.3-1.5 1.6-1.5h1.4V5.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5v7h3Z" />
      ),
    },
  ];
  const visible = items.filter((i) => i.href);
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((i) => (
        <a
          key={i.key}
          href={i.href}
          target="_blank"
          rel="noreferrer"
          aria-label={i.label}
          className={`flex ${size} items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)]`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            {i.path}
          </svg>
        </a>
      ))}
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 mt-10 flex items-end justify-between gap-3 border-b-[3px] border-[var(--text)] pb-2">
      <h2 className="border-l-[6px] border-[var(--accent-bright)] pl-3 font-display text-3xl tracking-wide text-[var(--text)]">
        {title}
      </h2>
      {action}
    </div>
  );
}

const TAB_KEYS: Tab[] = ["beranda", "booking", "promo", "galeri", "pelanggan", "ulasan", "member", "admin"];

// Halaman bisa dibuka langsung lewat alamat hash-nya (mis. #admin untuk
// dashboard admin) sehingga bisa di-bookmark. Tanpa hash yang valid,
// aplikasi mulai dari beranda seperti biasa.
function tabFromHash(): Tab {
  const h = window.location.hash.replace(/^#\/?/, "");
  return (TAB_KEYS as string[]).includes(h) ? (h as Tab) : "beranda";
}

export function App() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(() => tabFromHash());
  const [seed, setSeed] = useState<{ serviceId?: number; barberId?: number; promoCode?: string; nonce: number }>({
    nonce: 0,
  });
  const [memberId, setMemberId] = useState<number | null>(() => {
    const raw = safeStorageGet("local", "bb_member_id");
    return raw ? Number(raw) : null;
  });

  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => api.getBootstrap({}) });
  const pendingQ = usePendingCounts();
  const adminPending = pendingTotal(pendingQ.data);
  const memberProfile = useQuery({
    queryKey: ["member-profile", memberId],
    queryFn: () => api.getMemberProfile({ memberId: memberId ?? 0 }),
    enabled: memberId != null,
    retry: false,
  });

  useEffect(() => {
    if (memberProfile.isError) {
      safeStorageRemove("local", "bb_member_id");
      setMemberId(null);
    }
  }, [memberProfile.isError]);

  // Sinkronisasi Supabase: selama dashboard admin terbuka (sudah login PIN)
  // di perangkat mana pun, semua data aplikasi dikirim ulang ke Supabase
  // tiap 60 detik — booking baru dan perubahan lain ikut tersalin hampir
  // seketika, dan Realtime Supabase meneruskannya ke perangkat lain yang
  // terhubung. Kegagalan (mis. tabel belum dibuat) diabaikan diam-diam;
  // status lengkapnya ada di Admin → Supabase.
  const sbPushBusy = useRef(false);
  useEffect(() => {
    const tick = () => {
      if (safeStorageGet("session", "bb_admin") !== "1") return;
      if (sbPushBusy.current) return;
      sbPushBusy.current = true;
      api
        .pushSupabaseData({})
        .catch(() => undefined)
        .finally(() => {
          sbPushBusy.current = false;
        });
    };
    const first = window.setTimeout(tick, 5000);
    const iv = window.setInterval(tick, 60000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(iv);
    };
  }, []);

  const data = boot.data;
  const activeBranches = useMemo(() => (data ? data.branches.filter((b) => b.active) : []), [data]);
  // BARBERBOYS hanya punya satu lokasi — tidak ada lagi pilihan cabang.
  const selectedBranch: Branch | undefined = activeBranches[0];
  const member: Member | null = memberProfile.data?.member ?? null;
  const target = stampsTarget(data?.settings);

  const goBooking = (opts?: { serviceId?: number; barberId?: number; promoCode?: string }) => {
    setSeed({ ...opts, nonce: Date.now() });
    setTab("booking");
    if (window.location.hash !== "#booking") window.location.hash = "booking";
    window.scrollTo({ top: 0 });
  };
  const goTab = (t: Tab) => {
    setTab(t);
    if (window.location.hash !== `#${t}`) window.location.hash = t;
    window.scrollTo({ top: 0 });
  };

  // Tombol maju/mundur browser dan tautan bookmark (#admin dsb.) ikut
  // berpindah halaman.
  useEffect(() => {
    const onHash = () => {
      setTab(tabFromHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const onLogin = (m: Member) => {
    safeStorageSet("local", "bb_member_id", String(m.id));
    setMemberId(m.id);
    queryClient.invalidateQueries({ queryKey: ["member-profile"] });
  };
  const onLogout = () => {
    safeStorageRemove("local", "bb_member_id");
    setMemberId(null);
  };

  const navItems: Array<{ key: Tab; label: string }> = [
    { key: "beranda", label: "Beranda" },
    { key: "booking", label: "Booking" },
    { key: "galeri", label: "Galeri" },
    { key: "pelanggan", label: "Foto Pelanggan" },
    { key: "promo", label: "Promo" },
    { key: "member", label: member ? "Member Saya" : "Member" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 text-[var(--text)] md:pb-10">
      <header className="sticky top-0 z-30 border-b-2 border-[var(--text)] bg-[var(--surface)] pt-safe shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={() => goTab("beranda")}
            className="font-display text-2xl tracking-widest text-[var(--text)]"
            aria-label="BARBERBOYS — ke beranda"
          >
            BARBER<span className="text-[var(--accent)]">BOYS</span>
          </button>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
            {navItems.map((n) => (
              <button
                key={n.key}
                type="button"
                onClick={() => goTab(n.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  tab === n.key ? "bg-[var(--accent)] text-[var(--accent-dark)]" : "text-[var(--dim)]"
                }`}
              >
                {n.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => goTab("ulasan")}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                tab === "ulasan" ? "bg-[var(--accent)] text-[var(--accent-dark)]" : "text-[var(--dim)]"
              }`}
            >
              Ulasan
            </button>
          </nav>
          {member ? (
            <button type="button" onClick={() => goTab("member")} className="md:hidden" aria-label="Profil member">
              <Badge>
                ✂ {member.stamps}/{target}{member.freeCuts > 0 ? ` • ${member.freeCuts} gratis` : ` • kurang ${target - member.stamps}`}
              </Badge>
            </button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        {boot.isPending && <p className="py-16 text-center text-[var(--dim)]">Memuat BARBERBOYS…</p>}
        {boot.isError && (
          <div className="py-16 text-center">
            <p className="text-[var(--dim)]">Gagal memuat data. Periksa koneksi lalu coba lagi.</p>
            <button type="button" className={`${btnGold} mt-4`} onClick={() => boot.refetch()}>
              Coba Lagi
            </button>
          </div>
        )}
        {data && selectedBranch && (
          <>
            {tab === "beranda" && (
              <HomeView data={data} branch={selectedBranch} goBooking={goBooking} goTab={goTab} />
            )}
            {tab === "booking" && (
              <BookingView
                key={seed.nonce}
                data={data}
                initialBranchId={selectedBranch.id}
                seed={seed}
                member={member}
                goTab={goTab}
              />
            )}
            {tab === "promo" && <PromoView promos={data.promos} goBooking={goBooking} />}
            {tab === "galeri" && <GalleryView data={data} />}
            {tab === "pelanggan" && <CustomerPhotosView data={data} />}
            {tab === "ulasan" && <ReviewsView data={data} member={member} />}
            {tab === "member" && (
              <MemberView
                member={member}
                profile={memberProfile.data ?? null}
                isLoading={memberProfile.isPending && memberId != null}
                settings={data.settings}
                onLogin={onLogin}
                onLogout={onLogout}
                goBooking={() => goBooking()}
              />
            )}
            {tab === "admin" && <AdminView data={data} />}
          </>
        )}
        {data && !selectedBranch && (
          <p className="py-16 text-center text-[var(--dim)]">
            Data lokasi barbershop belum tersedia. Pemilik dapat memeriksanya lewat tautan Admin di bagian bawah halaman.
          </p>
        )}
      </main>

      <footer className="mx-auto mt-12 max-w-5xl border-t-2 border-[var(--text)] px-4 pb-6 pt-8 text-center text-sm text-[var(--dim)]">
        <p className="font-display text-xl tracking-widest text-[var(--text)]">
          BARBER<span className="text-[var(--accent)]">BOYS</span>
        </p>
        <p className="mt-1">{data?.settings.tagline ?? ""}</p>
        {data && (
          <div className="mt-3 flex justify-center">
            <SocialIcons settings={data.settings} />
          </div>
        )}
        <button type="button" className="mt-2 underline" onClick={() => goTab("ulasan")}>
          Lihat & tulis ulasan pelanggan
        </button>
        <p className="mt-6">
          <button
            type="button"
            onClick={() => goTab("admin")}
            aria-label={adminPending > 0 ? `Admin — ${adminPending} hal menunggu tindakan` : "Admin"}
            className="text-xs text-[var(--dim)] underline-offset-2 hover:underline"
          >
            Admin
            <NotifBadge count={adminPending} label={`${adminPending} hal menunggu tindakan admin`} />
          </button>
        </p>
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-[var(--text)] bg-[var(--surface)] pb-safe shadow-[0_-2px_8px_rgba(33,26,16,0.12)] md:hidden"
        aria-label="Navigasi bawah"
      >
        <div className="grid grid-cols-6">
          {navItems.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => goTab(n.key)}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                tab === n.key ? "text-[var(--accent)]" : "text-[var(--dim)]"
              }`}
              aria-current={tab === n.key ? "page" : undefined}
              aria-label={n.label.replace(" Saya", "")}
            >
              <span className="relative text-base leading-none">
                {n.key === "beranda" ? "⌂" : n.key === "booking" ? "✂" : n.key === "galeri" ? "▦" : n.key === "pelanggan" ? "☺" : n.key === "promo" ? "%" : "★"}
              </span>
              {n.label.replace(" Saya", "").replace("Foto ", "")}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

type GallerySlide = Bootstrap["gallery"][number];

function HeroSlider({
  data,
  goBooking,
  goTab,
}: {
  data: Bootstrap;
  goBooking: (opts?: { serviceId?: number; barberId?: number; promoCode?: string }) => void;
  goTab: (t: Tab) => void;
}) {
  const flagged = data.gallery.filter((g) => g.isSlide && photoSrc(g));
  const pool = flagged.length > 0 ? flagged : data.gallery.filter((g) => photoSrc(g)).slice(0, 4);
  const slides: GallerySlide[] =
    pool.length > 0
      ? pool
      : [{ id: 0, title: "Kursi Klasik Kami", styleTag: "Interior", imageAsset: "hero", imageUrl: null, isSlide: true, sortOrder: 0 }];
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const count = slides.length;
  const active = Math.min(idx, count - 1);

  useEffect(() => {
    if (paused || reducedMotion || count < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [paused, reducedMotion, count]);

  const go = (dir: number) => setIdx((i) => (i + dir + count) % count);
  const current = slides[active];

  return (
    <section
      className="relative -mx-4 mt-0 overflow-hidden"
      aria-roledescription="carousel"
      aria-label="Slider foto BARBERBOYS"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        touchX.current = null;
        if (start != null && end != null && Math.abs(end - start) > 40) go(end < start ? 1 : -1);
        setPaused(false);
      }}
    >
      <div className="relative h-[400px] w-full">
        {slides.map((g, i) => (
          <img
            key={g.id}
            src={photoSrc(g) ?? ""}
            alt={i === active ? `Foto slider: ${g.title}` : ""}
            aria-hidden={i !== active}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/25" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#e9bc45]">Selamat Datang di</p>
          <h1 className="font-display text-5xl leading-none tracking-wide text-white min-[420px]:text-6xl sm:text-7xl">
            BARBER<span className="text-[#e9bc45]">BOYS</span>
          </h1>
          <p className="mt-2 max-w-md text-lg font-semibold text-white">{data.settings.tagline ?? ""}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" className={btnGold} onClick={() => goBooking()}>
              Booking Sekarang
            </button>
            <button
              type="button"
              className="rounded-[var(--radius)] border border-[#f3ead8]/50 px-5 py-2.5 font-semibold text-[#f3ead8]"
              onClick={() => goTab("promo")}
            >
              Lihat Promo
            </button>
          </div>
          {data.stats.reviewCount > 0 && (
            <p className="mt-4 text-sm text-[#e8dfca]">
              <Stars value={data.stats.avgRating} /> {data.stats.avgRating.toFixed(1)} dari {data.stats.reviewCount} ulasan
            </p>
          )}
          {current && (
            <p className="absolute bottom-12 left-0 right-0 text-xs font-semibold uppercase tracking-widest text-[#e8dfca]/80">
              {current.title}
              {current.styleTag ? ` • ${current.styleTag}` : ""}
            </p>
          )}
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto sebelumnya"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-xl text-[#f3ead8]"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Foto berikutnya"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-xl text-[#f3ead8]"
            >
              ›
            </button>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
              {slides.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  aria-label={`Ke slide ${i + 1}: ${g.title}`}
                  aria-current={i === active}
                  onClick={() => setIdx(i)}
                  className={`h-2 min-h-0 rounded-full transition-all ${i === active ? "w-6 bg-[var(--accent)]" : "w-2 bg-[#f3ead8]/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function HomeView({
  data,
  branch,
  goBooking,
  goTab,
}: {
  data: Bootstrap;
  branch: Branch;
  goBooking: (opts?: { serviceId?: number; barberId?: number; promoCode?: string }) => void;
  goTab: (t: Tab) => void;
}) {
  const services = data.services.filter((s) => s.branchId === branch.id && s.active);
  const barbers = data.barbers.filter((b) => b.branchId === branch.id && b.active);
  const s = data.settings;
  return (
    <div>
      <HeroSlider data={data} goBooking={goBooking} goTab={goTab} />

      <div className="mt-5 grid grid-cols-2 gap-3 text-center">
        {[
          { n: String(barbers.length), l: "Kapster Siap Melayani" },
          { n: String(services.length), l: "Pilihan Layanan" },
        ].map((x) => (
          <div
            key={x.l}
            className="rounded-[var(--radius)] border-2 border-[var(--border)] bg-[var(--surface)] py-3 shadow-[0_2px_6px_rgba(33,26,16,0.10)]"
          >
            <p className="font-display text-3xl text-[var(--accent)]">{x.n}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">{x.l}</p>
          </div>
        ))}
      </div>

      <SectionTitle title="Layanan & Harga" />
      {services.length === 0 && <p className="text-[var(--dim)]">Belum ada layanan tersedia.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((sv) => (
          <article key={sv.id} className={cardCls}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-2xl tracking-wide">{sv.name}</h3>
              <p className="whitespace-nowrap font-display text-2xl text-[var(--accent)]">{rp(sv.price)}</p>
            </div>
            <p className="mt-1 text-base text-[var(--dim)]">{sv.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--dim)]">± {sv.durationMin} menit</span>
              <button type="button" className={btnGold} onClick={() => goBooking({ serviceId: sv.id })}>
                Booking
              </button>
            </div>
          </article>
        ))}
      </div>

      <SectionTitle title="Kapster Kami" />
      {barbers.length === 0 && <p className="text-[var(--dim)]">Belum ada kapster tersedia.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {barbers.map((b) => (
          <article key={b.id} className={`${cardCls} flex gap-3`}>
            {barberPhotoSrc(b) ? (
              <img src={barberPhotoSrc(b) ?? ""} alt={`Kapster ${b.name} sedang bekerja`} className="h-28 w-24 shrink-0 rounded-[var(--radius)] object-cover" />
            ) : (
              <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--surface2)] font-display text-4xl text-[var(--accent)]">
                {b.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-display text-2xl tracking-wide">{b.name}</h3>
              <p className="text-sm font-semibold text-[var(--accent)]">{b.specialty}</p>
              {b.reviewCount > 0 ? (
                <p className="mt-0.5 text-sm">
                  <Stars value={b.avgRating} size="text-sm" /> {b.avgRating.toFixed(1)} ({b.reviewCount})
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-[var(--dim)]">Belum ada ulasan</p>
              )}
              <p className="mt-1 line-clamp-2 text-base text-[var(--dim)]">{b.bio}</p>
              <p className="mt-1 text-sm text-[var(--dim)]">
                {b.experienceYears} tahun pengalaman • {workDaysLabel(b)} • {b.startTime}–{b.endTime}
              </p>
              <button type="button" className="mt-2 text-sm font-bold text-[var(--accent)] underline" onClick={() => goBooking({ barberId: b.id })}>
                Booking dengan {b.name.split(" ")[0]}
              </button>
            </div>
          </article>
        ))}
      </div>

      {data.promos.length > 0 && (
        <>
          <SectionTitle
            title="Promo Aktif"
            action={
              <button type="button" className="text-sm font-bold text-[var(--accent)] underline" onClick={() => goTab("promo")}>
                Semua promo
              </button>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {data.promos.slice(0, 2).map((p) => (
              <PromoCard key={p.id} promo={p} goBooking={goBooking} />
            ))}
          </div>
        </>
      )}

      <SectionTitle
        title="Galeri Hasil Potongan"
        action={
          <button type="button" className="text-sm font-bold text-[var(--accent)] underline" onClick={() => goTab("galeri")}>
            Lihat semua
          </button>
        }
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {data.gallery.slice(0, 4).map((g) => (
          <figure key={g.id} className="relative overflow-hidden rounded-[var(--radius)]">
            {photoSrc(g) && <img src={photoSrc(g) ?? ""} alt={g.title} className="aspect-square w-full object-cover" />}
            <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-xs font-semibold text-[#f3ead8]">
              {g.title}
            </figcaption>
          </figure>
        ))}
      </div>

      {data.customerPhotos.length > 0 && (
        <>
          <SectionTitle
            title="Foto Pelanggan"
            action={
              <button type="button" className="text-sm font-bold text-[var(--accent)] underline" onClick={() => goTab("pelanggan")}>
                Lihat semua
              </button>
            }
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.customerPhotos.slice(0, 4).map((p) => (
              <figure key={p.id} className="relative overflow-hidden rounded-[var(--radius)]">
                <img src={p.imageUrl} alt={`Foto ${p.customerName}${p.style ? `, gaya ${p.style}` : ""}`} className="aspect-square w-full object-cover" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-xs font-semibold text-[#f3ead8]">
                  {p.customerName}
                  {p.style ? ` • ${p.style}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {data.reviews.length > 0 && (
        <>
          <SectionTitle
            title="Kata Pelanggan"
            action={
              <button type="button" className="text-sm font-bold text-[var(--accent)] underline" onClick={() => goTab("ulasan")}>
                Semua ulasan
              </button>
            }
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {data.reviews.slice(0, 3).map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </>
      )}

      <SectionTitle title="Lokasi & Jam Buka" />
      <article className={cardCls}>
        <h3 className="font-display text-2xl tracking-wide">{s.shop_name ?? "BARBERBOYS"}</h3>
        <dl className="mt-2 space-y-1.5 text-base">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-bold">Alamat:</dt>
            <dd>{branch.address || "—"}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-bold">Jam buka:</dt>
            <dd>
              Setiap hari, pukul {branch.openTime} – {branch.closeTime}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-bold">Telepon / WA:</dt>
            <dd>{branch.phone || s.phone || "—"}</dd>
          </div>
        </dl>
      </article>
      {s.about && <p className="mt-4 text-base leading-relaxed text-[var(--dim)]">{s.about}</p>}
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-[var(--dim)]">Ikuti & hubungi kami:</p>
        <SocialIcons settings={s} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {waHref(s.whatsapp) && (
          <a className={btnGhost} href={waHref(s.whatsapp)} target="_blank" rel="noreferrer">
            Chat WhatsApp
          </a>
        )}
        {s.instagram && <span className="px-2 py-2 font-semibold text-[var(--dim)]">Instagram: {s.instagram}</span>}
        {s.email && <span className="px-2 py-2 font-semibold text-[var(--dim)]">{s.email}</span>}
      </div>
    </div>
  );
}

function PromoCard({
  promo,
  goBooking,
}: {
  promo: Promo;
  goBooking: (opts?: { promoCode?: string }) => void;
}) {
  const label =
    promo.discountType === "persen" ? `Diskon ${promo.discountValue}%` : `Potongan ${rp(promo.discountValue)}`;
  const remaining = promo.maxUses != null ? promo.maxUses - promo.usedCount : null;
  return (
    <article className="rounded-[var(--radius)] border-2 border-dashed border-[var(--accent)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-3xl tracking-wider text-[var(--accent)]">{promo.code}</p>
          <p className="font-semibold">{label}</p>
        </div>
        <Badge>{label}</Badge>
      </div>
      <p className="mt-1 text-sm text-[var(--dim)]">{promo.description}</p>
      <p className="mt-2 text-xs text-[var(--dim)]">
        Berlaku {fmtDateShort(promo.startDate)} – {fmtDate(promo.endDate)}
        {promo.minSpend > 0 ? ` • Min. belanja ${rp(promo.minSpend)}` : ""}
        {remaining != null ? ` • Sisa kuota ${remaining}` : ""}
      </p>
      <button type="button" className={`${btnGold} mt-3`} onClick={() => goBooking({ promoCode: promo.code })}>
        Pakai Promo Ini
      </button>
    </article>
  );
}

type Review = Bootstrap["reviews"][number];
function ReviewCard({ review }: { review: Review }) {
  return (
    <article className={cardCls}>
      <Stars value={review.rating} />
      <p className="mt-1.5 text-sm leading-relaxed">{review.comment || "—"}</p>
      <p className="mt-2 text-sm font-semibold">{review.customerName}</p>
      <p className="text-xs text-[var(--dim)]">
        {review.barberName ? `Kapster: ${review.barberName} • ` : ""}
        {new Date(review.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
      </p>
    </article>
  );
}

function waNumber(raw: string | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  if (d.startsWith("8")) return `62${d}`;
  return d;
}

// Membangun tautan wa.me yang valid dari nomor mentah (08xx, +62xx, 8xx)
// atau dari tautan wa.me yang nomornya belum dinormalisasi. Tautan lain
// yang bukan WhatsApp dibiarkan apa adanya.
function waHref(raw: string | undefined): string | undefined {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  const m = s.match(/wa\.me\/([+\d][\d\s-]*)/);
  if (m?.[1]) {
    const n = waNumber(m[1]);
    return n ? `https://wa.me/${n}` : undefined;
  }
  if (/^[+\d][\d\s().-]*$/.test(s)) {
    const n = waNumber(s);
    return n ? `https://wa.me/${n}` : undefined;
  }
  return s;
}

function buildWaUrl(settings: Record<string, string>, booking: Booking): string | null {
  const num = waNumber(settings.whatsapp);
  if (!num) return null;
  const lines = [
    "Halo Admin BARBERBOYS, saya baru saja booking online. Mohon konfirmasinya ya.",
    "",
    `Kode Booking: #BB-${String(booking.id).padStart(4, "0")}`,
    `Nama: ${booking.customerName}`,
    `Layanan: ${booking.serviceName}`,
    `Kapster: ${booking.barberName}`,
    `Tanggal: ${fmtDate(booking.date)}`,
    `Jam: ${booking.time}`,
    `Total: ${rp(booking.totalPrice)}`,
    `Pembayaran: ${PAYMENT_LABEL[booking.paymentMethod] ?? booking.paymentMethod}`,
    ...(booking.notes ? [`Catatan: ${booking.notes}`] : []),
    ...(booking.paymentMethod === "qris" && !booking.freeCutUsed
      ? ["", "Saya membayar via QRIS — bukti pembayarannya (screenshot) saya kirim di chat ini ya, Admin."]
      : []),
    "",
    "Terima kasih!",
  ];
  return `https://wa.me/${num}?text=${encodeURIComponent(lines.join("\n"))}`;
}

// Tautan WhatsApp khusus tombol "Kirim Bukti Pembayaran": TANPA teks
// otomatis sama sekali. Ini chat kedua setelah chat konfirmasi booking,
// jadi pelanggan bisa langsung melampirkan screenshot bukti bayar saja
// tanpa harus menghapus teks booking yang panjang dulu.
function buildProofWaUrl(settings: Record<string, string>): string | null {
  const num = waNumber(settings.whatsapp);
  if (!num) return null;
  return `https://wa.me/${num}`;
}

function fitCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

async function downloadReceiptPng(booking: Booking) {
  try {
    await document.fonts.ready;
  } catch {
    /* font bawaan tetap dipakai */
  }
  const W = 640;
  const scale = 2;
  const pad = 44;
  const rows: Array<[string, string]> = [
    ["Kode Booking", `#BB-${String(booking.id).padStart(4, "0")}`],
    ["Nama", booking.customerName],
    ["No. HP", booking.customerPhone],
    ["Layanan", booking.serviceName],
    ["Kapster", booking.barberName],
    ["Tanggal", fmtDate(booking.date)],
    ["Jam", `${booking.time} WIB`],
    [
      "Pembayaran",
      `${PAYMENT_LABEL[booking.paymentMethod] ?? booking.paymentMethod} — ${PAYSTATUS_LABEL[booking.paymentStatus] ?? booking.paymentStatus}`,
    ],
  ];
  if (booking.promoCode) rows.push(["Kode Promo", booking.promoCode]);
  if (booking.notes) rows.push(["Catatan", booking.notes]);

  const headerH = 148;
  const statusH = 96;
  const rowH = 34;
  const totalsH = booking.discount > 0 ? 116 : 82;
  const footerH = 104;
  const H = headerH + statusH + rows.length * rowH + totalsH + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  // Latar struk
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#b3a37f";
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, W - 12, H - 12);

  // Kepala struk
  ctx.textAlign = "center";
  ctx.fillStyle = "#211a10";
  ctx.font = "58px 'Bebas Neue', 'Arial Narrow', sans-serif";
  ctx.fillText("BARBERBOYS", W / 2, 66);
  ctx.fillStyle = "#8a6a14";
  ctx.fillRect(W / 2 - 90, 82, 180, 5);
  ctx.fillStyle = "#57503f";
  ctx.font = "600 19px 'Barlow', sans-serif";
  ctx.fillText("STRUK BOOKING", W / 2, 118);
  if (booking.branchName) {
    ctx.font = "16px 'Barlow', sans-serif";
    ctx.fillText(booking.branchName, W / 2, 140);
  }

  // Kotak status persetujuan admin
  const statusColors: Record<string, { bg: string; fg: string }> = {
    menunggu: { bg: "#efe7d3", fg: "#211a10" },
    dikonfirmasi: { bg: "#8a6a14", fg: "#ffffff" },
    selesai: { bg: "#3e6b1e", fg: "#ffffff" },
    dibatalkan: { bg: "#b23a1e", fg: "#ffffff" },
    menunggu_pembatalan: { bg: "#efe7d3", fg: "#b23a1e" },
  };
  const sc = statusColors[booking.status] ?? { bg: "#efe7d3", fg: "#211a10" };
  const boxY = headerH + 8;
  ctx.fillStyle = sc.bg;
  ctx.beginPath();
  ctx.roundRect(pad, boxY, W - pad * 2, 72, 10);
  ctx.fill();
  ctx.fillStyle = sc.fg;
  ctx.font = "600 14px 'Barlow', sans-serif";
  ctx.fillText("STATUS PERSETUJUAN ADMIN", W / 2, boxY + 26);
  ctx.font = "700 25px 'Barlow', sans-serif";
  ctx.fillText(
    (STATUS_LABEL[booking.status] ?? booking.status).toUpperCase(),
    W / 2,
    boxY + 56,
  );

  // Baris detail
  let y = headerH + statusH + 22;
  ctx.font = "17px 'Barlow', sans-serif";
  for (const [label, value] of rows) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#57503f";
    ctx.fillText(label, pad, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#211a10";
    ctx.font = "600 17px 'Barlow', sans-serif";
    ctx.fillText(fitCanvasText(ctx, value, W - pad * 2 - 130), W - pad, y);
    ctx.font = "17px 'Barlow', sans-serif";
    ctx.strokeStyle = "#e3dac2";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, y + 10);
    ctx.lineTo(W - pad, y + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    y += rowH;
  }

  // Total
  y += 6;
  ctx.textAlign = "left";
  ctx.fillStyle = "#57503f";
  ctx.font = "17px 'Barlow', sans-serif";
  ctx.fillText("Harga", pad, y);
  ctx.textAlign = "right";
  ctx.fillStyle = "#211a10";
  ctx.fillText(rp(booking.price), W - pad, y);
  y += 30;
  if (booking.discount > 0) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#3e6b1e";
    ctx.fillText(
      booking.freeCutUsed ? "Potong gratis member" : "Potongan promo",
      pad,
      y,
    );
    ctx.textAlign = "right";
    ctx.fillText(`−${rp(booking.discount)}`, W - pad, y);
    y += 30;
  }
  ctx.strokeStyle = "#211a10";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y - 16);
  ctx.lineTo(W - pad, y - 16);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = "#211a10";
  ctx.font = "700 20px 'Barlow', sans-serif";
  ctx.fillText("TOTAL BAYAR", pad, y + 16);
  ctx.textAlign = "right";
  ctx.fillStyle = "#8a6a14";
  ctx.font = "34px 'Bebas Neue', 'Arial Narrow', sans-serif";
  ctx.fillText(rp(booking.totalPrice), W - pad, y + 18);

  // Kaki struk
  ctx.textAlign = "center";
  ctx.fillStyle = "#57503f";
  ctx.font = "16px 'Barlow', sans-serif";
  ctx.fillText("Terima kasih sudah booking di BARBERBOYS.", W / 2, H - 62);
  ctx.font = "13px 'Barlow', sans-serif";
  ctx.fillText(
    "Status pada struk ini sesuai saat struk diunduh. Cek status terbaru",
    W / 2,
    H - 38,
  );
  ctx.fillText("di menu Booking dengan nomor HP kamu.", W / 2, H - 20);

  // Watermark transparan "BOYS" miring menutupi struk
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.42);
  ctx.fillStyle = "rgba(138, 106, 20, 0.09)";
  ctx.font = "150px 'Bebas Neue', 'Arial Narrow', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const stepX = 400;
  const stepY = 300;
  for (let gx = -stepX; gx <= stepX; gx += stepX) {
    for (let gy = -stepY * 2; gy <= stepY * 2; gy += stepY) {
      ctx.fillText("BOYS", gx, gy);
    }
  }
  ctx.restore();

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `struk-barberboys-${String(booking.id).padStart(4, "0")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
}

async function downloadVoucherPng(voucher: Voucher, target: number) {
  try {
    await document.fonts.ready;
  } catch {
    /* font bawaan tetap dipakai */
  }
  const W = 640;
  const scale = 2;
  const pad = 44;
  const headerH = 148;
  const statusH = 96;
  const codeH = 118;
  const rows: Array<[string, string]> = [
    ["Nama Member", voucher.memberName],
    ["No. HP", voucher.memberPhone],
    ["Tanggal Didapat", new Date(voucher.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })],
    ["Berlaku Untuk", "1x potong rambut GRATIS"],
  ];
  if (voucher.redeemedAt) {
    rows.push([
      "Tanggal Dipakai",
      new Date(voucher.redeemedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    ]);
  }
  const rowH = 34;
  const infoH = 118;
  const footerH = 84;
  const H = headerH + statusH + codeH + rows.length * rowH + infoH + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#b3a37f";
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, W - 12, H - 12);

  // Kepala voucher
  ctx.textAlign = "center";
  ctx.fillStyle = "#211a10";
  ctx.font = "58px 'Bebas Neue', 'Arial Narrow', sans-serif";
  ctx.fillText("BARBERBOYS", W / 2, 66);
  ctx.fillStyle = "#8a6a14";
  ctx.fillRect(W / 2 - 90, 82, 180, 5);
  ctx.fillStyle = "#8a6a14";
  ctx.font = "700 26px 'Barlow', sans-serif";
  ctx.fillText("VOUCHER POTONG GRATIS", W / 2, 120);
  ctx.fillStyle = "#57503f";
  ctx.font = "16px 'Barlow', sans-serif";
  ctx.fillText(`Hadiah ${target} stempel loyalitas member`, W / 2, 142);

  // Kotak status voucher
  const statusColors: Record<string, { bg: string; fg: string }> = {
    aktif: { bg: "#3e6b1e", fg: "#ffffff" },
    menunggu_persetujuan: { bg: "#8a6a14", fg: "#ffffff" },
    terpakai: { bg: "#efe7d3", fg: "#211a10" },
    dibatalkan: { bg: "#b23a1e", fg: "#ffffff" },
  };
  const sc = statusColors[voucher.status] ?? { bg: "#efe7d3", fg: "#211a10" };
  const boxY = headerH + 8;
  ctx.fillStyle = sc.bg;
  ctx.beginPath();
  ctx.roundRect(pad, boxY, W - pad * 2, 72, 10);
  ctx.fill();
  ctx.fillStyle = sc.fg;
  ctx.font = "600 14px 'Barlow', sans-serif";
  ctx.fillText("STATUS VOUCHER", W / 2, boxY + 26);
  ctx.font = "700 25px 'Barlow', sans-serif";
  ctx.fillText(
    (VOUCHER_STATUS_LABEL[voucher.status] ?? voucher.status).toUpperCase(),
    W / 2,
    boxY + 56,
  );

  // Kotak kode voucher
  const codeY = headerH + statusH + 10;
  ctx.strokeStyle = "#8a6a14";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.roundRect(pad, codeY, W - pad * 2, 92, 10);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#57503f";
  ctx.font = "600 14px 'Barlow', sans-serif";
  ctx.fillText("KODE VOUCHER", W / 2, codeY + 28);
  ctx.fillStyle = "#211a10";
  ctx.font = "700 42px 'Courier New', monospace";
  ctx.fillText(voucher.code, W / 2, codeY + 72);

  // Baris detail
  let y = headerH + statusH + codeH + 22;
  ctx.font = "17px 'Barlow', sans-serif";
  for (const [label, value] of rows) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#57503f";
    ctx.fillText(label, pad, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#211a10";
    ctx.font = "600 17px 'Barlow', sans-serif";
    ctx.fillText(fitCanvasText(ctx, value, W - pad * 2 - 150), W - pad, y);
    ctx.font = "17px 'Barlow', sans-serif";
    ctx.strokeStyle = "#e3dac2";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, y + 10);
    ctx.lineTo(W - pad, y + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    y += rowH;
  }

  // Cara menukar
  y += 14;
  ctx.textAlign = "center";
  ctx.fillStyle = "#211a10";
  ctx.font = "700 17px 'Barlow', sans-serif";
  ctx.fillText("CARA MENUKAR", W / 2, y);
  ctx.fillStyle = "#57503f";
  ctx.font = "16px 'Barlow', sans-serif";
  ctx.fillText("Tunjukkan gambar voucher ini ke admin/kasir saat datang", W / 2, y + 26);
  ctx.fillText("ke BARBERBOYS. Admin menyetujui penukarannya di aplikasi.", W / 2, y + 48);
  ctx.fillText("Setelah voucher dipakai, stempel direset ulang dari 0.", W / 2, y + 70);

  // Kaki voucher
  ctx.fillStyle = "#57503f";
  ctx.font = "13px 'Barlow', sans-serif";
  ctx.fillText("Satu voucher berlaku untuk satu kali potong gratis • Tidak dapat diuangkan", W / 2, H - 30);

  // Watermark transparan "BOYS" miring menutupi voucher
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.42);
  ctx.fillStyle = "rgba(138, 106, 20, 0.09)";
  ctx.font = "150px 'Bebas Neue', 'Arial Narrow', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const stepX = 400;
  const stepY = 300;
  for (let gx = -stepX; gx <= stepX; gx += stepX) {
    for (let gy = -stepY * 2; gy <= stepY * 2; gy += stepY) {
      ctx.fillText("BOYS", gx, gy);
    }
  }
  ctx.restore();

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voucher-gratis-barberboys-${voucher.code.toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
}

function BookingCard({ booking, settings }: { booking: Booking; settings?: Record<string, string> }) {
  const queryClient = useQueryClient();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSent, setCancelSent] = useState(false);
  const cancelMut = useMutation({
    mutationFn: () => api.requestBookingCancellation({ bookingId: booking.id, phone: booking.customerPhone }),
    onSuccess: () => {
      setCancelSent(true);
      setConfirmingCancel(false);
      setCancelError(null);
      queryClient.invalidateQueries();
    },
    onError: (e) => setCancelError(e instanceof Error ? e.message : "Pengajuan pembatalan gagal. Coba lagi."),
  });
  const canCancel = booking.status === "menunggu" || booking.status === "dikonfirmasi";
  const cancelPending = booking.status === "menunggu_pembatalan" || cancelSent;
  const proofWaUrl =
    settings && booking.paymentMethod === "qris" && booking.paymentStatus !== "lunas" && !booking.freeCutUsed
      ? buildProofWaUrl(settings)
      : null;
  return (
    <article className={cardCls}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl tracking-wide">{booking.serviceName}</p>
          <p className="text-sm text-[var(--dim)]">Kapster {booking.barberName}</p>
        </div>
        <Badge tone={statusTone(booking.status)}>{STATUS_LABEL[booking.status] ?? booking.status}</Badge>
      </div>
      <p className="mt-2 text-sm">
        {fmtDate(booking.date)} • Jam {booking.time}
      </p>
      <p className="text-sm text-[var(--dim)]">
        {booking.customerName} • {booking.customerPhone}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {booking.discount > 0 && <span className="text-[var(--dim)] line-through">{rp(booking.price)}</span>}
        <span className="font-display text-xl text-[var(--accent)]">{rp(booking.totalPrice)}</span>
        {booking.freeCutUsed && <Badge tone="green">Potong Gratis Member</Badge>}
        {booking.promoCode && <Badge tone="dim">Promo {booking.promoCode}</Badge>}
        <Badge tone={booking.paymentStatus === "lunas" ? "green" : "dim"}>
          {PAYMENT_LABEL[booking.paymentMethod] ?? booking.paymentMethod} — {PAYSTATUS_LABEL[booking.paymentStatus] ?? booking.paymentStatus}
        </Badge>
      </div>
      {booking.notes && <p className="mt-1 text-sm text-[var(--dim)]">Catatan: {booking.notes}</p>}
      <button
        type="button"
        className={`${btnGhost} mt-3`}
        onClick={() => void downloadReceiptPng(booking)}
        aria-label={`Unduh struk PNG untuk booking ${booking.serviceName}`}
      >
        Unduh Struk (PNG)
      </button>
      <p className="mt-1 text-xs text-[var(--dim)]">Struk menampilkan status persetujuan admin saat ini.</p>
      {proofWaUrl && (
        <>
          <a
            href={proofWaUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-2 rounded-[var(--radius)] bg-[#3e6b1e] px-4 py-2.5 text-center text-sm font-bold text-white shadow-sm"
            aria-label={`Kirim bukti pembayaran QRIS untuk booking ${booking.serviceName} via WhatsApp`}
          >
            Kirim Bukti Pembayaran via WhatsApp
          </a>
          <p className="mt-1 text-xs text-[var(--dim)]">
            Sudah bayar pakai QRIS? Chat WhatsApp akan terbuka kosong — langsung lampirkan screenshot bukti bayarnya saja supaya cepat
            diverifikasi.
          </p>
        </>
      )}
      {cancelPending ? (
        <p className="mt-3 rounded-[var(--radius)] border-2 border-[var(--red)] bg-[var(--surface2)] px-3 py-2 text-sm font-semibold text-[var(--red)]">
          Pembatalan sudah diajukan — menunggu persetujuan admin. Booking ini resmi batal setelah admin menyetujuinya di dashboard.
        </p>
      ) : canCancel ? (
        <div className="mt-3">
          {!confirmingCancel ? (
            <button
              type="button"
              className="text-sm font-bold text-[var(--red)] underline"
              onClick={() => setConfirmingCancel(true)}
              aria-label={`Batalkan booking ${booking.serviceName} pada ${fmtDate(booking.date)} jam ${booking.time}`}
            >
              Batalkan Booking
            </button>
          ) : (
            <div className="rounded-[var(--radius)] border-2 border-[var(--red)] bg-[var(--surface)] px-3 py-2">
              <p className="text-sm">
                Yakin mau membatalkan booking ini? Pembatalan <strong>menunggu persetujuan admin</strong> dulu — booking tetap tercatat
                sampai admin menyetujuinya.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-[var(--radius)] bg-[var(--red)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  disabled={cancelMut.isPending}
                  onClick={() => cancelMut.mutate()}
                >
                  {cancelMut.isPending ? "Mengajukan…" : "Ya, Ajukan Pembatalan"}
                </button>
                <button type="button" className={btnGhost} onClick={() => setConfirmingCancel(false)}>
                  Tidak Jadi
                </button>
              </div>
            </div>
          )}
          {cancelError && (
            <p className="mt-2 text-sm font-semibold text-[var(--red)]" role="alert">{cancelError}</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function BookingView({
  data,
  initialBranchId,
  seed,
  member,
  goTab,
}: {
  data: Bootstrap;
  initialBranchId: number;
  seed: { serviceId?: number; barberId?: number; promoCode?: string };
  member: Member | null;
  goTab: (t: Tab) => void;
}) {
  const queryClient = useQueryClient();
  const seedBarber = seed.barberId ? data.barbers.find((b) => b.id === seed.barberId) : undefined;
  const seedService = seed.serviceId ? data.services.find((sv) => sv.id === seed.serviceId) : undefined;
  // Satu lokasi saja — cabang tidak lagi dipilih, selalu lokasi utama.
  const branch =
    data.branches.find((b) => b.id === (seedBarber?.branchId ?? seedService?.branchId ?? initialBranchId)) ??
    data.branches.find((b) => b.active);
  const services = data.services.filter((sv) => sv.branchId === branch?.id && sv.active);
  const barbers = data.barbers.filter((b) => b.branchId === branch?.id && b.active);
  const target = stampsTarget(data.settings);
  const [serviceId, setServiceId] = useState<number | null>(seedService?.id ?? null);
  const [barberId, setBarberId] = useState<number | null>(seedBarber?.id ?? null);
  const [date, setDate] = useState<string>(todayPlus(0));
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState(member?.name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"qris" | "tunai">("qris");
  const [promoInput, setPromoInput] = useState(seed.promoCode ?? "");
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [useFreeCut, setUseFreeCut] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<Booking | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const waWinRef = useRef<Window | null>(null);
  const [lookupPhone, setLookupPhone] = useState(member?.phone ?? "");
  const [lookup, setLookup] = useState<Booking[] | null>(null);

  const service = services.find((sv) => sv.id === serviceId) ?? null;
  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const barberOff = barber ? !barber.workDays.includes(weekdayOf(date)) : false;

  const availability = useQuery({
    queryKey: ["availability", barberId, date],
    queryFn: () => api.getAvailability({ barberId: barberId ?? 0, date }),
    enabled: barberId != null,
  });
  const bookedTimes = availability.data?.bookedTimes ?? [];
  const slotList = barber && branch ? slotsFor(barber, branch) : [];

  const price = service?.price ?? 0;
  const freeCutActive = Boolean(useFreeCut && member && member.freeCuts > 0 && service);
  const discount = freeCutActive ? price : (promo?.discount ?? 0);
  const total = Math.max(0, price - discount);

  const validateMut = useMutation({
    mutationFn: () => api.validatePromo({ code: promoInput.trim(), price, date }),
    onSuccess: (res) => {
      if (res.valid) {
        setPromo({ code: res.promoCode, discount: res.discount });
        setPromoMsg(`Kode ${res.promoCode} aktif — hemat ${rp(res.discount)}.`);
      } else {
        setPromo(null);
        setPromoMsg(res.message);
      }
    },
    onError: (e) => setPromoMsg(e instanceof Error ? e.message : "Kode tidak bisa dicek."),
  });

  const createMut = useMutation({
    mutationFn: async () =>
      await api.createBooking({
        branchId: branch?.id ?? 0,
        serviceId: serviceId ?? 0,
        barberId: barberId ?? 0,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        date,
        time: time ?? "",
        paymentMethod,
        promoCode: freeCutActive ? undefined : (promo?.code ?? undefined),
        memberId: member?.id ?? undefined,
        useFreeCut: freeCutActive,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (res) => {
      setDone(res.booking);
      // Arahkan pelanggan ke chat WhatsApp admin dengan teks otomatis.
      const url = buildWaUrl(data.settings, res.booking);
      setWaUrl(url);
      if (waWinRef.current && url) {
        waWinRef.current.location.href = url;
      } else if (waWinRef.current) {
        waWinRef.current.close();
      } else if (url) {
        window.open(url, "_blank", "noopener");
      }
      waWinRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["member-profile"] });
      window.scrollTo({ top: 0 });
    },
    onError: (e) => {
      if (waWinRef.current) waWinRef.current.close();
      waWinRef.current = null;
      setFormError(e instanceof Error ? e.message : "Booking gagal. Coba lagi.");
    },
  });

  const lookupMut = useMutation({
    mutationFn: () => api.findBookingsByPhone({ phone: lookupPhone.trim() }),
    onSuccess: (res) => setLookup(res.bookings),
    onError: (e) => setFormError(e instanceof Error ? e.message : "Pencarian gagal."),
  });

  const submit = () => {
    setFormError(null);
    if (!service) return setFormError("Pilih layanan dulu ya.");
    if (!barber) return setFormError("Pilih kapster dulu ya.");
    if (barberOff) return setFormError(`${barber.name} libur pada ${fmtDate(date)}. Pilih hari atau kapster lain.`);
    if (!time) return setFormError("Pilih jam kedatangan.");
    if (name.trim().length < 2) return setFormError("Isi nama kamu (minimal 2 huruf).");
    if (phone.trim().length < 8) return setFormError("Isi nomor HP/WhatsApp yang benar.");
    // Buka tab kosong selagi klik masih segar supaya tidak diblokir pemblokir
    // pop-up; setelah booking tersimpan, tab ini diarahkan ke chat WhatsApp admin.
    if (waNumber(data.settings.whatsapp)) {
      waWinRef.current = window.open("about:blank", "_blank");
    }
    createMut.mutate();
  };

  if (done) {
    return (
      <div className="py-8">
        <div className="rounded-[var(--radius)] border-2 border-[var(--accent)] bg-[var(--surface)] p-5 text-center">
          <p className="font-display text-4xl tracking-wide text-[var(--accent)]">Booking Berhasil!</p>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Kamu diarahkan ke chat WhatsApp admin untuk konfirmasi booking ini. Tunjukkan detail ini saat datang, dan simpan nomor HP kamu
            untuk cek status booking.
          </p>
        </div>
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-[var(--radius)] bg-[#3e6b1e] px-5 py-3 text-center font-bold text-white shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.2-.7l.5-.6c.1-.2.1-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
            </svg>
            Konfirmasi via WhatsApp Admin
          </a>
        )}
        <div className="mt-4">
          <BookingCard booking={done} />
        </div>
        <div className={`${cardCls} mt-3`}>
          <h3 className="font-display text-xl tracking-wide">Cara Pembayaran</h3>
          {done.freeCutUsed ? (
            <p className="mt-1 text-sm text-[var(--dim)]">Booking ini memakai 1x potong gratis member — tidak perlu bayar. Selamat!</p>
          ) : done.paymentMethod === "tunai" ? (
            <p className="mt-1 text-sm text-[var(--dim)]">Bayar tunai {rp(done.totalPrice)} langsung di kasir saat datang.</p>
          ) : (
            <div>
              <p className="mt-1 text-sm text-[var(--dim)]">
                Bayar <strong className="text-[var(--text)]">{rp(done.totalPrice)}</strong> dengan scan kode QRIS di bawah ini. Setelah membayar,{" "}
                <strong className="text-[var(--text)]">kirim bukti pembayaran (screenshot) lewat WhatsApp ke admin</strong> supaya pembayaranmu
                cepat diverifikasi — statusnya bisa kamu cek di bawah dengan nomor HP.
              </p>
              {data.qrisImageUrl ? (
                <img
                  src={data.qrisImageUrl}
                  alt="Kode QRIS BARBERBOYS — scan untuk membayar booking ini"
                  className="mx-auto mt-3 w-full max-w-[260px] rounded-[var(--radius)] border-2 border-[var(--border)] bg-white object-contain"
                />
              ) : (
                <p className="mt-2 text-sm font-semibold text-[var(--red)]">
                  Admin belum mengunggah gambar kode QRIS di dashboard — minta kode QRIS ke admin lewat WhatsApp, lalu kirim bukti bayarnya di
                  chat yang sama.
                </p>
              )}
              {buildProofWaUrl(data.settings) && (
                <a
                  href={buildProofWaUrl(data.settings) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 rounded-[var(--radius)] bg-[#3e6b1e] px-4 py-2.5 text-center text-sm font-bold text-white shadow-sm"
                  aria-label="Kirim bukti pembayaran QRIS via WhatsApp — chat dibuka kosong untuk melampirkan screenshot"
                >
                  Kirim Bukti Pembayaran via WhatsApp
                </a>
              )}
              <p className="mt-1 text-xs text-[var(--dim)]">
                Chat WhatsApp akan terbuka kosong — langsung lampirkan screenshot bukti pembayaranmu saja, tanpa teks otomatis.
              </p>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btnGold} onClick={() => goTab("beranda")}>
            Kembali ke Beranda
          </button>
          <button type="button" className={btnGhost} onClick={() => setDone(null)}>
            Buat Booking Lain
          </button>
        </div>
      </div>
    );
  }

  const days = Array.from({ length: 14 }, (_, i) => todayPlus(i));

  return (
    <div className="py-5">
      <h1 className="font-display text-4xl tracking-wide">Booking Online</h1>
      <p className="mt-1 text-base text-[var(--dim)]">Pilih layanan, kapster, dan jam kedatangan — tanpa antre.</p>
      {branch && (
        <p className="mt-1 text-sm font-semibold text-[var(--dim)]">
          Lokasi: {branch.address} • Buka {branch.openTime}–{branch.closeTime}
        </p>
      )}

      {member && (
        <div className="mt-4 rounded-[var(--radius)] border-2 border-[var(--accent)] bg-[var(--surface)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Member</Badge>
            <p className="text-base">
              Halo, <strong>{member.name}</strong>
            </p>
          </div>
          <p className="mt-1.5 text-base">
            Stempel terkumpul: <strong>{member.stamps} dari {target}</strong>
            {member.freeCuts > 0 ? (
              <>
                {" "}• Kamu punya <strong>{member.freeCuts}x potong GRATIS</strong>
              </>
            ) : (
              <>
                {" "}• Kurang <strong>{target - member.stamps}x potong lagi</strong> untuk dapat 1x potong gratis
              </>
            )}
          </p>
        </div>
      )}

      <section className="mt-6">
        <h2 className={labelCls}>1. Layanan</h2>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Pilih layanan">
          {services.map((sv) => (
            <button
              key={sv.id}
              type="button"
              role="radio"
              aria-checked={serviceId === sv.id}
              onClick={() => {
                setServiceId(sv.id);
                setPromo(null);
                setPromoMsg(null);
              }}
              className={`rounded-[var(--radius)] border-2 p-3 text-left ${
                serviceId === sv.id ? "border-[var(--accent)] bg-[var(--surface2)]" : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold">{sv.name}</span>
                <span className="font-display text-xl text-[var(--accent)]">{rp(sv.price)}</span>
              </span>
              <span className="mt-0.5 block text-sm text-[var(--dim)]">
                {sv.description} • ±{sv.durationMin} menit
              </span>
            </button>
          ))}
          {services.length === 0 && <p className="text-sm text-[var(--dim)]">Belum ada layanan aktif.</p>}
        </div>
      </section>

      <section className="mt-6">
        <h2 className={labelCls}>2. Kapster</h2>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Pilih kapster">
          {barbers.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={barberId === b.id}
              onClick={() => {
                setBarberId(b.id);
                setTime(null);
              }}
              className={`flex items-center gap-3 rounded-[var(--radius)] border-2 p-3 text-left ${
                barberId === b.id ? "border-[var(--accent)] bg-[var(--surface2)]" : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {barberPhotoSrc(b) ? (
                <img src={barberPhotoSrc(b) ?? ""} alt="" className="h-14 w-12 rounded-[var(--radius)] object-cover" />
              ) : (
                <span className="flex h-14 w-12 items-center justify-center rounded-[var(--radius)] bg-[var(--surface2)] font-display text-2xl text-[var(--accent)]">
                  {b.name.slice(0, 1)}
                </span>
              )}
              <span>
                <span className="block font-semibold">{b.name}</span>
                <span className="block text-sm text-[var(--accent)]">{b.specialty}</span>
                <span className="block text-xs text-[var(--dim)]">
                  {workDaysLabel(b)} • {b.startTime}–{b.endTime}
                  {b.reviewCount > 0 ? ` • ★ ${b.avgRating.toFixed(1)}` : ""}
                </span>
              </span>
            </button>
          ))}
          {barbers.length === 0 && <p className="text-sm text-[var(--dim)]">Belum ada kapster aktif.</p>}
        </div>
      </section>

      <section className="mt-6">
        <h2 className={labelCls}>3. Tanggal</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih tanggal">
          {days.map((d) => {
            const dt = new Date(`${d}T00:00:00`);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={date === d}
                onClick={() => {
                  setDate(d);
                  setTime(null);
                  setPromo(null);
                  setPromoMsg(null);
                }}
                className={`w-[68px] rounded-[var(--radius)] border px-2 py-2 text-center ${
                  date === d ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-dark)]" : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <span className="block text-xs font-semibold">{DAY_SHORT[dt.getDay()]}</span>
                <span className="block font-display text-xl leading-tight">{dt.getDate()}</span>
                <span className="block text-[11px]">{MONTHS[dt.getMonth()]?.slice(0, 3)}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-sm text-[var(--dim)]">{fmtDate(date)}</p>
      </section>

      <section className="mt-6">
        <h2 className={labelCls}>4. Jam Kedatangan</h2>
        {!barber && <p className="text-sm text-[var(--dim)]">Pilih kapster dulu untuk melihat jam yang tersedia.</p>}
        {barber && barberOff && (
          <p className="text-sm font-semibold text-[var(--red)]">
            {barber.name} libur pada hari {DAY_NAMES[weekdayOf(date)]}. Pilih tanggal atau kapster lain.
          </p>
        )}
        {barber && !barberOff && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih jam">
            {slotList.map((t) => {
              const taken = bookedTimes.includes(t);
              const past = date === todayPlus(0) && toMinutes(t) <= new Date().getHours() * 60 + new Date().getMinutes();
              const disabled = taken || past;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={disabled}
                  aria-pressed={time === t}
                  onClick={() => setTime(t)}
                  className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${
                    time === t
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-dark)]"
                      : disabled
                        ? "border-[var(--border)] text-[var(--dim)] line-through opacity-50"
                        : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {t}
                </button>
              );
            })}
            {slotList.length === 0 && <p className="text-sm text-[var(--dim)]">Tidak ada jam tersedia pada tanggal ini.</p>}
          </div>
        )}
        {availability.isPending && barber && <p className="mt-1 text-sm text-[var(--dim)]">Mengecek ketersediaan…</p>}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="bk-name">5. Nama Kamu</label>
          <input id="bk-name" className={inputCls} {...FIELDS.createBooking.customerName} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" autoComplete="name" />
        </div>
        <div>
          <label className={labelCls} htmlFor="bk-phone">Nomor HP / WhatsApp</label>
          <input id="bk-phone" className={inputCls} {...FIELDS.createBooking.customerPhone} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" autoComplete="tel" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="bk-notes">Catatan (opsional)</label>
          <input id="bk-notes" className={inputCls} {...FIELDS.createBooking.notes} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contoh: fade tinggi, samping tipis" />
        </div>
      </section>

      {member && member.freeCuts > 0 && (
        <section className="mt-6">
          <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--surface)] p-3">
            <input type="checkbox" checked={useFreeCut} onChange={(e) => setUseFreeCut(e.target.checked)} className="h-5 w-5 accent-[#8a6a14]" />
            <span className="text-sm">
              <strong>Pakai 1x potong gratis member</strong> — kamu punya {member.freeCuts}x. Booking ini jadi Rp0 (promo tidak bisa digabung).
            </span>
          </label>
        </section>
      )}

      {!freeCutActive && (
        <section className="mt-6">
          <h2 className={labelCls}>6. Kode Promo (opsional)</h2>
          <div className="flex gap-2">
            <input
              className={`${inputCls} uppercase`}
              {...FIELDS.validatePromo.code}
              value={promoInput}
              onChange={(e) => {
                setPromoInput(e.target.value.toUpperCase());
                setPromo(null);
                setPromoMsg(null);
              }}
              placeholder="Contoh: GANTENG10"
              aria-label="Kode promo"
            />
            <button
              type="button"
              className={btnGhost}
              disabled={!promoInput.trim() || !service || validateMut.isPending}
              onClick={() => validateMut.mutate()}
            >
              Pakai
            </button>
          </div>
          {promoMsg && <p className={`mt-1.5 text-sm ${promo ? "font-semibold text-[var(--green)]" : "text-[var(--red)]"}`}>{promoMsg}</p>}
          {!service && <p className="mt-1 text-sm text-[var(--dim)]">Pilih layanan dulu sebelum memakai promo.</p>}
        </section>
      )}

      <section className="mt-6">
        <h2 className={labelCls}>{freeCutActive ? "6" : "7"}. Metode Pembayaran</h2>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Metode pembayaran">
          {(["qris", "tunai"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={paymentMethod === k}
              onClick={() => setPaymentMethod(k)}
              className={`rounded-[var(--radius)] border-2 p-3 text-left font-semibold ${
                paymentMethod === k ? "border-[var(--accent)] bg-[var(--surface2)]" : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {PAYMENT_LABEL[k]}
              <span className="block text-sm font-normal text-[var(--dim)]">
                {k === "tunai" ? "Bayar langsung di kasir saat kamu datang." : "Scan QRIS, lalu admin memverifikasi pembayaranmu."}
              </span>
            </button>
          ))}
        </div>
        {paymentMethod === "qris" && !freeCutActive && (
          <div className="mt-3 rounded-[var(--radius)] border-2 border-[var(--accent)] bg-[var(--surface)] p-4 text-center">
            <p className="font-display text-2xl tracking-wide">Kode QRIS BARBERBOYS</p>
            {data.qrisImageUrl ? (
              <>
                <img
                  src={data.qrisImageUrl}
                  alt="Kode QRIS BARBERBOYS — scan untuk membayar"
                  className="mx-auto mt-3 w-full max-w-[280px] rounded-[var(--radius)] border-2 border-[var(--border)] bg-white object-contain"
                />
                <p className="mt-3 text-sm text-[var(--dim)]">
                  Scan kode QRIS di atas dengan GoPay, OVO, DANA, ShopeePay, atau mobile banking
                  {service ? (
                    <>
                      {" "}— total yang dibayar <strong className="text-[var(--text)]">{rp(total)}</strong>
                    </>
                  ) : (
                    ""
                  )}
                  . Selesaikan booking dulu, lalu setelah membayar, kirim bukti pembayaran (screenshot) lewat WhatsApp ke admin agar
                  pembayaranmu diverifikasi.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--dim)]">
                Admin belum mengunggah gambar kode QRIS di dashboard. Selesaikan booking ini, lalu minta kode QRIS ke admin lewat WhatsApp —
                setelah membayar, kirim bukti pembayarannya di chat yang sama.
              </p>
            )}
          </div>
        )}
      </section>

      <section className={`${cardCls} mt-6`}>
        <h2 className="font-display text-2xl tracking-wide">Ringkasan Booking</h2>
        <dl className="mt-2 space-y-1 text-base">
          <div className="flex justify-between"><dt className="text-[var(--dim)]">Layanan</dt><dd className="font-semibold">{service?.name ?? "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-[var(--dim)]">Kapster</dt><dd className="font-semibold">{barber?.name ?? "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-[var(--dim)]">Jadwal</dt><dd className="font-semibold">{fmtDate(date)}{time ? ` • ${time}` : ""}</dd></div>
          <div className="flex justify-between"><dt className="text-[var(--dim)]">Harga</dt><dd className="font-semibold">{service ? rp(price) : "—"}</dd></div>
          {discount > 0 && (
            <div className="flex justify-between text-[var(--green)]">
              <dt>{freeCutActive ? "Potong gratis member" : `Promo ${promo?.code}`}</dt>
              <dd className="font-semibold">−{rp(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-[var(--border)] pt-2 text-base">
            <dt className="font-semibold">Total Bayar</dt>
            <dd className="font-display text-2xl text-[var(--accent)]">{service ? rp(total) : "—"}</dd>
          </div>
        </dl>
        {formError && <p className="mt-3 text-sm font-semibold text-[var(--red)]" role="alert">{formError}</p>}
        <button type="button" className={`${btnGold} mt-4 w-full py-3 text-lg`} disabled={createMut.isPending} onClick={submit}>
          {createMut.isPending ? "Memproses…" : "Buat Booking"}
        </button>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-3xl tracking-wide">Cek Booking Saya</h2>
        <p className="mt-1 text-sm text-[var(--dim)]">Masukkan nomor HP yang dipakai saat booking.</p>
        <div className="mt-3 flex gap-2">
          <input className={inputCls} {...FIELDS.findBookingsByPhone.phone} value={lookupPhone} onChange={(e) => setLookupPhone(e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" aria-label="Nomor HP untuk cek booking" />
          <button type="button" className={btnGhost} disabled={lookupPhone.trim().length < 8 || lookupMut.isPending} onClick={() => lookupMut.mutate()}>
            Cek
          </button>
        </div>
        {lookup && lookup.length === 0 && <p className="mt-3 text-sm text-[var(--dim)]">Tidak ada booking dengan nomor ini.</p>}
        {lookup && lookup.length > 0 && (
          <div className="mt-3 grid gap-3">
            {lookup.map((b) => (
              <BookingCard key={b.id} booking={b} settings={data.settings} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PromoView({
  promos,
  goBooking,
}: {
  promos: Promo[];
  goBooking: (opts?: { promoCode?: string }) => void;
}) {
  return (
    <div className="py-5">
      <h1 className="font-display text-4xl tracking-wide">Promo & Voucher</h1>
      <p className="mt-1 text-sm text-[var(--dim)]">Semua promo yang sedang aktif. Masukkan kodenya saat booking dan harga langsung terpotong.</p>
      {promos.length === 0 && <p className="mt-6 text-[var(--dim)]">Belum ada promo aktif saat ini. Cek lagi nanti ya.</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {promos.map((p) => (
          <PromoCard key={p.id} promo={p} goBooking={goBooking} />
        ))}
      </div>
    </div>
  );
}

function GalleryView({ data }: { data: Bootstrap }) {
  const [filter, setFilter] = useState<string>("Semua");
  const tags = ["Semua", ...new Set(data.gallery.map((g) => g.styleTag).filter(Boolean))];
  const items = filter === "Semua" ? data.gallery : data.gallery.filter((g) => g.styleTag === filter);
  return (
    <div className="py-5">
      <h1 className="font-display text-4xl tracking-wide">Galeri Hasil Potongan</h1>
      <p className="mt-1 text-sm text-[var(--dim)]">Referensi gaya untuk kunjunganmu berikutnya — tunjukkan foto ini ke kapster.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter gaya">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={filter === t}
            onClick={() => setFilter(t)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
              filter === t ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-dark)]" : "border-[var(--border)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((g) => (
          <figure key={g.id} className="relative overflow-hidden rounded-[var(--radius)]">
            {photoSrc(g) ? (
              <img src={photoSrc(g) ?? ""} alt={g.title} className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-[var(--surface2)] font-display text-3xl text-[var(--accent)]">✂</div>
            )}
            <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 px-2.5 py-1.5 text-sm font-semibold text-[#f3ead8]">
              {g.title}
              {g.styleTag && <span className="block text-xs font-normal text-[#f0e7cf]">{g.styleTag}</span>}
            </figcaption>
          </figure>
        ))}
        {items.length === 0 && <p className="text-sm text-[var(--dim)]">Belum ada foto untuk gaya ini.</p>}
      </div>
    </div>
  );
}

function CustomerPhotosView({ data }: { data: Bootstrap }) {
  return (
    <div className="py-5">
      <h1 className="font-display text-4xl tracking-wide">Foto Pelanggan</h1>
      <p className="mt-1 text-sm text-[var(--dim)]">Hasil potongan asli pelanggan BARBERBOYS — lengkap dengan nama dan gaya rambutnya.</p>
      {data.customerPhotos.length === 0 ? (
        <p className="mt-6 text-[var(--dim)]">Belum ada foto pelanggan. Foto hasil potongan pelanggan akan tampil di sini.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.customerPhotos.map((p) => (
            <figure key={p.id} className="relative overflow-hidden rounded-[var(--radius)]">
              <img
                src={p.imageUrl}
                alt={`Foto ${p.customerName}${p.style ? `, gaya ${p.style}` : ""}`}
                className="aspect-square w-full object-cover"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 px-2.5 py-1.5 text-sm font-semibold text-[#f3ead8]">
                {p.customerName}
                {p.style && <span className="block text-xs font-normal text-[#f0e7cf]">{p.style}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewsView({ data, member }: { data: Bootstrap; member: Member | null }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(member?.name ?? "");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [barberId, setBarberId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const createMut = useMutation({
    mutationFn: async () =>
      await api.createReview({
        customerName: name.trim(),
        rating,
        comment: comment.trim() || undefined,
        barberId: barberId ? Number(barberId) : null,
      }),
    onSuccess: () => {
      setThanks(true);
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Ulasan gagal dikirim."),
  });
  return (
    <div className="py-5">
      <h1 className="font-display text-4xl tracking-wide">Ulasan Pelanggan</h1>
      {data.stats.reviewCount > 0 ? (
        <p className="mt-1 text-sm text-[var(--dim)]">
          <Stars value={data.stats.avgRating} /> Rating rata-rata {data.stats.avgRating.toFixed(1)} dari {data.stats.reviewCount} ulasan
        </p>
      ) : (
        <p className="mt-1 text-sm text-[var(--dim)]">Jadilah yang pertama memberi ulasan.</p>
      )}

      <form
        className={`${cardCls} mt-5`}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (name.trim().length < 2) return setError("Isi nama kamu dulu ya.");
          createMut.mutate();
        }}
      >
        <h2 className="font-display text-2xl tracking-wide">Tulis Ulasan</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="rv-name">Nama</label>
            <input id="rv-name" className={inputCls} {...FIELDS.createReview.customerName} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu" />
          </div>
          <div>
            <label className={labelCls} htmlFor="rv-barber">Kapster (opsional)</label>
            <select id="rv-barber" className={inputCls} value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              <option value="">— Semua / tidak spesifik —</option>
              {data.barbers.filter((b) => b.active).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <span className={labelCls}>Rating</span>
          <div className="flex gap-1" role="radiogroup" aria-label="Pilih rating">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={rating === i}
                aria-label={`${i} bintang`}
                onClick={() => setRating(i)}
                className={`text-3xl leading-none ${i <= rating ? "text-[var(--accent)]" : "text-[var(--dim)] opacity-40"}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <label className={labelCls} htmlFor="rv-comment">Ulasan kamu</label>
          <textarea id="rv-comment" className={inputCls} {...FIELDS.createReview.comment} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ceritakan pengalamanmu…" />
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-[var(--red)]" role="alert">{error}</p>}
        {thanks && <p className="mt-2 text-sm font-semibold text-[var(--green)]">Terima kasih! Ulasanmu sudah tampil di bawah.</p>}
        <button type="submit" className={`${btnGold} mt-3`} disabled={createMut.isPending}>
          Kirim Ulasan
        </button>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
    </div>
  );
}

function MemberView({
  member,
  profile,
  isLoading,
  settings,
  onLogin,
  onLogout,
  goBooking,
}: {
  member: Member | null;
  profile: { member: Member; bookings: Booking[] } | null;
  isLoading: boolean;
  settings: Record<string, string>;
  onLogin: (m: Member) => void;
  onLogout: () => void;
  goBooking: () => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "daftar">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMut = useMutation({
    mutationFn: () => api.loginMember({ phone: phone.trim(), pin }),
    onSuccess: (res) => {
      onLogin(res.member);
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Login gagal."),
  });
  const registerMut = useMutation({
    mutationFn: () => api.registerMember({ name: name.trim(), phone: phone.trim(), pin }),
    onSuccess: (res) => {
      onLogin(res.member);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Pendaftaran gagal."),
  });

  const [voucherError, setVoucherError] = useState<string | null>(null);
  const voucherQ = useQuery({
    queryKey: ["member-vouchers", member?.id],
    queryFn: () => api.getMemberVouchers({ memberId: member?.id ?? 0 }),
    enabled: member != null,
  });
  const redeemMut = useMutation({
    mutationFn: (voucherId: number) => api.requestVoucherRedemption({ memberId: member?.id ?? 0, voucherId }),
    onSuccess: () => {
      setVoucherError(null);
      queryClient.invalidateQueries({ queryKey: ["member-vouchers"] });
    },
    onError: (e) => setVoucherError(e instanceof Error ? e.message : "Permintaan penukaran gagal dikirim."),
  });
  const vouchers = voucherQ.data?.vouchers ?? [];
  const target = stampsTarget(settings);

  if (isLoading) return <p className="py-16 text-center text-[var(--dim)]">Memuat profil member…</p>;

  if (!member) {
    return (
      <div className="py-5">
        <h1 className="font-display text-4xl tracking-wide">Member & Loyalitas</h1>
        <p className="mt-1 max-w-lg text-base text-[var(--dim)]">
          Kumpulkan <strong className="text-[var(--text)]">1 stempel</strong> setiap selesai potong rambut. Setelah{" "}
          <strong className="text-[var(--text)]">{target} stempel</strong>, kamu dapat <strong className="text-[var(--text)]">voucher 1x potong rambut GRATIS</strong>{" "}
          yang bisa diunduh sebagai gambar PNG dan ditukar langsung di barber dengan menunjukkannya ke admin. Di halaman ini kamu bisa melihat stempel yang sudah terkumpul dan kurang berapa kali potong lagi menuju gratis.
        </p>
        <div className="mt-4 flex gap-2" role="tablist" aria-label="Login atau daftar member">
          <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")} className={mode === "login" ? btnGold : btnGhost}>
            Login
          </button>
          <button type="button" role="tab" aria-selected={mode === "daftar"} onClick={() => setMode("daftar")} className={mode === "daftar" ? btnGold : btnGhost}>
            Daftar Baru
          </button>
        </div>
        <form
          className={`${cardCls} mt-4 max-w-md`}
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (mode === "daftar" && name.trim().length < 2) return setError("Isi nama kamu (minimal 2 huruf).");
            if (phone.trim().length < 8) return setError("Isi nomor HP yang benar.");
            if (!/^\d{4,6}$/.test(pin)) return setError("PIN harus 4–6 digit angka.");
            if (mode === "login") loginMut.mutate();
            else registerMut.mutate();
          }}
        >
          {mode === "daftar" && (
            <div className="mb-3">
              <label className={labelCls} htmlFor="mb-name">Nama Lengkap</label>
              <input id="mb-name" className={inputCls} {...FIELDS.registerMember.name} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu" autoComplete="name" />
            </div>
          )}
          <div className="mb-3">
            <label className={labelCls} htmlFor="mb-phone">Nomor HP</label>
            <input id="mb-phone" className={inputCls} {...FIELDS.loginMember.phone} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" autoComplete="tel" />
          </div>
          <div>
            <label className={labelCls} htmlFor="mb-pin">PIN (4–6 digit)</label>
            <input id="mb-pin" className={inputCls} {...FIELDS.loginMember.pin} type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" inputMode="numeric" autoComplete="current-password" />
          </div>
          {error && <p className="mt-3 text-sm font-semibold text-[var(--red)]" role="alert">{error}</p>}
          <button type="submit" className={`${btnGold} mt-4 w-full`} disabled={loginMut.isPending || registerMut.isPending}>
            {mode === "login" ? "Login Member" : "Daftar Jadi Member"}
          </button>
          <p className="mt-2 text-xs text-[var(--dim)]">Ingat PIN kamu ya — PIN dipakai untuk login di perangkat mana pun.</p>
        </form>
      </div>
    );
  }

  const stamps = member.stamps;
  return (
    <div className="py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-wide">Halo, {member.name.split(" ")[0]}!</h1>
          <p className="mt-1 text-base text-[var(--dim)]">
            Member sejak {new Date(member.createdAt).toLocaleDateString("id-ID", { month: "long", year: "numeric" })} • {member.phone} • Total kunjungan selesai: {member.totalVisits}x
          </p>
        </div>
        <button type="button" className={btnGhost} onClick={onLogout}>
          Keluar
        </button>
      </div>

      <section className="mt-5 rounded-[var(--radius)] border-2 border-[var(--accent)] bg-[var(--surface)] p-5 shadow-[0_2px_6px_rgba(33,26,16,0.10)]">
        <h2 className="font-display text-3xl tracking-wide">Kartu Stempel Kamu</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius)] border-2 border-[var(--border)] bg-[var(--surface2)] p-3 text-center">
            <p className="font-display text-4xl text-[var(--accent)]">{stamps} / {target}</p>
            <p className="text-sm font-bold uppercase tracking-wide text-[var(--dim)]">Stempel Terkumpul</p>
          </div>
          <div className="rounded-[var(--radius)] border-2 border-[var(--border)] bg-[var(--surface2)] p-3 text-center">
            {member.freeCuts > 0 ? (
              <>
                <p className="font-display text-4xl text-[var(--green)]">{member.freeCuts}x</p>
                <p className="text-sm font-bold uppercase tracking-wide text-[var(--dim)]">Potong Gratis Tersedia</p>
              </>
            ) : (
              <>
                <p className="font-display text-4xl text-[var(--text)]">{target - stamps}x lagi</p>
                <p className="text-sm font-bold uppercase tracking-wide text-[var(--dim)]">Kurang Potong untuk Gratis</p>
              </>
            )}
          </div>
        </div>
        <div
          className="mt-4 h-4 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface2)]"
          role="progressbar"
          aria-valuenow={stamps}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-label={`Kemajuan stempel: ${stamps} dari ${target}`}
        >
          <div className="h-full bg-[var(--accent)]" style={{ width: `${(stamps / target) * 100}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-10 gap-1.5" role="img" aria-label={`${stamps} dari ${target} stempel terkumpul`}>
          {Array.from({ length: target }, (_, i) => (
            <div
              key={i}
              className={`flex aspect-square items-center justify-center rounded-full border-2 text-lg ${
                i < stamps
                  ? "border-[var(--accent)] bg-[var(--accent)] font-bold text-[var(--accent-dark)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
              }`}
            >
              ✂
            </div>
          ))}
        </div>
        {member.freeCuts > 0 ? (
          <div className="mt-4 rounded-[var(--radius)] bg-[#3e6b1e] px-4 py-3 text-white">
            <p className="font-display text-2xl tracking-wide">Kamu punya {member.freeCuts}x POTONG GRATIS!</p>
            <p className="text-base">
              Unduh voucher PNG-nya di bagian "Voucher Potong Gratis Saya" di bawah, lalu tunjukkan gambar vouchernya ke admin saat datang
              untuk ditukar — atau centang "Pakai potong gratis" saat booking. Setelah voucher dipakai, stempel direset ulang dari 0.
            </p>
            <button type="button" className="mt-2 rounded-[var(--radius)] bg-white px-4 py-2 font-bold text-[#2c4a12]" onClick={goBooking}>
              Booking & Pakai Gratis
            </button>
          </div>
        ) : (
          <p className="mt-4 rounded-[var(--radius)] border-2 border-dashed border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-base">
            Kamu sudah mengumpulkan <strong>{stamps} stempel</strong>. Kurang <strong>{target - stamps}x potong lagi</strong> untuk mendapatkan{" "}
            <strong>1x potong rambut GRATIS</strong>. Setiap booking yang selesai otomatis menambah 1 stempel.
          </p>
        )}
      </section>

      {vouchers.length > 0 && (
        <>
          <SectionTitle title="Voucher Potong Gratis Saya" />
          <p className="-mt-2 mb-3 max-w-2xl text-sm text-[var(--dim)]">
            Voucher ini hadiah dari {target} stempel yang sudah kamu kumpulkan. Unduh gambarnya, datang ke BARBERBOYS, lalu tunjukkan vouchernya ke
            admin — admin menyetujui penukarannya di aplikasi. Setelah voucher dipakai, stempelmu direset ulang dari 0.
          </p>
          {voucherError && (
            <p className="mb-3 text-sm font-semibold text-[var(--red)]" role="alert">{voucherError}</p>
          )}
          <div className="grid gap-3">
            {vouchers.map((v) => (
              <article key={v.id} className={cardCls}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xl font-bold tracking-wider">{v.code}</p>
                    <p className="text-sm text-[var(--dim)]">
                      1x potong rambut GRATIS • Didapat{" "}
                      {new Date(v.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      {v.redeemedAt
                        ? ` • Dipakai ${new Date(v.redeemedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
                        : ""}
                    </p>
                  </div>
                  <Badge tone={voucherTone(v.status)}>{VOUCHER_STATUS_LABEL[v.status] ?? v.status}</Badge>
                </div>
                {v.status === "aktif" && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={btnGold}
                        onClick={() => void downloadVoucherPng(v, target)}
                        aria-label={`Unduh voucher potong gratis PNG dengan kode ${v.code}`}
                      >
                        Unduh Voucher (PNG)
                      </button>
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={redeemMut.isPending}
                        onClick={() => redeemMut.mutate(v.id)}
                        aria-label={`Minta persetujuan admin untuk menukar voucher ${v.code}`}
                      >
                        Saya di Barber — Minta Persetujuan Admin
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-[var(--dim)]">
                      Tunjukkan gambar voucher ini ke admin saat datang. Kamu juga bisa menekan tombol minta persetujuan supaya admin
                      langsung menyetujuinya di aplikasi.
                    </p>
                  </>
                )}
                {v.status === "menunggu_persetujuan" && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={btnGold}
                        onClick={() => void downloadVoucherPng(v, target)}
                        aria-label={`Unduh voucher potong gratis PNG dengan kode ${v.code}`}
                      >
                        Unduh Voucher (PNG)
                      </button>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--accent)]">
                      Permintaan penukaran terkirim — tunjukkan voucher ini ke admin, admin sedang menyetujuinya di aplikasi.
                    </p>
                  </>
                )}
                {v.status === "terpakai" && (
                  <p className="mt-2 text-sm text-[var(--dim)]">Voucher ini sudah ditukar dengan 1x potong gratis. Stempelmu sudah direset ulang dari 0.</p>
                )}
                {v.status === "dibatalkan" && (
                  <p className="mt-2 text-sm text-[var(--dim)]">Voucher ini sudah dibatalkan admin.</p>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      <SectionTitle title="Riwayat Booking Saya" />
      {profile && profile.bookings.length === 0 && (
        <p className="text-sm text-[var(--dim)]">Belum ada booking dengan akun member ini. Booking saat login member agar tercatat dan dapat stempel.</p>
      )}
      <div className="grid gap-3">
        {(profile?.bookings ?? []).map((b) => (
          <BookingCard key={b.id} booking={b} settings={settings} />
        ))}
      </div>
      <button type="button" className={`${btnGold} mt-5`} onClick={goBooking}>
        Booking Sekarang
      </button>
    </div>
  );
}

type AdminTab = "ringkasan" | "booking" | "keuangan" | "layanan" | "kapster" | "member" | "voucher" | "galeri" | "foto" | "promo" | "pengaturan" | "supabase";

function AdminView({ data }: { data: Bootstrap }) {
  const [unlocked, setUnlocked] = useState(() => safeStorageGet("session", "bb_admin") === "1");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [atab, setAtab] = useState<AdminTab>("ringkasan");
  const pendingQ = usePendingCounts();
  const pinMut = useMutation({
    mutationFn: () => api.verifyAdminPin({ pin }),
    onSuccess: (res) => {
      if (res.ok) {
        safeStorageSet("session", "bb_admin", "1");
        setUnlocked(true);
        setPinError(null);
      } else {
        setPinError("PIN admin salah.");
      }
    },
    onError: (e) => setPinError(e instanceof Error ? e.message : "Tidak bisa memeriksa PIN."),
  });

  if (!unlocked) {
    return (
      <div className="py-10">
        <form
          className={`${cardCls} mx-auto max-w-sm text-center`}
          onSubmit={(e) => {
            e.preventDefault();
            if (!pin) return setPinError("Masukkan PIN admin dulu.");
            pinMut.mutate();
          }}
        >
          <p className="font-display text-4xl tracking-wide">Dashboard Admin</p>
          <p className="mt-1 text-sm text-[var(--dim)]">Cukup masukkan PIN admin — tanpa email dan password.</p>
          <label className="sr-only" htmlFor="admin-pin">PIN Admin</label>
          <input
            id="admin-pin"
            type="password"
            className={`${inputCls} mt-4 text-center text-2xl tracking-[0.3em]`}
            {...FIELDS.verifyAdminPin.pin}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN Admin"
            autoComplete="current-password"
          />
          {pinError && <p className="mt-2 text-sm font-semibold text-[var(--red)]" role="alert">{pinError}</p>}
          <button type="submit" className={`${btnGold} mt-4 w-full`} disabled={pinMut.isPending}>
            {pinMut.isPending ? "Memeriksa…" : "Masuk Dashboard"}
          </button>
        </form>
      </div>
    );
  }

  const bookingBadge = pendingBookingTotal(pendingQ.data);
  const voucherBadge = pendingQ.data?.voucherRequests ?? 0;
  const tabs: Array<{ key: AdminTab; label: string; badge?: number; badgeLabel?: string }> = [
    { key: "ringkasan", label: "Ringkasan", badge: pendingTotal(pendingQ.data), badgeLabel: "hal menunggu tindakan admin" },
    { key: "booking", label: "Booking", badge: bookingBadge, badgeLabel: "booking menunggu tindakan admin" },
    { key: "keuangan", label: "Keuangan" },
    { key: "layanan", label: "Layanan" },
    { key: "kapster", label: "Kapster" },
    { key: "member", label: "Member" },
    { key: "voucher", label: "Voucher Gratis", badge: voucherBadge, badgeLabel: "permintaan penukaran voucher menunggu persetujuan" },
    { key: "galeri", label: "Galeri" },
    { key: "foto", label: "Foto Pelanggan" },
    { key: "promo", label: "Promo" },
    { key: "pengaturan", label: "Pengaturan" },
    { key: "supabase", label: "Supabase" },
  ];

  return (
    <div className="py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl tracking-wide">Dashboard Admin</h1>
        <button
          type="button"
          className={btnGhost}
          onClick={() => {
            safeStorageRemove("session", "bb_admin");
            setUnlocked(false);
          }}
        >
          Kunci Dashboard
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Menu admin">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={atab === t.key}
            aria-label={t.badge ? `${t.label} — ${t.badge} ${t.badgeLabel ?? "menunggu tindakan"}` : undefined}
            onClick={() => setAtab(t.key)}
            className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${
              atab === t.key ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-dark)]" : "border-[var(--border)]"
            }`}
          >
            {t.label}
            {t.badge != null && <NotifBadge count={t.badge} label={`${t.badge} ${t.badgeLabel ?? "menunggu tindakan"}`} />}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {atab === "ringkasan" && <AdminSummary data={data} goTab={setAtab} />}
        {atab === "booking" && <AdminBookings data={data} />}
        {atab === "keuangan" && <AdminFinance data={data} />}
        {atab === "layanan" && <AdminServices data={data} />}
        {atab === "kapster" && <AdminBarbers data={data} />}
        {atab === "member" && <AdminMembers data={data} />}
        {atab === "voucher" && <AdminVouchers data={data} />}
        {atab === "galeri" && <AdminGallery data={data} />}
        {atab === "foto" && <AdminCustomerPhotos data={data} />}
        {atab === "promo" && <AdminPromos />}
        {atab === "pengaturan" && <AdminSettings data={data} />}
        {atab === "supabase" && <AdminSupabase />}
      </div>
    </div>
  );
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["bootstrap"] });
    qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    qc.invalidateQueries({ queryKey: ["finance"] });
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
    qc.invalidateQueries({ queryKey: ["admin-members"] });
    qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    qc.invalidateQueries({ queryKey: ["admin-pending"] });
    qc.invalidateQueries({ queryKey: ["supabase-status"] });
    qc.invalidateQueries({ queryKey: ["member-profile"] });
    qc.invalidateQueries({ queryKey: ["member-vouchers"] });
  };
}

type BookingStatus = "menunggu" | "dikonfirmasi" | "selesai" | "dibatalkan" | "menunggu_pembatalan";
type PayStatus = "belum_bayar" | "menunggu_verifikasi" | "lunas";

function BookingRowAdmin({ booking }: { booking: Booking }) {
  const invalidate = useInvalidate();
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: async (patch: { status?: BookingStatus; paymentStatus?: PayStatus }) =>
      await api.updateBooking({ id: booking.id, ...patch }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal mengubah booking."),
  });
  const approveCancelMut = useMutation({
    mutationFn: () => api.approveBookingCancellation({ id: booking.id }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menyetujui pembatalan."),
  });
  const rejectCancelMut = useMutation({
    mutationFn: () => api.rejectBookingCancellation({ id: booking.id }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menolak pembatalan."),
  });
  return (
    <article className={cardCls}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {booking.customerName} <span className="font-normal text-[var(--dim)]">({booking.customerPhone})</span>
            {booking.memberId != null && <Badge tone="gold"> Member</Badge>}
            {booking.freeCutUsed && <Badge tone="green"> Potong Gratis</Badge>}
          </p>
          <p className="text-sm text-[var(--dim)]">
            {booking.serviceName} • Kapster {booking.barberName}
          </p>
          <p className="text-sm">
            {fmtDate(booking.date)} • {booking.time} • <span className="font-display text-lg text-[var(--accent)]">{rp(booking.totalPrice)}</span>
            {booking.promoCode ? ` • Promo ${booking.promoCode}` : ""}
          </p>
          {booking.notes && <p className="text-sm text-[var(--dim)]">Catatan: {booking.notes}</p>}
        </div>
      </div>
      {booking.status === "menunggu_pembatalan" && (
        <div className="mt-3 rounded-[var(--radius)] border-2 border-[var(--red)] bg-[var(--surface2)] px-3 py-3">
          <p className="text-sm font-bold text-[var(--red)]">Pelanggan mengajukan pembatalan booking ini.</p>
          <p className="mt-0.5 text-sm text-[var(--dim)]">
            Setujui untuk membatalkan booking dan membebaskan slot jamnya, atau tolak supaya booking kembali ke status sebelumnya.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-[var(--radius)] bg-[var(--red)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              disabled={approveCancelMut.isPending || rejectCancelMut.isPending}
              onClick={() => approveCancelMut.mutate()}
              aria-label={`Setujui pembatalan booking ${booking.customerName}`}
            >
              Setujui Pembatalan
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={approveCancelMut.isPending || rejectCancelMut.isPending}
              onClick={() => rejectCancelMut.mutate()}
              aria-label={`Tolak pembatalan booking ${booking.customerName}`}
            >
              Tolak Pembatalan
            </button>
          </div>
        </div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--dim)]" htmlFor={`st-${booking.id}`}>Status Booking</label>
          <select id={`st-${booking.id}`} className={inputCls} value={booking.status} onChange={(e) => mut.mutate({ status: e.target.value as BookingStatus })}>
            {Object.keys(STATUS_LABEL).map((k) => (
              <option key={k} value={k}>{STATUS_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--dim)]" htmlFor={`ps-${booking.id}`}>Status Bayar</label>
          <select id={`ps-${booking.id}`} className={inputCls} value={booking.paymentStatus} onChange={(e) => mut.mutate({ paymentStatus: e.target.value as PayStatus })}>
            {Object.keys(PAYSTATUS_LABEL).map((k) => (
              <option key={k} value={k}>{PAYSTATUS_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold text-[var(--dim)]">Metode Bayar</span>
          <p className="py-2 text-sm font-semibold">{PAYMENT_LABEL[booking.paymentMethod] ?? booking.paymentMethod}</p>
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--dim)]">Menandai "Selesai" pada booking member otomatis memberi 1 stempel loyalitas.</p>
      {error && <p className="mt-1 text-sm font-semibold text-[var(--red)]" role="alert">{error}</p>}
    </article>
  );
}

function AdminSummary({ data, goTab }: { data: Bootstrap; goTab: (t: AdminTab) => void }) {
  const today = todayPlus(0);
  const bookingsQ = useQuery({
    queryKey: ["admin-bookings", null, null],
    queryFn: () => api.listBookingsAdmin({}),
  });
  const financeQ = useQuery({ queryKey: ["finance", null], queryFn: () => api.getFinanceReport({}) });
  const pendingQ = usePendingCounts();
  const pending = pendingQ.data;
  const all = bookingsQ.data?.bookings ?? [];
  const todays = all.filter((b) => b.date === today && b.status !== "dibatalkan");
  const waiting = all.filter((b) => b.status === "menunggu");
  const upcoming = all
    .filter((b) => b.date >= today && b.status !== "dibatalkan" && b.status !== "selesai")
    .slice(0, 6);
  const fin = financeQ.data;
  const cards = [
    { n: String(todays.length), l: "Booking Hari Ini" },
    { n: String(waiting.length), l: "Menunggu Konfirmasi" },
    { n: fin ? rp(fin.todayTotal) : "…", l: "Pemasukan Hari Ini (Lunas)" },
    { n: fin ? rp(fin.monthTotal) : "…", l: "Pemasukan Bulan Ini (Lunas)" },
    { n: String(data.stats.reviewCount), l: `Ulasan • ★ ${data.stats.avgRating.toFixed(1)}` },
    { n: String(all.length), l: "Total Booking" },
  ];
  return (
    <div>
      {pending && pendingTotal(pending) > 0 && (
        <div className="mb-4 rounded-[var(--radius)] border-2 border-[#d92d20] bg-[var(--surface)] px-4 py-3" role="alert">
          <p className="font-display text-2xl tracking-wide text-[#b42318]">Perlu Tindakan ({pendingTotal(pending)})</p>
          <ul className="mt-1 space-y-1 text-sm font-semibold">
            {pending.newBookings > 0 && <li>• {pending.newBookings} booking baru menunggu konfirmasi</li>}
            {pending.cancelRequests > 0 && <li>• {pending.cancelRequests} permintaan pembatalan booking menunggu persetujuan</li>}
            {pending.paymentVerifications > 0 && <li>• {pending.paymentVerifications} pembayaran QRIS menunggu verifikasi</li>}
            {pending.voucherRequests > 0 && <li>• {pending.voucherRequests} permintaan penukaran voucher gratis menunggu persetujuan</li>}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingBookingTotal(pending) > 0 && (
              <button type="button" className={btnGold} onClick={() => goTab("booking")}>
                Buka Booking
                <NotifBadge count={pendingBookingTotal(pending)} label={`${pendingBookingTotal(pending)} booking menunggu tindakan admin`} />
              </button>
            )}
            {pending.voucherRequests > 0 && (
              <button type="button" className={btnGold} onClick={() => goTab("voucher")}>
                Buka Voucher Gratis
                <NotifBadge count={pending.voucherRequests} label={`${pending.voucherRequests} permintaan penukaran voucher menunggu persetujuan`} />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.l} className="rounded-[var(--radius)] border-2 border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_2px_6px_rgba(33,26,16,0.10)]">
            <p className="font-display text-2xl text-[var(--accent)] sm:text-3xl">{c.n}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">{c.l}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btnGold} onClick={() => goTab("booking")}>Kelola Booking</button>
        <button type="button" className={btnGhost} onClick={() => goTab("keuangan")}>Lihat Laporan Keuangan</button>
      </div>
      <h2 className="mb-3 mt-8 font-display text-3xl tracking-wide">Booking Terdekat</h2>
      {bookingsQ.isPending && <p className="text-sm text-[var(--dim)]">Memuat booking…</p>}
      {upcoming.length === 0 && !bookingsQ.isPending && <p className="text-sm text-[var(--dim)]">Belum ada booking mendatang.</p>}
      <div className="grid gap-3">
        {upcoming.map((b) => (
          <BookingRowAdmin key={b.id} booking={b} />
        ))}
      </div>
    </div>
  );
}

function AdminBookings({ data: _data }: { data: Bootstrap }) {
  void _data;
  const [dateFilter, setDateFilter] = useState<string>("");
  const q = useQuery({
    queryKey: ["admin-bookings", null, dateFilter],
    queryFn: () => api.listBookingsAdmin({ date: dateFilter || null }),
  });
  return (
    <div>
      <div className="max-w-xs">
        <label className={labelCls} htmlFor="ab-date">Filter Tanggal</label>
        <input id="ab-date" type="date" className={inputCls} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
      </div>
      {q.isPending && <p className="mt-4 text-sm text-[var(--dim)]">Memuat booking…</p>}
      {q.data && q.data.bookings.filter((b) => b.status === "menunggu_pembatalan").length > 0 && (
        <p className="mt-4 rounded-[var(--radius)] border-2 border-[var(--red)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--red)]" role="alert">
          Ada {q.data.bookings.filter((b) => b.status === "menunggu_pembatalan").length} permintaan pembatalan booking menunggu persetujuanmu —
          setujui atau tolak pada kartu bookingnya di bawah.
        </p>
      )}
      {q.data && q.data.bookings.length === 0 && <p className="mt-4 text-sm text-[var(--dim)]">Tidak ada booking untuk filter ini.</p>}
      <div className="mt-4 grid gap-3">
        {(q.data?.bookings ?? []).map((b) => (
          <BookingRowAdmin key={b.id} booking={b} />
        ))}
      </div>
    </div>
  );
}

function BreakdownList({ title, rows }: { title: string; rows: Array<{ name: string; total: number; count: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className={cardCls}>
      <h3 className="font-display text-2xl tracking-wide">{title}</h3>
      {rows.length === 0 && <p className="mt-2 text-sm text-[var(--dim)]">Belum ada pemasukan lunas.</p>}
      <ul className="mt-2 space-y-3">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">{r.name}</span>
              <span className="text-[var(--dim)]">{r.count}x • <span className="font-semibold text-[var(--text)]">{rp(r.total)}</span></span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface2)]">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.round((r.total / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminFinance({ data: _data }: { data: Bootstrap }) {
  void _data;
  const q = useQuery({
    queryKey: ["finance", null],
    queryFn: () => api.getFinanceReport({}),
  });
  const fin = q.data;
  const chartDaily = (fin?.daily ?? []).map((d) => ({ name: fmtDateShort(d.date), total: d.total }));
  const monthName = (m: string) => {
    const [y = "", mo = "1"] = m.split("-");
    return `${MONTHS[Number(mo) - 1]?.slice(0, 3) ?? mo} ${y.slice(2)}`;
  };
  const chartMonthly = (fin?.monthly ?? []).map((d) => ({ name: monthName(d.month), total: d.total }));
  const chartStyle = {
    backgroundColor: "#ffffff",
    border: "2px solid #b3a37f",
    color: "#211a10",
  } as const;
  return (
    <div>
      {q.isPending && <p className="mt-4 text-sm text-[var(--dim)]">Menghitung laporan…</p>}
      {fin && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { n: rp(fin.todayTotal), l: "Hari Ini" },
              { n: rp(fin.weekTotal), l: "Minggu Ini" },
              { n: rp(fin.monthTotal), l: "Bulan Ini" },
              { n: rp(fin.allTimeTotal), l: `Total • ${fin.paidCount} transaksi lunas` },
            ].map((c) => (
              <div key={c.l} className="rounded-[var(--radius)] border-2 border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_2px_6px_rgba(33,26,16,0.10)]">
                <p className="font-display text-2xl text-[var(--accent)]">{c.n}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">{c.l}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--dim)]">Laporan dihitung dari booking yang status bayarnya "Lunas" dan tidak dibatalkan, berdasarkan tanggal booking.</p>

          <div className={`${cardCls} mt-4`}>
            <h3 className="font-display text-2xl tracking-wide">Pemasukan 14 Hari Terakhir</h3>
            <div className="mt-3 h-56" role="img" aria-label="Grafik batang pemasukan harian 14 hari terakhir">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDaily} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="#ddd2b8" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#57503f", fontSize: 11 }} axisLine={{ stroke: "#b3a37f" }} tickLine={false} interval={1} />
                  <YAxis tick={{ fill: "#57503f", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}rb`} width={44} />
                  <Tooltip contentStyle={chartStyle} formatter={(v) => [rp(Number(v ?? 0)), "Pemasukan"]} labelStyle={{ color: "#211a10" }} />
                  <Bar dataKey="total" fill="#8a6a14" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${cardCls} mt-4`}>
            <h3 className="font-display text-2xl tracking-wide">Pemasukan 6 Bulan Terakhir</h3>
            <div className="mt-3 h-48" role="img" aria-label="Grafik batang pemasukan bulanan 6 bulan terakhir">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartMonthly} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="#ddd2b8" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#57503f", fontSize: 11 }} axisLine={{ stroke: "#b3a37f" }} tickLine={false} />
                  <YAxis tick={{ fill: "#57503f", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}rb`} width={44} />
                  <Tooltip contentStyle={chartStyle} formatter={(v) => [rp(Number(v ?? 0)), "Pemasukan"]} labelStyle={{ color: "#211a10" }} />
                  <Bar dataKey="total" fill="#b5891a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <BreakdownList title="Per Layanan" rows={fin.byService} />
            <BreakdownList title="Per Kapster" rows={fin.byBarber} />
          </div>
        </>
      )}
    </div>
  );
}

function FormShell({
  title,
  children,
  onSubmit,
  submitLabel,
  pending,
  error,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
  error: string | null;
}) {
  return (
    <form
      className={cardCls}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h3 className="font-display text-2xl tracking-wide">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
      {error && <p className="mt-3 text-sm font-semibold text-[var(--red)]" role="alert">{error}</p>}
      <button type="submit" className={`${btnGold} mt-4`} disabled={pending}>
        {pending ? "Menyimpan…" : submitLabel}
      </button>
    </form>
  );
}

function AdminServices({ data }: { data: Bootstrap }) {
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Service | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [branchId, setBranchId] = useState<number>(data.branches[0]?.id ?? 0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("50000");
  const [duration, setDuration] = useState("45");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (sv: Service | null) => {
    setEditing(sv);
    setBranchId(sv?.branchId ?? data.branches[0]?.id ?? 0);
    setName(sv?.name ?? "");
    setDescription(sv?.description ?? "");
    setPrice(String(sv?.price ?? 50000));
    setDuration(String(sv?.durationMin ?? 45));
    setActive(sv?.active ?? true);
    setError(null);
    setFormKey((k) => k + 1);
  };
  const saveMut = useMutation({
    mutationFn: async () =>
      await api.saveService({ id: editing?.id ?? null, branchId, name: name.trim(), description: description.trim(), price: Number(price), durationMin: Number(duration), active, sortOrder: editing?.sortOrder ?? 0 }),
    onSuccess: () => {
      invalidate();
      startEdit(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menyimpan layanan."),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => api.deleteService({ id }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menghapus layanan."),
  });
  return (
    <div>
      {data.branches.slice(0, 1).map((b) => (
        <div key={b.id} className="mb-5">
          <h3 className="mb-2 font-display text-2xl tracking-wide">Semua Layanan</h3>
          <div className="grid gap-2">
            {data.services.filter((sv) => sv.branchId === b.id).map((sv) => (
              <article key={sv.id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <p className="font-semibold">
                    {sv.name} {!sv.active && <Badge tone="red">Nonaktif</Badge>}{" "}
                    <span className="font-display text-xl text-[var(--accent)]">{rp(sv.price)}</span>
                  </p>
                  <p className="text-sm text-[var(--dim)]">{sv.description} • ±{sv.durationMin} menit</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={btnGhost} onClick={() => startEdit(sv)}>Ubah</button>
                  <button type="button" className={btnGhost} disabled={delMut.isPending} onClick={() => delMut.mutate(sv.id)}>Hapus</button>
                </div>
              </article>
            ))}
            {data.services.filter((sv) => sv.branchId === b.id).length === 0 && <p className="text-sm text-[var(--dim)]">Belum ada layanan.</p>}
          </div>
        </div>
      ))}
      <div key={formKey}>
        <FormShell
          title={editing ? `Ubah ${editing.name}` : "Tambah Layanan Baru"}
          submitLabel={editing ? "Simpan Perubahan" : "Tambah Layanan"}
          pending={saveMut.isPending}
          error={error}
          onSubmit={() => {
            if (name.trim().length < 2) return setError("Nama layanan minimal 2 huruf.");
            if (!branchId) return setError("Data lokasi belum tersedia.");
            if (Number(price) < 0 || Number.isNaN(Number(price))) return setError("Harga tidak valid.");
            saveMut.mutate();
          }}
        >
          <div>
            <label className={labelCls} htmlFor="sv-name">Nama Layanan</label>
            <input id="sv-name" className={inputCls} {...FIELDS.saveService.name} value={name} onChange={(e) => setName(e.target.value)} placeholder="Potong Rambut Dewasa" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="sv-desc">Deskripsi</label>
            <input id="sv-desc" className={inputCls} {...FIELDS.saveService.description} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Termasuk cuci dan styling" />
          </div>
          <div>
            <label className={labelCls} htmlFor="sv-price">Harga (Rp)</label>
            <input id="sv-price" type="number" className={inputCls} {...FIELDS.saveService.price} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <label className={labelCls} htmlFor="sv-duration">Durasi (menit)</label>
            <input id="sv-duration" type="number" className={inputCls} {...FIELDS.saveService.durationMin} value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-[#8a6a14]" /> Layanan aktif
          </label>
        </FormShell>
      </div>
    </div>
  );
}

function AdminBarbers({ data }: { data: Bootstrap }) {
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Barber | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [branchId, setBranchId] = useState<number>(data.branches[0]?.id ?? 0);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [exp, setExp] = useState("3");
  const [photo, setPhoto] = useState("barber1");
  const [upload, setUpload] = useState<PhotoData | null>(null);
  const [useBuiltin, setUseBuiltin] = useState(false);
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("21:00");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (b: Barber | null) => {
    setEditing(b);
    setBranchId(b?.branchId ?? data.branches[0]?.id ?? 0);
    setName(b?.name ?? "");
    setSpecialty(b?.specialty ?? "");
    setBio(b?.bio ?? "");
    setExp(String(b?.experienceYears ?? 3));
    setPhoto(b?.photoAsset || "barber1");
    setUpload(null);
    setUseBuiltin(false);
    setWorkDays(b?.workDays ?? [1, 2, 3, 4, 5, 6]);
    setStartTime(b?.startTime ?? "09:00");
    setEndTime(b?.endTime ?? "21:00");
    setActive(b?.active ?? true);
    setError(null);
    setFormKey((k) => k + 1);
  };
  const saveMut = useMutation({
    mutationFn: async () =>
      await api.saveBarber({
        id: editing?.id ?? null,
        branchId,
        name: name.trim(),
        specialty: specialty.trim(),
        bio: bio.trim(),
        experienceYears: Number(exp),
        photoAsset: photo,
        photo: upload ? { dataBase64: upload.dataBase64, mimeType: upload.mimeType } : undefined,
        clearUploadedPhoto: useBuiltin && editing?.photoUrl ? true : undefined,
        workDays,
        startTime,
        endTime,
        active,
        sortOrder: editing?.sortOrder ?? 0,
      }),
    onSuccess: () => {
      invalidate();
      startEdit(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menyimpan kapster."),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => api.deleteBarber({ id }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menghapus kapster."),
  });
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div>
      {data.branches.slice(0, 1).map((br) => (
        <div key={br.id} className="mb-5">
          <h3 className="mb-2 font-display text-2xl tracking-wide">Semua Kapster</h3>
          <div className="grid gap-2">
            {data.barbers.filter((b) => b.branchId === br.id).map((b) => (
              <article key={b.id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3`}>
                <div className="flex items-center gap-3">
                  {barberPhotoSrc(b) && <img src={barberPhotoSrc(b) ?? ""} alt="" className="h-14 w-12 rounded-[var(--radius)] object-cover" />}
                  <div>
                    <p className="font-semibold">{b.name} {!b.active && <Badge tone="red">Nonaktif</Badge>}</p>
                    <p className="text-sm text-[var(--dim)]">
                      {b.specialty} • {workDaysLabel(b)} • {b.startTime}–{b.endTime}
                      {b.reviewCount > 0 ? ` • ★ ${b.avgRating.toFixed(1)} (${b.reviewCount} ulasan)` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={btnGhost} onClick={() => startEdit(b)}>Ubah</button>
                  <button type="button" className={btnGhost} disabled={delMut.isPending} onClick={() => delMut.mutate(b.id)}>Hapus</button>
                </div>
              </article>
            ))}
            {data.barbers.filter((b) => b.branchId === br.id).length === 0 && <p className="text-sm text-[var(--dim)]">Belum ada kapster.</p>}
          </div>
        </div>
      ))}
      <div key={formKey}>
        <FormShell
          title={editing ? `Ubah ${editing.name}` : "Tambah Kapster Baru"}
          submitLabel={editing ? "Simpan Perubahan" : "Tambah Kapster"}
          pending={saveMut.isPending}
          error={error}
          onSubmit={() => {
            if (name.trim().length < 2) return setError("Nama kapster minimal 2 huruf.");
            if (!branchId) return setError("Data lokasi belum tersedia.");
            if (workDays.length === 0) return setError("Pilih minimal 1 hari kerja.");
            saveMut.mutate();
          }}
        >
          <div>
            <label className={labelCls} htmlFor="kb-name">Nama Kapster</label>
            <input id="kb-name" className={inputCls} {...FIELDS.saveBarber.name} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kapster" />
          </div>
          <div>
            <label className={labelCls} htmlFor="kb-spec">Spesialisasi</label>
            <input id="kb-spec" className={inputCls} {...FIELDS.saveBarber.specialty} value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Fade & Skin Fade" />
          </div>
          <div>
            <label className={labelCls} htmlFor="kb-exp">Pengalaman (tahun)</label>
            <input id="kb-exp" type="number" className={inputCls} {...FIELDS.saveBarber.experienceYears} value={exp} onChange={(e) => setExp(e.target.value)} inputMode="numeric" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="kb-bio">Bio Singkat</label>
            <input id="kb-bio" className={inputCls} {...FIELDS.saveBarber.bio} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Ceritakan keahlian kapster ini" />
          </div>
          <div className="sm:col-span-2">
            <span className={labelCls}>Foto Kapster</span>
            {editing?.photoUrl && !useBuiltin && !upload ? (
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <img
                  src={editing.photoUrl}
                  alt={`Foto kapster ${editing.name}`}
                  className="h-20 w-16 rounded-[var(--radius)] border-2 border-[var(--border)] object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--green)]">Foto unggahan sendiri sedang dipakai.</p>
                  <button type="button" className="mt-1 text-sm font-bold text-[var(--accent)] underline" onClick={() => setUseBuiltin(true)}>
                    Ganti ke foto bawaan
                  </button>
                </div>
              </div>
            ) : null}
            {useBuiltin && editing?.photoUrl ? (
              <p className="mb-3 text-sm text-[var(--dim)]">
                Foto bawaan di bawah akan dipakai dan foto unggahan dihapus saat disimpan.{" "}
                <button type="button" className="font-bold text-[var(--accent)] underline" onClick={() => setUseBuiltin(false)}>
                  Batalkan — tetap pakai foto unggahan
                </button>
              </p>
            ) : null}
            <PhotoUploadField
              id="kb-upload"
              label={editing?.photoUrl && !useBuiltin ? "Ganti dengan foto unggahan baru" : "Unggah foto kapster"}
              value={upload}
              onChange={setUpload}
            />
            {!upload && (!editing?.photoUrl || useBuiltin) ? (
              <div className="mt-3 max-w-xs">
                <label className={labelCls} htmlFor="kb-photo">Atau pakai foto bawaan</label>
                <select id="kb-photo" className={inputCls} value={photo} onChange={(e) => setPhoto(e.target.value)}>
                  {PHOTO_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {upload ? (
              <p className="mt-2 text-sm text-[var(--dim)]">Foto unggahan baru ini yang akan tampil setelah disimpan — di beranda, form booking, dan daftar kapster.</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="kb-start">Mulai Kerja</label>
              <input id="kb-start" type="time" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="kb-end">Selesai Kerja</label>
              <input id="kb-end" type="time" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <fieldset className="sm:col-span-2">
            <legend className={labelCls}>Hari Kerja</legend>
            <div className="flex flex-wrap gap-2">
              {dayOrder.map((d) => (
                <label key={d} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${workDays.includes(d) ? "border-[var(--accent)] bg-[var(--surface2)]" : "border-[var(--border)]"}`}>
                  <input
                    type="checkbox"
                    checked={workDays.includes(d)}
                    onChange={(e) => setWorkDays(e.target.checked ? [...workDays, d] : workDays.filter((x) => x !== d))}
                    className="h-4 w-4 accent-[#8a6a14]"
                  />
                  {DAY_NAMES[d]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-[#8a6a14]" /> Kapster aktif
          </label>
        </FormShell>
      </div>
    </div>
  );
}

function AdminMembers({ data }: { data: Bootstrap }) {
  const target = stampsTarget(data.settings);
  const invalidate = useInvalidate();
  const q = useQuery({ queryKey: ["admin-members"], queryFn: () => api.listMembersAdmin({}) });
  const [drafts, setDrafts] = useState<Record<number, { stamps: string; freeCuts: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const mut = useMutation({
    mutationFn: async (args: { memberId: number; stamps: number; freeCuts: number }) => await api.setMemberLoyalty(args),
    onSuccess: (_res, vars) => {
      setSavedId(vars.memberId);
      invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menyimpan stempel."),
  });
  const members = q.data?.members ?? [];
  const totalFreeCuts = members.reduce((sum, m) => sum + m.freeCuts, 0);
  return (
    <div>
      <p className="max-w-2xl text-base text-[var(--dim)]">
        Di sini admin melihat <strong className="text-[var(--text)]">semua akun member</strong>: berapa stempel yang sudah terkumpul dan kurang
        berapa kali potong lagi untuk mendapatkan 1x potong gratis. Stempel bertambah otomatis setiap booking member ditandai "Selesai", dan admin
        juga bisa mengoreksinya manual (stempel 0–{target - 1}). Voucher potong gratis yang didapat member dari {target} stempel dikelola di tab{" "}
        <strong className="text-[var(--text)]">Voucher Gratis</strong> — di sana admin menyetujui penukaran voucher yang ditunjukkan member di barber.
      </p>
      {q.data && members.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            { n: String(members.length), l: "Total Member" },
            { n: String(members.reduce((sum, m) => sum + m.totalVisits, 0)), l: "Total Kunjungan Selesai" },
            { n: `${totalFreeCuts}x`, l: "Potong Gratis Belum Dipakai" },
          ].map((x) => (
            <div
              key={x.l}
              className="rounded-[var(--radius)] border-2 border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_2px_6px_rgba(33,26,16,0.10)]"
            >
              <p className="font-display text-3xl text-[var(--accent)]">{x.n}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">{x.l}</p>
            </div>
          ))}
        </div>
      )}
      {q.isPending && <p className="mt-4 text-sm text-[var(--dim)]">Memuat member…</p>}
      {q.data && members.length === 0 && <p className="mt-4 text-sm text-[var(--dim)]">Belum ada member terdaftar.</p>}
      {error && <p className="mt-3 text-sm font-semibold text-[var(--red)]" role="alert">{error}</p>}
      <div className="mt-4 grid gap-3">
        {members.map((m) => {
          const draft = drafts[m.id] ?? { stamps: String(m.stamps), freeCuts: String(m.freeCuts) };
          return (
            <article key={m.id} className={cardCls}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{m.name}</p>
                  <p className="text-sm text-[var(--dim)]">
                    {m.phone} • {m.totalVisits}x kunjungan selesai • Member sejak{" "}
                    {new Date(m.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {m.freeCuts > 0 ? (
                  <Badge tone="green">{m.freeCuts}x potong gratis tersedia</Badge>
                ) : (
                  <Badge tone="dim">Kurang {target - m.stamps}x potong lagi</Badge>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-[var(--radius)] border-2 border-[var(--border)] bg-[var(--surface2)] p-3 text-center">
                  <p className="font-display text-3xl text-[var(--accent)]">{m.stamps} / {target}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">Stempel Terkumpul</p>
                </div>
                <div className="rounded-[var(--radius)] border-2 border-[var(--border)] bg-[var(--surface2)] p-3 text-center">
                  {m.freeCuts > 0 ? (
                    <>
                      <p className="font-display text-3xl text-[var(--green)]">{m.freeCuts}x gratis</p>
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">Sudah Bisa Dipakai</p>
                    </>
                  ) : (
                    <>
                      <p className="font-display text-3xl">{target - m.stamps}x lagi</p>
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">Kurang untuk 1x Gratis</p>
                    </>
                  )}
                </div>
              </div>
              <div
                className="mt-3 h-3 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface2)]"
                role="progressbar"
                aria-valuenow={m.stamps}
                aria-valuemin={0}
                aria-valuemax={target}
                aria-label={`Stempel ${m.name}: ${m.stamps} dari ${target}, kurang ${target - m.stamps} lagi`}
              >
                <div className="h-full bg-[var(--accent)]" style={{ width: `${(m.stamps / target) * 100}%` }} />
              </div>
              <p className="mt-2 text-base" aria-label={`Rincian stempel ${m.name}`}>
                {Array.from({ length: target }, (_, i) => (
                  <span key={i} className={i < m.stamps ? "font-bold text-[var(--accent)]" : "text-[var(--dim)] opacity-50"}>✂</span>
                ))}{" "}
                — sudah terkumpul <strong>{m.stamps} dari {target} stempel</strong>
                {m.freeCuts > 0
                  ? `, dan member ini punya ${m.freeCuts}x potong gratis yang belum dipakai.`
                  : `, kurang ${target - m.stamps}x potong lagi untuk dapat 1x potong gratis.`}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--dim)]" htmlFor={`ms-${m.id}`}>Stempel (0–{target - 1})</label>
                  <input
                    id={`ms-${m.id}`}
                    type="number"
                    className={inputCls}
                    {...FIELDS.setMemberLoyalty.stamps}
                    value={draft.stamps}
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: { ...draft, stamps: e.target.value } }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--dim)]" htmlFor={`mf-${m.id}`}>Potong Gratis Tersedia</label>
                  <input
                    id={`mf-${m.id}`}
                    type="number"
                    className={inputCls}
                    {...FIELDS.setMemberLoyalty.freeCuts}
                    value={draft.freeCuts}
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: { ...draft, freeCuts: e.target.value } }))}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    className={btnGold}
                    disabled={mut.isPending}
                    onClick={() => {
                      const stamps = Number(draft.stamps);
                      const freeCuts = Number(draft.freeCuts);
                      if (Number.isNaN(stamps) || stamps < 0 || stamps > target - 1) return setError(`Stempel harus 0–${target - 1} (${target} stempel otomatis jadi 1 potong gratis).`);
                      if (Number.isNaN(freeCuts) || freeCuts < 0) return setError("Potong gratis tidak valid.");
                      setError(null);
                      mut.mutate({ memberId: m.id, stamps, freeCuts });
                    }}
                  >
                    Simpan
                  </button>
                  {savedId === m.id && <span className="pb-2 text-sm font-semibold text-[var(--green)]">Tersimpan</span>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function AdminVouchers({ data }: { data: Bootstrap }) {
  const target = stampsTarget(data.settings);
  const invalidate = useInvalidate();
  const q = useQuery({ queryKey: ["admin-vouchers"], queryFn: () => api.listVouchersAdmin({}) });
  const [error, setError] = useState<string | null>(null);
  const [approvedId, setApprovedId] = useState<number | null>(null);
  const approveMut = useMutation({
    mutationFn: (voucherId: number) => api.approveVoucherRedemption({ voucherId }),
    onSuccess: (_res, voucherId) => {
      setApprovedId(voucherId);
      setError(null);
      invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Persetujuan voucher gagal."),
  });
  const rejectMut = useMutation({
    mutationFn: (voucherId: number) => api.rejectVoucherRedemption({ voucherId }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Penolakan voucher gagal."),
  });
  const vouchers = q.data?.vouchers ?? [];
  const pending = vouchers.filter((v) => v.status === "menunggu_persetujuan");
  const others = vouchers.filter((v) => v.status !== "menunggu_persetujuan");

  const renderCard = (v: Voucher, highlight: boolean) => (
    <article
      key={v.id}
      className={
        highlight
          ? "rounded-[var(--radius)] border-2 border-[var(--accent)] bg-[var(--surface)] p-4 shadow-[0_2px_6px_rgba(33,26,16,0.10)]"
          : cardCls
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">{v.memberName}</p>
          <p className="text-sm text-[var(--dim)]">
            {v.memberPhone} • {v.source === "admin" ? "Diberikan admin" : `Dari ${target} stempel`} • Didapat{" "}
            {new Date(v.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            {v.redeemedAt
              ? ` • Dipakai ${new Date(v.redeemedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
              : ""}
          </p>
        </div>
        <Badge tone={voucherTone(v.status)}>{VOUCHER_STATUS_LABEL[v.status] ?? v.status}</Badge>
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tracking-wider">{v.code}</p>
      {(v.status === "aktif" || v.status === "menunggu_persetujuan") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnGold}
            disabled={approveMut.isPending || rejectMut.isPending}
            onClick={() => approveMut.mutate(v.id)}
            aria-label={`Setujui penukaran voucher ${v.code} milik ${v.memberName}`}
          >
            Setujui & Tandai Terpakai
          </button>
          {v.status === "menunggu_persetujuan" && (
            <button
              type="button"
              className={btnGhost}
              disabled={approveMut.isPending || rejectMut.isPending}
              onClick={() => rejectMut.mutate(v.id)}
              aria-label={`Tolak permintaan penukaran voucher ${v.code} milik ${v.memberName}`}
            >
              Tolak Permintaan
            </button>
          )}
          {approvedId === v.id && <span className="text-sm font-semibold text-[var(--green)]">Disetujui</span>}
        </div>
      )}
      {(v.status === "aktif" || v.status === "menunggu_persetujuan") && (
        <p className="mt-2 text-xs text-[var(--dim)]">
          Menyetujui berarti member menukar voucher ini dengan 1x potong gratis sekarang: potong gratis member berkurang 1 dan stempelnya
          direset ulang ke 0. Pastikan kode di gambar voucher yang ditunjukkan member sama dengan kode di atas.
        </p>
      )}
      {v.status === "terpakai" && <p className="mt-2 text-sm text-[var(--dim)]">Voucher ini sudah ditukar dengan 1x potong gratis.</p>}
      {v.status === "dibatalkan" && <p className="mt-2 text-sm text-[var(--dim)]">Voucher ini sudah dibatalkan.</p>}
    </article>
  );

  return (
    <div>
      <p className="max-w-2xl text-base text-[var(--dim)]">
        Member yang mengumpulkan <strong className="text-[var(--text)]">{target} stempel</strong> otomatis mendapat voucher potong gratis yang bisa
        mereka unduh sebagai PNG. Saat member datang dan menunjukkan gambar vouchernya, cocokkan kodenya lalu{" "}
        <strong className="text-[var(--text)]">setujui penukarannya di sini</strong> — voucher langsung terpakai, potong gratis member berkurang
        1, dan stempelnya direset ulang dari 0.
      </p>
      {q.isPending && <p className="mt-4 text-sm text-[var(--dim)]">Memuat voucher…</p>}
      {error && (
        <p className="mt-3 text-sm font-semibold text-[var(--red)]" role="alert">{error}</p>
      )}
      {pending.length > 0 && (
        <>
          <h3 className="mt-5 font-display text-2xl tracking-wide">Menunggu Persetujuan Penukaran ({pending.length})</h3>
          <p className="mt-1 text-sm text-[var(--dim)]">Member di bawah ini sedang di barber dan meminta penukaran vouchernya disetujui.</p>
          <div className="mt-3 grid gap-3">{pending.map((v) => renderCard(v, true))}</div>
        </>
      )}
      <h3 className="mt-6 font-display text-2xl tracking-wide">Semua Voucher</h3>
      {q.data && vouchers.length === 0 && (
        <p className="mt-3 text-sm text-[var(--dim)]">
          Belum ada voucher potong gratis. Voucher otomatis dibuat saat member mengumpulkan {target} stempel atau saat admin menambah potong gratis
          member di tab Member.
        </p>
      )}
      <div className="mt-3 grid gap-3">{others.map((v) => renderCard(v, false))}</div>
    </div>
  );
}

type GalleryItem = Bootstrap["gallery"][number];
function AdminGallery({ data }: { data: Bootstrap }) {
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [photo, setPhoto] = useState("fade1");
  const [upload, setUpload] = useState<PhotoData | null>(null);
  const [isSlide, setIsSlide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startEdit = (g: GalleryItem | null) => {
    setEditing(g);
    setTitle(g?.title ?? "");
    setTag(g?.styleTag ?? "");
    setPhoto(g?.imageAsset ?? "fade1");
    setUpload(null);
    setIsSlide(g?.isSlide ?? false);
    setError(null);
    setFormKey((k) => k + 1);
  };
  const saveMut = useMutation({
    mutationFn: async () =>
      await api.saveGalleryItem({
        id: editing?.id ?? null,
        title: title.trim(),
        styleTag: tag.trim(),
        ...(upload
          ? { photo: { dataBase64: upload.dataBase64, mimeType: upload.mimeType } }
          : { imageAsset: photo }),
        isSlide,
        sortOrder: editing?.sortOrder ?? data.gallery.length,
      }),
    onSuccess: () => {
      invalidate();
      startEdit(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menyimpan foto."),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => api.deleteGalleryItem({ id }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menghapus foto."),
  });
  const previewSrc = upload?.previewUrl ?? (editing?.imageUrl ?? null) ?? ASSETS[photo] ?? null;
  return (
    <div>
      <p className="mb-3 text-sm text-[var(--dim)]">
        Semua foto di sini bisa diganti dengan foto hasil sendiri: pilih foto yang mau diubah, lalu unggah foto dari HP atau
        komputer. Foto yang dicentang "Slider Beranda" tampil di slider paling atas halaman beranda.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {data.gallery.map((g) => (
          <figure key={g.id} className="relative overflow-hidden rounded-[var(--radius)]">
            {photoSrc(g) && <img src={photoSrc(g) ?? ""} alt={g.title} className="aspect-square w-full object-cover" />}
            <figcaption className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5 text-xs font-semibold text-[#f3ead8]">
              {g.title} {g.styleTag ? `• ${g.styleTag}` : ""} {g.imageUrl ? "• Foto Sendiri" : ""} {g.isSlide ? "• ★ Slider Beranda" : ""}
              <span className="mt-1 flex gap-2">
                <button type="button" className="underline" onClick={() => startEdit(g)}>Ubah</button>
                <button type="button" className="underline" disabled={delMut.isPending} onClick={() => delMut.mutate(g.id)}>Hapus</button>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-4" key={formKey}>
        <FormShell
          title={editing ? `Ubah "${editing.title}"` : "Tambah Foto Galeri"}
          submitLabel={editing ? "Simpan Perubahan" : "Tambah Foto"}
          pending={saveMut.isPending}
          error={error}
          onSubmit={() => {
            if (title.trim().length < 2) return setError("Judul foto minimal 2 huruf.");
            saveMut.mutate();
          }}
        >
          <div>
            <label className={labelCls} htmlFor="gl-title">Judul</label>
            <input id="gl-title" className={inputCls} {...FIELDS.saveGalleryItem.title} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Skin Fade Rapi" />
          </div>
          <div>
            <label className={labelCls} htmlFor="gl-tag">Tag Gaya</label>
            <input id="gl-tag" className={inputCls} {...FIELDS.saveGalleryItem.styleTag} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Fade / Crop / Interior" />
          </div>
          <div className="sm:col-span-2">
            <PhotoUploadField
              id="gl-upload"
              label={editing?.imageUrl ? "Ganti dengan foto sendiri" : "Unggah foto sendiri"}
              value={upload}
              onChange={setUpload}
            />
            {editing?.imageUrl && !upload && (
              <p className="mt-1 text-xs font-semibold text-[var(--accent)]">Foto ini sedang memakai foto unggahan sendiri.</p>
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor="gl-photo">Atau pakai foto bawaan</label>
            <select
              id="gl-photo"
              className={inputCls}
              value={photo}
              disabled={upload != null}
              onChange={(e) => setPhoto(e.target.value)}
            >
              {PHOTO_KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            {upload != null && <p className="mt-1 text-xs text-[var(--dim)]">Foto unggahan dipakai — batalkan unggahan untuk kembali ke foto bawaan.</p>}
          </div>
          {previewSrc && <img src={previewSrc} alt="Pratinjau foto terpilih" className="h-28 w-28 rounded-[var(--radius)] object-cover" />}
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
            <input type="checkbox" checked={isSlide} onChange={(e) => setIsSlide(e.target.checked)} className="h-5 w-5 accent-[#8a6a14]" />
            Tampilkan di slider foto beranda — foto slider diambil dari galeri yang dicentang ini, jadi pemilik bisa mengganti foto slider kapan saja dari sini, termasuk dengan foto unggahan sendiri.
          </label>
        </FormShell>
      </div>
    </div>
  );
}

function AdminCustomerPhotos({ data }: { data: Bootstrap }) {
  const invalidate = useInvalidate();
  const [formKey, setFormKey] = useState(0);
  const [name, setName] = useState("");
  const [style, setStyle] = useState("");
  const [upload, setUpload] = useState<PhotoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!upload) throw new Error("Pilih foto pelanggan dulu.");
      return await api.uploadCustomerPhoto({
        customerName: name.trim(),
        style: style.trim() || undefined,
        photo: { dataBase64: upload.dataBase64, mimeType: upload.mimeType },
      });
    },
    onSuccess: () => {
      invalidate();
      setName("");
      setStyle("");
      setUpload(null);
      setError(null);
      setFormKey((k) => k + 1);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal mengunggah foto pelanggan."),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => api.deleteCustomerPhoto({ id }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menghapus foto pelanggan."),
  });
  return (
    <div>
      <p className="mb-3 text-sm text-[var(--dim)]">
        Unggah foto hasil potongan pelanggan beserta nama dan gaya rambutnya. Foto tampil di menu "Foto Pelanggan" yang
        bisa dilihat semua pengunjung.
      </p>
      {data.customerPhotos.length === 0 ? (
        <p className="text-sm text-[var(--dim)]">Belum ada foto pelanggan. Unggah foto pertama lewat formulir di bawah.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.customerPhotos.map((p) => (
            <figure key={p.id} className="relative overflow-hidden rounded-[var(--radius)]">
              <img src={p.imageUrl} alt={`Foto ${p.customerName}`} className="aspect-square w-full object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5 text-xs font-semibold text-[#f3ead8]">
                {p.customerName} {p.style ? `• ${p.style}` : ""}
                <span className="mt-1 flex gap-2">
                  <button type="button" className="underline" disabled={delMut.isPending} onClick={() => delMut.mutate(p.id)}>Hapus</button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <div className="mt-4" key={formKey}>
        <FormShell
          title="Upload Foto Pelanggan"
          submitLabel="Upload Foto"
          pending={saveMut.isPending}
          error={error}
          onSubmit={() => {
            if (name.trim().length < 2) return setError("Nama pelanggan minimal 2 huruf.");
            if (!upload) return setError("Pilih foto pelanggan dulu.");
            saveMut.mutate();
          }}
        >
          <div>
            <label className={labelCls} htmlFor="cp-name">Nama Pelanggan</label>
            <input id="cp-name" className={inputCls} {...FIELDS.uploadCustomerPhoto.customerName} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama pelanggan" />
          </div>
          <div>
            <label className={labelCls} htmlFor="cp-style">Style / Gaya Rambut</label>
            <input id="cp-style" className={inputCls} {...FIELDS.uploadCustomerPhoto.style} value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Skin Fade / Textured Crop / Buzz Cut" />
          </div>
          <div className="sm:col-span-2">
            <PhotoUploadField id="cp-upload" label="Foto Hasil Potongan" value={upload} onChange={setUpload} />
          </div>
        </FormShell>
      </div>
    </div>
  );
}

type AdminPromo = ApiResponse<typeof api, "listPromosAdmin">["promos"][number];
function AdminPromos() {
  const invalidate = useInvalidate();
  const q = useQuery({ queryKey: ["admin-promos"], queryFn: () => api.listPromosAdmin({}) });
  const [editing, setEditing] = useState<AdminPromo | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"persen" | "nominal">("persen");
  const [value, setValue] = useState("10");
  const [minSpend, setMinSpend] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [startDate, setStartDate] = useState(todayPlus(0));
  const [endDate, setEndDate] = useState(todayPlus(30));
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const today = todayPlus(0);

  const startEdit = (p: AdminPromo | null) => {
    setEditing(p);
    setCode(p?.code ?? "");
    setDescription(p?.description ?? "");
    setType(p?.discountType === "nominal" ? "nominal" : "persen");
    setValue(String(p?.discountValue ?? 10));
    setMinSpend(String(p?.minSpend ?? 0));
    setMaxUses(p?.maxUses != null ? String(p.maxUses) : "");
    setStartDate(p?.startDate ?? todayPlus(0));
    setEndDate(p?.endDate ?? todayPlus(30));
    setActive(p?.active ?? true);
    setError(null);
    setFormKey((k) => k + 1);
  };
  const saveMut = useMutation({
    mutationFn: async () =>
      await api.savePromo({
        id: editing?.id ?? null,
        code: code.trim().toUpperCase(),
        description: description.trim(),
        discountType: type,
        discountValue: Number(value),
        minSpend: Number(minSpend),
        maxUses: maxUses.trim() ? Number(maxUses) : null,
        startDate,
        endDate,
        active,
      }),
    onSuccess: () => {
      invalidate();
      startEdit(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menyimpan promo."),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => api.deletePromo({ id }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menghapus promo."),
  });
  const promos = q.data?.promos ?? [];
  return (
    <div>
      {q.isPending && <p className="text-sm text-[var(--dim)]">Memuat promo…</p>}
      <div className="grid gap-3">
        {promos.map((p) => {
          const expired = p.endDate < today;
          const habis = p.maxUses != null && p.usedCount >= p.maxUses;
          return (
            <article key={p.id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3`}>
              <div>
                <p className="font-display text-2xl tracking-wider text-[var(--accent)]">
                  {p.code}{" "}
                  {!p.active ? <Badge tone="red">Nonaktif</Badge> : expired ? <Badge tone="dim">Kedaluwarsa</Badge> : habis ? <Badge tone="dim">Kuota Habis</Badge> : <Badge tone="green">Aktif</Badge>}
                </p>
                <p className="text-sm">
                  {p.discountType === "persen" ? `Diskon ${p.discountValue}%` : `Potongan ${rp(p.discountValue)}`}
                  {p.minSpend > 0 ? ` • Min. ${rp(p.minSpend)}` : ""} • Dipakai {p.usedCount}
                  {p.maxUses != null ? `/${p.maxUses}` : ""} kali
                </p>
                <p className="text-sm text-[var(--dim)]">
                  {p.description} • {fmtDateShort(p.startDate)} – {fmtDate(p.endDate)}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className={btnGhost} onClick={() => startEdit(p)}>Ubah</button>
                <button type="button" className={btnGhost} disabled={delMut.isPending} onClick={() => delMut.mutate(p.id)}>Hapus</button>
              </div>
            </article>
          );
        })}
        {q.data && promos.length === 0 && <p className="text-sm text-[var(--dim)]">Belum ada promo. Buat promo pertama di bawah.</p>}
      </div>
      <div className="mt-4" key={formKey}>
        <FormShell
          title={editing ? `Ubah Promo ${editing.code}` : "Buat Kode Promo Baru"}
          submitLabel={editing ? "Simpan Perubahan" : "Buat Promo"}
          pending={saveMut.isPending}
          error={error}
          onSubmit={() => {
            if (code.trim().length < 3) return setError("Kode promo minimal 3 karakter.");
            const v = Number(value);
            if (Number.isNaN(v) || v < 1) return setError("Nilai potongan tidak valid.");
            if (type === "persen" && v > 100) return setError("Potongan persen maksimal 100%.");
            if (endDate < startDate) return setError("Tanggal selesai harus setelah tanggal mulai.");
            saveMut.mutate();
          }}
        >
          <div>
            <label className={labelCls} htmlFor="pr-code">Kode Promo</label>
            <input id="pr-code" className={`${inputCls} uppercase`} {...FIELDS.savePromo.code} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GANTENG10" />
          </div>
          <div>
            <label className={labelCls} htmlFor="pr-type">Jenis Potongan</label>
            <select id="pr-type" className={inputCls} value={type} onChange={(e) => setType(e.target.value as "persen" | "nominal")}>
              <option value="persen">Persen (%)</option>
              <option value="nominal">Nominal (Rp)</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="pr-value">{type === "persen" ? "Nilai Diskon (%)" : "Nilai Potongan (Rp)"}</label>
            <input id="pr-value" type="number" className={inputCls} {...FIELDS.savePromo.discountValue} value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <label className={labelCls} htmlFor="pr-min">Minimal Belanja (Rp)</label>
            <input id="pr-min" type="number" className={inputCls} {...FIELDS.savePromo.minSpend} value={minSpend} onChange={(e) => setMinSpend(e.target.value)} inputMode="numeric" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="pr-desc">Deskripsi Promo</label>
            <input id="pr-desc" className={inputCls} {...FIELDS.savePromo.description} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Diskon untuk semua layanan" />
          </div>
          <div>
            <label className={labelCls} htmlFor="pr-max">Batas Pemakaian (kosongkan = tanpa batas)</label>
            <input id="pr-max" type="number" className={inputCls} {...FIELDS.savePromo.maxUses} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" placeholder="Tanpa batas" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="pr-start">Mulai Berlaku</label>
              <input id="pr-start" type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="pr-end">Berlaku Sampai</label>
              <input id="pr-end" type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-[#8a6a14]" /> Promo aktif
          </label>
        </FormShell>
      </div>
    </div>
  );
}

function QrisSettingsCard({ data }: { data: Bootstrap }) {
  const invalidate = useInvalidate();
  const [photo, setPhoto] = useState<PhotoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const uploadMut = useMutation({
    mutationFn: async () =>
      await api.uploadQrisImage({
        photo: { dataBase64: photo?.dataBase64 ?? "", mimeType: photo?.mimeType ?? "image/png" },
      }),
    onSuccess: () => {
      setPhoto(null);
      setSaved(true);
      setError(null);
      invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal mengunggah kode QRIS."),
  });
  const delMut = useMutation({
    mutationFn: () => api.deleteQrisImage({}),
    onSuccess: () => {
      setSaved(false);
      setError(null);
      invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menghapus kode QRIS."),
  });
  return (
    <section className={`${cardCls} mt-5`}>
      <h3 className="font-display text-2xl tracking-wide">Kode QRIS Pembayaran</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Unggah gambar kode QRIS tokomu (dari aplikasi merchant QRIS / e-wallet). Gambar ini{" "}
        <strong className="text-[var(--text)]">otomatis tampil ke pelanggan</strong> saat mereka memilih pembayaran QRIS di halaman booking,
        lengkap dengan saran mengirim bukti pembayaran lewat WhatsApp setelah membayar.
      </p>
      {data.qrisImageUrl ? (
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <img
            src={data.qrisImageUrl}
            alt="Kode QRIS yang tampil ke pelanggan saat booking"
            className="w-44 rounded-[var(--radius)] border-2 border-[var(--border)] bg-white object-contain"
          />
          <div>
            <p className="text-sm font-semibold text-[var(--green)]">Kode QRIS aktif — pelanggan bisa melihatnya saat memilih pembayaran QRIS.</p>
            <button type="button" className={`${btnGhost} mt-2`} disabled={delMut.isPending} onClick={() => delMut.mutate()}>
              Hapus Kode QRIS
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm font-semibold text-[var(--red)]">
          Belum ada kode QRIS — pelanggan yang memilih QRIS belum bisa melihat kode pembayaran di halaman booking.
        </p>
      )}
      <div className="mt-4 max-w-md">
        <PhotoUploadField
          id="set-qris"
          label={data.qrisImageUrl ? "Ganti dengan gambar QRIS baru" : "Unggah gambar kode QRIS"}
          value={photo}
          onChange={setPhoto}
        />
      </div>
      {error && (
        <p className="mt-2 text-sm font-semibold text-[var(--red)]" role="alert">{error}</p>
      )}
      {saved && <p className="mt-2 text-sm font-semibold text-[var(--green)]">Kode QRIS tersimpan dan sudah tampil ke pelanggan.</p>}
      <button type="button" className={`${btnGold} mt-3`} disabled={!photo || uploadMut.isPending} onClick={() => uploadMut.mutate()}>
        {uploadMut.isPending ? "Mengunggah…" : "Simpan Kode QRIS"}
      </button>
    </section>
  );
}

function AdminSettings({ data }: { data: Bootstrap }) {
  const invalidate = useInvalidate();
  const s = data.settings;
  const [shopName, setShopName] = useState(s.shop_name ?? "BARBERBOYS");
  const [tagline, setTagline] = useState(s.tagline ?? "");
  const [about, setAbout] = useState(s.about ?? "");
  const [phone, setPhone] = useState(s.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(s.whatsapp ?? "");
  const [instagram, setInstagram] = useState(s.instagram ?? "");
  const [email, setEmail] = useState(s.email ?? "");
  const [socWa, setSocWa] = useState(s.social_whatsapp ?? "");
  const [socIg, setSocIg] = useState(s.social_instagram ?? "");
  const [socTt, setSocTt] = useState(s.social_tiktok ?? "");
  const [socFb, setSocFb] = useState(s.social_facebook ?? "");
  const [stampsNeed, setStampsNeed] = useState(s.stamps_for_free_cut ?? "10");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Nomor WhatsApp selalu disimpan dalam format internasional (628xx):
  // awalan 0 atau 8 diubah menjadi 62, tanda + dan spasi dibuang.
  const waNormalized = waNumber(whatsapp);
  const socWaNormalized = waHref(socWa) ?? socWa.trim();
  const mut = useMutation({
    mutationFn: async () =>
      await api.saveSettings({
        values: {
          shop_name: shopName.trim(),
          tagline: tagline.trim(),
          about: about.trim(),
          phone: phone.trim(),
          whatsapp: waNormalized,
          instagram: instagram.trim(),
          email: email.trim(),
          social_whatsapp: socWaNormalized,
          social_instagram: socIg.trim(),
          social_tiktok: socTt.trim(),
          social_facebook: socFb.trim(),
          stamps_for_free_cut: String(Number(stampsNeed)),
        },
      }),
    onSuccess: () => {
      setWhatsapp(waNormalized);
      setSocWa(socWaNormalized);
      setStampsNeed(String(Number(stampsNeed)));
      setSaved(true);
      invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menyimpan pengaturan."),
  });
  return (
    <div>
    <FormShell
      title="Profil Barbershop"
      submitLabel="Simpan Pengaturan"
      pending={mut.isPending}
      error={error}
      onSubmit={() => {
        const n = Number(stampsNeed);
        if (!Number.isInteger(n) || n < 2 || n > 50) {
          setError("Jumlah kunjungan untuk 1x potong gratis harus angka bulat antara 2 dan 50.");
          return;
        }
        setError(null);
        setSaved(false);
        mut.mutate();
      }}
    >
      <div>
        <label className={labelCls} htmlFor="set-name">Nama Barbershop</label>
        <input id="set-name" className={inputCls} value={shopName} onChange={(e) => setShopName(e.target.value)} />
      </div>
      <div>
        <label className={labelCls} htmlFor="set-tagline">Tagline</label>
        <input id="set-tagline" className={inputCls} value={tagline} onChange={(e) => setTagline(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls} htmlFor="set-about">Tentang Barbershop</label>
        <textarea id="set-about" className={inputCls} rows={3} value={about} onChange={(e) => setAbout(e.target.value)} />
      </div>
      <div>
        <label className={labelCls} htmlFor="set-phone">Telepon</label>
        <input id="set-phone" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className={labelCls} htmlFor="set-wa">WhatsApp Admin</label>
        <input id="set-wa" className={inputCls} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="6281234567890" inputMode="tel" />
        <p className="mt-1 text-xs text-[var(--dim)]">
          Contoh format yang benar: <strong>6281234567890</strong> (kode negara 62, tanpa tanda + dan tanpa spasi). Nomor yang diketik
          08xx, 8xx, atau +62xx otomatis diubah ke format ini saat disimpan — format lokal tanpa kode negara ditolak WhatsApp.
        </p>
      </div>
      <div>
        <label className={labelCls} htmlFor="set-ig">Instagram</label>
        <input id="set-ig" className={inputCls} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@barberboys.id" />
      </div>
      <div>
        <label className={labelCls} htmlFor="set-email">Email</label>
        <input id="set-email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className={labelCls} htmlFor="set-stamps">Kunjungan untuk 1x Potong Gratis</label>
        <input
          id="set-stamps"
          className={inputCls}
          type="number"
          min={2}
          max={50}
          step={1}
          value={stampsNeed}
          onChange={(e) => setStampsNeed(e.target.value)}
          inputMode="numeric"
        />
        <p className="mt-1 text-xs text-[var(--dim)]">
          Member mengumpulkan 1 stempel setiap potong selesai. Begitu stempel mencapai angka ini (sekarang 10 — bisa diganti misalnya
          12 atau 15), stempel otomatis berubah menjadi 1 voucher potong gratis dan hitungannya mulai lagi dari 0. Perubahan berlaku
          untuk perolehan stempel berikutnya; stempel yang sudah terkumpul tidak berubah.
        </p>
      </div>
      <div className="sm:col-span-2">
        <span className={labelCls}>Profil Media Sosial (pratinjau seperti yang dilihat pelanggan)</span>
        <SocialIcons
          settings={{ social_whatsapp: socWa, social_instagram: socIg, social_tiktok: socTt, social_facebook: socFb }}
        />
        <p className="mt-1 text-xs text-[var(--dim)]">Ikon ini tampil di bagian kontak dan footer aplikasi. Ubah tautannya di bawah, lalu simpan.</p>
      </div>
      <div>
        <label className={labelCls} htmlFor="set-soc-wa">Tautan WhatsApp</label>
        <input id="set-soc-wa" className={inputCls} value={socWa} onChange={(e) => setSocWa(e.target.value)} placeholder="https://wa.me/6281234567890" />
        <p className="mt-1 text-xs text-[var(--dim)]">
          Boleh ditempel sebagai tautan wa.me atau nomor saja (628xx / 08xx / +62xx) — nomornya otomatis dinormalisasi ke format
          internasional saat disimpan.
        </p>
      </div>
      <div>
        <label className={labelCls} htmlFor="set-soc-ig">Tautan Instagram</label>
        <input id="set-soc-ig" className={inputCls} value={socIg} onChange={(e) => setSocIg(e.target.value)} placeholder="https://instagram.com/namatoko" />
      </div>
      <div>
        <label className={labelCls} htmlFor="set-soc-tt">Tautan TikTok</label>
        <input id="set-soc-tt" className={inputCls} value={socTt} onChange={(e) => setSocTt(e.target.value)} placeholder="https://tiktok.com/@namatoko" />
      </div>
      <div>
        <label className={labelCls} htmlFor="set-soc-fb">Tautan Facebook</label>
        <input id="set-soc-fb" className={inputCls} value={socFb} onChange={(e) => setSocFb(e.target.value)} placeholder="https://facebook.com/namatoko" />
      </div>
      {saved && <p className="text-sm font-semibold text-[var(--green)]">Pengaturan tersimpan.</p>}
    </FormShell>
    <QrisSettingsCard data={data} />
    <LocationCard data={data} />
    <ChangePinCard />
    </div>
  );
}

function LocationCard({ data }: { data: Bootstrap }) {
  const invalidate = useInvalidate();
  const branch = data.branches[0];
  const [name, setName] = useState(branch?.name ?? "BARBERBOYS");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [phone, setPhone] = useState(branch?.phone ?? "");
  const [openTime, setOpenTime] = useState(branch?.openTime ?? "09:00");
  const [closeTime, setCloseTime] = useState(branch?.closeTime ?? "21:00");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const mut = useMutation({
    mutationFn: async () =>
      await api.saveBranch({
        id: branch?.id ?? null,
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        openTime,
        closeTime,
        active: true,
        sortOrder: branch?.sortOrder ?? 0,
      }),
    onSuccess: () => {
      setSaved(true);
      invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal menyimpan lokasi."),
  });
  return (
    <FormShell
      title="Lokasi & Jam Buka (Satu Tempat)"
      submitLabel="Simpan Lokasi"
      pending={mut.isPending}
      error={error}
      onSubmit={() => {
        if (name.trim().length < 2) return setError("Nama lokasi minimal 2 huruf.");
        setError(null);
        setSaved(false);
        mut.mutate();
      }}
    >
      <div>
        <label className={labelCls} htmlFor="loc-name">Nama Lokasi</label>
        <input id="loc-name" className={inputCls} {...FIELDS.saveBranch.name} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className={labelCls} htmlFor="loc-phone">Telepon / WA Lokasi</label>
        <input id="loc-phone" className={inputCls} {...FIELDS.saveBranch.phone} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls} htmlFor="loc-address">Alamat</label>
        <input id="loc-address" className={inputCls} {...FIELDS.saveBranch.address} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div>
        <label className={labelCls} htmlFor="loc-open">Jam Buka</label>
        <input id="loc-open" type="time" className={inputCls} value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
      </div>
      <div>
        <label className={labelCls} htmlFor="loc-close">Jam Tutup</label>
        <input id="loc-close" type="time" className={inputCls} value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
      </div>
      {saved && <p className="text-sm font-semibold text-[var(--green)]">Lokasi tersimpan.</p>}
    </FormShell>
  );
}

function ChangePinCard() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const mut = useMutation({
    mutationFn: async () => await api.changeAdminPin({ currentPin, newPin }),
    onSuccess: () => {
      setDone(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Gagal mengganti PIN."),
  });
  return (
    <form
      className={`${cardCls} mt-4`}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setDone(false);
        if (newPin.length < 4) return setError("PIN baru minimal 4 karakter.");
        if (newPin !== confirmPin) return setError("Konfirmasi PIN baru tidak sama.");
        mut.mutate();
      }}
    >
      <h3 className="font-display text-2xl tracking-wide">Keamanan — Ganti PIN Admin</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">PIN dipakai untuk masuk dashboard admin (tanpa email/password).</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="pin-current">PIN Lama</label>
          <input id="pin-current" type="password" className={inputCls} {...FIELDS.changeAdminPin.currentPin} value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <label className={labelCls} htmlFor="pin-new">PIN Baru</label>
          <input id="pin-new" type="password" className={inputCls} {...FIELDS.changeAdminPin.newPin} value={newPin} onChange={(e) => setNewPin(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className={labelCls} htmlFor="pin-confirm">Konfirmasi PIN Baru</label>
          <input id="pin-confirm" type="password" className={inputCls} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} autoComplete="new-password" />
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-[var(--red)]" role="alert">{error}</p>}
      {done && <p className="mt-3 text-sm font-semibold text-[var(--green)]">PIN admin berhasil diganti. Pakai PIN baru saat login berikutnya.</p>}
      <button type="submit" className={`${btnGold} mt-4`} disabled={mut.isPending}>
        {mut.isPending ? "Menyimpan…" : "Ganti PIN"}
      </button>
    </form>
  );
}

type SupabaseStatus = ApiResponse<typeof api, "getSupabaseStatus">;
type SupabasePushResult = ApiResponse<typeof api, "pushSupabaseData">;
type SupabasePullResult = ApiResponse<typeof api, "pullSupabaseData">;

function AdminSupabase() {
  const invalidate = useInvalidate();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [confirmPull, setConfirmPull] = useState(false);
  const statusQ = useQuery({ queryKey: ["supabase-status"], queryFn: () => api.getSupabaseStatus({}) });
  const status: SupabaseStatus | undefined = statusQ.data;

  const summarizePush = (res: SupabasePushResult): void => {
    const failed = res.tables.filter((t) => t.error);
    const total = res.tables.reduce((a, t) => a + t.pushed, 0);
    if (res.ok) {
      setResultMsg(`Berhasil — ${total} baris data dari ${res.tables.length} tabel terkirim ke Supabase.`);
      setResultError(null);
    } else {
      setResultMsg(null);
      setResultError(
        `Sebagian tabel gagal dikirim: ${failed.map((t) => `${t.label} (${t.error})`).join("; ")}`,
      );
    }
    void statusQ.refetch();
  };
  const summarizePull = (res: SupabasePullResult): void => {
    const failed = res.tables.filter((t) => t.error);
    const total = res.tables.reduce((a, t) => a + t.pulled, 0);
    if (res.ok) {
      setResultMsg(`Berhasil — ${total} baris data dari Supabase diterapkan ke aplikasi.`);
      setResultError(null);
    } else {
      setResultMsg(null);
      setResultError(
        `Sebagian tabel gagal ditarik: ${failed.map((t) => `${t.label} (${t.error})`).join("; ")}`,
      );
    }
    setConfirmPull(false);
    invalidate();
    void statusQ.refetch();
  };
  const pushMut = useMutation({
    mutationFn: () => api.pushSupabaseData({}),
    onSuccess: summarizePush,
    onError: (e) => {
      setResultMsg(null);
      setResultError(e instanceof Error ? e.message : "Gagal mengirim data ke Supabase.");
    },
  });
  const pullMut = useMutation({
    mutationFn: () => api.pullSupabaseData({}),
    onSuccess: summarizePull,
    onError: (e) => {
      setResultMsg(null);
      setResultError(e instanceof Error ? e.message : "Gagal menarik data dari Supabase.");
    },
  });

  const copySql = async () => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(SUPABASE_SQL);
      setCopied(true);
    } catch {
      setCopyError("Browser menolak menyalin otomatis. Blokir semua teks di kotak SQL di bawah (tekan lama / Ctrl+A di dalam kotak), lalu salin manual.");
    }
  };
  const downloadSql = () => {
    const blob = new Blob([SUPABASE_SQL], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "barberboys_supabase.sql";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <section className={cardCls}>
        <h3 className="font-display text-2xl tracking-wide">Supabase — Database & Sinkronisasi</h3>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Aplikasi ini tersambung ke proyek Supabase kamu{status ? (
            <>
              {" "}(<span className="font-semibold text-[var(--text)]">{status.url}</span>)
            </>
          ) : null}{" "}
          dengan publishable key. Semua tabel aplikasi — layanan, kapster, booking, member & stempel, promo, voucher gratis, galeri,
          foto pelanggan, ulasan, dan pengaturan (termasuk hash PIN admin dan target stempel) — dibuat lewat file SQL di bawah, dan
          Realtime Supabase diaktifkan untuk semua tabel itu lewat SQL yang sama.
        </p>
        <p className="mt-2 text-sm text-[var(--dim)]">
          Cara sinkronnya: aplikasi tetap berjalan seperti biasa, dan selama dashboard admin terbuka, semua data otomatis dikirim ke
          Supabase tiap 60 detik. Tombol <strong className="text-[var(--text)]">Kirim Semua Data ke Supabase</strong> memindahkan /
          menyelaraskan data saat itu juga (baris yang sama diperbarui, bukan digandakan). Tombol{" "}
          <strong className="text-[var(--text)]">Tarik Data dari Supabase</strong> melakukan kebalikannya bila kamu mengubah data
          langsung di Supabase.
        </p>

        <div className="mt-4">
          {statusQ.isPending ? (
            <p className="text-sm text-[var(--dim)]">Memeriksa koneksi ke Supabase…</p>
          ) : statusQ.isError ? (
            <p className="text-sm font-semibold text-[var(--red)]" role="alert">
              Pemeriksaan status gagal di server aplikasi. Coba tombol Periksa Koneksi.
            </p>
          ) : status ? (
            <>
              <p className="text-sm font-semibold">
                Status:{" "}
                {!status.reachable ? (
                  <span className="text-[var(--red)]">Supabase tidak terjangkau dari server</span>
                ) : status.ready ? (
                  <span className="text-[var(--green)]">Terhubung — semua tabel sudah ada di Supabase</span>
                ) : (
                  <span className="text-[var(--red)]">Terhubung, tapi tabel belum dibuat — jalankan file SQL di bawah dulu</span>
                )}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[430px] text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-[var(--border)]">
                      <th className="py-1.5 pr-3 font-bold">Tabel</th>
                      <th className="py-1.5 pr-3 font-bold">Di Supabase</th>
                      <th className="py-1.5 pr-3 font-bold">Baris di Aplikasi</th>
                      <th className="py-1.5 font-bold">Baris di Supabase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.tables.map((t) => (
                      <tr key={t.name} className="border-b border-[var(--border)]">
                        <td className="py-1.5 pr-3">
                          <span className="font-semibold">{t.label}</span>{" "}
                          <span className="text-xs text-[var(--dim)]">({t.name})</span>
                        </td>
                        <td className="py-1.5 pr-3">
                          {t.exists ? (
                            <span className="font-semibold text-[var(--green)]">Sudah ada</span>
                          ) : (
                            <span className="font-semibold text-[var(--red)]">Belum dibuat</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3">{t.localCount}</td>
                        <td className="py-1.5">{t.remoteCount ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        {resultMsg && <p className="mt-3 text-sm font-semibold text-[var(--green)]">{resultMsg}</p>}
        {resultError && (
          <p className="mt-3 text-sm font-semibold text-[var(--red)]" role="alert">{resultError}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btnGhost} disabled={statusQ.isFetching} onClick={() => void statusQ.refetch()}>
            {statusQ.isFetching ? "Memeriksa…" : "Periksa Koneksi"}
          </button>
          <button
            type="button"
            className={btnGold}
            disabled={pushMut.isPending || (status != null && !status.ready)}
            onClick={() => {
              setResultMsg(null);
              setResultError(null);
              pushMut.mutate();
            }}
          >
            {pushMut.isPending ? "Mengirim…" : "Kirim Semua Data ke Supabase"}
          </button>
          {confirmPull ? (
            <>
              <span className="w-full text-sm font-semibold text-[var(--red)]">
                Tarik data akan menimpa baris aplikasi yang id-nya sama dengan versi Supabase. Lanjutkan?
              </span>
              <button
                type="button"
                className={btnGold}
                disabled={pullMut.isPending}
                onClick={() => {
                  setResultMsg(null);
                  setResultError(null);
                  pullMut.mutate();
                }}
              >
                {pullMut.isPending ? "Menarik…" : "Ya, Tarik Data dari Supabase"}
              </button>
              <button type="button" className={btnGhost} disabled={pullMut.isPending} onClick={() => setConfirmPull(false)}>
                Batal
              </button>
            </>
          ) : (
            <button
              type="button"
              className={btnGhost}
              disabled={pullMut.isPending || (status != null && !status.ready)}
              onClick={() => setConfirmPull(true)}
            >
              Tarik Data dari Supabase
            </button>
          )}
        </div>
        {status != null && !status.ready && (
          <p className="mt-2 text-xs text-[var(--dim)]">
            Tombol kirim/tarik aktif setelah semua tabel dibuat lewat file SQL di bawah — publishable key tidak bisa membuat tabel
            lewat API, jadi pembuatan tabel memang harus lewat SQL Editor.
          </p>
        )}
      </section>

      <section className={`${cardCls} mt-5`}>
        <h3 className="font-display text-2xl tracking-wide">File SQL — Buat Tabel di Supabase</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--dim)]">
          <li>Salin SQL di bawah (atau unduh sebagai file <span className="font-semibold text-[var(--text)]">barberboys_supabase.sql</span>).</li>
          <li>
            Buka dashboard Supabase proyek <span className="font-semibold text-[var(--text)]">boys</span> →{" "}
            <span className="font-semibold text-[var(--text)]">SQL Editor</span> → New query → tempel → klik{" "}
            <span className="font-semibold text-[var(--text)]">Run</span>.
          </li>
          <li>Kembali ke sini, klik <span className="font-semibold text-[var(--text)]">Periksa Koneksi</span> — semua tabel harus berstatus “Sudah ada”.</li>
          <li>Klik <span className="font-semibold text-[var(--text)]">Kirim Semua Data ke Supabase</span> untuk memindahkan data yang ada sekarang.</li>
          <li>
            Terakhir, jalankan potongan <span className="font-semibold text-[var(--text)]">LANGKAH 2</span> di bagian paling bawah
            file SQL (hapus tanda komentarnya) supaya nomor urut id di Supabase selaras dengan data hasil pemindahan.
          </li>
        </ol>
        <p className="mt-2 text-sm text-[var(--dim)]">
          File ini membuat 11 tabel sekaligus mengaktifkan Row Level Security (policy terbuka untuk publishable key — aplikasi tidak
          memakai login Supabase Auth, akses admin dijaga PIN aplikasi) dan Realtime untuk semua tabel. PIN admin dan PIN member{" "}
          <strong className="text-[var(--text)]">tidak pernah</strong> disimpan sebagai teks asli — yang tersimpan dan terkirim hanya
          hash SHA-256-nya. File aman dijalankan berulang kali.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btnGold} onClick={() => void copySql()}>
            {copied ? "SQL Tersalin ✓" : "Salin SQL"}
          </button>
          <button type="button" className={btnGhost} onClick={downloadSql}>
            Unduh File SQL
          </button>
        </div>
        {copyError && (
          <p className="mt-2 text-sm font-semibold text-[var(--red)]" role="alert">{copyError}</p>
        )}
        <label className={labelCls} htmlFor="supabase-sql">
          Isi file barberboys_supabase.sql
        </label>
        <textarea
          id="supabase-sql"
          className={`${inputCls} font-mono text-xs leading-relaxed`}
          rows={18}
          readOnly
          value={SUPABASE_SQL}
          onFocus={(e) => e.target.select()}
        />
      </section>
    </div>
  );
}
