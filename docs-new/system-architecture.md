# System Architecture Document — LUCY SWD392

| **Tên dự án** | LUCY (Language Unity & Collaborative Youth) |
|---|---|
| **Phiên bản** | 1.1.0 |
| **Ngày cập nhật** | 2026-07-23 |
| **Loại tài liệu** | Architecture |
| **Công nghệ** | .NET 10, Node.js 22, Java 26, MariaDB 12, Flutter 3.27+ |

---

## Mục lục

- [1. Architectural Style](#1-architectural-style)
- [2. Service Topology & Port Mapping](#2-service-topology--port-mapping)
- [3. Communication Patterns](#3-communication-patterns)
- [4. Security Architecture](#4-security-architecture)
- [5. Technology Stack](#5-technology-stack)
- [6. Design Patterns](#6-design-patterns)
- [7. Phase Transition Architecture](#7-phase-transition-architecture)
- [8. Folder Structure](#8-folder-structure)

---

## 1. Architectural Style

LUCY áp dụng **Microservices Architecture** với các đặc điểm sau:

- **Service isolation**: Mỗi service chạy độc lập, có port riêng, có thể deploy riêng.
- **Database isolation**: Cùng 1 MariaDB instance nhưng tách database theo phase (lucy_phase1 - lucy_phase5).
- **Synchronous communication**: REST/JSON giữa Auth, Wallet và client.
- **Asynchronous communication**: WebSocket (Socket.IO) cho Realtime Service.
- **Standalone service**: LMS Service chạy console, không expose API.

### Nguyên tắc kiến trúc

1. **Single Responsibility**: Mỗi service chỉ quản lý một domain duy nhất.
2. **Token-based auth**: JWT là cơ chế xác thực xuyên service.
3. **Database-per-service pattern**: Mỗi service chỉ thao tác trên tables thuộc domain của mình.
4. **Phase-driven evolution**: Kiến trúc tiến hóa qua 5 phase, mỗi phase thêm service mới.

---

## 2. Service Topology & Port Mapping

```
┌──────────────────────────────────────────────────────────────┐
│                         Client Layer                          │
│  (Web React/Vinext / Flutter / curl / Postman / Swagger / k6)│
└──────┬──────────────┬──────────────┬──────────┬──────────────┘
       │              │              │          │
       ▼              ▼              ▼          ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ Auth       │ │ Wallet     │ │ Realtime   │ │ LMS        │
│ .NET 10    │ │ .NET 10    │ │ Node.js 22 │ │ Java 26    │
│ :5000      │ │ :5040      │ │ :3020      │ │ Console    │
│            │ │            │ │            │ │            │
│ JWT Issue  │ │ Swagger UI │ │ Socket.IO  │ │ State      │
│ Register/  │ │ Top-up     │ │ Room Mgmt  │ │ Pattern    │
│ Login      │ │ Gift/Pod   │ │ Agora      │ │ Dashboard  │
└──────┬─────┘ └──────┬─────┘ └──────┬─────┘ └────────────┘
       │              │              │
       └──────────────┴──────────────┘
                       │
                  ┌────▼────┐
                  │ MariaDB │
                  │ :3306   │
                  │         │
                  │ Phase:  │
                  │ 1→5     │
                  └─────────┘
```

### Chi tiết port mapping

| Service | Internal Port | External Port | Protocol | Ghi chú |
|---|---|---|---|---|
| Auth Service | 5000 | 5000 | HTTP | Minimal API, không Swagger |
| Wallet Service | 5040 | 5040 | HTTP | Có Swagger UI |
| Realtime Service | 3020 | 3020 | HTTP + WebSocket | Express + Socket.IO |
| MariaDB | 3306 | 3306 | MySQL protocol | Cổng mặc định |
| LMS | Console | — | — | Chạy theo lệnh |

---

## 3. Communication Patterns

### REST (JSON)

Được dùng giữa client và các service:

```
Client  ──GET/POST JSON──▶  Auth / Wallet / Realtime (REST)
        ◀──JSON Response──  Service
```

### WebSocket (Socket.IO)

Dùng cho real-time audio room:

```
Client  ──Socket.IO events──▶  Realtime Service
        ◀──Socket.IO emit────  (room:state, chat, recording, gift, WebRTC)
```

### MariaDB Transactions

Dùng trong monetization flow:

```
Wallet Service ──BEGIN TRANSACTION──▶ MariaDB
               ├── UPDATE balance (sender)
               ├── UPDATE balance (receiver)
               ├── INSERT wallet_transactions
               └── INSERT gift_transactions
                                    └── COMMIT / ROLLBACK
```

### Cross-service Integration

Super Chat dùng flow commit trước, broadcast sau:

```
Web Client ──POST /gifts──▶ Wallet Service ──COMMIT──▶ MariaDB
Web Client ──gift:announce──▶ Realtime Service ──gift:announced──▶ Room
```

Realtime Service kiểm tra gift đã tồn tại và đúng room trước khi broadcast.

---

## 4. Security Architecture

### Authentication Flow

```
┌──────────┐  POST /auth/login    ┌────────────┐
│  Client  │ ──────────────────▶  │ Auth Svc   │
│          │                      │ (.NET)     │
│          │ ◀──────────────────  │            │
│          │  JWT {sub,email,role}│            │
│          │    (exp: 2h)         └────────────┘
│          │
│          │  GET /auth/me        ┌────────────┐
│          │ ──Bearer JWT──────▶  │ Auth Svc   │
│          │ ◀──────────────────  │            │
│          │  {id,email,role}     └────────────┘
└──────────┘
```

### Key Security Decisions

1. **Cô lập Identity**: Auth (.NET) là service duy nhất access DB user. Node.js Realtime không direct access DB user - nhận token từ client.
2. **JWT signing key**: Sử dụng secret key đơn giản cho development (`phase1-development-secret-change-before-production`). Cần thay đổi trước production.
3. **Password hashing**: Dùng ASP.NET Core Identity PasswordHasher (PBKDF2-based).
4. **Room password**: Password phòng là tùy chọn, hash bằng Node `scrypt`; API chỉ
   công khai cờ `hasPassword`.
5. **Role authorization**: Ghi âm, upload tài liệu và CRUD podcast xác thực Bearer
   JWT qua Auth Service; room join hiện vẫn nhận identity từ client.
6. **MariaDB credentials**: Chỉ dùng tài khoản local trong development; không commit
   credential thật.

### Client room resilience

Web client lưu room code đang tham gia trong `localStorage`. Chuyển tab giữ nguyên
Socket.IO/WebRTC session; F5 hoặc mất kết nối sẽ thử join lại 3 lần với backoff
1/2/4 giây. Password phòng không được lưu, vì vậy phòng khóa yêu cầu nhập lại qua
modal sau reload.

### JWT Token Structure

```json
{
  "sub": "user-id-here",
  "email": "user@example.com",
  "role": "Anonymous | Pro | Super",
  "iss": "lucy-phase1",
  "aud": "lucy-clients",
  "exp": 1719600000
}
```

---

## 5. Technology Stack

| Component | Technology | Version | Lý do chọn |
|---|---|---|---|
| **Auth API** | ASP.NET Core Minimal API | .NET 10 | Identity framework, JWT support |
| **Wallet API** | ASP.NET Core Minimal API + Swagger | .NET 10 | Swagger cho API documentation |
| **Realtime** | Express + Socket.IO | Node.js 22 | WebSocket performance, event-driven |
| **LMS** | Java Console + State Pattern | Java 26 | State Pattern implementation, OOP |
| **Database** | MariaDB | 12.2 | Ổn định, utf8mb4 support |
| **ORM** | ADO.NET (MySqlConnector) | — | Lightweight, direct SQL control |
| **ORM (Node)** | mysql2 | — | Promise-based, connection pool |
| **ORM (Java)** | JDBC (mysql-connector-j) | — | Standard Java database access |
| **Agora** | Agora RTC SDK (scaffold) | — | Real-time audio/video |
| **Stress Test** | k6 | 0.54+ | JavaScript-based, CI-friendly |
| **Mobile** | Flutter | 3.27+ | Cross-platform mobile |
| **Digitization** | Python + Java Apache POI | — | Word document processing |

---

## 6. Design Patterns

### State Pattern (LMS Service)

Sub-level transitions trong một level:

```
                    ┌──────────┐
                    │ WarmUp   │
                    │ (10 phút)│
                    └────┬─────┘
                         │ auto
                    ┌────▼─────┐
                    │Guided    │
                    │Practice  │
                    │ (10 phút)│
                    └────┬─────┘
                         │ auto
                    ┌────▼─────┐
                    │Peer      │
                    │Exchange  │
                    │ (10 phút)│
                    └────┬─────┘
                         │ auto
                    ┌────▼─────┐
                    │Reflection│
                    │ (10 phút)│
                    └──────────┘
                         │
                         ▼
                    Next Level
```

Mỗi sub-level implement interface `SubLevelState` với method `execute()`.

### Transaction Pattern (Wallet Service)

MariaDB transaction cho top-up và gift:

1. BEGIN TRANSACTION
2. Kiểm tra số dư (gift only)
3. UPDATE balance
4. INSERT transaction record
5. COMMIT (hoặc ROLLBACK nếu lỗi)

### Agora Token Scaffold Pattern

Realtime Service sinh Agora token đơn giản (chưa tích hợp Agora SDK thật) để demo flow:

```
Client ──POST /agora/token──▶ Realtime Service
                              └── Response: {channelName, uid, role, token: "scaffold-token", note}
```

---

## 7. Phase Transition Architecture

| Phase | Services | Tính năng mới |
|---|---|---|
| **Phase 1** | Auth + Database | Register, Login, JWT, Digitize content |
| **Phase 2** | + Realtime | Socket.IO rooms, Agora scaffold, Health check |
| **Phase 3** | + LMS (Java) | State pattern, Mentor dashboard, Material pins |
| **Phase 4** | + Wallet | Top-up, Gift, Podcast, Cross-service flow, SOA |
| **Phase 5** | + Stress Test + Flutter | k6 stress, Cross testing, Mobile app |

Database phát triển theo phase: `lucy_phase1` -> `lucy_phase2` -> ... -> `lucy_phase5` (24 tables).

---

## 8. Folder Structure

```
swd/
├── phase1-rbl/
│   ├── database/            # Schema + seed cho Phase 1
│   ├── docs/                # Tài liệu Phase 1
│   ├── dotnet-auth/         # Auth Service (.NET)
│   ├── java-importer/       # Java Word importer skeleton
│   ├── tools/               # Python digitization scripts
│   ├── uml/                 # PlantUML diagrams
│   └── generated/           # Digitized content output
├── phase2-rbl/
│   └── realtime-audio/      # Realtime Service (Node.js)
├── phase3-rbl/
│   └── java-lms/            # LMS Service (Java)
├── phase4-rbl/
│   └── dotnet-wallet/       # Wallet Service (.NET)
├── phase5-rbl/
│   ├── stress-tests/        # k6 scripts
│   ├── final-evaluation/    # Kết quả đánh giá
│   └── flutter_app/         # Flutter mobile app
├── docs/                    # Tài liệu tổng hợp
└── *.docx / *.pdf           # Tài liệu nguồn học liệu
```
