"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  roomId?: string;
  amount: number;
  message?: string;
  createdAt: string;
};
type Podcast = {
  id: string;
  creatorId: string;
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
};
type RecordingState = {
  status: 'RECORDING' | 'SAVED' | 'NONE' | 'ERROR';
  startedBy?: string;
  recordingId?: string;
  audioUrl?: string;
  error?: string;
};
type RoomInfo = { roomId: string; title: string; languageCode: string; levelNumber: number; participantCount?: number; status: string };
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
const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:3020";
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
  const response = await fetch(`http://localhost:3020${path}`, {
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
    <AppShell route={route} session={session} logout={logout} onCreateRoom={() => setShowCreateRoom(true)}>
      {route === "/room" && <RoomView session={session} onCreateRoom={() => setShowCreateRoom(true)} />}
      {route === "/wallet" && <WalletView session={session} notify={notify} />}
      {route === "/gifts" && <GiftsView session={session} notify={notify} />}
      {route === "/podcasts" && <PodcastsView session={session} notify={notify} />}
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

function AppShell({ route, session, logout, onCreateRoom, children }: { route: Route; session: Session; logout: () => void; onCreateRoom?: () => void; children: React.ReactNode }) {
  const canCreate = session.user.role === "PRO" || session.user.role === "SUPER";
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="side-brand" href="#/home"><span>✦</span><b>LUCY</b></a>
      <nav aria-label="Điều hướng chính">{nav.map(([href, icon, label]) => <a key={href} href={`#${href}`} className={route === href ? "active" : ""}><span>{icon}</span>{label}</a>)}</nav>
      <div className="side-user"><span className="avatar">{session.user.displayName?.[0]?.toUpperCase() || "U"}</span><div><b>{session.user.displayName}</b><small>{session.user.role}</small></div>{canCreate && <button onClick={onCreateRoom} aria-label="Tạo phòng" title="Tạo phòng học mới">＋</button>}<button onClick={logout} aria-label="Đăng xuất" title="Đăng xuất">↪</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><small>LUCY · Phase 5</small><h1>{nav.find(([href]) => href === route)?.[2] || "Trang chủ"}</h1></div><span className="role-pill">{session.user.role}</span></header>
      <div className="content">{children}</div>
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
      await api<Gift | { transaction: Gift }>("wallet", "/gifts", { method: "POST", token: session.token, body: JSON.stringify({ fromUserId: form.get("fromUserId"), toCreatorId: form.get("toCreatorId"), amount, message: form.get("message") }) });
      formElement.reset();
      notify("Gửi quà thành công!");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Gửi quà thất bại"); }
    finally { setSending(false); }
  }

  return <div className="two-column gifts-layout"><section className="panel sticky-panel"><span className="eyebrow">🎁 Quà tặng</span><h2>Gửi quà</h2><p className="muted">Ủng hộ creator bằng số dư ví LUCY của bạn.</p><form className="form compact" onSubmit={send}><label>Từ User ID<input name="fromUserId" defaultValue={session.user.id} required /></label><label>Đến Creator ID<input name="toCreatorId" placeholder="creator-1" required /></label><label>Số tiền<input name="amount" type="number" min="1000" step="1000" required /></label><label>Lời nhắn<textarea name="message" rows={3} placeholder="Cảm ơn bài học!" /></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary-button" disabled={sending}>{sending ? "Đang gửi…" : "Gửi quà"}</button></form></section><section className="panel"><div className="panel-title"><div><span className="eyebrow">Hoạt động</span><h2>Lịch sử quà tặng</h2></div><button className="icon-button" onClick={load} aria-label="Làm mới">↻</button></div>{loading ? <Empty text="Đang tải giao dịch…" loading /> : gifts.length ? <div className="list">{gifts.map(gift => <article className="list-item" key={gift.id}><span className="avatar gift-avatar">{gift.fromUserId[0]?.toUpperCase()}</span><div><h3>{gift.fromUserId} <span>→</span> {gift.toCreatorId}</h3><p>{gift.message || "Không có lời nhắn"}</p><small>{dateTime(gift.createdAt)}</small></div><strong>{money(gift.amount)}</strong></article>)}</div> : <Empty text="Chưa có giao dịch quà tặng" />}</section></div>;
}

function PodcastsView({ session, notify }: { session: Session; notify: (message: string) => void }) {
  const [items, setItems] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [error, setError] = useState("");
  const isSuper = session.user.role.toUpperCase() === "SUPER";
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await api<Podcast[]>("wallet", "/podcasts/recordings", { token: session.token })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải podcast"); }
    finally { setLoading(false); }
  }, [session.token]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const durationSeconds = Number(form.get("durationSeconds"));
    if (!(durationSeconds > 0)) { setError("Thời lượng không hợp lệ"); return; }
    setCreating(true); setError("");
    try {
      await api("wallet", "/podcasts/recordings", { method: "POST", token: session.token, body: JSON.stringify({ creatorId: form.get("creatorId"), roomId: form.get("roomId"), title: form.get("title"), storageUri: form.get("storageUri"), durationSeconds }) });
      setDialog(false); notify("Tạo podcast thành công!"); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Tạo podcast thất bại"); }
    finally { setCreating(false); }
  }

  return <><div className="section-heading"><div><span className="eyebrow">📻 Thư viện</span><h2>Podcast bài học</h2><p>Nghe lại nội dung từ các phòng học LUCY.</p></div>{isSuper && <button className="primary-button fit" onClick={() => { setError(""); setDialog(true); }}>＋ Tạo mới</button>}</div>{error && !dialog && <p className="error banner" role="alert">{error} <button onClick={load}>Thử lại</button></p>}{loading ? <Empty text="Đang tải podcast…" loading /> : items.length ? <section className="podcast-grid">{items.map(item => <article className="podcast-card" key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><div className="podcast-art"><span>▶</span><small>{duration(item.durationSeconds)}</small></div><div style={{ flex: 1 }}><span className="eyebrow">{item.roomId}</span><h3>{item.title}</h3><p>Tác giả: {item.creatorId}</p><small>{dateTime(item.createdAt)}</small></div></div>{item.storageUri ? <audio src={item.storageUri.startsWith("http") ? item.storageUri : `${REALTIME_URL}${item.storageUri}`} controls style={{ width: '100%', height: 40, borderRadius: 8 }} /> : <button disabled title="Chưa có file audio" aria-label="Phát podcast" style={{ alignSelf: 'flex-start' }}>▶</button>}</article>)}</section> : <Empty text="Chưa có bản ghi podcast nào" />}{dialog && <div className="modal-backdrop" role="presentation" onMouseDown={() => !creating && setDialog(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="podcast-title" onMouseDown={event => event.stopPropagation()}><div className="panel-title"><div><span className="eyebrow">Creator tools</span><h2 id="podcast-title">Tạo podcast mới</h2></div><button className="icon-button" onClick={() => setDialog(false)} aria-label="Đóng">×</button></div><form className="form compact" onSubmit={create}><label>Creator ID<input name="creatorId" defaultValue={session.user.id} required /></label><label>Room ID<input name="roomId" required /></label><label>Tiêu đề<input name="title" required /></label><label>Storage URI<input name="storageUri" placeholder="s3://recordings/..." required /></label><label>Thời lượng (giây)<input name="durationSeconds" type="number" min="1" required /></label>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setDialog(false)}>Hủy</button><button className="primary-button fit" disabled={creating}>{creating ? "Đang tạo…" : "Tạo podcast"}</button></div></form></section></div>}</>;
}

function CreateRoomDialog({ onClose, onCreated, session }: { onClose: () => void; onCreated?: (roomCode: string) => void; session: Session }) {
  const [language, setLanguage] = useState("en");
  const [levelNumber, setLevelNumber] = useState(1);
  const [roomCode, setRoomCode] = useState("");
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
      await realtimeApi("/rooms", {
        method: "POST",
        body: JSON.stringify({
          roomCode,
          title: form.get("title") || `${LANGUAGES.find(l => l.code === language)?.name} Level ${levelNumber}`,
          languageCode: language,
          levelNumber,
        }),
      });
      onClose();
      window.location.hash = "#/room";
      const jr = (window as any).__lucyJoinRoom;
      if (jr) setTimeout(() => jr(roomCode), 100);
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
                  <small>{r.roomId} · {r.participantCount || 0} người</small>
                </div>
                <span className="join-badge">{connected ? "Tham gia →" : "..."}</span>
              </button>)}
            </div>
          </div>;
        })}
      </div>}
  </div>;
}

function RoomView({ session, onCreateRoom }: { session: Session; onCreateRoom?: () => void }) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [showBrowser, setShowBrowser] = useState(true);
  const [mic, setMic] = useState(true);
  const [hand, setHand] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [recording, setRecording] = useState<RecordingState>({ status: 'NONE' });
  const [remoteUsers, setRemoteUsers] = useState<{ userId: string; displayName: string }[]>([]);
  const [chatOpen, setChatOpen] = useState(true);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());


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
      });
      liveSocket.on("disconnect", () => {
        setConnected(false);
        setJoined(false);
        stopLocalStream();
        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
        remoteStreamsRef.current.clear();
        remoteAudioRefs.current.clear();
        setRemoteUsers([]);
      });
      liveSocket.on("connect_error", () => setError("Không thể kết nối Realtime service"));
      liveSocket.on("room:state", (state: Room) => setRoom(state));
      liveSocket.on("chat:message", (msg: ChatMessage) => {
        setMessages(prev => [...prev, msg]);
      });
      liveSocket.on("recording:update", (state: RecordingState) => {
        setRecording(prev => ({ ...prev, ...state }));
      });
      liveSocket.on("webrtc:offer", ({ userId, sdp }: { userId: string; sdp: RTCSessionDescriptionInit }) => {
        handleWebRTCOffer(userId, sdp);
      });
      liveSocket.on("webrtc:answer", ({ userId, sdp }: { userId: string; sdp: RTCSessionDescriptionInit }) => {
        handleWebRTCAnswer(userId, sdp);
      });
      liveSocket.on("webrtc:ice-candidate", ({ userId, candidate }: { userId: string; candidate: RTCIceCandidateInit }) => {
        handleWebRTCIceCandidate(userId, candidate);
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
    return () => { active = false; liveSocket?.off(); liveSocket?.disconnect(); };
  }, []);

  function toggleHand() { const s = socketRef.current || socket; const next = !hand; s?.emit("hand:raise", { roomId, raised: next }); setHand(next); }
  function toggleMic() {
    const s = socketRef.current || socket;
    const next = !mic;
    s?.emit("mic:toggle", { roomId, enabled: next });
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = next; });
    }
    setMic(next);
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
      userId: session.user.id,
      displayName: session.user.displayName,
      message: chatInput.trim(),
    }, (result: { ok: boolean }) => {
      if (result?.ok) setChatInput("");
    });
  }
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingsListRef = useRef<{ id: number; url: string; status: string }[]>([]);
  const recIdCounterRef = useRef(0);
  const [recordingsList, setRecordingsList] = useState<{ id: number; url: string; status: string }[]>([]);

  function toggleRecording() {
    if (recording.status === 'RECORDING') {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
    } else {
      const stream = localStreamRef.current;
      if (!stream) { setRecording({ status: 'ERROR', error: "Chưa có quyền truy cập micro. Join room trước." }); return; }
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const thisId = ++recIdCounterRef.current;
      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        const localUrl = URL.createObjectURL(blob);
        const entry = { id: thisId, url: localUrl, status: 'local' };
        recordingsListRef.current = [...recordingsListRef.current, entry];
        setRecordingsList([...recordingsListRef.current]);
        setRecording({ status: 'NONE' });
        audioChunksRef.current = [];
        const s = socketRef.current || socket;
        if (s?.connected) {
          const formData = new FormData();
          formData.append("audio", blob, `rec-${thisId}.webm`);
          formData.append("roomCode", roomId);
          formData.append("userId", session.user.id);
          formData.append("displayName", session.user.displayName);
          fetch(`${REALTIME_URL}/api/upload-recording`, {
            method: "POST",
            body: formData,
          }).then(res => res.json()).then(data => {
            if (data.ok) {
              entry.url = `${REALTIME_URL}${data.storageUri}`;
              entry.status = 'saved';
              setRecordingsList([...recordingsListRef.current]);
            }
          }).catch(() => {});
        }
      };
      recorder.onerror = () => {
        setRecording({ status: 'ERROR', error: "Lỗi khi ghi âm" });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording({ status: 'RECORDING' });
    }
  }

  async function startLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      return stream;
    } catch {
      return null;
    }
  }

  function stopLocalStream() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
  }

  const STUN_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  function getSocketOrThrow(): Socket {
    const s = socketRef.current;
    if (!s) throw new Error("Socket not connected");
    return s;
  }

  async function createPeerConnection(targetUserId: string) {
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

  async function handleWebRTCOffer(userId: string, sdp: RTCSessionDescriptionInit) {
    const pc = await createPeerConnection(userId);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    getSocketOrThrow().emit("webrtc:answer", { targetUserId: userId, sdp: answer });
  }

  async function handleWebRTCAnswer(userId: string, sdp: RTCSessionDescriptionInit) {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  function handleWebRTCIceCandidate(userId: string, candidate: RTCIceCandidateInit) {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  function closePeerConnection(userId: string) {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
    remoteStreamsRef.current.delete(userId);
  }

  const participants = useMemo(() => room?.users || [], [room]);

  function joinRoom(code: string) {
    const s = socketRef.current || socket;
    if (!s || !code.trim() || joined) return;
    setRoomId(code);
    setShowBrowser(false);
    setJoined(true);
    if (!s.connected) {
      setJoined(false);
      setShowBrowser(true);
      setError("Chưa kết nối được server. Vui lòng đợi hoặc refresh.");
      return;
    }
    s.emit("room:join", { roomId: code, userId: session.user.id, displayName: session.user.displayName, role: session.user.role }, async (result: { ok: boolean; room?: Room; message?: string }) => {
      if (!result?.ok) { setJoined(false); setShowBrowser(true); return; }
      setError("");
      const stream = await startLocalStream();
      if (!stream || !result.room?.users) return;
      const others = result.room.users.filter((u: { userId: string }) => u.userId !== session.user.id);
      for (const user of others) {
        const pc = await createPeerConnection(user.userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit("webrtc:offer", { targetUserId: user.userId, sdp: offer });
      }
    });
  }

  useEffect(() => {
    (window as any).__lucyJoinRoom = (code: string) => {
      if (socketRef.current?.connected) joinRoom(code);
    };
    return () => { delete (window as any).__lucyJoinRoom; };
  }, []);

  if (showBrowser) {
    return <RoomBrowser session={session} onJoin={joinRoom} connected={connected} onCreateRoom={onCreateRoom} />;
  }

  return <div className="room-view">
    {/* ── Topbar ── */}
    <header className="room-topbar">
      <button className="room-back" onClick={() => setShowBrowser(true)}>
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
      </div>
    )}

    {/* ── Main body: participants grid + chat drawer ── */}
    <div className="room-body">
      <div className="room-main">
        {participants.length ? (
          <div className="participants-grid">
            {participants.map(person => (
              <div className="participant-tile" key={person.participantId}>
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
              </div>
            ))}
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
              {recording.status === 'RECORDING' ? '🔴 Đang ghi' : recordingsList.length > 0 ? `🎵 ${recordingsList.length} bản ghi` : '💬 Chat'}
            </span>
            <h3>Hội thoại</h3>
          </div>
          <div className="chat-drawer-actions">
            {recordingsList.map(r => (
              <audio key={r.id} src={r.url} controls style={{ height: 26, borderRadius: 4, maxWidth: 100 }} />
            ))}
            {joined && !showBrowser && (
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
                  return (
                    <div key={msg.id} className={`chat-msg${isOwn ? " own" : " other"}`}>
                      {!isOwn && <small className="chat-msg-author">{msg.displayName}</small>}
                      <p className="chat-msg-text">{msg.message}</p>
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
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Nhập tin nhắn..."
              />
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
        <button className={`ctrl-btn${recording.status === 'RECORDING' ? " recording" : ""}`} onClick={toggleRecording}>
          <span className="ctrl-icon">{recording.status === 'RECORDING' ? '⏹' : '⏺'}</span>
          <span className="ctrl-label">{recording.status === 'RECORDING' ? 'Dừng' : 'Ghi âm'}</span>
        </button>
        <button className={`ctrl-btn chat-toggle${chatOpen ? " active" : ""}`} onClick={() => setChatOpen(v => !v)}>
          <span className="ctrl-icon">💬</span>
          <span className="ctrl-label">Chat</span>
        </button>
      </footer>
    )}
  </div>;
}

function Empty({ text, loading = false }: { text: string; loading?: boolean }) {
  return <div className="empty">{loading ? <span className="spinner" /> : <span>✦</span>}<p>{text}</p></div>;
}
