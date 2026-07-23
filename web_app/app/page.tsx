"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Route =
  | "/login"
  | "/register"
  | "/home"
  | "/room"
  | "/wallet"
  | "/gifts"
  | "/podcasts";

type User = { id: string; email: string; displayName: string; role: string };
type Session = { token: string; user: User };
type Wallet = { id: string; userId: string; balance: number; currencyCode: string };
type Gift = {
  id: string;
  fromUserId: string;
  toCreatorId: string;
  fromDisplayName?: string;
  toDisplayName?: string;
  roomId?: string;
  amount: number;
  message?: string;
  createdAt: string;
};
type Podcast = {
  id: string;
  creatorId: string;
  creatorDisplayName?: string;
  roomId: string;
  title: string;
  storageUri: string;
  durationSeconds: number;
  createdAt: string;
};
type Participant = {
  participantId: string;
  userId: string;
  displayName: string;
  role: string;
  micEnabled: boolean;
  joinedAt: string;
};
type Room = { roomId: string; title?: string; createdAt: string; users: Participant[]; raisedHands: string[]; languageCode?: string; levelNumber?: number };
type ChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  message: string;
  createdAt: string;
  kind?: "CHAT" | "SUPER_CHAT" | "DOCUMENT";
  amount?: number;
  toUserId?: string;
  toDisplayName?: string;
  documentName?: string;
  documentUrl?: string;
  documentSize?: number;
};
type RecordingState = {
  status: 'RECORDING' | 'SAVED' | 'NONE' | 'ERROR';
  startedBy?: string;
  startedAt?: string;
  recordingId?: string;
  audioUrl?: string;
  error?: string;
};
type RoomInfo = { roomId: string; title: string; languageCode: string; levelNumber: number; participantCount?: number; status: string; hasPassword?: boolean };
type Socket = {
  connected: boolean;
  on<T extends unknown[]>(event: string, callback: (...args: T) => void): Socket;
  off(event?: string): Socket;
  emit(event: string, ...args: unknown[]): Socket;
  disconnect(): Socket;
};

declare global {
  interface Window {
    io?: (url: string, options?: Record<string, unknown>) => Socket;
  }
}

const SESSION_KEY = "lucy_session";
const ACTIVE_ROOM_KEY = "lucy_active_room";
const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:3020";
const SPEAKING_THRESHOLD = 0.035;
const SPEAKING_HOLD_FRAMES = 8;
const MAX_CHAT_MESSAGE_LENGTH = 500;
const MAX_LIVE_CHAT_MESSAGES = 200;
const MAX_JOIN_RETRIES = 3;
const JOIN_ACK_TIMEOUT_MS = 5000;
const realtimeAssetUrl = (uri: string) => /^https?:\/\//i.test(uri)
  ? uri
  : uri.startsWith("/") ? `${REALTIME_URL.replace(/\/$/, "")}${uri}` : "";
const playableAudioUrl = realtimeAssetUrl;
const readableFileSize = (bytes = 0) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : bytes >= 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${bytes} B`;
const audioFileDuration = (file: File) => new Promise<number>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const audio = new Audio(url);
  audio.onloadedmetadata = () => {
    URL.revokeObjectURL(url);
    const seconds = Math.round(audio.duration);
    Number.isFinite(seconds) && seconds > 0 ? resolve(seconds) : reject(new Error("Không đọc được thời lượng audio"));
  };
  audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("File audio không hợp lệ")); };
});
const routes = new Set<Route>([
  "/login",
  "/register",
  "/home",
  "/room",
  "/wallet",
  "/gifts",
  "/podcasts",
]);

function currentRoute(): Route {
  const value = window.location.hash.slice(1) as Route;
  return routes.has(value) ? value : "/login";
}

function navigate(route: Route) {
  window.location.hash = route;
}

async function api<T>(
  service: "auth" | "wallet",
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...init } = options;
  const response = await fetch(`/api/backend/${service}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message || `Yêu cầu thất bại (${response.status})`);
  return body as T;
}

async function realtimeApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${REALTIME_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message || `Request failed (${response.status})`);
  return body as T;
}

function money(value: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export default function LucyPage() {
  const [route, setRoute] = useState<Route>("/login");
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [toast, setToast] = useState("");

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACTIVE_ROOM_KEY);
    setSession(null);
    navigate("/login");
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem(SESSION_KEY);
      if (!saved) {
        setBooting(false);
        return;
      }
      try {
        const cached = JSON.parse(saved) as Session;
        const me = await api<Partial<User>>("auth", "/auth/me", { token: cached.token });
        const restored = { token: cached.token, user: { ...cached.user, ...me, displayName: me.displayName || cached.user.displayName } };
        localStorage.setItem(SESSION_KEY, JSON.stringify(restored));
        setSession(restored);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setBooting(false);
      }
    };
    restore();
  }, []);

  useEffect(() => {
    if (booting) return;
    const publicRoute = route === "/login" || route === "/register";
    if (!session && !publicRoute) navigate("/login");
    if (session && publicRoute) navigate("/home");
  }, [booting, route, session]);

  const saveSession = (next: Session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [pendingRoomCode, setPendingRoomCode] = useState("");

  if (booting) return <div className="boot"><span className="spinner" />Đang mở LUCY…</div>;

  const content = !session ? (
    route === "/register" ? (
      <RegisterView notify={notify} />
    ) : (
      <LoginView onLogin={saveSession} />
    )
  ) : (
    <AppShell route={route} session={session} logout={logout}>
      <RoomView session={session} compact={route !== "/room"} onCreateRoom={() => setShowCreateRoom(true)} />
      {route === "/wallet" && <WalletView session={session} notify={notify} />}
      {route === "/gifts" && <GiftsView session={session} notify={notify} />}
      {route === "/podcasts" && <PodcastsView session={session} />}
      {(route === "/home" || route === "/login" || route === "/register") && <HomeView session={session} />}
    </AppShell>
  );

  return <>{content}{toast && <div className="toast" role="status">{toast}</div>}{showCreateRoom && session && <CreateRoomDialog session={session} onClose={() => setShowCreateRoom(false)} onCreated={(code) => { setShowCreateRoom(false); setPendingRoomCode(code); }} />}</>;
}

function LoginView({ onLogin }: { onLogin: (session: Session) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ accessToken: string; user: User }>("auth", "/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      onLogin({ token: result.accessToken, user: result.user });
      navigate("/home");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return <AuthFrame title="Chào mừng trở lại" subtitle="Đăng nhập để tiếp tục hành trình cùng LUCY" icon="✦">
    <form className="form" onSubmit={submit}>
      <label>Email<input name="email" type="email" autoComplete="email" placeholder="ban@lucy.local" required /></label>
      <label>Mật khẩu<span className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" minLength={6} required /><button type="button" className="text-button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Ẩn" : "Hiện"}</button></span></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary-button" disabled={loading}>{loading ? <><span className="spinner small" />Đang đăng nhập</> : "Đăng nhập"}</button>
    </form>
    <p className="auth-switch">Chưa có tài khoản? <a href="#/register">Đăng ký</a></p>
  </AuthFrame>;
}

function RegisterView({ notify }: { notify: (message: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("auth", "/auth/register", {
        method: "POST",
        body: JSON.stringify({ displayName: form.get("displayName"), email: form.get("email"), password: form.get("password"), role: form.get("role") }),
      });
      notify("Đăng ký thành công. Bạn có thể đăng nhập ngay!");
      navigate("/login");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  return <AuthFrame title="Tạo tài khoản" subtitle="Tham gia cộng đồng học tập LUCY" icon="＋">
    <form className="form" onSubmit={submit}>
      <label>Tên hiển thị<input name="displayName" autoComplete="name" required /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Mật khẩu<input name="password" type="password" autoComplete="new-password" minLength={6} required /></label>
      <label>Vai trò<select name="role" defaultValue="Anonymous"><option>Anonymous</option><option>Pro</option><option>Super</option></select></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary-button" disabled={loading}>{loading ? "Đang tạo…" : "Đăng ký"}</button>
    </form>
    <p className="auth-switch">Đã có tài khoản? <a href="#/login">Đăng nhập</a></p>
  </AuthFrame>;
}

function AuthFrame({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: string; children: React.ReactNode }) {
  return <main className="auth-page">
    <section className="auth-brand"><div className="brand-mark">✦</div><div><strong>LUCY</strong><span>Learn · Unite · Connect · Yourself</span></div><h1>Học ngôn ngữ.<br />Kết nối thế giới.</h1><p>Không gian học tập trực tiếp, nội dung đa ngôn ngữ và cộng đồng cùng tiến bộ.</p></section>
    <section className="auth-card"><div className="auth-icon">{icon}</div><h2>{title}</h2><p>{subtitle}</p>{children}</section>
  </main>;
}

const nav = [
  ["/home", "🏠", "Trang chủ"],
  ["/room", "🎙️", "Phòng học"],
  ["/wallet", "💰", "Ví"],
  ["/gifts", "🎁", "Quà tặng"],
  ["/podcasts", "📻", "Podcast"],
] as const;

function AppShell({ route, session, logout, children }: { route: Route; session: Session; logout: () => void; children: React.ReactNode }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="side-brand" href="#/home"><span>✦</span><b>LUCY</b></a>
      <nav aria-label="Điều hướng chính">{nav.map(([href, icon, label]) => <a key={href} href={`#${href}`} className={route === href ? "active" : ""}><span>{icon}</span>{label}</a>)}</nav>
      <div className="side-user"><span className="avatar">{session.user.displayName?.[0]?.toUpperCase() || "U"}</span><div><b>{session.user.displayName}</b><small>{session.user.role}</small></div><button onClick={logout} aria-label="Đăng xuất" title="Đăng xuất">↪</button></div>
    </aside>
    <main className={`main-area${route === "/room" ? " room-main-area" : ""}`}>
      <header className="topbar"><div><small>LUCY · Phase 5</small><h1>{nav.find(([href]) => href === route)?.[2] || "Trang chủ"}</h1></div><span className="role-pill">{session.user.role}</span></header>
      <div className={`content${route === "/room" ? " room-content" : ""}`}>{children}</div>
    </main>
    <nav className="bottom-nav" aria-label="Điều hướng mobile">{nav.map(([href, icon, label]) => <a key={href} href={`#${href}`} className={route === href ? "active" : ""}><span>{icon}</span><small>{label}</small></a>)}</nav>
  </div>;
}

function HomeView({ session }: { session: Session }) {
  const cards = [
    ["#/room", "🎙️", "Phòng học", "Tham gia phòng, giơ tay, bật mic và đo độ trễ", "purple"],
    ["#/wallet", "💰", "Ví", "Theo dõi số dư và nạp tiền vào ví LUCY", "mint"],
    ["#/gifts", "🎁", "Quà tặng", "Gửi quà và lời nhắn đến creator", "peach"],
    ["#/podcasts", "📻", "Podcast", "Xem lại danh sách bản ghi bài học", "blue"],
  ];
  return <>
    <section className="welcome"><div><span className="eyebrow">Xin chào, {session.user.displayName}</span><h2>Sẵn sàng cho buổi học hôm nay?</h2><p>Tham gia phòng học, quản lý ví, gửi quà và theo dõi podcast trong cùng một không gian LUCY.</p></div><div className="welcome-orbit"><span>EN</span><span>中</span><span>あ</span><b>✦</b></div></section>
    <section className="profile-strip" aria-label="Thông tin tài khoản">
      <div className="profile-person"><span className="avatar">{session.user.displayName?.[0]?.toUpperCase() || "U"}</span><div><small>Tài khoản hiện tại</small><b>{session.user.displayName}</b><span>{session.user.email}</span></div></div>
      <div><small>Vai trò</small><b>{session.user.role}</b></div>
      <div><small>Giai đoạn</small><b>Phase 5</b></div>
      <div><small>Nền tảng</small><b>Web · Flutter</b></div>
    </section>
    <div className="section-heading"><div><h2>Không gian của bạn</h2><p>Tất cả công cụ học tập ở một nơi</p></div><span className="status"><i /> Hệ thống sẵn sàng</span></div>
    <section className="feature-grid">{cards.map(([href, icon, title, description, color]) => <a href={href} className={`feature-card ${color}`} key={href}><span className="feature-icon">{icon}</span><div><h3>{title}</h3><p>{description}</p></div><b>→</b></a>)}</section>
    <section className="learning-flow" aria-label="Luồng sử dụng Phase 5"><div><span>01</span><b>Đăng nhập</b><small>Xác thực tài khoản LUCY</small></div><i>→</i><div><span>02</span><b>Vào phòng</b><small>Tham gia lớp học trực tiếp</small></div><i>→</i><div><span>03</span><b>Tương tác</b><small>Giơ tay, mic và ping</small></div><i>→</i><div><span>04</span><b>Kết nối</b><small>Ví, quà tặng và podcast</small></div></section>
  </>;
}

function WalletView({ session, notify }: { session: Session; notify: (message: string) => void }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setWallet(await api<Wallet>("wallet", `/wallets/${encodeURIComponent(session.user.id)}`, { token: session.token })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải ví"); }
    finally { setLoading(false); }
  }, [session]);
  // Data fetch on screen entry is the intended external synchronization.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function topUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const amount = Number(form.get("amount"));
    if (!(amount > 0)) { setError("Vui lòng nhập số tiền hợp lệ"); return; }
    setTopUpLoading(true); setError("");
    try {
      const result = await api<Wallet | { wallet: Wallet }>("wallet", `/wallets/${encodeURIComponent(session.user.id)}/top-up`, { method: "POST", token: session.token, body: JSON.stringify({ amount, providerReference: `topup_${Date.now()}` }) });
      setWallet("wallet" in result ? result.wallet : result);
      formElement.reset();
      notify("Nạp tiền thành công!");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Nạp tiền thất bại"); }
    finally { setTopUpLoading(false); }
  }

  return <div className="two-column">
    <section className="panel wallet-panel"><div className="panel-title"><div><span className="eyebrow">💰 Ví LUCY</span><h2>Số dư khả dụng</h2></div><button className="icon-button" onClick={load} disabled={loading} aria-label="Làm mới ví">↻</button></div><div className="balance">{loading ? <span className="spinner" /> : wallet ? money(wallet.balance, wallet.currencyCode) : "—"}<small>{wallet?.userId || session.user.id}</small></div><div className="wallet-meta"><span>Loại tiền<b>{wallet?.currencyCode || "VND"}</b></span><span>Trạng thái<b className="online">Hoạt động</b></span></div></section>
    <section className="panel"><div className="panel-title"><div><span className="eyebrow">Top-up</span><h2>Nạp tiền vào ví</h2></div></div><form className="form compact" onSubmit={topUp}><label>Số tiền<input name="amount" type="number" min="1000" step="1000" placeholder="100.000" required /></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary-button" disabled={topUpLoading}>{topUpLoading ? "Đang xử lý…" : "Nạp tiền"}</button></form><div className="notice">Lịch sử giao dịch sẽ sớm được cập nhật.</div></section>
  </div>;
}

function GiftsView({ session, notify }: { session: Session; notify: (message: string) => void }) {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setGifts(await api<Gift[]>("wallet", "/gifts", { token: session.token })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải quà tặng"); }
    finally { setLoading(false); }
  }, [session.token]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const amount = Number(form.get("amount"));
    if (!(amount > 0)) { setError("Số tiền không hợp lệ"); return; }
    setSending(true); setError("");
    try {
      await api<Gift | { transaction: Gift }>("wallet", "/gifts", { method: "POST", token: session.token, body: JSON.stringify({ fromUserId: session.user.id, toCreatorId: form.get("toCreatorId"), amount, message: form.get("message") }) });
      formElement.reset();
      notify("Gửi quà thành công!");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Gửi quà thất bại"); }
    finally { setSending(false); }
  }

  return <div className="two-column gifts-layout"><section className="panel sticky-panel"><span className="eyebrow">🎁 Quà tặng</span><h2>Gửi quà</h2><p className="muted">Ủng hộ creator bằng số dư ví LUCY của bạn.</p><form className="form compact" onSubmit={send}><label>Từ<input value={session.user.displayName} disabled /></label><label>Đến Creator ID<input name="toCreatorId" placeholder="creator-1" required /></label><label>Số tiền<input name="amount" type="number" min="1000" step="1000" required /></label><label>Lời nhắn<textarea name="message" rows={3} placeholder="Cảm ơn bài học!" /></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary-button" disabled={sending}>{sending ? "Đang gửi…" : "Gửi quà"}</button></form></section><section className="panel"><div className="panel-title"><div><span className="eyebrow">Hoạt động</span><h2>Lịch sử quà tặng</h2></div><button className="icon-button" onClick={load} aria-label="Làm mới">↻</button></div>{loading ? <Empty text="Đang tải giao dịch…" loading /> : gifts.length ? <div className="list">{gifts.map(gift => { const senderName = gift.fromDisplayName || gift.fromUserId; const receiverName = gift.toDisplayName || gift.toCreatorId; return <article className="list-item" key={gift.id}><span className="avatar gift-avatar">{senderName[0]?.toUpperCase()}</span><div><h3>{senderName} <span>→</span> {receiverName}</h3><p>{gift.message || "Không có lời nhắn"}</p><small>{dateTime(gift.createdAt)}</small></div><strong>{money(gift.amount)}</strong></article>; })}</div> : <Empty text="Chưa có giao dịch quà tặng" />}</section></div>;
}

function PodcastsView({ session }: { session: Session }) {
  const [items, setItems] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [creatingPodcast, setCreatingPodcast] = useState(false);
  const [editingItem, setEditingItem] = useState<Podcast | null>(null);
  const [busyPodcastId, setBusyPodcastId] = useState("");
  const canManage = ["PRO", "SUPER"].includes(session.user.role.toUpperCase());
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await api<Podcast[]>("wallet", "/podcasts/recordings", { token: session.token })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải podcast"); }
    finally { setLoading(false); }
  }, [session.token]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const roomOptions = useMemo(() => [...new Set(items.map(item => item.roomId))].sort(), [items]);
  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi-VN");
    return items.filter(item => (!roomFilter || item.roomId === roomFilter) && (!keyword
      || item.title.toLocaleLowerCase("vi-VN").includes(keyword)
      || item.roomId.toLocaleLowerCase("vi-VN").includes(keyword)
      || (item.creatorDisplayName || item.creatorId).toLocaleLowerCase("vi-VN").includes(keyword)));
  }, [items, query, roomFilter]);

  async function uploadPodcastAudio(formElement: HTMLFormElement, item?: Podcast) {
    const form = new FormData(formElement);
    const file = form.get("audio");
    if (!(file instanceof File) || !file.size) throw new Error("Vui lòng chọn file audio");
    if (file.size > 50 * 1024 * 1024) throw new Error("File audio không được vượt quá 50 MB");
    const payload = new FormData();
    payload.append("audio", file);
    payload.append("title", String(form.get("title") || "").trim());
    payload.append("roomCode", item?.roomId || String(form.get("roomCode") || "").trim());
    payload.append("userId", session.user.id);
    payload.append("durationSeconds", String(await audioFileDuration(file)));
    if (item) payload.append("podcastId", item.id);
    const response = await fetch(`${REALTIME_URL}/api/upload-recording`, { method: "POST", headers: { Authorization: `Bearer ${session.token}` }, body: payload });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Không thể tải audio (${response.status})`);
  }

  async function createPodcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusyPodcastId("new"); setError("");
    try {
      await uploadPodcastAudio(formElement);
      formElement.reset(); setCreatingPodcast(false);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể nhập podcast"); }
    finally { setBusyPodcastId(""); }
  }

  async function updatePodcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem) return;
    const title = String(new FormData(event.currentTarget).get("title") || "").trim();
    if (!title) return;
    setBusyPodcastId(editingItem.id); setError("");
    try {
      const audio = new FormData(event.currentTarget).get("audio");
      if (audio instanceof File && audio.size) await uploadPodcastAudio(event.currentTarget, editingItem);
      else await api("wallet", `/podcasts/recordings/${encodeURIComponent(editingItem.id)}`, { method: "PUT", token: session.token, body: JSON.stringify({ title }) });
      setEditingItem(null);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật podcast"); }
    finally { setBusyPodcastId(""); }
  }

  async function deletePodcast(item: Podcast) {
    if (!window.confirm(`Bạn có chắc muốn xóa podcast “${item.title}”?`)) return;
    setBusyPodcastId(item.id); setError("");
    try {
      await api("wallet", `/podcasts/recordings/${encodeURIComponent(item.id)}`, { method: "DELETE", token: session.token });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể xóa podcast"); }
    finally { setBusyPodcastId(""); }
  }

  return <>
    <div className="section-heading">
      <div><span className="eyebrow">📻 Thư viện</span><h2>Podcast bài học</h2><p>Nghe lại nội dung từ các phòng học LUCY.</p></div>
      {canManage && <button className="primary-button fit" onClick={() => { setError(""); setCreatingPodcast(true); }}>＋ Nhập audio</button>}
    </div>
    {error && <p className="error banner" role="alert">{error} <button onClick={load}>Thử lại</button></p>}

    {creatingPodcast && <div className="modal-backdrop" onMouseDown={() => !busyPodcastId && setCreatingPodcast(false)}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-podcast-title" onMouseDown={event => event.stopPropagation()}>
        <span className="eyebrow">Podcast</span><h2 id="create-podcast-title">Nhập audio mới</h2>
        <form className="form" onSubmit={createPodcast}>
          <label>Tiêu đề<input name="title" maxLength={255} autoFocus required /></label>
          <label>Phòng học<input name="roomCode" list="podcast-room-options" defaultValue={roomFilter} maxLength={80} required /></label>
          <datalist id="podcast-room-options">{roomOptions.map(room => <option key={room} value={room} />)}</datalist>
          <label>File audio<input name="audio" type="file" accept="audio/webm,audio/mp4,audio/wav,audio/mpeg,audio/ogg,.m4a" required /><small>WebM, M4A, WAV, MP3 hoặc OGG · tối đa 50 MB</small></label>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="secondary-button" disabled={Boolean(busyPodcastId)} onClick={() => setCreatingPodcast(false)}>Hủy</button><button className="primary-button" disabled={Boolean(busyPodcastId)}>{busyPodcastId ? "Đang tải…" : "Nhập podcast"}</button></div>
        </form>
      </section>
    </div>}

    {editingItem && <div className="modal-backdrop" onMouseDown={() => !busyPodcastId && setEditingItem(null)}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-podcast-title" onMouseDown={event => event.stopPropagation()}>
        <span className="eyebrow">Podcast</span><h2 id="edit-podcast-title">Sửa podcast</h2>
        <form className="form" onSubmit={updatePodcast}>
          <label>Tiêu đề<input name="title" defaultValue={editingItem.title} maxLength={255} autoFocus required /></label>
          <label>Thay audio <small>(không bắt buộc)</small><input name="audio" type="file" accept="audio/webm,audio/mp4,audio/wav,audio/mpeg,audio/ogg,.m4a" /><small>Để trống nếu chỉ muốn đổi tiêu đề · tối đa 50 MB</small></label>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="secondary-button" disabled={Boolean(busyPodcastId)} onClick={() => setEditingItem(null)}>Hủy</button><button className="primary-button" disabled={Boolean(busyPodcastId)}>{busyPodcastId ? "Đang lưu…" : "Lưu"}</button></div>
        </form>
      </section>
    </div>}

    {loading ? <Empty text="Đang tải podcast…" loading /> : items.length ? <>
      <div className="podcast-toolbar">
        <label className="podcast-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm theo tiêu đề, tác giả hoặc phòng…" aria-label="Tìm podcast" /></label>
        <select value={roomFilter} onChange={event => setRoomFilter(event.target.value)} aria-label="Lọc theo phòng"><option value="">Tất cả phòng</option>{roomOptions.map(room => <option key={room} value={room}>{room}</option>)}</select>
        <small>{filteredItems.length} podcast</small>
      </div>
      {filteredItems.length ? <section className="podcast-grid">{filteredItems.map(item => {
      const audioUrl = playableAudioUrl(item.storageUri);
      return <article className="podcast-card" key={item.id}>
        <div className="podcast-card-main">
          <div className="podcast-art" aria-hidden="true"><span>▶</span><small>{duration(item.durationSeconds)}</small></div>
          <div className="podcast-info">
            <span className="podcast-room">{item.roomId}</span>
            <h3>{item.title}</h3>
            <p>Tác giả: <b>{item.creatorDisplayName || item.creatorId}</b></p>
            <time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time>
          </div>
          {canManage && <div className="podcast-card-actions"><button onClick={() => { setError(""); setEditingItem(item); }} aria-label={`Sửa ${item.title}`} title="Sửa podcast">✎</button><button className="danger" onClick={() => deletePodcast(item)} disabled={busyPodcastId === item.id} aria-label={`Xóa ${item.title}`} title="Xóa podcast">⌫</button></div>}
        </div>
        {audioUrl ? <audio className="podcast-player" src={audioUrl} controls preload="metadata" /> : <div className="podcast-unavailable">Chưa có tệp âm thanh</div>}
      </article>;
    })}</section> : <Empty text="Không tìm thấy podcast phù hợp" />}
    </> : <Empty text="Chưa có bản ghi podcast nào" />}
  </>;
}

function CreateRoomDialog({ onClose, onCreated, session }: { onClose: () => void; onCreated?: (roomCode: string) => void; session: Session }) {
  const [language, setLanguage] = useState("en");
  const [levelNumber, setLevelNumber] = useState(1);
  const [roomCode, setRoomCode] = useState("");
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const LANGUAGES = [
    { code: "en", name: "English" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" },
  ];

  useEffect(() => {
    setRoomCode(`${language}-level-${levelNumber}-${Date.now().toString(36)}`);
  }, [language, levelNumber]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const roomCode = form.get("roomCode") as string;
      const password = passwordEnabled ? String(form.get("roomPassword") || "") : "";
      await realtimeApi("/rooms", {
        method: "POST",
        body: JSON.stringify({
          roomCode,
          title: form.get("title") || `${LANGUAGES.find(l => l.code === language)?.name} Level ${levelNumber}`,
          languageCode: language,
          levelNumber,
          password: password || null,
        }),
      });
      onClose();
      window.location.hash = "#/room";
      const jr = (window as any).__lucyJoinRoom;
      if (jr) setTimeout(() => jr(roomCode, password), 100);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo phòng");
    } finally {
      setCreating(false);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={() => !creating && onClose()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-room-title" onMouseDown={e => e.stopPropagation()}>
      <div className="panel-title">
        <div>
          <span className="eyebrow">✦ Mentor tools</span>
          <h2 id="create-room-title">Tạo phòng học mới</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Đóng">×</button>
      </div>
      <form className="form compact" onSubmit={create}>
        <label>Ngôn ngữ
          <select value={language} onChange={e => setLanguage(e.target.value)}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </label>
        <label>Cấp độ (Level)
          <input type="number" min={1} max={100} value={levelNumber} onChange={e => setLevelNumber(Number(e.target.value))} />
        </label>
        <label>Mã phòng
          <input name="roomCode" value={roomCode} onChange={e => setRoomCode(e.target.value)} required />
        </label>
        <label>Tên phòng (không bắt buộc)
          <input name="title" placeholder={`${LANGUAGES.find(l => l.code === language)?.name} Level ${levelNumber}`} />
        </label>
        <label className="checkbox-label"><input type="checkbox" checked={passwordEnabled} onChange={e => setPasswordEnabled(e.target.checked)} />Yêu cầu mật khẩu khi tham gia</label>
        {passwordEnabled && <label>Mật khẩu phòng
          <input name="roomPassword" type="password" minLength={4} maxLength={100} autoComplete="new-password" required />
        </label>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={creating}>← Hủy</button>
          <button className="primary-button" disabled={creating}>
            {creating ? <><span className="spinner small" />Đang tạo</> : "Tạo phòng →"}
          </button>
        </div>
      </form>
    </section>
  </div>;
}

function RoomBrowser({ session, onJoin, connected, onCreateRoom }: { session: Session; onJoin: (roomCode: string) => void; connected: boolean; onCreateRoom?: () => void }) {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterLang, setFilterLang] = useState("");
  const [manualId, setManualId] = useState("");

  const LANGUAGES = [
    { code: "en", name: "English" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = filterLang ? `?language=${filterLang}` : "";
      const result = await realtimeApi<{ rooms: RoomInfo[] }>(`/rooms${query}`);
      setRooms(result.rooms);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải danh sách phòng");
    } finally {
      setLoading(false);
    }
  }, [filterLang]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, RoomInfo[]>();
    for (const r of rooms) {
      const key = `${r.languageCode}-${r.levelNumber}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort();
  }, [rooms]);

  function handleManualJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (manualId.trim()) onJoin(manualId.trim());
  }

  return <div className="room-browser">
    <div className="section-heading">
      <div>
        <span className="eyebrow">🎙️ Phòng học</span>
        <h2>Danh sách phòng</h2>
        <p>Chọn phòng hoặc nhập mã phòng để tham gia.</p>
      </div>
      <button className="primary-button fit" onClick={onCreateRoom}>＋ Tạo phòng</button>
    </div>
    <form className="form compact" onSubmit={handleManualJoin} style={{ margin: '0 0 16px', display: 'flex', gap: 8 }}>
      <input value={manualId} onChange={e => setManualId(e.target.value)} placeholder="Nhập mã phòng..." className="input" style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }} />
      <button className="primary-button" disabled={!connected || !manualId.trim()} type="submit">Vào phòng</button>
    </form>
    <div className="filter-row" style={{ marginBottom: 12 }}>
      <select value={filterLang} onChange={e => setFilterLang(e.target.value)}>
        <option value="">Tất cả ngôn ngữ</option>
        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
      <button className="text-button" onClick={load} disabled={loading}>⟳ Làm mới</button>
    </div>
    {error && <p className="error banner" role="alert">{error} <button onClick={load}>Thử lại</button></p>}
    {!connected && !loading && <p className="error banner" role="alert">⚠️ Chưa kết nối được server. Đợi kết nối hoặc refresh trang.</p>}
    {loading ? <div className="empty"><span className="spinner" /><p>Đang tải phòng…</p></div>
    : grouped.length === 0 ? <div className="empty"><span>✦</span><p>Chưa có phòng nào.</p></div>
    : <div className="room-groups">
        {grouped.map(([key, roomList]) => {
          const lang = LANGUAGES.find(l => l.code === roomList[0].languageCode);
          return <div key={key} className="room-group">
            <h3>{lang?.name || roomList[0].languageCode} · Level {roomList[0].levelNumber}</h3>
            <div className="room-cards">
              {roomList.map(r => <button key={r.roomId} className="room-card" onClick={() => onJoin(r.roomId)}>
                <span className="room-icon">🎙️</span>
                <div>
                  <strong>{r.title}</strong>
                  <small>{r.roomId} · {r.participantCount || 0} người{r.hasPassword ? " · 🔒" : ""}</small>
                </div>
                <span className="join-badge">{connected ? "Tham gia →" : "..."}</span>
              </button>)}
            </div>
          </div>;
        })}
      </div>}
  </div>;
}

function RoomView({ session, compact, onCreateRoom }: { session: Session; compact: boolean; onCreateRoom?: () => void }) {
  const canRecord = ["PRO", "SUPER"].includes(session.user.role.toUpperCase());
  const isLearner = session.user.role.toUpperCase() === "ANONYMOUS";
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [retryRoomId, setRetryRoomId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [showBrowser, setShowBrowser] = useState(true);
  const [mic, setMic] = useState(false);
  const [hand, setHand] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [recording, setRecording] = useState<RecordingState>({ status: 'NONE' });
  const [remoteUsers, setRemoteUsers] = useState<{ userId: string; displayName: string }[]>([]);
  const [chatOpen, setChatOpen] = useState(true);
  const [superChatOpen, setSuperChatOpen] = useState(false);
  const [giftSending, setGiftSending] = useState(false);
  const [giftError, setGiftError] = useState("");
  const [documentSending, setDocumentSending] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [passwordRoomId, setPasswordRoomId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(() => new Set());

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const joinAckTimerRef = useRef<number | null>(null);
  const joinRequestRef = useRef(0);
  const speakingContextRef = useRef<AudioContext | null>(null);
  const speakingMonitorsRef = useRef<Map<string, { source: MediaStreamAudioSourceNode; frame: number }>>(new Map());

  function setUserSpeaking(userId: string, speaking: boolean) {
    setSpeakingUsers(current => {
      if (current.has(userId) === speaking) return current;
      const next = new Set(current);
      if (speaking) next.add(userId); else next.delete(userId);
      return next;
    });
  }

  function stopSpeakingMonitor(userId: string) {
    const monitor = speakingMonitorsRef.current.get(userId);
    if (!monitor) return;
    cancelAnimationFrame(monitor.frame);
    monitor.source.disconnect();
    speakingMonitorsRef.current.delete(userId);
    setUserSpeaking(userId, false);
  }

  function stopAllSpeakingMonitors(updateState = true) {
    speakingMonitorsRef.current.forEach(monitor => {
      cancelAnimationFrame(monitor.frame);
      monitor.source.disconnect();
    });
    speakingMonitorsRef.current.clear();
    speakingContextRef.current?.close();
    speakingContextRef.current = null;
    if (updateState) setSpeakingUsers(new Set());
  }

  function watchSpeaking(userId: string, stream: MediaStream) {
    stopSpeakingMonitor(userId);
    const context = speakingContextRef.current || new AudioContext();
    speakingContextRef.current = context;
    void context.resume().catch(() => {});
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    const samples = new Uint8Array(analyser.fftSize);
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const monitor = { source, frame: 0 };
    let quietFrames = SPEAKING_HOLD_FRAMES;
    const measure = () => {
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) energy += ((sample - 128) / 128) ** 2;
      const hasVoice = Math.sqrt(energy / samples.length) > SPEAKING_THRESHOLD;
      quietFrames = hasVoice ? 0 : quietFrames + 1;
      setUserSpeaking(userId, hasVoice || quietFrames < SPEAKING_HOLD_FRAMES);
      monitor.frame = requestAnimationFrame(measure);
    };
    monitor.frame = requestAnimationFrame(measure);
    speakingMonitorsRef.current.set(userId, monitor);
  }


  useEffect(() => {
    let active = true;
    let liveSocket: Socket | null = null;
    const connect = () => {
      if (!active || !window.io) return;
      liveSocket = window.io(REALTIME_URL, { transports: ["websocket"] });
      socketRef.current = liveSocket;
      setSocket(liveSocket);
      liveSocket.on("connect", async () => {
        setConnected(true);
        setError("");
        const savedRoom = localStorage.getItem(ACTIVE_ROOM_KEY);
        if (savedRoom && !joinedRef.current) {
          setRetryRoomId(savedRoom);
          joinRoom(savedRoom);
        }
      });
      liveSocket.on("disconnect", () => {
        setConnected(false);
        setJoined(false);
        joinedRef.current = false;
        joiningRef.current = false;
        joinRequestRef.current += 1;
        if (joinAckTimerRef.current) window.clearTimeout(joinAckTimerRef.current);
        joinAckTimerRef.current = null;
        setJoining(false);
        stopLocalStream();
        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
        pendingIceRef.current.clear();
        remoteStreamsRef.current.clear();
        remoteAudioRefs.current.clear();
        stopAllSpeakingMonitors();
        setMic(false);
        setRemoteUsers([]);
      });
      liveSocket.on("connect_error", () => {
        setRetryRoomId(localStorage.getItem(ACTIVE_ROOM_KEY) || "");
        setError("Không thể kết nối Realtime service");
      });
      liveSocket.on("room:state", (state: Room) => setRoom(state));
      liveSocket.on("chat:message", (msg: ChatMessage) => {
        if (msg.kind === "DOCUMENT") setDocuments(current => [msg, ...current.filter(document => document.id !== msg.id)].slice(0, 100));
        else setMessages(prev => [...prev, msg].slice(-MAX_LIVE_CHAT_MESSAGES));
      });
      liveSocket.on("recording:update", (state: RecordingState) => {
        if (state.status === 'RECORDING') {
          const startedAt = state.startedAt ? new Date(state.startedAt).getTime() : Date.now();
          recordingStartedAtRef.current = Number.isFinite(startedAt) ? startedAt : Date.now();
          setRecordingElapsed(Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)));
        } else {
          setRecordingElapsed(0);
        }
        setRecording(prev => ({ ...prev, ...state }));
      });
      liveSocket.on("webrtc:offer", ({ userId, sdp }: { userId: string; sdp: RTCSessionDescriptionInit }) => {
        handleWebRTCOffer(userId, sdp).catch(() => setError("Không thể nhận kết nối voice"));
      });
      liveSocket.on("webrtc:answer", ({ userId, sdp }: { userId: string; sdp: RTCSessionDescriptionInit }) => {
        handleWebRTCAnswer(userId, sdp).catch(() => setError("Không thể hoàn tất kết nối voice"));
      });
      liveSocket.on("webrtc:ice-candidate", ({ userId, candidate }: { userId: string; candidate: RTCIceCandidateInit }) => {
        handleWebRTCIceCandidate(userId, candidate).catch(() => setError("Không thể thiết lập đường truyền voice"));
      });
      liveSocket.on("webrtc:user-joined", ({ userId, displayName }: { userId: string; displayName: string }) => {
        setRemoteUsers(prev => prev.some(u => u.userId === userId) ? prev : [...prev, { userId, displayName }]);
      });
      liveSocket.on("webrtc:user-left", ({ userId }: { userId: string }) => {
        closePeerConnection(userId);
        setRemoteUsers(prev => prev.filter(u => u.userId !== userId));
      });
      socketRef.current = liveSocket;
      setSocket(liveSocket);
    };
    if (window.io) connect();
    else {
      const id = "lucy-socket-client";
      const existing = document.getElementById(id) as HTMLScriptElement | null;
      const script = existing || Object.assign(document.createElement("script"), { id, src: `${REALTIME_URL}/socket.io/socket.io.js`, async: true });
      script.addEventListener("load", connect, { once: true });
      script.addEventListener("error", () => setError("Không tải được Socket.IO client"), { once: true });
      if (!existing) document.head.appendChild(script);
    }
    return () => {
      active = false;
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      peerConnectionsRef.current.forEach(pc => pc.close());
      stopAllSpeakingMonitors(false);
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      if (joinAckTimerRef.current) window.clearTimeout(joinAckTimerRef.current);
      liveSocket?.off();
      liveSocket?.disconnect();
    };
  }, []);

  function toggleHand() { const s = socketRef.current || socket; const next = !hand; s?.emit("hand:raise", { roomId, raised: next }); setHand(next); }
  async function toggleMic() {
    const s = socketRef.current || socket;
    if (!s || !joined) return;
    if (mic) {
      localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = false; });
      stopSpeakingMonitor(session.user.id);
      s.emit("mic:toggle", { roomId, enabled: false });
      setMic(false);
      return;
    }

    const stream = await startLocalStream();
    if (!stream) {
      setError("Không có quyền truy cập microphone. Hãy cấp quyền cho trình duyệt rồi thử lại.");
      return;
    }

    stream.getAudioTracks().forEach(track => { track.enabled = true; });
    watchSpeaking(session.user.id, stream);
    for (const [userId, pc] of peerConnectionsRef.current) {
      if (!pc.getSenders().some(sender => sender.track?.kind === "audio")) {
        stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit("webrtc:offer", { targetUserId: userId, sdp: offer });
      }
    }
    s.emit("mic:toggle", { roomId, enabled: true });
    setMic(true);
    setError("");
  }
  function ping() {
    const s = socketRef.current || socket;
    const started = Date.now(); setLatency(null);
    s?.emit("latency:ping", { clientSentAt: started }, (result: { ok: boolean }) => result?.ok && setLatency(Date.now() - started));
  }
  function sendChat(event: FormEvent) {
    event.preventDefault();
    const s = socketRef.current || socket;
    if (!s || !chatInput.trim() || !joined) return;
    s.emit("chat:send", {
      roomId,
      message: chatInput.trim(),
    }, (result: { ok: boolean; message?: string }) => {
      if (result?.ok) setChatInput(""); else setError(result?.message || "Không thể gửi tin nhắn");
    });
  }

  async function sendDocument(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !joined || !canRecord) return;
    if (file.size > 20 * 1024 * 1024) { setError("Tài liệu không được vượt quá 20 MB"); input.value = ""; return; }
    setDocumentSending(true); setError("");
    try {
      const payload = new FormData();
      payload.append("document", file);
      payload.append("userId", session.user.id);
      const response = await fetch(`${REALTIME_URL}/api/rooms/${encodeURIComponent(roomId)}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        body: payload,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || `Không thể gửi tài liệu (${response.status})`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi tài liệu");
    } finally {
      input.value = "";
      setDocumentSending(false);
    }
  }

  function leaveRoom() {
    const s = socketRef.current || socket;
    if (!s || !joined) return;
    if (recording.status === 'RECORDING') {
      setRecordingElapsed(0);
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
      s.emit("recording:stop", { roomId, token: session.token });
    }
    s.emit("room:leave", { roomId }, (result: { ok: boolean; message?: string }) => {
      if (!result?.ok) { setError(result?.message || "Không thể thoát phòng"); return; }
      localStorage.removeItem(ACTIVE_ROOM_KEY);
      joinedRef.current = false;
      joiningRef.current = false;
      joinRequestRef.current += 1;
      retryCountRef.current = 0;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      if (joinAckTimerRef.current) window.clearTimeout(joinAckTimerRef.current);
      retryTimerRef.current = null;
      joinAckTimerRef.current = null;
      stopLocalStream();
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      pendingIceRef.current.clear();
      remoteStreamsRef.current.clear();
      remoteAudioRefs.current.clear();
      stopAllSpeakingMonitors();
      setJoined(false);
      setJoining(false);
      setRetryRoomId("");
      setRoomId("");
      setRoom(null);
      setMessages([]);
      setDocuments([]);
      setMic(false);
      setHand(false);
      setLatency(null);
      setRemoteUsers([]);
      setShowBrowser(true);
      setError("");
    });
  }

  function confirmLeaveRoom() {
    if (window.confirm("Bạn có chắc muốn thoát phòng và trở về danh sách phòng?")) leaveRoom();
  }

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingContextRef = useRef<AudioContext | null>(null);
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recordingStartedAtRef = useRef(0);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingsListRef = useRef<{ id: number; url: string; status: string }[]>([]);
  const recIdCounterRef = useRef(0);
  const [recordingsList, setRecordingsList] = useState<{ id: number; url: string; status: string }[]>([]);
  const [recordingElapsed, setRecordingElapsed] = useState(0);

  useEffect(() => {
    if (recording.status !== 'RECORDING') return;
    const timer = window.setInterval(() => {
      setRecordingElapsed(Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording.status]);

  async function toggleRecording() {
    if (!canRecord) { setError("Chỉ PRO và SUPER mới được ghi âm"); return; }
    if (recording.status === 'RECORDING') {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
      (socketRef.current || socket)?.emit("recording:stop", { roomId, token: session.token });
    } else {
      const streams = [localStreamRef.current, ...remoteStreamsRef.current.values()]
        .filter((stream): stream is MediaStream => Boolean(stream?.getAudioTracks().length));
      if (!streams.length) { setRecording({ status: 'ERROR', error: "Chưa có luồng audio để ghi. Hãy bật microphone hoặc chờ người khác kết nối." }); return; }

      const context = new AudioContext();
      await context.resume();
      const destination = context.createMediaStreamDestination();
      streams.forEach(stream => context.createMediaStreamSource(stream).connect(destination));
      recordingContextRef.current = context;
      recordingDestinationRef.current = destination;

      const mime = ["audio/webm;codecs=opus", "audio/mp4"].find(MediaRecorder.isTypeSupported) || "";
      audioChunksRef.current = [];
      const recorder = mime ? new MediaRecorder(destination.stream, { mimeType: mime }) : new MediaRecorder(destination.stream);
      const thisId = ++recIdCounterRef.current;
      const extension = recorder.mimeType.includes("mp4") ? "m4a" : recorder.mimeType.includes("ogg") ? "ogg" : "webm";
      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        const localUrl = URL.createObjectURL(blob);
        const entry = { id: thisId, url: localUrl, status: 'local' };
        const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        recordingsListRef.current = [...recordingsListRef.current, entry];
        setRecordingsList([...recordingsListRef.current]);
        setRecording({ status: 'NONE' });
        setRecordingElapsed(0);
        audioChunksRef.current = [];
        await recordingContextRef.current?.close();
        recordingContextRef.current = null;
        recordingDestinationRef.current = null;
        const s = socketRef.current || socket;
        if (!s?.connected) {
          setRecording({ status: 'ERROR', error: "Đã ghi cục bộ nhưng mất kết nối nên chưa thể lưu Podcast." });
          return;
        }
        try {
          const formData = new FormData();
          formData.append("audio", blob, `rec-${thisId}.${extension}`);
          formData.append("roomCode", roomId);
          formData.append("userId", session.user.id);
          formData.append("displayName", session.user.displayName);
          formData.append("durationSeconds", String(durationSeconds));
          const response = await fetch(`${REALTIME_URL}/api/upload-recording`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.token}` },
            body: formData,
          });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.message || "Không thể lưu Podcast");
          entry.url = data.audioUrl || playableAudioUrl(data.storageUri);
          entry.status = 'saved';
          URL.revokeObjectURL(localUrl);
          setRecordingsList([...recordingsListRef.current]);
          setRecording({ status: 'SAVED', audioUrl: entry.url });
        } catch (reason) {
          setRecording({ status: 'ERROR', error: reason instanceof Error ? reason.message : "Không thể lưu Podcast" });
        }
      };
      recorder.onerror = () => {
        recordingContextRef.current?.close();
        recordingContextRef.current = null;
        recordingDestinationRef.current = null;
        setRecording({ status: 'ERROR', error: "Lỗi khi ghi âm" });
      };
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      setRecordingElapsed(0);
      recorder.start();
      (socketRef.current || socket)?.emit("recording:start", { roomId, token: session.token });
      setRecording({ status: 'RECORDING' });
    }
  }

  async function startLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      watchSpeaking(session.user.id, stream);
      if (recordingContextRef.current && recordingDestinationRef.current) {
        recordingContextRef.current.createMediaStreamSource(stream).connect(recordingDestinationRef.current);
      }
      return stream;
    } catch {
      return null;
    }
  }

  function stopLocalStream() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      stopSpeakingMonitor(session.user.id);
    }
  }

  const STUN_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  function getSocketOrThrow(): Socket {
    const s = socketRef.current;
    if (!s) throw new Error("Socket not connected");
    return s;
  }

  async function createPeerConnection(targetUserId: string) {
    const existing = peerConnectionsRef.current.get(targetUserId);
    if (existing) return existing;
    const pc = new RTCPeerConnection(STUN_SERVERS);
    peerConnectionsRef.current.set(targetUserId, pc);

    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        getSocketOrThrow().emit("webrtc:ice-candidate", { targetUserId, candidate: e.candidate.toJSON() });
      }
    };

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      if (remoteStream) {
        remoteStreamsRef.current.set(targetUserId, remoteStream);
        watchSpeaking(targetUserId, remoteStream);
        if (recordingContextRef.current && recordingDestinationRef.current) {
          recordingContextRef.current.createMediaStreamSource(remoteStream).connect(recordingDestinationRef.current);
        }
        const audioEl = remoteAudioRefs.current.get(targetUserId);
        if (audioEl) {
          audioEl.srcObject = remoteStream;
          audioEl.play().catch(() => {});
        }
        setRemoteUsers(prev => prev.some(u => u.userId === targetUserId) ? prev : [...prev, { userId: targetUserId, displayName: "" }]);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        closePeerConnection(targetUserId);
      }
    };

    return pc;
  }

  async function flushIceCandidates(userId: string, pc: RTCPeerConnection) {
    for (const candidate of pendingIceRef.current.get(userId) || []) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingIceRef.current.delete(userId);
  }

  async function handleWebRTCOffer(userId: string, sdp: RTCSessionDescriptionInit) {
    const pc = await createPeerConnection(userId);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await flushIceCandidates(userId, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    getSocketOrThrow().emit("webrtc:answer", { targetUserId: userId, sdp: answer });
  }

  async function handleWebRTCAnswer(userId: string, sdp: RTCSessionDescriptionInit) {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushIceCandidates(userId, pc);
    }
  }

  async function handleWebRTCIceCandidate(userId: string, candidate: RTCIceCandidateInit) {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc?.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      return;
    }
    pendingIceRef.current.set(userId, [...(pendingIceRef.current.get(userId) || []), candidate]);
  }

  function closePeerConnection(userId: string) {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
    remoteStreamsRef.current.delete(userId);
    pendingIceRef.current.delete(userId);
    stopSpeakingMonitor(userId);
  }

  const participants = useMemo(() => room?.users || [], [room]);
  const giftRecipients = useMemo(
    () => participants.filter(person => person.userId !== session.user.id && ["PRO", "SUPER"].includes(person.role.toUpperCase())),
    [participants, session.user.id],
  );

  async function sendSuperChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const toCreatorId = String(form.get("toCreatorId") || "");
    const amount = Number(form.get("amount"));
    if (!giftRecipients.some(person => person.userId === toCreatorId) || !(amount > 0)) {
      setGiftError("Mentor hoặc số tiền không hợp lệ");
      return;
    }
    setGiftSending(true);
    setGiftError("");
    try {
      const result = await api<Gift | { transaction: Gift }>("wallet", "/gifts", {
        method: "POST",
        token: session.token,
        body: JSON.stringify({ fromUserId: session.user.id, toCreatorId, roomId, amount, message: form.get("message") }),
      });
      const gift = "transaction" in result ? result.transaction : result;
      formElement.reset();
      setSuperChatOpen(false);
      (socketRef.current || socket)?.emit("gift:announce", { roomId, giftId: gift.id }, (announcement: { ok: boolean }) => {
        if (!announcement?.ok) setError("Gift đã gửi thành công nhưng thẻ Super Chat chưa hiển thị. Vui lòng không gửi lại.");
      });
    } catch (reason) {
      setGiftError(reason instanceof Error ? reason.message : "Không thể gửi Super Chat");
    } finally {
      setGiftSending(false);
    }
  }

  function scheduleJoinRetry(code: string, reason: string, password = "") {
    joiningRef.current = false;
    setJoining(false);
    setRetryRoomId(code);
    if (retryCountRef.current >= MAX_JOIN_RETRIES) {
      setError(`${reason}. Không thể tự tham gia lại sau ${MAX_JOIN_RETRIES} lần.`);
      return;
    }
    const attempt = ++retryCountRef.current;
    const delay = 2 ** (attempt - 1) * 1000;
    setError(`${reason}. Đang thử lại ${attempt}/${MAX_JOIN_RETRIES}…`);
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      joinRoom(code, true, password);
    }, delay);
  }

  function joinRoom(code: string, isRetry = false, password = "") {
    const target = code.trim();
    if (!target || joinedRef.current || joiningRef.current) return;
    if (!isRetry) retryCountRef.current = 0;
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    setRoomId(target);
    setRetryRoomId(target);
    const s = socketRef.current || socket;
    if (!s?.connected) { scheduleJoinRetry(target, "Chưa kết nối được server", password); return; }
    joiningRef.current = true;
    setJoining(true);
    setError("");
    const requestId = ++joinRequestRef.current;
    if (joinAckTimerRef.current) window.clearTimeout(joinAckTimerRef.current);
    joinAckTimerRef.current = window.setTimeout(() => {
      if (joinRequestRef.current !== requestId || joinedRef.current) return;
      joinAckTimerRef.current = null;
      joinRequestRef.current += 1;
      scheduleJoinRetry(target, "Server không phản hồi yêu cầu tham gia", password);
    }, JOIN_ACK_TIMEOUT_MS);
    s.emit("room:join", { roomId: target, userId: session.user.id, displayName: session.user.displayName, role: session.user.role, password }, async (result: { ok: boolean; room?: Room; message?: string; code?: string }) => {
      if (joinRequestRef.current !== requestId) return;
      if (joinAckTimerRef.current) window.clearTimeout(joinAckTimerRef.current);
      joinAckTimerRef.current = null;
      if (!result?.ok) {
        if (result?.code === "ROOM_PASSWORD_REQUIRED") {
          joiningRef.current = false;
          setJoining(false);
          setError("");
          setPasswordRoomId(target);
          setPasswordError(result.message || "Phòng yêu cầu mật khẩu");
          return;
        }
        scheduleJoinRetry(target, result?.message || "Không thể tham gia phòng", password);
        return;
      }
      joinedRef.current = true;
      joiningRef.current = false;
      retryCountRef.current = 0;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      localStorage.setItem(ACTIVE_ROOM_KEY, target);
      setJoined(true);
      setJoining(false);
      setRetryRoomId("");
      setPasswordRoomId("");
      setJoinPassword("");
      setPasswordError("");
      setShowBrowser(false);
      if (result.room) setRoom(result.room);
      try {
        const [history, files] = await Promise.all([
          realtimeApi<{ messages: ChatMessage[] }>(`/rooms/${encodeURIComponent(target)}/messages?limit=${MAX_LIVE_CHAT_MESSAGES}`),
          realtimeApi<{ documents: ChatMessage[] }>(`/rooms/${encodeURIComponent(target)}/documents`),
        ]);
        setMessages(current => [...history.messages, ...current.filter(message => !history.messages.some(saved => saved.id === message.id))]);
        setDocuments(current => [...files.documents, ...current.filter(document => !files.documents.some(saved => saved.id === document.id))].slice(0, 100));
      } catch { setError("Không thể tải lịch sử chat"); }
      const stream = await startLocalStream();
      const micEnabled = Boolean(stream);
      setMic(micEnabled);
      s.emit("mic:toggle", { roomId: target, enabled: micEnabled });
      setError(micEnabled ? "" : "Đã vào phòng ở chế độ chỉ nghe. Hãy cấp quyền microphone để bật voice.");
      if (!result.room?.users) return;
      const others = result.room.users.filter((u: { userId: string }) => u.userId !== session.user.id);
      for (const user of others) {
        const pc = await createPeerConnection(user.userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit("webrtc:offer", { targetUserId: user.userId, sdp: offer });
      }
    });
  }

  function retryJoinNow() {
    const target = retryRoomId || roomId || localStorage.getItem(ACTIVE_ROOM_KEY) || "";
    retryCountRef.current = 0;
    joiningRef.current = false;
    setJoining(false);
    joinRoom(target);
  }

  function closePasswordDialog() {
    setPasswordRoomId("");
    setJoinPassword("");
    setPasswordError("");
  }

  function submitRoomPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordRoomId || !joinPassword) return;
    setPasswordError("");
    joinRoom(passwordRoomId, false, joinPassword);
  }

  useEffect(() => {
    (window as any).__lucyJoinRoom = (code: string, password = "") => {
      if (socketRef.current?.connected) joinRoom(code, false, password);
    };
    return () => { delete (window as any).__lucyJoinRoom; };
  }, []);

  useEffect(() => {
    if (joined && roomId) localStorage.setItem(ACTIVE_ROOM_KEY, roomId);
  }, [joined, roomId]);

  const joinPasswordDialog = passwordRoomId ? <div className="modal-backdrop" onMouseDown={() => !joining && closePasswordDialog()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="join-password-title" onMouseDown={event => event.stopPropagation()}>
      <span className="eyebrow">🔒 Phòng riêng tư</span>
      <h2 id="join-password-title">Nhập mật khẩu phòng</h2>
      <p className="muted">Phòng <strong>{passwordRoomId}</strong> yêu cầu mật khẩu để tham gia.</p>
      <form className="form compact" onSubmit={submitRoomPassword}>
        <label>Mật khẩu
          <input type="password" value={joinPassword} onChange={event => setJoinPassword(event.target.value)} autoComplete="current-password" autoFocus required />
        </label>
        {passwordError && <p className="error" role="alert">{passwordError}</p>}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={closePasswordDialog} disabled={joining}>Hủy</button>
          <button className="primary-button" disabled={joining || !joinPassword}>{joining ? "Đang kiểm tra…" : "Vào phòng"}</button>
        </div>
      </form>
    </section>
  </div> : null;

  if (compact) {
    if (!joined) return joinPasswordDialog;
    return <><aside className={`mini-room${recording.status === 'RECORDING' ? " recording" : ""}`} aria-label="Phòng học đang tham gia">
      <button className="mini-room-main" onClick={() => navigate("/room")}>
        <span className="mini-room-avatar">{session.user.displayName[0]?.toUpperCase() || "U"}</span>
        <span className="mini-room-info">
          <small>{recording.status === 'RECORDING' ? `🔴 Đang ghi · ${duration(recordingElapsed)}` : connected ? "Đang trong phòng" : "Đang kết nối lại"}</small>
          <strong>{room?.title || roomId}</strong>
          <em>{participants.length} người tham gia</em>
        </span>
      </button>
      <div className="mini-room-actions">
        <button className={mic ? "active" : ""} onClick={toggleMic} aria-label={mic ? "Tắt mic" : "Bật mic"}>{mic ? "🎤" : "🔇"}</button>
        <button onClick={() => navigate("/room")} aria-label="Quay lại phòng">↗</button>
        <button className="leave" onClick={confirmLeaveRoom} aria-label="Thoát phòng">↪</button>
      </div>
    </aside>{joinPasswordDialog}</>;
  }

  if (showBrowser) {
    return <>{retryRoomId && <div className="room-retry-banner" role="status"><span>{joining ? `Đang tham gia lại phòng ${retryRoomId}…` : error || `Chưa thể vào phòng ${retryRoomId}`}</span><button onClick={retryJoinNow} disabled={joining}>Thử lại ngay</button></div>}<RoomBrowser session={session} onJoin={joinRoom} connected={connected} onCreateRoom={onCreateRoom} />{joinPasswordDialog}</>;
  }

  return <div className="room-view">
    {/* ── Topbar ── */}
    <header className="room-topbar">
      <button className="room-back" onClick={confirmLeaveRoom}>
        ← Danh sách phòng
      </button>
      <div className="room-topbar-info">
        <h1>{room?.title || roomId}</h1>
        <div className="room-meta">
          <span>{room?.languageCode === "en" ? "English" : room?.languageCode === "zh" ? "Chinese" : "Japanese"}</span>
          <span className="meta-dot">·</span>
          <span>Level {room?.levelNumber}</span>
          <span className="meta-dot">·</span>
          <span>Stage {Math.ceil((room?.levelNumber || 1) / 30)}</span>
        </div>
      </div>
      <div className={`room-connection${connected ? " connected" : ""}`}>
        <i />
        <span>{connected ? "Đã kết nối" : "Đang kết nối"}</span>
        {latency !== null && <span className="room-latency">{latency}ms</span>}
      </div>
    </header>

    {/* ── Error banner ── */}
    {error && (
      <div className="room-error-banner">
        <p className="error" role="alert">{error}</p>
        {retryRoomId && !joined && <button onClick={retryJoinNow} disabled={joining}>{joining ? "Đang thử…" : "Thử lại ngay"}</button>}
      </div>
    )}

    {superChatOpen && (
      <div className="modal-backdrop" onMouseDown={() => !giftSending && setSuperChatOpen(false)}>
        <section className="modal super-chat-modal" role="dialog" aria-modal="true" aria-labelledby="super-chat-title" onMouseDown={event => event.stopPropagation()}>
          <span className="eyebrow">💎 Super Chat</span>
          <h2 id="super-chat-title">Gửi quà trong phòng</h2>
          <p className="muted">Tin nhắn của bạn sẽ được làm nổi bật cho cả phòng sau khi giao dịch thành công.</p>
          <form className="form" onSubmit={sendSuperChat}>
            <label>Gửi đến
              <select name="toCreatorId" required defaultValue={giftRecipients[0]?.userId || ""}>
                {giftRecipients.length === 0 && <option value="" disabled>Chưa có PRO hoặc SUPER trong phòng</option>}
                {giftRecipients.map(person => <option key={person.userId} value={person.userId}>{person.displayName} · {person.role}</option>)}
              </select>
            </label>
            <label>Số tiền
              <input name="amount" type="number" min="1000" step="1000" placeholder="50.000" required />
            </label>
            <label>Lời nhắn
              <textarea name="message" rows={3} maxLength={240} placeholder="Cảm ơn buổi học!" />
            </label>
            {giftError && <p className="error" role="alert">{giftError}</p>}
            <div className="modal-actions">
              <button type="button" className="secondary-button" disabled={giftSending} onClick={() => setSuperChatOpen(false)}>Hủy</button>
              <button className="primary-button super-chat-submit" disabled={giftSending || giftRecipients.length === 0}>{giftSending ? "Đang gửi…" : "Gửi Super Chat"}</button>
            </div>
          </form>
        </section>
      </div>
    )}

    {/* ── Main body: participants grid + chat drawer ── */}
    <div className="room-body">
      <div className="room-main">
        {participants.length ? (
          <div className="participants-grid">
            {participants.map(person => {
              const isSpeaking = speakingUsers.has(person.userId);
              return <div className={`participant-tile${isSpeaking ? " speaking" : ""}`} key={person.participantId} aria-label={`${person.displayName}${isSpeaking ? ", đang nói" : ""}`}>
                <div className="tile-avatar">
                  <span>{person.displayName[0]?.toUpperCase()}</span>
                </div>
                <div className="tile-name">{person.displayName}</div>
                <div className="tile-role">{person.role}</div>
                <div className="tile-status">
                  {room?.raisedHands.includes(person.userId) && (
                    <span className="tile-hand" title="Đang giơ tay">✋</span>
                  )}
                  <span className={`tile-mic ${person.micEnabled ? "on" : "off"}`} title={person.micEnabled ? "Mic đang bật" : "Mic đang tắt"}>
                    {person.micEnabled ? "🎤" : "🔇"}
                  </span>
                </div>
                {person.userId !== session.user.id && (
                  <audio ref={el => { if (el) { remoteAudioRefs.current.set(person.userId, el); const s = remoteStreamsRef.current.get(person.userId); if (s && el.srcObject !== s) { el.srcObject = s; el.play().catch(() => {}); } } }} autoPlay playsInline style={{ width: 0, height: 0, position: 'absolute' }} />
                )}
              </div>;
            })}
          </div>
        ) : (
          <div className="participants-empty">
            <Empty text={joined ? "Chưa có người tham gia" : "Nhập mã phòng để xem người tham gia"} />
          </div>
        )}
      </div>

      {/* ── Chat drawer ── */}
      <aside className={`chat-drawer${chatOpen ? " open" : ""}`}>
        <div className="chat-drawer-header">
          <div className="chat-drawer-title">
            <span className="chat-eyebrow">
              {recording.status === 'RECORDING' ? `🔴 Đang ghi · ${duration(recordingElapsed)}` : recordingsList.length > 0 ? `🎵 ${recordingsList.length} bản ghi` : '💬 Chat'}
            </span>
            <h3>Hội thoại</h3>
          </div>
          <div className="chat-drawer-actions">
            {isLearner && (
              <button className="super-chat-button" onClick={() => { setGiftError(""); setSuperChatOpen(true); }}>💎 Super Chat</button>
            )}
            {recordingsList.map(r => (
              <audio key={r.id} src={r.url} controls style={{ height: 26, borderRadius: 4, maxWidth: 100 }} />
            ))}
            {joined && !showBrowser && canRecord && (
              <button
                className={recording.status === 'RECORDING' ? 'selected record-btn' : 'record-btn'}
                onClick={toggleRecording}
                style={{
                  background: recording.status === 'RECORDING' ? '#dc2626' : '#6366f1',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '5px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 12
                }}
              >
                <span>{recording.status === 'RECORDING' ? '⏹' : '⏺'}</span>
                {recording.status === 'RECORDING' ? 'Dừng' : 'Ghi âm'}
              </button>
            )}
          </div>
        </div>

        {recording.status === 'ERROR' && recording.error && (
          <p className="error" role="alert" style={{ margin: '4px 12px', fontSize: 12 }}>⚠️ {recording.error}</p>
        )}

        {joined ? (
          <>
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-empty-state">
                  <span>💬</span>
                  <p>Chưa có tin nhắn. Hãy bắt đầu cuộc hội thoại!</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isOwn = msg.userId === session.user.id;
                  const isSuperChat = msg.kind === "SUPER_CHAT";
                  return (
                    <div key={msg.id} className={`chat-msg${isOwn ? " own" : " other"}${isSuperChat ? " super-chat" : ""}`}>
                      {isSuperChat && <div className="super-chat-heading"><span>💎 Super Chat</span><strong>{money(msg.amount || 0)}</strong></div>}
                      {(!isOwn || isSuperChat) && <small className="chat-msg-author">{msg.displayName}</small>}
                      <p className="chat-msg-text">{msg.message}</p>
                      {isSuperChat && <small className="super-chat-recipient">Gửi đến {msg.toDisplayName}</small>}
                      <small className="chat-msg-time">
                        {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </small>
                    </div>
                  );
                })
              )}
              <div ref={el => el?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
            <form onSubmit={sendChat} className="chat-form">
              <div className="chat-input-wrap"><input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Nhập tin nhắn..." aria-label="Nhập tin nhắn" maxLength={MAX_CHAT_MESSAGE_LENGTH} /><small>{chatInput.length}/{MAX_CHAT_MESSAGE_LENGTH}</small></div>
              <button type="submit">Gửi</button>
            </form>
          </>
        ) : (
          <div className="chat-empty-state">
            <span>💬</span>
            <p>Tham gia phòng để chat và ghi âm</p>
          </div>
        )}
      </aside>

      <aside className={`documents-drawer${documentsOpen ? " open" : ""}`} aria-label="Tài liệu phòng học">
        <div className="room-documents-header">{documentsOpen && <strong>📎 Tài liệu <span>{documents.length}</span></strong>}<div>
          {documentsOpen && canRecord && <><button type="button" onClick={() => documentInputRef.current?.click()} disabled={documentSending} aria-label="Gửi tài liệu">{documentSending ? "Đang gửi…" : "＋ Gửi file"}</button><input ref={documentInputRef} className="document-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={sendDocument} /></>}
          <button type="button" className="documents-toggle" onClick={() => setDocumentsOpen(open => !open)} aria-expanded={documentsOpen} aria-label={documentsOpen ? "Đóng khu vực tài liệu" : "Mở khu vực tài liệu"} title={documentsOpen ? "Đóng tài liệu" : "Mở tài liệu"}>{documentsOpen ? "→" : "📎"}</button>
        </div>
        </div>
        {documentsOpen && (documents.length ? <div className="room-document-list">{documents.map(document => <a key={document.id} className="chat-document" href={realtimeAssetUrl(document.documentUrl || "")} target="_blank" rel="noreferrer" download={document.documentName}>
          <span aria-hidden="true">📄</span><span><strong>{document.documentName}</strong><small>{readableFileSize(document.documentSize)} · {document.displayName}</small></span><b aria-hidden="true">↓</b>
        </a>)}</div> : <small className="room-documents-empty">Chưa có tài liệu trong phòng</small>)}
      </aside>
    </div>

    {/* ── Bottom control bar ── */}
    {joined && (
      <footer className="room-controlbar">
        <button className={`ctrl-btn${mic ? " selected" : ""}`} onClick={toggleMic}>
          <span className="ctrl-icon">{mic ? "🎤" : "🔇"}</span>
          <span className="ctrl-label">{mic ? "Tắt mic" : "Bật mic"}</span>
        </button>
        <button className={`ctrl-btn${hand ? " selected" : ""}`} onClick={toggleHand}>
          <span className="ctrl-icon">✋</span>
          <span className="ctrl-label">{hand ? "Hạ tay" : "Giơ tay"}</span>
        </button>
        <button className="ctrl-btn" onClick={ping}>
          <span className="ctrl-icon">📡</span>
          <span className="ctrl-label">Ping</span>
        </button>
        {canRecord && <button className={`ctrl-btn${recording.status === 'RECORDING' ? " recording" : ""}`} onClick={toggleRecording}>
          <span className="ctrl-icon">{recording.status === 'RECORDING' ? '⏹' : '⏺'}</span>
          <span className="ctrl-label">{recording.status === 'RECORDING' ? 'Dừng' : 'Ghi âm'}</span>
        </button>}
        <button className={`ctrl-btn chat-toggle${chatOpen ? " active" : ""}`} onClick={() => setChatOpen(v => !v)}>
          <span className="ctrl-icon">💬</span>
          <span className="ctrl-label">Chat</span>
        </button>
        <button className="ctrl-btn leave" onClick={confirmLeaveRoom}>
          <span className="ctrl-icon">↪</span>
          <span className="ctrl-label">Thoát phòng</span>
        </button>
      </footer>
    )}
  </div>;
}

function Empty({ text, loading = false }: { text: string; loading?: boolean }) {
  return <div className="empty">{loading ? <span className="spinner" /> : <span>✦</span>}<p>{text}</p></div>;
}
