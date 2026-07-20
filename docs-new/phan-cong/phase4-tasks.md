# Phân công nhiệm vụ — Phase 4 (SOA & Monetization)

| **Tên dự án** | LUCY (Language Unity & Collaborative Youth) |
|---|---|
| **Phiên bản** | 1.0.0 |
| **Ngày tạo** | 2026-06-29 |
| **Phase** | 4 — SOA / Microservices & Monetization |
| **Services** | Auth, Wallet, Realtime, LMS |

---

## Mục lục

- [1. Phân công theo Service](#1-phan-cong-theo-service)
- [2. Chi tiết đầu việc theo nhóm](#2-chi-tiet-dau-viec-theo-nhom)
- [3. Luồng test liên service](#3-luong-test-lien-service)
- [4. Các phase còn lại](#4-cac-phase-con-lai)

---

## 1. Phân công theo Service

| Service | File chính | Công nghệ | Người phụ trách | Trạng thái |
|---|---|---|---|---|
| **Auth API** | `phase4-rbl/dotnet-auth/Program.cs` | .NET 10 | Backend 1 | ✅ Hoàn thành |
| **Wallet API** | `phase4-rbl/dotnet-wallet/Program.cs` | .NET 10 + Swagger | Backend 2 | ✅ Hoàn thành |
| **Realtime Audio** | `phase4-rbl/realtime-audio/src/server.js` | Node.js 22 + Socket.IO | Backend 3 | ✅ Hoàn thành |
| **Java LMS** | `phase4-rbl/java-lms/src/main/java/com/lucy/lms/*.java` | Java 26 + State Pattern | Backend 4 | ✅ Hoàn thành |
| **Flutter App** | `flutter_app/lib/screens/*.dart` | Flutter 3.27+ | Mobile 1 | 🔄 Đang thực hiện |
| **Database** | `phase4-rbl/database/*.sql` | MariaDB 12 | Team | ✅ Hoàn thành |
| **Stress Test** | `phase4-rbl/stress-tests/*.js` | k6 0.54+ | Team | 🔄 Phase 5 |

---

## 2. Chi tiết đầu việc theo nhóm

### Backend 1 — Auth API

| STT | Đầu việc | File | Ghi chú |
|---|---|---|---|
| 1 | Register endpoint | Program.cs | Validation, hash password, JWT |
| 2 | Login endpoint | Program.cs | Xác thực, trả token |
| 3 | Me endpoint | Program.cs | JWT validation, trả profile |
| 4 | Role management | Program.cs | Ensure role, normalize role |
| 5 | MariaDB integration | Program.cs | MySqlConnection, transaction |

### Backend 2 — Wallet API

| STT | Đầu việc | File | Ghi chú |
|---|---|---|---|
| 1 | Health check | Program.cs | GET /health |
| 2 | Wallet CRUD | Program.cs | GET /wallets/{userId}, auto-create |
| 3 | Top-up flow | Program.cs | MariaDB transaction |
| 4 | Gift flow | Program.cs | Double wallet transaction |
| 5 | Podcast recordings | Program.cs | POST/GET recordings |
| 6 | Swagger UI | Program.cs | AddSwaggerGen, UseSwaggerUI |
| 7 | Data models | Program.cs (inline) | WalletAccount, GiftRequest, etc. |

### Backend 3 — Realtime Audio

| STT | Đầu việc | File | Ghi chú |
|---|---|---|---|
| 1 | Express server setup | server.js | CORS, JSON, HTTP server |
| 2 | MariaDB connection pool | server.js | mysql2/promise pool |
| 3 | Room management | server.js | ensureRoom, serializeRoom |
| 4 | Socket.IO setup | server.js | Connection, event handlers |
| 5 | Agora token scaffold | server.js | POST /agora/token |
| 6 | Room join flow | server.js | DB insert, broadcast |
| 7 | Hand raise | server.js | DB update, broadcast |
| 8 | Mic toggle | server.js | DB update, broadcast |
| 9 | Latency ping/pong | server.js | Round-trip measurement |

### Backend 4 — Java LMS

| STT | Đầu việc | File | Ghi chú |
|---|---|---|---|
| 1 | Main application | LmsApplication.java | JDBC connect, seed, run |
| 2 | State interface | SubLevelState.java | Interface with execute() |
| 3 | WarmUp state | WarmUpState.java | First sub-level |
| 4 | GuidedPractice state | GuidedPracticeState.java | Second sub-level |
| 5 | PeerExchange state | PeerExchangeState.java | Third sub-level |
| 6 | Reflection state | ReflectionState.java | Final sub-level |
| 7 | Transition engine | StageTransitionEngine.java | State machine |
| 8 | Mentor dashboard | MentorDashboard.java | Load data, generate summary |
| 9 | Learner progress | LearnerProgress.java | Sub-level model |
| 10 | Dashboard summary | DashboardSummary.java | Report generation |

### Mobile 1 — Flutter App

| STT | Đầu việc | File | Ghi chú |
|---|---|---|---|
| 1 | Login screen | screens/login_screen.dart | Gọi POST /auth/login |
| 2 | Register screen | screens/register_screen.dart | Gọi POST /auth/register |
| 3 | Room list screen | screens/room_list_screen.dart | Gọi GET /rooms |
| 4 | Audio room screen | screens/audio_room_screen.dart | Socket.IO + Agora |
| 5 | Wallet screen | screens/wallet_screen.dart | GET/POST wallet |
| 6 | Gift screen | screens/gift_screen.dart | POST /gifts |
| 7 | LMS dashboard | screens/lms_dashboard.dart | Hiển thị progress |

---

## 3. Luồng test liên service

### 3.1 Auth -> Wallet -> Gift Flow

```
1. POST /auth/register (tạo 3 users: mentor, learner, creator)
2. POST /auth/login (lấy JWT)
3. GET /wallets/{userId} (tạo ví cho cả 3)
4. POST /wallets/{userId}/top-up (nạp tiền cho learner)
5. POST /gifts (learner gửi gift cho creator)
6. GET /gifts (kiểm tra lịch sử)
```

### 3.2 Auth -> Realtime Flow

```
1. POST /auth/register (tạo user anonymous)
2. GET /rooms (xem danh sách phòng)
3. Socket.IO connect
4. room:join (tham gia phòng)
5. hand:raise (giơ tay)
6. mic:toggle (bật mic)
7. latency:ping (đo độ trễ)
```

### 3.3 Cách chạy test

Mở 4 terminals:

```bash
# Terminal 1: Auth
cd phase4-rbl/dotnet-auth && dotnet run

# Terminal 2: Wallet
cd phase4-rbl/dotnet-wallet && dotnet run

# Terminal 3: Realtime
cd phase4-rbl/realtime-audio && npm start

# Terminal 4: Database (optional)
mariadb -u root -p1
USE lucy_phase4;

# Terminal 5: Test (curl)
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@lucy.local","password":"Test@123","displayName":"Test User","role":"Anonymous"}'
```

---

## 4. Các phase còn lại

| Phase | Service chính | Người | Ghi chú |
|---|---|---|---|
| **Phase 5** | Stress Test + Flutter | Team + Mobile 1 | k6 stress, cross testing, Flutter app hoàn thiện |
| **Phase 3** | Java LMS (State Pattern) | Backend 4 | Đã hoàn thành, kế thừa từ phase3-rbl |
| **Phase 2** | Realtime Audio | Backend 3 | Đã hoàn thành, kế thừa từ phase2-rbl |
| **Phase 1** | Auth + Content Import | Backend 1 + Team | Đã hoàn thành, kế thừa từ phase1-rbl |

### Lưu ý khi hoàn thiện Phase 5

1. Chạy k6 stress test với 1000 virtual users
2. Ghi nhận kết quả vào bảng `stress_test_runs`
3. Cross-test giữa các nhóm, ghi vào `cross_testing_reports`
4. Hoàn thiện Flutter app tích hợp tất cả API
5. Kiểm tra thresholds: p(95) latency < 800ms, failure rate < 5%
