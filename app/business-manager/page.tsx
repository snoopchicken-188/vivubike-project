"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
type Tab = "dashboard" | "vehicles" | "homepage";
type Period = "today" | "week" | "month" | "custom";
type Vehicle = {
  id: string;
  name: string;
  licensePlate: string;
  brand: string;
  type: string;
  dailyPrice: number;
  quantity: number;
  image: string;
  description: string;
  specs: string;
  amenities: string[];
  status: string;
  isVisible: boolean;
  statusBeforeHide?: string;
};
type VehicleForm = Omit<Vehicle, "id" | "amenities"> & {
  id?: string;
  amenitiesText: string;
};
type PriceRow = {
  id: string;
  isNew?: boolean;
  isDirty?: boolean;
  name: string;
  oneToFive: number;
  sixToTen: number;
  elevenToTwenty: number;
  overTwenty: number;
};
type Booking = {
  id: string;
  vehicleId?: string;
  vehicleName?: string;
  licensePlate?: string;
  status: string;
  totalAmount: number;
  customerType: "guest" | "member";
  createdAt: unknown;
  completedAt: unknown;
};
const str = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const num = (value: unknown) =>
  typeof value === "number" ? value : Number(value || 0);
const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + "đ";
const day = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
const dateOf = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const timestamp = value as { toDate?: () => Date; seconds?: number };
  if (typeof timestamp?.toDate === "function") return timestamp.toDate();
  return typeof timestamp?.seconds === "number"
    ? new Date(timestamp.seconds * 1000)
    : null;
};
const isCompleted = (status: string) =>
  ["completed", "returned", "done", "đã trả xe", "da tra xe"].includes(
    status.toLowerCase().trim(),
  );
const isCancelled = (status: string) =>
  ["cancelled", "canceled", "cancel", "đã hủy", "da huy"].includes(
    status.toLowerCase().trim(),
  );
const vehicleStatusLabel: Record<string, string> = {
  available: "Trống",
  reserved: "Đang đặt",
  delivered: "Đã giao",
  maintenance: "Đang bảo dưỡng",
  inactive: "Ngừng hoạt động",
};
const bookingStatusLabel: Record<string, string> = {
  ready_for_pickup: "Chờ bàn giao",
  in_progress: "Đang thuê",
  returning: "Tiếp nhận trả xe",
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  reserved: "Đang đặt",
  delivered: "Đã giao xe",
  completed: "Đã trả xe",
  returned: "Đã trả xe",
  cancelled: "Đã hủy",
  canceled: "Đã hủy",
};
const blankVehicle = (): VehicleForm => ({
  name: "",
  licensePlate: "",
  brand: "",
  type: "Tay ga",
  dailyPrice: 180000,
  quantity: 1,
  image: "",
  description: "",
  specs: "",
  amenitiesText: "02 mũ bảo hiểm, 01 áo mưa",
  status: "available",
  isVisible: true,
});
const mergePriceRows = (current: PriceRow[], loaded: PriceRow[]): PriceRow[] => {
  const drafts = new Map(current.filter(row => row.isNew || row.isDirty).map(row => [row.id, row]));
  const loadedIds = new Set(loaded.map(row => row.id));
  return [
    ...loaded.map(row => drafts.get(row.id) || row),
    ...current.filter(row => row.isNew && !loadedIds.has(row.id)),
  ].sort((a, b) => a.name.localeCompare(b.name, "vi"));
};

// Fleet summary reads current bookings, independently of the revenue date filter.
const fleetStatusKey = (value: string) => value.trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
  .replace(/[\s-]+/g, "_");
const fleetBookingStage = (status: string): "reserved" | "rented" | "closed" | null => {
  const key = fleetStatusKey(status);
  if (["pending", "pending_approval", "pending_confirmation", "waiting_confirmation", "confirmed", "ready_for_pickup", "reserved", "cho_xac_nhan", "cho_duyet", "cho_duyet_don", "da_xac_nhan", "dang_dat", "da_dat", "cho_ban_giao"].includes(key)) return "reserved";
  if (["in_progress", "renting", "rented", "delivered", "returning", "dang_thue", "dang_cho_thue", "da_giao", "da_giao_xe", "tiep_nhan_tra_xe"].includes(key)) return "rented";
  if (["completed", "returned", "done", "cancelled", "canceled", "cancel", "rejected", "da_hoan_thanh", "hoan_thanh", "da_tra_xe", "da_huy", "tu_choi", "da_tu_choi"].includes(key)) return "closed";
  return null;
};
const calculateFleetCondition = (vehicles: Vehicle[], bookings: Booking[]) => {
  const result = { total: 0, available: 0, reserved: 0, rented: 0, unmatchedBookings: 0, overbooked: 0, issues: [] as string[] };
  const vehicleIds = new Set(vehicles.map(vehicle => vehicle.id));
  const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const uniqueMatch = (candidates: Vehicle[]) => candidates.length === 1 ? candidates[0].id : "";
  const byVehicle = new Map<string, { reserved: number; rented: number }>();
  for (const booking of bookings) {
    const stage = fleetBookingStage(booking.status);
    if (!stage) {
      result.issues.push(`Đơn ${booking.id}: chưa nhận diện được trạng thái “${booking.status}”.`);
      continue;
    }
    // Prefer the stored document ID. Legacy/stale IDs may be resolved only
    // when a plate or model name identifies exactly one catalogue entry.
    let vehicleId = (booking.vehicleId || "").trim();
    if (!vehicleIds.has(vehicleId)) {
      vehicleId = "";
      const plate = normalizePlate(booking.licensePlate || "");
      const plateMatches = plate ? vehicles.filter(vehicle => normalizePlate(vehicle.licensePlate) === plate) : [];
      if (plateMatches.length === 1) vehicleId = plateMatches[0].id;
      // An ambiguous physical plate must never be resolved by a model name.
      if (!vehicleId && plateMatches.length === 0 && booking.vehicleName?.trim()) {
        vehicleId = uniqueMatch(vehicles.filter(vehicle =>
          normalizeName(vehicle.name) === normalizeName(booking.vehicleName!)));
      }
    }
    if (!vehicleIds.has(vehicleId)) {
      if (stage !== "closed") {
        result.unmatchedBookings += 1;
        result.issues.push(`Đơn ${booking.id} (${booking.vehicleName || "chưa có tên xe"}): không xác định được xe tương ứng trong danh mục.`);
      }
      continue;
    }
    const counts = byVehicle.get(vehicleId) || { reserved: 0, rented: 0 };
    // The current project creates one vehicle per booking for both guests
    // and members. Closed/rejected orders do not occupy a vehicle.
    if (stage !== "closed") counts[stage] += 1;
    byVehicle.set(vehicleId, counts);
  }
  for (const vehicle of vehicles) {
    const status = fleetStatusKey(vehicle.status);
    // Hiding a catalogue entry must not hide its active rental commitments.
    const activeCounts = byVehicle.get(vehicle.id);
    const hasActiveBookings = !!activeCounts && activeCounts.reserved + activeCounts.rented > 0;
    if (["maintenance", "inactive", "dang_bao_duong", "ngung_hoat_dong"].includes(status) && !hasActiveBookings) continue;
    const quantity = Number.isFinite(vehicle.quantity) ? Math.max(0, Math.floor(vehicle.quantity)) : 0;
    result.total += quantity;
    const bookingCounts = byVehicle.get(vehicle.id);
    let rented = 0, reserved = 0;
    if (bookingCounts) {
      // A booking's lifecycle is authoritative even when vehicles.status was
      // not reset after return. Prioritize physically rented stock if overbooked.
      rented = Math.min(quantity, bookingCounts.rented);
      reserved = Math.min(quantity - rented, bookingCounts.reserved);
      result.overbooked += Math.max(0, bookingCounts.rented + bookingCounts.reserved - quantity);
    } else if (fleetBookingStage(status) === "rented") {
      rented = quantity;
    } else if (fleetBookingStage(status) === "reserved") {
      reserved = quantity;
    }
    result.rented += rented;
    result.reserved += reserved;
    result.available += quantity - rented - reserved;
  }
  return result;
};

const priceInputStyle = {
  width: "100%",
  minWidth: 94,
  border: "1px solid #dfe5e8",
  borderRadius: 7,
  padding: "9px 10px",
  font: "inherit",
  background: "#fff",
};
export default function BusinessManagerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(
    day(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [to, setTo] = useState(day(new Date()));
  const [notice, setNotice] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fleetSources, setFleetSources] = useState({ vehicles: false, bookings: false, vehiclesError: false, bookingsError: false });
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [vehicleActionId, setVehicleActionId] = useState<string | null>(null);
  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3400);
  };
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/?login=true");
        return;
      }
      try {
        const profile = await getDoc(doc(db, "users", user.uid));
        const role = str(profile.data()?.role, "customer");
        if (role !== "business_manager") {
          router.replace(
            role === "admin" ? "/admin" : role === "staff" ? "/staff" : "/customer",
          );
          return;
        }
        setName(str(profile.data()?.fullName, user.displayName || user.email || "Business Manager"));
        setReady(true);
      } catch {
        router.replace("/?login=true");
      }
    });
  }, [router]);
  useEffect(() => {
    if (!ready) return;
    return onSnapshot(
      collection(db, "vehicles"),
      (snapshot) => {
        setFleetSources(current => ({ ...current, vehicles: true, vehiclesError: false }));
        setVehicles(
          snapshot.docs
            .map((item): Vehicle => {
              const data = item.data();
              return {
                id: item.id,
                name: str(data.name, "Xe chưa đặt tên"),
                licensePlate: str(data.licensePlate),
                brand: str(data.brand),
                type: str(data.type, "Khác"),
                dailyPrice: num(data.dailyPrice),
                quantity: Math.max(1, num(data.quantity || 1)),
                image: str(data.image),
                description: str(data.description),
                specs: str(data.specs),
                amenities: Array.isArray(data.amenities) ? data.amenities.map(String) : [],
                status: str(data.status, "available"),
                isVisible: data.isVisible !== false,
                statusBeforeHide: str(data.statusBeforeHide),
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name, "vi")),
        );
      },
      () => {
        setFleetSources(current => ({ ...current, vehiclesError: true }));
        notify("Không thể tải danh sách xe. Hãy kiểm tra Firestore Rules.");
      },
    );
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    return onSnapshot(
      collection(db, "bookings"),
      (snapshot) => {
        setFleetSources(current => ({ ...current, bookings: true, bookingsError: false }));
        setBookings(
          snapshot.docs.map((item): Booking => {
            const data = item.data();
            return {
              id: item.id,
              status: str(data.status, "pending"),
              vehicleId: str(data.vehicleId),
              vehicleName: str(data.vehicleName),
              licensePlate: str(data.plateNumber) || str(data.licensePlate) || str(data.handoverDetails?.plateNumber),
              totalAmount: num(data.totalAmount || data.totalPrice || data.amount),
              customerType: data.customerType === "guest" || !data.customerId ? "guest" : "member",
              createdAt: data.createdAt,
              completedAt: data.completedAt || data.returnedAt,
            };
          }),
        );
      },
      () => {
        setFleetSources(current => ({ ...current, bookingsError: true }));
        notify("Không thể tải dữ liệu đơn thuê.");
      },
    );
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    return onSnapshot(
      collection(db, "pricing"),
      (snapshot) => {
        const loaded = snapshot.docs.map((item): PriceRow => {
          const data = item.data();
          return {
            id: item.id,
            name: str(data.name),
            oneToFive: num(data.oneToFive),
            sixToTen: num(data.sixToTen),
            elevenToTwenty: num(data.elevenToTwenty),
            overTwenty: num(data.overTwenty),
          };
        }).filter(item => Boolean(item.name));
        setPriceRows(current => mergePriceRows(current, loaded));
      },
      () => notify("Không thể tải bảng giá trang chủ."),
    );
  }, [ready]);
  const range = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (period === "week") start.setDate(start.getDate() - 6);
    if (period === "month") start.setDate(1);
    if (period === "custom") {
      return {
        start: new Date(from + "T00:00:00"),
        end: new Date(to + "T23:59:59"),
      };
    }
    return { start, end };
  }, [period, from, to]);
  const fleet = useMemo(() => {
    const result = {
      total: 0,
      available: 0,
      reserved: 0,
      delivered: 0,
      maintenance: 0,
      inactive: 0,
    };
    vehicles.forEach((item) => {
      const quantity = Math.max(1, item.quantity);
      result.total += quantity;
      if (item.status === "available") result.available += quantity;
      if (item.status === "reserved") result.reserved += quantity;
      if (item.status === "delivered") result.delivered += quantity;
      if (item.status === "maintenance") result.maintenance += quantity;
      if (item.status === "inactive") result.inactive += quantity;
    });
    return result;
  }, [vehicles]);
  const fleetCondition = useMemo(() => calculateFleetCondition(vehicles, bookings), [vehicles, bookings]);
  const fleetConditionReady = fleetSources.vehicles && fleetSources.bookings && !fleetSources.vehiclesError && !fleetSources.bookingsError;
  const stats = useMemo(() => {
    const inRange = (value: Date | null) =>
      Boolean(value && value >= range.start && value <= range.end);
    const orders = bookings.filter((item) => inRange(dateOf(item.createdAt)));
    const done = bookings.filter(
      (item) =>
        isCompleted(item.status) &&
        inRange(dateOf(item.completedAt) || dateOf(item.createdAt)),
    );
    const revenue = done.reduce((sum, item) => sum + item.totalAmount, 0);
    const guest = orders.filter((item) => item.customerType === "guest").length;
    const statusCounts: Record<string, number> = {};
    orders.forEach((item) => {
      const key = item.status.trim().toLowerCase() || "pending";
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    });
    const values = new Map<string, number>();
    done.forEach((item) => {
      const bookingDate = dateOf(item.completedAt) || dateOf(item.createdAt);
      if (!bookingDate) return;
      const id = day(bookingDate);
      values.set(id, (values.get(id) || 0) + item.totalAmount);
    });
    const days: { id: string; title: string; value: number }[] = [];
    const cursor = new Date(range.start);
    cursor.setHours(0, 0, 0, 0);
    const finalDay = new Date(range.end);
    finalDay.setHours(0, 0, 0, 0);
    while (cursor <= finalDay) {
      const id = day(cursor);
      days.push({
        id,
        title: cursor.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
        value: values.get(id) || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return {
      revenue,
      done: done.length,
      total: orders.length,
      success: orders.filter((item) => !isCancelled(item.status)).length,
      cancel: orders.filter((item) => isCancelled(item.status)).length,
      guest,
      member: orders.length - guest,
      statusCounts,
      days,
      max: Math.max(...days.map((item) => item.value), 1),
    };
  }, [bookings, range]);
  const saveVehicle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !vehicleForm ||
      !vehicleForm.name.trim() ||
      !vehicleForm.licensePlate.trim() ||
      vehicleForm.dailyPrice <= 0 ||
      vehicleForm.quantity <= 0
    ) {
      notify("Hãy nhập tên xe, biển số, giá thuê và số lượng hợp lệ.");
      return;
    }
    setSaving(true);
    const payload = {
      name: vehicleForm.name.trim(),
      licensePlate: vehicleForm.licensePlate.trim().toUpperCase(),
      brand: vehicleForm.brand.trim(),
      type: vehicleForm.type,
      dailyPrice: Number(vehicleForm.dailyPrice),
      quantity: Number(vehicleForm.quantity),
      image: vehicleForm.image.trim(),
      description: vehicleForm.description.trim(),
      specs: vehicleForm.specs.trim(),
      amenities: vehicleForm.amenitiesText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      status: vehicleForm.status,
      isVisible: vehicleForm.isVisible,
      updatedAt: serverTimestamp(),
    };
    try {
      if (vehicleForm.id) {
        await updateDoc(doc(db, "vehicles", vehicleForm.id), payload);
      } else {
        await addDoc(collection(db, "vehicles"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      setVehicleForm(null);
      notify("Đã lưu thông tin xe.");
    } catch {
      notify("Không thể lưu xe. Hãy kiểm tra Firestore Rules.");
    } finally {
      setSaving(false);
    }
  };
  const savePrices = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!priceRows.length || priceRows.some(item =>
      !item.name.trim() || [item.oneToFive, item.sixToTen, item.elevenToTwenty, item.overTwenty]
        .some(value => !Number.isFinite(value) || value <= 0)
    )) {
      notify("Hãy nhập đủ tên loại xe và bốn mức giá hợp lệ.");
      return;
    }
    setSaving(true);
    try {
      const batch = writeBatch(db);
      priceRows.forEach(item => {
        const payload = {
          name: item.name.trim(),
          oneToFive: Number(item.oneToFive),
          sixToTen: Number(item.sixToTen),
          elevenToTwenty: Number(item.elevenToTwenty),
          overTwenty: Number(item.overTwenty),
          updatedAt: serverTimestamp(),
        };
        const ref = doc(db, "pricing", item.id);
        if (item.isNew) batch.set(ref, { ...payload, createdAt: serverTimestamp() });
        else batch.update(ref, payload);
      });
      await batch.commit();
      setPriceRows(current => current.map(item => ({ ...item, isNew: false, isDirty: false })));
      notify("Đã cập nhật bảng giá trang chủ.");
    } catch {
      notify("Không thể cập nhật bảng giá. Hãy thử lại.");
    } finally {
      setSaving(false);
    }
  };
  const editVehicle = (item?: Vehicle) =>
    setVehicleForm(
      item
        ? { ...item, amenitiesText: item.amenities.join(", ") }
        : blankVehicle(),
    );
  const manageVehicle = async (item: Vehicle, action: "hide" | "delete") => {
    if (vehicleActionId !== null || saving) return;
    const showing = action === "hide" && !item.isVisible;
    const question = action === "delete"
      ? "Xóa vĩnh viễn xe này? Thao tác không thể hoàn tác."
      : showing
        ? item.status === "inactive" && !item.statusBeforeHide
          ? "Bỏ ẩn xe này và chuyển trạng thái sang Trống?"
          : "Bỏ ẩn xe này?"
        : "Ẩn xe này khỏi trang chủ?";
    if (!window.confirm(question)) return;
    setVehicleActionId(item.id);
    try {
      if (action === "hide") {
        const payload: { isVisible: boolean; updatedAt: ReturnType<typeof serverTimestamp>; status?: string; statusBeforeHide?: string } = {
          isVisible: !item.isVisible,
          updatedAt: serverTimestamp(),
        };
        if (!showing) payload.statusBeforeHide = item.status;
        // Bản cũ đã đổi trạng thái thành inactive khi ẩn xe.
        if (showing && item.status === "inactive") {
          payload.status = item.statusBeforeHide || "available";
        }
        await updateDoc(doc(db, "vehicles", item.id), payload);
      } else {
        await deleteDoc(doc(db, "vehicles", item.id));
      }
      notify(action === "delete" ? "Đã xóa xe." : showing ? "Đã bỏ ẩn xe." : "Đã ẩn xe khỏi trang chủ.");
    } catch {
      notify("Không thể cập nhật xe.");
    } finally {
      setVehicleActionId(null);
    }
  };
  const updatePrice = (
    id: string,
    key: "name" | "oneToFive" | "sixToTen" | "elevenToTwenty" | "overTwenty",
    value: string | number,
  ) => {
    if (saving) return;
    setPriceRows((current) =>
      current.map((item) =>
        item.id !== id
          ? item
          : key === "name"
            ? { ...item, name: String(value), isDirty: true }
            : { ...item, [key]: num(value), isDirty: true } as PriceRow,
      ),
    );
  };
  const addPriceRow = () => {
    if (saving) return;
    setPriceRows((current) => [
      ...current,
      {
        id: doc(collection(db, "pricing")).id,
        isNew: true,
        name: "",
        oneToFive: 100000,
        sixToTen: 90000,
        elevenToTwenty: 80000,
        overTwenty: 70000,
      },
    ]);
  };
  const removePriceRow = async (item: PriceRow) => {
    if (saving) return;
    if (item.isNew) {
      setPriceRows(current => current.filter(row => row.id !== item.id));
      return;
    }
    if (!window.confirm(`Xóa loại xe "${item.name}" khỏi bảng giá trang chủ?`)) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "pricing", item.id));
      setPriceRows(current => current.filter(row => row.id !== item.id));
      notify("Đã xóa loại xe khỏi bảng giá trang chủ.");
    } catch {
      notify("Không thể xóa loại xe khỏi bảng giá.");
    } finally {
      setSaving(false);
    }
  };
  const filteredVehicles = vehicles.filter((item) =>
    [item.name, item.licensePlate, item.brand, item.type]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const guestPercent = stats.total
    ? Math.round((stats.guest * 100) / stats.total)
    : 0;
  if (!ready) {
    return <main className="bm-loading">Đang kiểm tra quyền truy cập…</main>;
  }
  return (
    <main className="business-manager">
      {notice && <div className="bm-notice">✓ {notice}</div>}
      <aside className="bm-sidebar">
        <a className="bm-brand" href="/">
          <span className="bm-brand-mark">V</span>
          <span>VI VU <b>BIKE</b></span>
        </a>
        <div className="bm-profile">
          <span className="bm-avatar">{name.slice(0, 1).toUpperCase()}</span>
          <div>
            <b>{name}</b>
            <small>Quản lý kinh doanh</small>
          </div>
        </div>
        <a className="bm-home-link" href="/">⌂ <span>Trang chủ</span></a>
        <p className="bm-menu-group">Quản lý kinh doanh</p>
        <nav>
          <button
            className={tab === "dashboard" ? "active" : ""}
            onClick={() => setTab("dashboard")}
          >
            ▦ Báo cáo thống kê
          </button>
          <button
            className={tab === "vehicles" ? "active" : ""}
            onClick={() => setTab("vehicles")}
          >
            ▣ Quản lý xe
          </button>
          <button
            className={tab === "homepage" ? "active" : ""}
            onClick={() => setTab("homepage")}
          >
            ▤ Bảng giá trang chủ
          </button>
        </nav>
        <div className="bm-side-actions">
          <button
            onClick={async () => {
              await signOut(auth);
              router.replace("/");
            }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>
      <section className="bm-content">
        <header>
          <div>
            <p>VI VU BIKE / QUẢN LÝ KINH DOANH</p>
            <h1>
              {tab === "dashboard"
                ? "Báo cáo thống kê"
                : tab === "vehicles"
                  ? "Quản lý danh mục xe"
                  : "Cập nhật bảng giá trang chủ"}
            </h1>
          </div>
          <div className="bm-user">
            <span className="bm-role-tag">MANAGER</span>
            <span className="bm-avatar small">{name.slice(0, 1).toUpperCase()}</span>
            <b>
              {name}
              <small>Quản lý kinh doanh</small>
            </b>
          </div>
        </header>
        {tab === "dashboard" && (
          <section className="bm-page">
            <div className="bm-filter">
              <div>
                <b>Khoảng thời gian</b>
                <small>Doanh thu chỉ tính các đơn đã trả xe.</small>
              </div>
              <div>
                {(["today", "week", "month", "custom"] as Period[]).map(
                  (item) => (
                    <button
                      className={period === item ? "selected" : ""}
                      key={item}
                      onClick={() => setPeriod(item)}
                    >
                      {item === "today"
                        ? "Hôm nay"
                        : item === "week"
                          ? "Tuần này"
                          : item === "month"
                            ? "Tháng này"
                            : "Tùy chọn"}
                    </button>
                  ),
                )}
              </div>
              {period === "custom" && (
                <label>
                  Từ
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                  Đến
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="bm-kpis">
              <article>
                <span>DOANH THU ĐÃ THU</span>
                <b>{money(stats.revenue)}</b>
                <small>{stats.done} đơn đã trả xe</small>
              </article>
              <article>
                <span>TỔNG ĐƠN ĐẶT XE</span>
                <b>{stats.total}</b>
                <small>{stats.success} đơn chưa bị hủy</small>
              </article>
              <article>
                <span>ĐƠN ĐÃ HỦY</span>
                <b>{stats.cancel}</b>
                <small>Trong khoảng đã chọn</small>
              </article>
              <article>
                <span>TỔNG ĐỘI XE</span>
                <b>{fleet.total}</b>
                <small>
                  {fleet.available} xe trống · {fleet.maintenance} bảo dưỡng
                </small>
              </article>
            </div>
            <div className="bm-grid">
              <article>
                <div className="bm-title">
                  <div>
                    <h2>Doanh thu theo ngày</h2>
                    <small>Di chuột vào cột để xem số tiền.</small>
                  </div>
                  <b>{money(stats.revenue)}</b>
                </div>
                <div className="bm-bars">
                  {stats.days.map((item) => (
                    <div
                      key={item.id}
                      title={item.title + ": " + money(item.value)}
                    >
                      <i
                        style={{
                          height: Math.max(5, (item.value * 100) / stats.max) + "%",
                        }}
                      />
                      <small>{item.title}</small>
                    </div>
                  ))}
                </div>
              </article>
              <article>
                <div className="bm-title">
                  <div>
                    <h2>Trạng thái đơn thuê</h2>
                    <small>Chi tiết các đơn tạo trong kỳ đã chọn.</small>
                  </div>
                  <b>{stats.total} đơn</b>
                </div>
                <div className="bm-legend">
                  {Object.entries(stats.statusCounts).map(([status, count]) => (
                    <p key={status}>
                      <i className={status === "cancelled" || status === "canceled" ? "member" : ""} />
                      {bookingStatusLabel[status] || status}
                      <b>{count} đơn</b>
                      <small>
                        {stats.total
                          ? Math.round((count * 100) / stats.total)
                          : 0}
                        % tổng đơn trong kỳ
                      </small>
                    </p>
                  ))}
                  {!Object.keys(stats.statusCounts).length && (
                    <p>
                      <i />
                      Chưa có đơn trong khoảng thời gian này
                    </p>
                  )}
                </div>
              </article>
            </div>
            <div className="bm-grid" style={{ marginTop: 18 }}>
              <article>
                <div className="bm-title">
                  <div>
                    <h2>Tình trạng đội xe</h2>
                    <small>Xe đang hoạt động, cập nhật theo dữ liệu xe và đơn thuê.</small>
                  </div>
                  <b>{fleetConditionReady ? `${fleetCondition.total} xe` : "—"}</b>
                </div>
                <div className="bm-legend" aria-live="polite">
                  {(fleetSources.vehiclesError || fleetSources.bookingsError) ? (
                    <p role="alert">Không tải được tình trạng đội xe. Hãy kiểm tra kết nối và quyền truy cập dữ liệu.</p>
                  ) : !fleetConditionReady ? (
                    <p>Đang tải tình trạng đội xe từ database...</p>
                  ) : <>
                    {([
                      ["available", "Xe trống"],
                      ["reserved", "Xe đã được đặt"],
                      ["rented", "Xe đang cho thuê"],
                    ] as const).map(([status, label]) => (
                      <p key={status}>
                        <i />
                        {label}
                        <b>{fleetCondition[status]} xe</b>
                        <small>
                          {fleetCondition.total ? Math.round((fleetCondition[status] * 100) / fleetCondition.total) : 0}% đội xe
                        </small>
                      </p>
                    ))}
                    {fleetCondition.unmatchedBookings > 0 && <small role="status">Có {fleetCondition.unmatchedBookings} đơn đang mở chưa liên kết được với xe trong danh mục; cần kiểm tra lại thông tin xe của đơn.</small>}
                    {fleetCondition.issues.length > 0 && <details style={{ gridColumn: "1 / -1" }}>
                      <summary>Xem đơn cần kiểm tra liên kết ({fleetCondition.issues.length})</summary>
                      <ul>{fleetCondition.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
                    </details>}
                    {fleetCondition.overbooked > 0 && <small role="status">Số đơn đang mở vượt số lượng xe trong danh mục; cần kiểm tra lại đơn đặt trùng hoặc số lượng xe.</small>}
                  </>}
                </div>
              </article>
              <article>
                <div className="bm-title">
                  <div>
                    <h2>Tệp khách hàng</h2>
                    <small>Phân loại theo đơn thuê đã tạo.</small>
                  </div>
                </div>
                <div className="bm-pie-row">
                  <div
                    className="bm-pie"
                    title={"Khách vãng lai: " + stats.guest + " · Thành viên: " + stats.member}
                    style={{
                      background:
                        "conic-gradient(#f26522 0 " +
                        guestPercent +
                        "%, #202a32 " +
                        guestPercent +
                        "% 100%)",
                    }}
                  >
                    <div>
                      <b>{stats.total}</b>
                      <small>đơn</small>
                    </div>
                  </div>
                  <div className="bm-legend">
                    <p>
                      <i />
                      Khách vãng lai
                      <b>{guestPercent}%</b>
                      <small>{stats.guest} đơn</small>
                    </p>
                    <p>
                      <i className="member" />
                      Khách thành viên
                      <b>{100 - guestPercent}%</b>
                      <small>{stats.member} đơn</small>
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </section>
        )}
        {tab === "vehicles" && (
          <section className="bm-page">
            <div className="bm-action">
              <div>
                <h2>Toàn bộ xe</h2>
                <small>Thêm số lượng xe, cập nhật trạng thái hoặc ẩn xe khỏi khách hàng.</small>
              </div>
              <button className="primary" onClick={() => editVehicle()}>
                + Thêm xe mới
              </button>
            </div>
            <input
              className="bm-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên xe, biển số, hãng hoặc loại xe…"
            />
            <div className="bm-table">
              <table>
                <thead>
                  <tr>
                    <th>Xe</th>
                    <th>Biển số / Hãng</th>
                    <th>Giá thực tế</th>
                    <th>Số lượng</th>
                    <th>Trạng thái</th>
                    <th>Hiển thị</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((item) => (
                    <tr key={item.id}>
                      <td className="vehicle">
                        {item.image ? <img src={item.image} alt="" /> : <i>XE</i>}
                        <b>
                          {item.name}
                          <small>{item.type}</small>
                        </b>
                      </td>
                      <td>
                        <b>
                          {item.licensePlate || "Chưa có biển số"}
                          <small>{item.brand || "Chưa có hãng"}</small>
                        </b>
                      </td>
                      <td>
                        {money(item.dailyPrice)}
                        <small>/ ngày</small>
                      </td>
                      <td>
                        <b>{item.quantity}</b>
                        <small>xe</small>
                      </td>
                      <td>
                        <em className={item.status}>
                          {vehicleStatusLabel[item.status] || item.status}
                        </em>
                      </td>
                      <td>{item.isVisible ? "Đang hiện" : "Đang ẩn"}</td>
                      <td className="actions">
                        <button disabled={saving || vehicleActionId !== null} onClick={() => editVehicle(item)}>Sửa</button>
                        <button disabled={saving || vehicleActionId !== null} onClick={() => manageVehicle(item, "hide")}>
                          {vehicleActionId === item.id ? "Đang xử lý…" : item.isVisible ? "Ẩn" : "Bỏ ẩn"}
                        </button>
                        <button
                          className="danger"
                          disabled={saving || vehicleActionId !== null}
                          onClick={() => manageVehicle(item, "delete")}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!filteredVehicles.length && (
                    <tr>
                      <td colSpan={7}>Chưa có xe phù hợp.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {vehicleForm && (
              <div className="overlay">
                <form className="editor" onSubmit={saveVehicle}>
                  <div className="editor-head">
                    <div>
                      <p>{vehicleForm.id ? "CẬP NHẬT XE" : "THÊM XE MỚI"}</p>
                      <h2>{vehicleForm.id ? vehicleForm.name : "Thông tin xe"}</h2>
                    </div>
                    <button type="button" onClick={() => setVehicleForm(null)}>
                      ✕
                    </button>
                  </div>
                  <div className="form-grid">
                    <label>
                      Tên xe
                      <input
                        required
                        value={vehicleForm.name}
                        onChange={(event) =>
                          setVehicleForm({ ...vehicleForm, name: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Biển số
                      <input
                        required
                        value={vehicleForm.licensePlate}
                        onChange={(event) =>
                          setVehicleForm({
                            ...vehicleForm,
                            licensePlate: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Hãng xe
                      <input
                        value={vehicleForm.brand}
                        onChange={(event) =>
                          setVehicleForm({ ...vehicleForm, brand: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Loại xe
                      <select
                        value={vehicleForm.type}
                        onChange={(event) =>
                          setVehicleForm({ ...vehicleForm, type: event.target.value })
                        }
                      >
                        <option>Tay ga</option>
                        <option>Xe số</option>
                        <option>Côn tay</option>
                        <option>Khác</option>
                      </select>
                    </label>
                    <label>
                      Giá thuê thực tế (đ/ngày)
                      <input
                        required
                        min="1"
                        type="number"
                        value={vehicleForm.dailyPrice}
                        onChange={(event) =>
                          setVehicleForm({
                            ...vehicleForm,
                            dailyPrice: num(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Số lượng xe
                      <input
                        required
                        min="1"
                        type="number"
                        value={vehicleForm.quantity}
                        onChange={(event) =>
                          setVehicleForm({
                            ...vehicleForm,
                            quantity: Math.max(1, num(event.target.value)),
                          })
                        }
                      />
                    </label>
                    <label>
                      Trạng thái
                      <select
                        value={vehicleForm.status}
                        onChange={(event) =>
                          setVehicleForm({ ...vehicleForm, status: event.target.value })
                        }
                      >
                        <option value="available">Trống</option>
                        <option value="reserved">Đang đặt</option>
                        <option value="delivered">Đã giao</option>
                        <option value="maintenance">Đang bảo dưỡng</option>
                        <option value="inactive">Ngừng hoạt động</option>
                      </select>
                    </label>
                    <label className="wide">
                      URL ảnh xe
                      <input
                        value={vehicleForm.image}
                        onChange={(event) =>
                          setVehicleForm({ ...vehicleForm, image: event.target.value })
                        }
                        placeholder="https://…"
                      />
                    </label>
                    <label className="wide">
                      Mô tả
                      <textarea
                        value={vehicleForm.description}
                        onChange={(event) =>
                          setVehicleForm({
                            ...vehicleForm,
                            description: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Thông số
                      <input
                        value={vehicleForm.specs}
                        onChange={(event) =>
                          setVehicleForm({ ...vehicleForm, specs: event.target.value })
                        }
                        placeholder="110cc · Phanh CBS"
                      />
                    </label>
                    <label>
                      Tiện ích (dấu phẩy)
                      <input
                        value={vehicleForm.amenitiesText}
                        onChange={(event) =>
                          setVehicleForm({
                            ...vehicleForm,
                            amenitiesText: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="wide check">
                      <input
                        type="checkbox"
                        checked={vehicleForm.isVisible}
                        onChange={(event) =>
                          setVehicleForm({
                            ...vehicleForm,
                            isVisible: event.target.checked,
                          })
                        }
                      />
                      Hiển thị xe này ở trang chủ
                    </label>
                  </div>
                  <div className="editor-actions">
                    <button type="button" onClick={() => setVehicleForm(null)}>
                      Hủy
                    </button>
                    <button className="primary" disabled={saving}>
                      {saving ? "Đang lưu…" : "Lưu xe"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}
        {tab === "homepage" && (
          <section className="bm-page">
            <div className="bm-action">
              <div>
                <h2>Bảng giá tham khảo trên trang chủ</h2>
                <small>
                  Thay đổi ở đây sẽ sửa trực tiếp bảng “Thuê lâu hơn, giá tốt hơn”
                  mà khách hàng nhìn thấy.
                </small>
              </div>
              <button type="button" className="primary" disabled={saving} onClick={addPriceRow}>
                + Thêm loại xe
              </button>
            </div>
            <form onSubmit={savePrices}>
              <div className="bm-table">
                <table>
                  <thead>
                    <tr>
                      <th>Loại xe</th>
                      <th>1–5 ngày</th>
                      <th>6–10 ngày</th>
                      <th>11–20 ngày</th>
                      <th>Từ 21 ngày</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceRows.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            required
                            value={item.name}
                            disabled={saving}
                            style={priceInputStyle}
                            onChange={(event) =>
                              updatePrice(item.id, "name", event.target.value)
                            }
                          />
                        </td>
                        {(
                          [
                            "oneToFive",
                            "sixToTen",
                            "elevenToTwenty",
                            "overTwenty",
                          ] as const
                        ).map((key) => (
                          <td key={key}>
                            <input
                              required
                              min="1"
                              type="number"
                              value={item[key]}
                              disabled={saving}
                              style={priceInputStyle}
                              onChange={(event) =>
                                updatePrice(item.id, key, event.target.value)
                              }
                            />
                          </td>
                        ))}
                        <td className="actions">
                          <button
                            type="button"
                            className="danger"
                            disabled={saving}
                            onClick={() => removePriceRow(item)}
                          >
                            {item.isNew ? "Bỏ dòng" : "Xóa dòng"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!priceRows.length && (
                      <tr>
                        <td colSpan={6}>Chưa có dữ liệu trong collection pricing.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="editor-actions" style={{ borderTop: 0, paddingTop: 18 }}>
                <button className="primary" disabled={saving || !priceRows.length}>
                  {saving ? "Đang cập nhật…" : "Cập nhật bảng giá trang chủ"}
                </button>
              </div>
            </form>
          </section>
        )}
      </section>
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap");
        :root{--bm-ink:#17202a;--bm-muted:#66707b;--bm-line:#e6e9ed;--bm-orange:#f86522;--bm-surface:#f4f6f8}
        *{box-sizing:border-box}
        body{margin:0;background:var(--bm-surface);color:var(--bm-ink);font-family:"Be Vietnam Pro",Arial,sans-serif;font-size:15px}
        button,input,select,textarea{font:inherit}button{cursor:pointer}
        .business-manager{min-height:100vh;background:var(--bm-surface);color:var(--bm-ink)}
        .bm-sidebar{width:288px;min-height:100vh;position:fixed;inset:0 auto 0 0;z-index:20;padding:28px 20px;background:#15181b;color:#fff;display:flex;flex-direction:column}
        .bm-brand{display:flex;align-items:center;gap:10px;padding:0 10px;color:#fff;text-decoration:none;font-size:17px;font-weight:800;letter-spacing:.06em}
        .bm-brand b{color:#ff6b25}.bm-brand-mark{display:grid;place-items:center;width:34px;height:34px;background:#ff6823;color:#fff;clip-path:polygon(50% 0,100% 18%,82% 100%,18% 100%,0 18%)}
        .bm-profile{display:flex;align-items:center;gap:12px;margin:37px 10px 24px;padding-bottom:22px;border-bottom:1px solid rgba(255,255,255,.13)}
        .bm-avatar{display:grid;place-items:center;flex:0 0 auto;width:44px;height:44px;border-radius:50%;background:#ff6823;color:#fff;font-size:13px;font-weight:800}.bm-avatar.small{width:36px;height:36px;font-size:11px}
        .bm-profile b,.bm-profile small,.bm-user b,.bm-user small{display:block}.bm-profile b{font-size:14px}.bm-profile small{margin-top:4px;color:#aeb6be;font-size:12px}
        .bm-home-link,.bm-sidebar nav button,.bm-side-actions button{width:100%;display:flex;align-items:center;gap:14px;border:0;color:#c5cbd1;background:transparent;text-decoration:none;text-align:left;font-size:14px;font-weight:700;padding:13px 14px;border-radius:8px}
        .bm-home-link{margin-bottom:19px}.bm-home-link:hover,.bm-sidebar nav button:hover{color:#fff;background:rgba(255,255,255,.06)}
        .bm-menu-group{margin:0 14px 8px;color:#767e87;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
        .bm-sidebar nav{display:grid;gap:5px}.bm-sidebar nav button.active{color:#fff;background:#f86522;box-shadow:0 8px 20px rgba(248,101,34,.25)}
        .bm-side-actions{display:grid;gap:4px;margin-top:auto;border-top:1px solid rgba(255,255,255,.13);padding-top:8px}.bm-side-actions a{padding:12px 14px;color:#c5cbd1;text-decoration:none;font-size:13px;font-weight:700}.bm-side-actions a:hover,.bm-side-actions button:hover{color:#fff}.bm-side-actions button{border-radius:0;padding-top:12px;font-size:13px}
        .bm-content{width:calc(100% - 288px);min-height:100vh;margin-left:288px}.bm-content>header{height:112px;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:0 48px;background:#fff;border-bottom:1px solid #e9ecef}
        .bm-content>header p,.editor-head p,.preview>p{margin:0 0 8px;color:var(--bm-orange);font-size:11px;font-weight:800;letter-spacing:.15em}.bm-content>header h1{margin:0;font-size:31px;letter-spacing:-.04em}
        .bm-user{display:flex;align-items:center;gap:10px;font-size:14px}.bm-user b{font-size:14px}.bm-user small{margin-top:3px;color:var(--bm-muted);font-size:11px}.bm-role-tag{padding:6px 9px;border-radius:6px;background:#fff0e8;color:#dd5215;font-size:10px;font-weight:800;letter-spacing:.08em}
        .bm-page{max-width:1380px;padding:38px 48px 54px}.bm-filter,.bm-grid>article,.home-form{background:#fff;border:1px solid var(--bm-line);border-radius:13px}
        .bm-filter{display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:19px 22px}.bm-filter b,.bm-filter small{display:block}.bm-filter b{font-size:14px}.bm-filter small{margin-top:4px;color:var(--bm-muted);font-size:12px}.bm-filter>div:last-of-type{display:flex;gap:7px;flex-wrap:wrap;margin-left:auto}.bm-filter button{border:1px solid #dfe4e8;border-radius:7px;background:#fff;color:#55616a;padding:9px 11px;font-size:12px;font-weight:700}.bm-filter button:hover{border-color:#f7b18f;color:#d75317}.bm-filter .selected{border-color:var(--bm-orange);background:#fff1eb;color:#c94f17}.bm-filter label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700}.bm-filter input{border:1px solid #dce3e6;border-radius:6px;padding:7px;background:#fff}
        .bm-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:22px 0}.bm-kpis article{min-height:148px;padding:22px;background:#fff;border:1px solid var(--bm-line);border-radius:13px}.bm-kpis span,.bm-kpis small{display:block}.bm-kpis span{font-size:10px;color:var(--bm-muted);font-weight:800;letter-spacing:.08em}.bm-kpis b{display:block;margin:14px 0 7px;font-size:27px;letter-spacing:-.04em}.bm-kpis small{font-size:12px;color:var(--bm-muted)}
        .bm-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,.8fr);gap:18px}.bm-grid>article{padding:23px}.bm-title{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.bm-title h2,.bm-action h2{margin:0;font-size:19px;letter-spacing:-.025em}.bm-title small,.bm-action small{display:block;margin-top:6px;color:var(--bm-muted);font-size:12px}.bm-title>b{font-size:15px;color:var(--bm-orange)}
        .bm-bars{height:255px;display:flex;align-items:flex-end;gap:4px;overflow-x:auto;padding:22px 0 0}.bm-bars>div{height:100%;min-width:24px;flex:1;display:grid;grid-template-rows:1fr auto;gap:7px;align-items:end;text-align:center}.bm-bars>div:before{content:"";grid-row:1;background:#f4f6f8;border-radius:5px 5px 0 0}.bm-bars i{grid-row:1;grid-column:1;align-self:end;width:100%;min-height:5px;border-radius:5px 5px 0 0;background:linear-gradient(180deg,#ff8d59,var(--bm-orange))}.bm-bars small{font-size:9px;color:var(--bm-muted);white-space:nowrap}
        .bm-pie-row{display:flex;align-items:center;justify-content:center;gap:24px;margin-top:35px}.bm-pie{width:156px;height:156px;display:grid;place-items:center;flex:none;border-radius:50%}.bm-pie>div{width:108px;height:108px;display:grid;place-content:center;border-radius:50%;background:#fff;text-align:center}.bm-pie b{font-size:28px}.bm-pie small{font-size:11px;color:var(--bm-muted)}.bm-legend{display:grid;gap:20px}.bm-legend p{position:relative;margin:0;padding-left:18px;font-size:12px}.bm-legend i{position:absolute;left:0;top:2px;width:10px;height:10px;border-radius:50%;background:var(--bm-orange)}.bm-legend i.member{background:#202a32}.bm-legend b{display:block;margin-top:5px;font-size:17px}.bm-legend small{display:block;margin-top:3px;color:var(--bm-muted)}
        .bm-action{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}.primary{border:0;border-radius:8px;background:var(--bm-orange);color:#fff;padding:12px 15px;box-shadow:0 8px 16px rgba(242,101,34,.2);font-size:13px;font-weight:800}.primary:hover{background:#e45716}.primary:disabled{opacity:.6;cursor:wait}.bm-search{width:100%;margin-bottom:16px;border:1px solid var(--bm-line);border-radius:9px;background:#fff;padding:12px 14px;font-size:13px;outline-color:var(--bm-orange)}
        .bm-table{overflow:auto;border:1px solid var(--bm-line);border-radius:12px;background:#fff}table{width:100%;min-width:820px;border-collapse:collapse}th,td{padding:14px 16px;border-bottom:1px solid var(--bm-line);text-align:left;vertical-align:middle;font-size:13px}th{background:#fafbfc;color:var(--bm-muted);font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}tr:last-child td{border-bottom:0}td small{display:block;margin-top:4px;color:var(--bm-muted);font-size:11px}.vehicle{display:flex;align-items:center;gap:10px;min-width:210px}.vehicle img,.vehicle>i{display:grid;place-items:center;width:46px;height:35px;border-radius:6px;background:#eff2f3;color:#77838a;object-fit:cover;font-size:10px;font-style:normal}.vehicle b{font-size:13px}em{display:inline-block;padding:6px 8px;border-radius:99px;background:#edf7ef;color:#28713c;font-size:11px;font-style:normal;font-weight:800;white-space:nowrap}em.reserved{background:#fff6df;color:#a36e00}em.delivered{background:#eaf2ff;color:#1e63af}em.maintenance{background:#fceced;color:#b83a45}em.inactive{background:#edf0f2;color:#67727a}.actions{white-space:nowrap}.actions button{border:0;background:transparent;color:#27618d;padding:3px 5px;font-size:12px;font-weight:800}.actions button:hover{text-decoration:underline}.actions .danger{color:#c23c44}
        .overlay{position:fixed;inset:0;z-index:50;display:grid;place-items:start center;overflow:auto;padding:32px;background:rgba(18,28,35,.55)}.editor{width:min(760px,100%);margin:auto;padding:26px;border-radius:16px;background:#fff;box-shadow:0 24px 80px rgba(0,0,0,.24)}.editor-head{display:flex;justify-content:space-between;gap:15px;padding-bottom:20px;border-bottom:1px solid var(--bm-line)}.editor-head h2{margin:0;font-size:23px;letter-spacing:-.03em}.editor-head>button{width:32px;height:32px;border:0;border-radius:50%;background:#f1f3f4}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:17px;margin:22px 0}.form-grid label,.home-form label{display:grid;gap:7px;color:#42515a;font-size:12px;font-weight:800}.form-grid input,.form-grid select,.form-grid textarea,.home-form input,.home-form textarea{width:100%;border:1px solid #dfe5e8;border-radius:7px;background:#fff;padding:10px;font-size:13px;outline-color:var(--bm-orange)}.form-grid textarea,.home-form textarea{min-height:88px;resize:vertical}.form-grid .wide{grid-column:1/-1}.form-grid .check{display:flex;align-items:center;gap:9px}.form-grid .check input{width:auto}.editor-actions{display:flex;justify-content:flex-end;gap:10px;padding-top:18px;border-top:1px solid var(--bm-line)}.editor-actions>button:not(.primary){border:1px solid #dfe5e8;border-radius:8px;background:#fff;padding:11px 15px;font-size:13px;font-weight:800}.editor-actions>button:not(.primary):hover{background:#f6f7f8}
        .home-form{max-width:730px;padding:24px;display:grid;gap:17px}.home-form .primary{justify-self:start}.preview{max-width:730px;margin-top:22px;border-radius:14px;background:#15181b;color:#fff;padding:28px}.preview h2{margin:0 0 24px;font-size:28px;letter-spacing:-.035em}.preview>div{display:grid;grid-template-columns:1fr 1fr;gap:12px}.preview article{display:grid;gap:8px;padding:16px;border-radius:9px;background:rgba(255,255,255,.08)}.preview article span{color:#ffad87;font-size:10px;font-weight:800;letter-spacing:.1em}.preview article b{font-size:18px}.preview>small{display:block;margin-top:17px;color:#b4bfc5;font-size:12px}
        .bm-notice{position:fixed;z-index:80;top:20px;left:50%;transform:translateX(-50%);border-radius:8px;background:#17212a;color:#fff;padding:13px 16px;box-shadow:0 12px 28px rgba(0,0,0,.25);font-size:13px}.bm-loading{min-height:100vh;display:grid;place-items:center;background:var(--bm-surface);color:#52616a;font:600 15px "Be Vietnam Pro",Arial,sans-serif}
        @media(max-width:1000px){.bm-sidebar{position:static;width:auto;min-height:0;height:auto;padding:18px;display:block}.bm-profile,.bm-home-link,.bm-menu-group{display:none}.bm-sidebar nav{grid-template-columns:repeat(4,max-content);overflow:auto}.bm-sidebar nav button{white-space:nowrap}.bm-side-actions{display:flex;justify-content:space-between;margin-top:12px;border-top:0}.bm-content{width:100%;margin-left:0}.bm-content>header,.bm-page{padding-left:24px;padding-right:24px}.bm-kpis{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:700px){.bm-content>header{height:auto;padding:22px;align-items:flex-start}.bm-content>header h1{font-size:23px}.bm-user{display:none}.bm-page{padding:24px 16px 45px}.bm-filter>div:last-of-type{margin-left:0}.bm-kpis,.bm-grid{grid-template-columns:1fr}.bm-pie-row{align-items:flex-start}.bm-action{flex-direction:column}.overlay{padding:10px}.editor{padding:20px}.form-grid{grid-template-columns:1fr}.form-grid .wide{grid-column:auto}.preview>div{grid-template-columns:1fr}.bm-filter label{flex-wrap:wrap}}
      `}</style>
    </main>
  );
}
