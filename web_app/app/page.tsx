"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
type Room = { roomId: string; createdAt: string; users: Participant[]; raisedHands: string[]; languageCode?: string; levelNumber?: number };
type RoomInfo = { roomCode: string; title: string; languageCode: string; levelNumber: number; participantCount?: number; status: string };
type Socket = {
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

  if (booting) return <div className="boot"><span className="spinner" />Đang mở LUCY…</div>;

  const content = !session ? (
    route === "/register" ? (
      <RegisterView notify={notify} />
    ) : (
      <LoginView onLogin={saveSession} />
    )
  ) : (
    <AppShell route={route} session={session} logout={logout} onCreateRoom={() => setShowCreateRoom(true)}>
      {route === "/room" && <RoomView session={session} />}
      {route === "/wallet" && <WalletView session={session} notify={notify} />}
      {route === "/gifts" && <GiftsView session={session} notify={notify} />}
      {route === "/podcasts" && <PodcastsView session={session} notify={notify} />}
      {(route === "/home" || route === "/login" || route === "/register") && <HomeView session={session} />}
    </AppShell>
  );

  return <>{content}{toast && <div className="toast" role="status">{toast}</div>}{showCreateRoom && session && <CreateRoomDialog session={session} onClose={() => setShowCreateRoom(false)} />}</>;
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

  return <><div className="section-heading"><div><span className="eyebrow">📻 Thư viện</span><h2>Podcast bài học</h2><p>Nghe lại nội dung từ các phòng học LUCY.</p></div>{isSuper && <button className="primary-button fit" onClick={() => { setError(""); setDialog(true); }}>＋ Tạo mới</button>}</div>{error && !dialog && <p className="error banner" role="alert">{error} <button onClick={load}>Thử lại</button></p>}{loading ? <Empty text="Đang tải podcast…" loading /> : items.length ? <section className="podcast-grid">{items.map(item => <article className="podcast-card" key={item.id}><div className="podcast-art"><span>▶</span><small>{duration(item.durationSeconds)}</small></div><div><span className="eyebrow">{item.roomId}</span><h3>{item.title}</h3><p>Tác giả: {item.creatorId}</p><small>{dateTime(item.createdAt)}</small></div><button disabled title="Bản demo chỉ lưu metadata" aria-label="Phát podcast">▶</button></article>)}</section> : <Empty text="Chưa có bản ghi podcast nào" />}{dialog && <div className="modal-backdrop" role="presentation" onMouseDown={() => !creating && setDialog(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="podcast-title" onMouseDown={event => event.stopPropagation()}><div className="panel-title"><div><span className="eyebrow">Creator tools</span><h2 id="podcast-title">Tạo podcast mới</h2></div><button className="icon-button" onClick={() => setDialog(false)} aria-label="Đóng">×</button></div><form className="form compact" onSubmit={create}><label>Creator ID<input name="creatorId" defaultValue={session.user.id} required /></label><label>Room ID<input name="roomId" required /></label><label>Tiêu đề<input name="title" required /></label><label>Storage URI<input name="storageUri" placeholder="s3://recordings/..." required /></label><label>Thời lượng (giây)<input name="durationSeconds" type="number" min="1" required /></label>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setDialog(false)}>Hủy</button><button className="primary-button fit" disabled={creating}>{creating ? "Đang tạo…" : "Tạo podcast"}</button></div></form></section></div>}</>;
}

function CreateRoomDialog({ onClose, session }: { onClose: () => void; session: Session }) {
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
      await realtimeApi("/rooms", {
        method: "POST",
        body: JSON.stringify({
          roomCode: form.get("roomCode"),
          title: form.get("title") || `${LANGUAGES.find(l => l.code === language)?.name} Level ${levelNumber}`,
          languageCode: language,
          levelNumber,
        }),
      });
      onClose();
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

function RoomBrowser({ session, onJoin }: { session: Session; onJoin: (roomCode: string) => void }) {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterLang, setFilterLang] = useState("");

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

  return <div className="room-browser">
    <div className="section-heading">
      <div>
        <span className="eyebrow">🎙️ Phòng học</span>
        <h2>Danh sách phòng</h2>
        <p>Chọn phòng để tham gia học tập cùng nhóm.</p>
      </div>
      <div className="filter-row">
        <select value={filterLang} onChange={e => setFilterLang(e.target.value)}>
          <option value="">Tất cả ngôn ngữ</option>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        <button className="text-button" onClick={load} disabled={loading}>⟳ Làm mới</button>
      </div>
    </div>
    {error && <p className="error banner" role="alert">{error} <button onClick={load}>Thử lại</button></p>}
    {loading ? <div className="empty"><span className="spinner" /><p>Đang tải phòng…</p></div>
    : grouped.length === 0 ? <div className="empty"><span>✦</span><p>Chưa có phòng nào. Mentor có thể tạo phòng mới.</p></div>
    : <div className="room-groups">
        {grouped.map(([key, roomList]) => {
          const lang = LANGUAGES.find(l => l.code === roomList[0].languageCode);
          return <div key={key} className="room-group">
            <h3>{lang?.name || roomList[0].languageCode} · Level {roomList[0].levelNumber}</h3>
            <div className="room-cards">
              {roomList.map(r => <button key={r.roomCode} className="room-card" onClick={() => onJoin(r.roomCode)}>
                <span className="room-icon">🎙️</span>
                <div>
                  <strong>{r.title}</strong>
                  <small>{r.roomCode} · {r.participantCount || 0} người</small>
                </div>
                <span className="join-badge">Tham gia →</span>
              </button>)}
            </div>
          </div>;
        })}
      </div>}
  </div>;
}

function RoomView({ session }: { session: Session }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [mic, setMic] = useState(true);
  const [hand, setHand] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [showBrowser, setShowBrowser] = useState(true);

  useEffect(() => {
    let active = true;
    let liveSocket: Socket | null = null;
    const connect = () => {
      if (!active || !window.io) return;
      liveSocket = window.io(REALTIME_URL, { transports: ["websocket"] });
      liveSocket.on("connect", () => { setConnected(true); setError(""); });
      liveSocket.on("disconnect", () => { setConnected(false); setJoined(false); });
      liveSocket.on("connect_error", () => setError("Không thể kết nối Realtime service"));
      liveSocket.on("room:state", (state: Room) => setRoom(state));
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

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!socket || !roomId.trim()) return;
    socket.emit("room:join", { roomId: roomId.trim(), userId: session.user.id, displayName: session.user.displayName, role: session.user.role }, (result: { ok: boolean; message?: string }) => {
      if (result?.ok) { setJoined(true); setError(""); }
      else setError(result?.message || "Không thể vào phòng");
    });
  }
  function toggleHand() { const next = !hand; socket?.emit("hand:raise", { roomId, raised: next }); setHand(next); }
  function toggleMic() { const next = !mic; socket?.emit("mic:toggle", { roomId, enabled: next }); setMic(next); }
  function ping() {
    const started = Date.now(); setLatency(null);
    socket?.emit("latency:ping", { clientSentAt: started }, (result: { ok: boolean }) => result?.ok && setLatency(Date.now() - started));
  }

  const participants = useMemo(() => room?.users || [], [room]);

  if (showBrowser) {
    return <RoomBrowser session={session} onJoin={(code) => { setRoomId(code); setShowBrowser(false); }} />;
  }

  return <div className="room-layout">
    <section className="panel room-controls">
      <div className="connection"><i className={connected ? "connected" : ""} />{connected ? "Đã kết nối" : "Đang kết nối"}{latency !== null && <span>{latency} ms</span>}</div>
      <span className="eyebrow">🎙️ Phòng học trực tiếp</span>
      <h2>Tham gia phòng học</h2>
      <form className="form compact" onSubmit={join}>
        <label>Room ID<input value={roomId} onChange={event => setRoomId(event.target.value)} placeholder="english-level-1" required /></label>
        <button className="primary-button" disabled={!connected}>{joined ? "Đã vào phòng" : "Join Room"}</button>
      </form>
      <button className="text-button" onClick={() => setShowBrowser(true)} style={{ marginTop: 8 }}>← Danh sách phòng</button>
      {error && <p className="error" role="alert">{error}</p>}
      {joined && <div className="room-actions">
        <button className={hand ? "selected" : ""} onClick={toggleHand}>✋ {hand ? "Hạ tay" : "Giơ tay"}</button>
        <button className={mic ? "selected" : ""} onClick={toggleMic}>{mic ? "🎤 Tắt mic" : "🔇 Bật mic"}</button>
        <button onClick={ping}>📡 Ping</button>
      </div>}
    </section>
    <section className="panel participants">
      <div className="panel-title">
        <div>
          <span className="eyebrow">{room?.roomId || "Room state"}</span>
          <h2>Người tham gia</h2>
          {room?.languageCode && room?.levelNumber != null && (
            <small style={{ color: "var(--muted)", fontSize: 12, marginTop: 4, display: "block" }}>
              {room.languageCode.toUpperCase()} · Level {room.levelNumber}
            </small>
          )}
        </div>
        <span className="count">{participants.length}</span>
      </div>
      {participants.length ? <div className="list">{participants.map(person => <article className="participant" key={person.participantId}>
        <span className="avatar">{person.displayName[0]?.toUpperCase()}</span>
        <div>
          <h3>{person.displayName}</h3>
          <p>{person.role}</p>
        </div>
        <div className="participant-state">
          {room?.raisedHands.includes(person.userId) && <span title="Đang giơ tay">✋</span>}
          <span title={person.micEnabled ? "Mic đang bật" : "Mic đang tắt"}>{person.micEnabled ? "🎤" : "🔇"}</span>
        </div>
      </article>)}</div> : <Empty text={joined ? "Chưa có người tham gia" : "Nhập mã phòng để xem người tham gia"} />}
    </section>
  </div>;
}

function Empty({ text, loading = false }: { text: string; loading?: boolean }) {
  return <div className="empty">{loading ? <span className="spinner" /> : <span>✦</span>}<p>{text}</p></div>;
}
