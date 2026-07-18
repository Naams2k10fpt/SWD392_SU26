# 🧪 Hướng Dẫn Test Full Phase (Phase 4 & 5) — SWD

> Dự án: **RBL SWD392 — LUCY Learning Platform**  
> Ngày: 26/06/2026  
> Các service đã được test thành công (xác nhận hoạt động đúng)

---

## 📋 Mục Lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Khởi tạo Database](#2-khởi-tạo-database)
3. [Auth API (Port 5000)](#3-auth-api-port-5000)
4. [Wallet API (Port 5040)](#4-wallet-api-port-5040)
5. [Realtime Audio (Port 3020)](#5-realtime-audio-port-3020)
6. [Java LMS](#6-java-lms)
7. [Stress Test (k6)](#7-stress-test-k6)
8. [Các lỗi đã fix và khắc phục](#8-các-lỗi-đã-fix-và-khắc-phục)

---

## 1. Yêu Cầu Hệ Thống

| Công cụ | Phiên bản | Kiểm tra |
|---|---|---|
| **MariaDB** | 12.2.2+ | `mariadb --version` |
| **.NET SDK** | 10.0 | `dotnet --version` |
| **Node.js** | 20+ | `node --version` |
| **Java** | 17+ | `java --version` |
| **Maven** | 3.9+ | `mvn --version` |
| **k6** | 0.54+ | `k6 version` |

> **MariaDB password root**: `1` (đã fix trong toàn bộ code)

---

## 2. Khởi Tạo Database

### Phase 4
```bash
cd /home/amtia/Projects/swd/phase4-rbl
mariadb -u root -p1 < database/import-all.sql
# → 20 tables
```

### Phase 5
```bash
cd /home/amtia/Projects/swd/phase5-rbl
mariadb -u root -p1 < database/import-all.sql
# → 22 tables
```

### Kiểm tra
```bash
mariadb -u root -p1 -e "USE lucy_phase5; SHOW TABLES;"
```

---

## 3. Auth API (Port 5000)

### Chạy service
```bash
cd /home/amtia/Projects/swd/phase5-rbl/dotnet-auth
dotnet run
# → http://localhost:5000
```

### Test cases

#### ✅ TC-01: Register thành công
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@lucy.local","password":"Pro@123","displayName":"Mentor One","role":"Pro"}'
# → HTTP 201, trả về JWT + user info
```

#### ✅ TC-02: Register với role khác
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"super@lucy.local","password":"Super@123","displayName":"Creator One","role":"Super"}'
# → HTTP 201, role = SUPER
```

#### ✅ TC-03: Login thành công
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@lucy.local","password":"Pro@123"}'
# → HTTP 200, trả về accessToken
```

#### ✅ TC-04: Auth/Me với JWT
```bash
# Lưu token: 
TOKEN=$(curl -s -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@lucy.local","password":"Pro@123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

curl http://localhost:5000/auth/me \
  -H "Authorization: Bearer $TOKEN"
# → HTTP 200, trả về user info từ JWT
```

#### ✅ TC-05: Duplicate email → 409
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@lucy.local","password":"Pro@123","displayName":"Fake","role":"Anonymous"}'
# → HTTP 409 "Email already registered"
```

#### ✅ TC-06: Sai password → 401
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@lucy.local","password":"sai_mat_khau"}'
# → HTTP 401
```

#### ✅ TC-07: Email không tồn tại → 401
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"khongton@lucy.local","password":"Test@123"}'
# → HTTP 401
```

#### ✅ TC-08: Thiếu field → 400
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":""}'
# → HTTP 400 "email, password and displayName are required"
```

---

## 4. Wallet API (Port 5040)

### Chạy service
```bash
cd /home/amtia/Projects/swd/phase5-rbl/dotnet-wallet
dotnet run
# → http://localhost:5040
# → Swagger: http://localhost:5040/swagger
```

### Test cases

#### ✅ TC-09: Wallet lookup
```bash
curl http://localhost:5040/wallets/user-1
# → HTTP 200, balance = 0
```

#### ✅ TC-10: Top-up
```bash
curl -X POST http://localhost:5040/wallets/user-1/top-up \
  -H "Content-Type: application/json" \
  -d '{"amount":100000,"providerReference":"ref-001"}'
# → HTTP 200, balance = 100000
```

#### ✅ TC-11: Top-up số âm → 400
```bash
curl -X POST http://localhost:5040/wallets/user-1/top-up \
  -H "Content-Type: application/json" \
  -d '{"amount":-5000,"providerReference":"ref-002"}'
# → HTTP 400 "Amount must be positive"
```

#### ✅ TC-12: Gửi gift
```bash
curl -X POST http://localhost:5040/gifts \
  -H "Content-Type: application/json" \
  -d '{"fromUserId":"user-1","toCreatorId":"creator-2","amount":5000,"message":"Chuc mung!"}'
# → HTTP 200, realtimeEvent = "gift:sent"
# Kiểm tra số dư:
curl http://localhost:5040/wallets/user-1      # balance giảm
curl http://localhost:5040/wallets/creator-2   # balance tăng
```

#### ✅ TC-13: Gift quá số dư → 400
```bash
curl -X POST http://localhost:5040/gifts \
  -H "Content-Type: application/json" \
  -d '{"fromUserId":"user-1","toCreatorId":"creator-2","amount":99999999,"message":"fake"}'
# → HTTP 400 "Insufficient wallet balance"
```

#### ✅ TC-14: Gift số âm → 400
```bash
curl -X POST http://localhost:5040/gifts \
  -H "Content-Type: application/json" \
  -d '{"fromUserId":"user-1","toCreatorId":"creator-2","amount":-1000,"message":"fake"}'
# → HTTP 400 "Gift amount must be positive"
```

#### ✅ TC-15: Lịch sử gift
```bash
curl http://localhost:5040/gifts
# → HTTP 200, mảng gift transactions
```

#### ✅ TC-16: Tạo Podcast recording
```bash
curl -X POST http://localhost:5040/podcasts/recordings \
  -H "Content-Type: application/json" \
  -d '{"creatorId":"creator-1","roomId":"room-abc","title":"Bai hoc Level 1","storageUri":"s3://recordings/room-abc.mp3","duration":1800}'
# → HTTP 201
```

#### ✅ TC-17: Danh sách recordings
```bash
curl http://localhost:5040/podcasts/recordings
# → HTTP 200
```

---

## 5. Realtime Audio (Port 3020)

### Chạy service
```bash
cd /home/amtia/Projects/swd/phase5-rbl/realtime-audio
npm run check  # Kiểm tra syntax
npm start      # → http://localhost:3020
```

### Test HTTP

#### ✅ TC-18: Health check
```bash
curl http://localhost:3020/health
# → {"status":"ready"}
```

#### ✅ TC-19: Danh sách rooms
```bash
curl http://localhost:3020/rooms
# → Danh sách rooms trong DB
```

#### ✅ TC-20: Agora token scaffold
```bash
curl -X POST http://localhost:3020/agora/token \
  -H "Content-Type: application/json" \
  -d '{"channelName":"level-1","uid":"anon-1"}'
# → Token scaffold
```

### Test Socket.IO (mở browser → F12 → Console)

```javascript
// Tab 1
const s1 = io('http://localhost:3020');
s1.emit('room:join', { roomId:'level-1', userId:'u1', displayName:'Nguyen Van A', role:'Pro' });
s1.on('room:state', s => console.log('Tab1 state:', s));

// Tab 2
const s2 = io('http://localhost:3020');
s2.emit('room:join', { roomId:'level-1', userId:'u2', displayName:'Tran Van B', role:'Anonymous' });
s2.on('room:state', s => console.log('Tab2 state:', s));

// Test events
s1.emit('hand:raise', { roomId:'level-1', raised: true });  // Giơ tay
s2.emit('mic:toggle', { roomId:'level-1', enabled: true });  // Bật mic
s1.emit('latency:ping', { clientSentAt: Date.now() });       // Ping
```

---

## 6. Java LMS

### Chạy
```bash
cd /home/amtia/Projects/swd/phase5-rbl/java-lms
mvn compile
LUCY_DB_PASSWORD=<your-local-password> mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication
```

### Output mong đợi
```
Mentor dashboard: mentor-pro-1
Pinned materials: 2
- English Stage 1 Speaking Drill [en]
- Japanese Stage 1 Listening [ja]
Learners: 2
- Anonymous Level 1 level 1 -> GUIDED_PRACTICE
- Anonymous Level 4 level 4 -> PEER_EXCHANGE
```

> **Lưu ý**: Cấu hình `LUCY_DB_PASSWORD` trong `local-env.ps1` trước khi chạy.

---

## 7. Stress Test (k6)

### Cài đặt k6
```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update && sudo apt install k6

# Arch Linux
sudo pacman -S k6

# macOS
brew install k6
```

### Chạy stress test
```bash
# Đảm bảo cả 3 services đang chạy:
# Auth (5000), Wallet (5040), Realtime (3020)

cd /home/amtia/Projects/swd/phase5-rbl
k6 run stress-tests/realtime-auth-wallet-stress.js
```

### Kịch bản stress
| Phase | Duration | Target VUs |
|---|---|---|
| Ramp up | 1m | 0 → 100 |
| Normal load | 3m | 100 → 500 |
| Peak load | 2m | 500 → 1000 |
| Cooldown | 1m | 1000 → 0 |

### Thresholds
- `http_req_failed < 5%`
- `p(95) latency < 800ms`

### Các endpoint được stress
- `POST /auth/register` — Auth API
- `POST /agora/token` — Realtime Audio
- `GET /wallets/{userId}` — Wallet API
- `POST /wallets/{userId}/top-up` — Wallet API

---

## 8. Các Lỗi Đã Fix và Khắc Phục

| # | Lỗi | Module | Nguyên nhân | Fix |
|---|---|---|---|---|
| 1 | **500 khi login** | dotnet-auth | MySqlConnector trả GUID object, không phải string | `GetGuid("id")` thay vì `GetString("id")` |
| 2 | **500 register thiếu field** | dotnet-auth | NullReferenceException do gọi `.Trim()` trên null | Check null trước khi trim |
| 3 | **Port conflict** | dotnet-wallet | Không set port → mặc định 5000 (conflict auth) | `app.Run("http://localhost:5040")` |
| 4 | **500 wallet lookup** | dotnet-wallet | Giống lỗi #1 — GUID cast | `GetGuid("id").ToString()` |
| 5 | **Column 'room_code' cannot be null** | dotnet-wallet | Gift request không có roomId | ALTER TABLE + null handling |
| 6 | **500 gift list (DBNull)** | dotnet-wallet | `room_code` NULL khi đọc | `IsDBNull` check cho room_code |
| 7 | **500 guest list (DBNull)** | dotnet-wallet | message NULL khi đọc (đã có check nhưng room_code chưa) | `IsDBNull` check |
| 8 | **Auth DB connection** | realtime-audio | URL không có password | Cấu hình `LUCY_DB_URL` trong `local-env.ps1` |
| 9 | **Auth DB connection** | java-lms | Default password rỗng | Sửa default thành `"1"` |

---

## 🎯 Demo Flow cho Final Defense

```
Terminal 1: Auth API      → http://localhost:5000
Terminal 2: Wallet API    → http://localhost:5040  + Swagger
Terminal 3: Realtime      → http://localhost:3020  + Socket.IO
Terminal 4: Java LMS      → mvn exec:java
Terminal 5: Stress Test   → k6 run
```

1. **Phase 1**: Show `generated/digitized-content.json`
2. **Auth**: Register → Login → JWT → Auth/Me
3. **Realtime**: Agora token → Join Socket.IO room → Giơ tay → Mic
4. **LMS**: Dashboard → Sub-level transition (State pattern)
5. **Wallet**: Swagger → Top-up → Gift → Podcast recording
6. **Stress**: k6 report (p95 latency, failure rate)

---

> 📌 **Lưu ý**: Các module là MVP scaffold. Khi defense cần giải thích hardening steps:
> - Agora token thật (AccessToken2)
> - Payment gateway + webhook signature verification
> - JWT middleware cho Node.js
> - Distributed transaction / Outbox pattern
> - Idempotency key cho gift/broadcast
