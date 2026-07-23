# API Specification — LUCY SWD392

| **Tên dự án** | LUCY (Language Unity & Collaborative Youth) |
|---|---|
| **Phiên bản** | 1.2.0 |
| **Ngày cập nhật** | 2026-07-23 |
| **Loại tài liệu** | API Specification |
| **Base URLs** | Auth: http://localhost:5000, Wallet: http://localhost:5041, Realtime: http://localhost:3020 |

---

## Mục lục

- [1. Auth Service (port 5000)](#1-auth-service-port-5000)
- [2. Wallet Service (port 5041)](#2-wallet-service-port-5041)
- [3. Realtime Service (port 3020)](#3-realtime-service-port-3020)
- [4. Java LMS (Console)](#4-java-lms-console)
- [5. Error Codes](#5-error-codes)
- [6. Authentication Flow](#6-authentication-flow)

---

## 1. Auth Service (port 5000)

Công nghệ: ASP.NET Core Minimal API (.NET 10)
Base URL: `http://localhost:5000`

### Endpoints

| Method | Endpoint | Auth | Request Body | Response | Mô tả |
|---|---|---|---|---|---|
| GET | / | No | — | `{service, status, storage}` | Health check |
| POST | /auth/register | No | `{email, password, displayName, role}` | 201 `{accessToken, expiresAt, user}` | Đăng ký tài khoản |
| POST | /auth/login | No | `{email, password}` | 200 `{accessToken, expiresAt, user}` | Đăng nhập |
| GET | /auth/me | Bearer JWT | — | 200 `{id, email, role}` | Xem thông tin user |

### Chi tiết Endpoint

#### GET / — Health Check

```
GET http://localhost:5000/
```

Response (200):

```json
{
  "service": "LUCY Phase 1 Auth API",
  "status": "ready",
  "storage": "MariaDB"
}
```

#### POST /auth/register — Register

```
POST http://localhost:5000/auth/register
Content-Type: application/json

{
  "email": "mentor@lucy.local",
  "password": "Mentor@123",
  "displayName": "Mentor One",
  "role": "Pro"
}
```

Response (201):

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresAt": 1719600000,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "mentor@lucy.local",
    "displayName": "Mentor One",
    "role": "Pro"
  }
}
```

Validation:

| Field | Yêu cầu | Ghi chú |
|---|---|---|
| email | Bắt buộc, không được rỗng | Trim + lowercase |
| password | Bắt buộc, không được rỗng | Hash bằng Identity PasswordHasher |
| displayName | Bắt buộc, không được rỗng | Trim |
| role | Không bắt buộc | Mặc định: Anonymous |

Error responses:

| Status | Ý nghĩa |
|---|---|
| 400 | Thiếu field (email, password, displayName) |
| 409 | Email đã tồn tại |

#### POST /auth/login — Login

```
POST http://localhost:5000/auth/login
Content-Type: application/json

{
  "email": "mentor@lucy.local",
  "password": "Mentor@123"
}
```

Response (200):

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresAt": 1719600000,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "mentor@lucy.local",
    "displayName": "Mentor One",
    "role": "Pro"
  }
}
```

Error responses:

| Status | Ý nghĩa |
|---|---|
| 401 | Sai email hoặc password |

#### GET /auth/me — Current User

```
GET http://localhost:5000/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

Response (200):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "mentor@lucy.local",
  "role": "Pro"
}
```

Error responses:

| Status | Ý nghĩa |
|---|---|
| 401 | Token không hợp lệ hoặc hết hạn |

---

## 2. Wallet Service (port 5041)

Công nghệ: ASP.NET Core Minimal API + Swagger (.NET 10)
Base URL: `http://localhost:5041`
Swagger UI: `http://localhost:5041/swagger`

### Endpoints

| Method | Endpoint | Auth | Request Body | Response | Mô tả |
|---|---|---|---|---|---|
| GET | /health | No | — | `{service, status, storage}` | Health check |
| GET | /wallets/{userId} | No | — | `{id, userId, balance, currencyCode}` | Xem thông tin ví (tự động tạo nếu chưa có) |
| POST | /wallets/{userId}/top-up | No | `{amount, providerReference}` | `{wallet, message}` | Nạp tiền vào ví (transaction) |
| POST | /gifts | Bearer JWT | `{fromUserId, toCreatorId, amount, message, roomId}` | `{transaction, realtimeEvent}` | Super Chat tới PRO/SUPER cùng phòng |
| GET | /gifts | Bearer JWT | — | `[{id, fromUserId, toCreatorId, ...}]` | Quà user hiện tại đã gửi hoặc nhận |
| POST | /podcasts/recordings | Bearer JWT | `{creatorId, roomId, title, storageUri, durationSeconds}` | 201 `{id, ...}` | PRO/SUPER tạo podcast |
| GET | /podcasts/recordings | No | — | `[{id, title, ...}]` | Danh sách recordings |
| PUT | /podcasts/recordings/{id} | Bearer JWT | `{title}` | 200 `{id, title}` | PRO/SUPER đổi tên podcast |
| DELETE | /podcasts/recordings/{id} | Bearer JWT | — | 204 | PRO/SUPER xóa podcast |

### Chi tiết Endpoint

#### GET /health — Health Check

```
GET http://localhost:5041/health
```

Response (200):

```json
{
  "service": "RBL Phase 4 Wallet API",
  "status": "ready",
  "storage": "MariaDB"
}
```

#### GET /wallets/{userId} — Get Wallet

```
GET http://localhost:5041/wallets/mentor-1
```

Response (200):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "userId": "mentor-1",
  "balance": 1000000.00,
  "currencyCode": "VND"
}
```

Ghi chú: Nếu ví chưa tồn tại, tự động tạo ví mới với balance = 0.

#### POST /wallets/{userId}/top-up — Top-up

```
POST http://localhost:5041/wallets/mentor-1/top-up
Content-Type: application/json

{
  "amount": 1000000,
  "providerReference": "topup-mentor-1"
}
```

Response (200):

```json
{
  "wallet": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "userId": "mentor-1",
    "balance": 2000000.00,
    "currencyCode": "VND"
  },
  "message": "top-up committed to MariaDB ledger"
}
```

Ghi chú: MariaDB transaction (BEGIN -> UPDATE balance -> INSERT wallet_transactions -> COMMIT).

Error:

| Status | Ý nghĩa |
|---|---|
| 400 | Amount <= 0 |

#### POST /gifts — Send Gift

```
POST http://localhost:5041/gifts
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "fromUserId": "learner-1",
  "toCreatorId": "creator-1",
  "roomId": "trial-level-1",
  "amount": 50000,
  "message": "Cam on bai hoc hay!"
}
```

Response (201):

```json
{
  "transaction": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "fromWalletId": "...",
    "toWalletId": "...",
    "amount": 50000,
    "message": "Cam on bai hoc hay!"
  },
  "realtimeEvent": "gift:sent",
  "syncRisk": "Broadcast over Node Socket.IO after wallet commit"
}
```

Ghi chú: MariaDB transaction kiểm tra balance sender trước khi thực hiện.

Error:

| Status | Ý nghĩa |
|---|---|
| 400 | Amount <= 0 hoặc insufficient balance |

#### GET /gifts — List Gifts

```
GET http://localhost:5041/gifts
Authorization: Bearer <jwt>
```

Chỉ trả các giao dịch mà user trong JWT là người gửi hoặc người nhận.

Response (200):

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "fromUserId": "learner-1",
    "toCreatorId": "creator-1",
    "amount": 50000,
    "message": "Cam on bai hoc hay!",
    "createdAt": "2026-06-29T10:30:00Z"
  }
]
```

#### POST /podcasts/recordings — Create Recording

```
POST http://localhost:5041/podcasts/recordings
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "creatorId": "creator-1",
  "roomId": "trial-level-1",
  "title": "English Speaking Practice",
  "storageUri": "https://storage.lucy.local/recordings/abc123.mp3",
  "durationSeconds": 1800
}
```

Response (201):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "creatorId": "creator-1",
  "roomId": "trial-level-1",
  "title": "English Speaking Practice",
  "storageUri": "https://storage.lucy.local/recordings/abc123.mp3",
  "durationSeconds": 1800,
  "createdAt": "2026-06-29T10:30:00Z"
}
```

#### GET /podcasts/recordings — List Recordings

```
GET http://localhost:5041/podcasts/recordings
```

Response (200):

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "creatorId": "creator-1",
    "roomId": "trial-level-1",
    "title": "English Speaking Practice",
    "storageUri": "https://storage.lucy.local/recordings/abc123.mp3",
    "durationSeconds": 1800,
    "createdAt": "2026-06-29T10:30:00Z"
  }
]
```

---

## 3. Realtime Service (port 3020)

Công nghệ: Express + Socket.IO (Node.js 22)
Base URL: `http://localhost:3020`

### REST Endpoints

| Method | Endpoint | Request | Response | Mô tả |
|---|---|---|---|---|
| GET | /health | — | `{service, status, storage}` | Health check |
| GET | /rooms | `language?`, `level?` | `{rooms: [{roomId, hasPassword, users, raisedHands}]}` | Danh sách phòng đang có người |
| POST | /rooms | `{roomCode, title?, languageCode, levelNumber, password?}` | 201 room | Tạo phòng công khai hoặc có password |
| GET | /rooms/levels | — | `{groups}` | Nhóm phòng theo ngôn ngữ và level |
| GET | /rooms/:roomCode/messages | `limit?`, `before?` | `{messages}` | Lịch sử chat, tối đa 200 |
| GET | /rooms/:roomCode/documents | — | `{documents}` | 100 tài liệu mới nhất |
| POST | /api/rooms/:roomCode/documents | Bearer + multipart `document` | 201 document | PRO/SUPER gửi tài liệu tối đa 20 MB |
| GET | /rooms/:roomCode/recordings | — | `{recordings}` | Bản ghi của phòng |
| POST | /api/upload-recording | Bearer + multipart `audio` | 201 podcast | PRO/SUPER upload audio tối đa 50 MB |
| POST | /agora/token | `{channelName, uid, role}` | `{channelName, uid, role, token, note}` | Sinh Agora token (scaffold) |

### Chi tiết REST Endpoint

#### GET /health

```
GET http://localhost:3020/health
```

Response (200):

```json
{
  "service": "RBL Phase 2 Real-time Audio MVP",
  "status": "ready",
  "storage": "MariaDB"
}
```

#### GET /rooms

```
GET http://localhost:3020/rooms
```

Response (200):

```json
{
  "rooms": [
    {
      "roomId": "trial-level-1",
      "hasPassword": true,
      "createdAt": "2026-06-29T10:00:00Z",
      "users": [
        {
          "participantId": "550e8400-...",
          "userId": "anon-123",
          "displayName": "Nguyen Van A",
          "role": "ANONYMOUS",
          "micEnabled": true,
          "joinedAt": "2026-06-29T10:05:00Z"
        }
      ],
      "raisedHands": ["anon-456"]
    }
  ]
}
```

#### POST /agora/token

```
POST http://localhost:3020/agora/token
Content-Type: application/json

{
  "channelName": "level-1",
  "uid": "anon-123",
  "role": "audience"
}
```

Response (200):

```json
{
  "channelName": "level-1",
  "uid": "anon-123",
  "role": "audience",
  "token": "scaffold-token-placeholder",
  "note": "scaffold — replace with real Agora Server SDK"
}
```

### Socket.IO Events

#### Client to Server

| Event | Payload | Mô tả |
|---|---|---|
| `room:join` | `{roomId, userId, displayName, role, password?}` | Join; sai password trả `ROOM_PASSWORD_REQUIRED` |
| `room:leave` | `{roomId}` | Rời phòng audio |
| `hand:raise` | `{roomId, raised: bool}` | Giơ tay / hạ tay |
| `mic:toggle` | `{roomId, enabled: bool}` | Bật / tắt mic |
| `latency:ping` | `{clientSentAt: timestamp}` | Đo độ trễ client -> server |
| `chat:send` | `{roomId, message}` | Gửi tin nhắn 1-500 ký tự |
| `recording:start` | `{roomId, token}` | Bắt đầu ghi, chỉ PRO/SUPER |
| `recording:stop` | `{roomId, token}` | Dừng ghi, chỉ PRO/SUPER |
| `gift:announce` | `{roomId, giftId}` | Broadcast Super Chat đã commit |
| `webrtc:offer/answer/ice-candidate` | WebRTC payload | Thiết lập audio peer-to-peer |

#### Server to Client

| Event | Payload | Mô tả |
|---|---|---|
| `room:state` | `{roomId, users: [...], raisedHands: [...]}` | Cập nhật trạng thái phòng |
| `chat:message` | Chat hoặc document payload | Tin nhắn/tài liệu mới |
| `recording:update` | Recording state | Trạng thái và thời gian ghi |
| `gift:announced` | Super Chat payload | Thông báo quà trong phòng |
| `latency:pong` | `{clientSentAt, serverReceivedAt}` | Phản hồi đo độ trễ |

#### Event Flow Example

```
Client                          Server
  │                               │
  │──── room:join ──────────────▶ │
  │    {roomId, userId, ...}      │
  │                               │──▶ DB: INSERT participant
  │                               │──▶ Broadcast room:state
  │◀──── room:state ─────────────│
  │    {roomId, users, hands}     │
  │                               │
  │──── hand:raise ─────────────▶ │
  │    {roomId, raised: true}     │
  │                               │──▶ DB: UPDATE hand_raised
  │                               │──▶ Broadcast room:state
  │◀──── room:state ─────────────│
  │                               │
  │──── latency:ping ───────────▶ │
  │    {clientSentAt: T1}         │
  │◀──── latency:pong ───────────│
  │    {clientSentAt: T1,         │
  │     serverReceivedAt: T2}     │
```

---

## 4. Java LMS (Console)

Công nghệ: Java 17 + State Pattern
Không có REST API. Chạy dưới dạng console application.

| Command | Mô tả |
|---|---|
| `mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication` | Chạy mentor dashboard |

### Output Example

Khi chạy LmsApplication, console in ra:

```
=== Mentor Dashboard Summary ===
Mentor ID: mentor-pro-1
Total Learners Tracked: 2

--- Learner Progress ---
anon-level-1-demo (Anonymous Level 1)
  Level: 1
  Current Sub-Level: WARM_UP
  Started: 11 minutes ago
  Status: OVERDUE (exceeded 10-min limit)

anon-level-4-demo (Anonymous Level 4)
  Level: 4
  Current Sub-Level: GUIDED_PRACTICE
  Started: 3 minutes ago
  Status: IN_PROGRESS

--- Pinned Materials ---
  English Stage 1 Speaking Drill (en, Stage 1, Level 1)
  Japanese Stage 1 Listening (ja, Stage 1, Level 1)
```

---

## 5. Error Codes

### HTTP Status Codes

| Status | Ý nghĩa | Service |
|---|---|---|
| 200 | OK | Tất cả |
| 201 | Created (register, gift, room, document hoặc recording) | Auth, Wallet, Realtime |
| 400 | Bad Request (thiếu field, amount <= 0) | Auth, Wallet, Realtime |
| 401 | Unauthorized (sai pass/email, thiếu hoặc token hết hạn) | Auth, Wallet |
| 403 | Forbidden (sai role, identity không khớp hoặc chưa join room) | Wallet, Realtime |
| 404 | Not Found | Wallet, Realtime |
| 409 | Conflict (email đã tồn tại) | Auth |
| 500 | Internal Server Error | Tất cả |

### Error Response Format

```json
{
  "message": "Email already registered"
}
```

### Validation Rules

| Endpoint | Field | Rule |
|---|---|---|
| POST /auth/register | email | Required, non-empty, auto lowercase |
| POST /auth/register | password | Required, non-empty |
| POST /auth/register | displayName | Required, non-empty |
| POST /wallets/{userId}/top-up | amount | Must be positive (> 0) |
| POST /rooms | password | Bỏ trống hoặc dài 4-100 ký tự; lưu dạng `scrypt` hash |
| Socket `chat:send` | message | Sau trim phải dài 1-500 ký tự |
| POST /gifts | sender/recipient/room/amount | JWT là ANONYMOUS sender; recipient là PRO/SUPER cùng phòng; amount dương và không vượt balance |
| POST /agora/token | channelName | Required |
| POST /agora/token | uid | Required |

---

## 6. Authentication Flow

### Flow Diagram

```
┌──────────┐   1. Register/Login     ┌──────────┐
│          │ ──────────────────────▶  │   Auth   │
│  Client  │                          │ Service  │
│          │ ◀──────────────────────  │  :5000   │
│          │     JWT + User Info      └──────────┘
│          │
│          │   2. Use JWT for Auth    ┌──────────┐
│          │ ──Bearer JWT──────────▶  │   Auth   │
│          │                          │ Service  │
│          │ ◀──User Profile◀────────│  :5000   │
│          │                          └──────────┘
│          │
│          │   3. Wallet API           ┌──────────┐
│          │ ──JWT cho gift/podcast─▶  │  Wallet  │
│          │                          │ Service  │
│          │ ◀──────────────────────  │  :5041   │
│          │     Wallet / Gift Data   └──────────┘
│          │
│          │   4. Realtime Socket     ┌──────────┐
│          │ ──connect + room join──▶  │ Realtime │
│          │                          │  :3020   │
│          │ ◀──Socket.IO events◀───  └──────────┘
└──────────┘
```

Ghi chú quan trọng:

- Wallet Service hiện tại không yêu cầu JWT (dev mode). Token verification sẽ được thêm trong phiên bản production.
- Realtime Service nhận userId từ client qua Socket.IO event, không tự verify token. Cơ chế này cần được strengthen trong production.
- JWT secret key mặc định (`phase1-development-secret-change-before-production`) phải được thay đổi trước production deploy.
