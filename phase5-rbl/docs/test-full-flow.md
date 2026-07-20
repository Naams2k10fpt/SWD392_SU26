# Test Plan — LUCY RBL SWD392 (Phase 5)

## Yêu cầu hệ thống

| Công cụ | Phiên bản |
|---|---|
| MariaDB / MySQL | 12+ / 8+ |
| .NET SDK | 10+ |
| Node.js | 22+ |
| Java | 17+ (cho LMS) |
| Flutter | 3.10+ (cho mobile) |

---

## 1. SETUP

### 1.1. Import database

```bash
mysql -u root -p < phase5-rbl/database/dbeaver-import-all.sql
```

**Kỳ vọng:** Database `lucy_phase5` được tạo với 24 bảng:
`users, roles, languages, stages, levels, lessons, content_blocks, realtime_rooms, realtime_room_participants, realtime_latency_samples, learner_progress, lms_transition_events, mentor_material_pins, wallet_accounts, wallet_transactions, gift_transactions, podcast_recordings, room_messages, recording_logs, stress_test_runs, cross_testing_reports, source_documents, word_import_jobs`

### 1.2. Export biến môi trường

```bash
export LUCY_JWT_SECRET="lucy_swd392_jwt_secret_key_2026_32chars"
export LUCY_DB="Server=localhost;Database=lucy_phase5;User=root;Password=;AllowUserVariables=True;"
export LUCY_DB_URL="mysql://root@localhost:3306/lucy_phase5"
```

### 1.3. Mở 4 terminal

| Terminal | Service | Cổng | Lệnh |
|---|---|---|---|
| T1 | Auth API (.NET) | 5000 | `dotnet run --project phase5-rbl/dotnet-auth` |
| T2 | Wallet API (.NET) | 5040 | `dotnet run --project phase5-rbl/dotnet-wallet` |
| T3 | Realtime (Node.js) | 3020 | `cd phase5-rbl/realtime-audio && npm start` |
| T4 | Web App (Next.js) | 3000 | `cd web_app && npm run dev` |

```bash
# Mỗi terminal chạy 1 lệnh
# T1:
export LUCY_JWT_SECRET="lucy_swd392_jwt_secret_key_2026_32chars"
export LUCY_DB="Server=localhost;Database=lucy_phase5;User=root;Password=;AllowUserVariables=True;"
dotnet run --project phase5-rbl/dotnet-auth

# T2:
export LUCY_DB="Server=localhost;Database=lucy_phase5;User=root;Password=;AllowUserVariables=True;"
dotnet run --project phase5-rbl/dotnet-wallet

# T3: (không cần export biến)
cd phase5-rbl/realtime-audio && npm start

# T4: (không cần export biến)
cd web_app && npm run dev
```

---

## 2. TEST AUTH

### 2.1. Health check
```bash
curl http://localhost:5000
# Kỳ vọng: {"service":"LUCY Phase 1 Auth API","status":"ready","storage":"MariaDB"}
```

### 2.2. Register
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@lucy.com","password":"123456","displayName":"Test User"}'
# Kỳ vọng: HTTP 201 + accessToken + user { id, email, displayName, role }
```

### 2.3. Register trùng email
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@lucy.com","password":"123456","displayName":"Test User"}'
# Kỳ vọng: HTTP 409 Conflict {"message":"Email already registered"}
```

### 2.4. Login
```bash
TOKEN=$(curl -s -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@lucy.com","password":"123456"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "Token: $TOKEN"
# Kỳ vọng: HTTP 200 + accessToken JWT
```

### 2.5. Get current user
```bash
curl http://localhost:5000/auth/me -H "Authorization: Bearer $TOKEN"
# Kỳ vọng: HTTP 200 + thông tin user
```

### 2.6. Login sai password
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@lucy.com","password":"wrong"}'
# Kỳ vọng: HTTP 401 Unauthorized
```

---

## 3. TEST REALTIME ROOM

### 3.1. Health check
```bash
curl http://localhost:3020/health
# Kỳ vọng: {"service":"RBL Phase 5 Real-time Audio","status":"ready","storage":"MariaDB"}
```

### 3.2. Danh sách phòng
```bash
curl http://localhost:3020/rooms
# Kỳ vọng: {"rooms":[...]} — danh sách phòng OPEN
```

### 3.3. Lọc phòng theo ngôn ngữ
```bash
curl "http://localhost:3020/rooms?language=en"
# Kỳ vọng: chỉ trả về phòng English
```

### 3.4. Lọc phòng theo level
```bash
curl "http://localhost:3020/rooms?level=5"
# Kỳ vọng: chỉ trả về phòng Level 5
```

### 3.5. Tạo phòng mới (Pro/Mentor)
```bash
curl -X POST http://localhost:3020/rooms \
  -H "Content-Type: application/json" \
  -d '{"roomCode":"en-s1-l10-demo","title":"English Stage 1 Level 10","languageCode":"en","levelNumber":10}'
# Kỳ vọng: HTTP 201 + thông tin room { id, room_code, title, language_code, level_number, status }
```

### 3.6. Tạo phòng thiếu tham số
```bash
curl -X POST http://localhost:3020/rooms \
  -H "Content-Type: application/json" \
  -d '{"roomCode":"invalid-room"}'
# Kỳ vọng: HTTP 400 {"message":"roomCode, languageCode and levelNumber are required"}
```

### 3.7. Room levels group
```bash
curl http://localhost:3020/rooms/levels
# Kỳ vọng: {"groups":[{"language_code":"en","level_number":1,"room_count":1},...]}
```

### 3.8. Tạo phòng trùng mã
```bash
curl -X POST http://localhost:3020/rooms \
  -H "Content-Type: application/json" \
  -d '{"roomCode":"en-s1-l10-demo","languageCode":"en","levelNumber":10}'
# Kỳ vọng: HTTP 409 {"message":"Room code already exists"}
```

---

## 4. TEST CHAT (CONVERSATION)

### 4.1. Chat messages (empty)
```bash
curl http://localhost:3020/rooms/en-s1-l10-demo/messages
# Kỳ vọng: {"messages":[]}
```

### 4.2. Chat messages với limit
```bash
curl "http://localhost:3020/rooms/en-s1-l10-demo/messages?limit=10"
# Kỳ vọng: {"messages":[]} — tối đa 10 messages
```

### 4.3. Chat messages không tồn tại room
```bash
curl http://localhost:3020/rooms/nonexistent-room/messages
# Kỳ vọng: HTTP 200 + room được auto-create + {"messages":[]}
```

### 4.4. Chat messages pagination (before timestamp)
```bash
curl "http://localhost:3020/rooms/en-s1-l10-demo/messages?before=2026-12-31T23:59:59.000Z"
# Kỳ vọng: {"messages":[...]}
```

### 4.5. Socket.IO chat (cần browser)
> Mở http://localhost:3000 → Login → Vào Room → Join phòng → Gõ tin nhắn → Gửi

**Kỳ vọng:**
- Tin nhắn hiện trong khung chat ngay lập tức
- Tin nhắn của mình căn phải, màu accent
- Tin nhắn người khác căn trái, kèm tên
- Scroll tự động xuống tin nhắn mới

---

## 5. TEST RECORDING

### 5.1. Recording list (empty)
```bash
curl http://localhost:3020/rooms/en-s1-l10-demo/recordings
# Kỳ vọng: {"recordings":[]}
```

### 5.2. Socket.IO recording (cần browser)
> Mở http://localhost:3000 → Login → Vào Room → Join phòng

**Test ghi âm:**
1. Nhấn ⏺ **Ghi âm**
   - Kỳ vọng: Nút chuyển sang màu đỏ, hiển thị "Dừng ghi" + icon 🔴
   - Browser hỏi quyền micro → Chọn Allow

2. Nói gì đó vào micro → Nhấn ⏹ **Dừng**
   - Kỳ vọng: Audio player xuất hiện 🎵
   - Nhấn Play → Nghe lại được giọng vừa ghi

3. Nếu từ chối micro
   - Kỳ vọng: Hiển thị lỗi "⚠️ Không thể truy cập micro: ..."

---

## 6. TEST WALLET

### 6.1. Health check
```bash
curl http://localhost:5040/health
# Kỳ vọng: {"service":"RBL Phase 4 Wallet API","status":"ready","storage":"MariaDB"}
```

### 6.2. Xem ví
```bash
curl http://localhost:5040/wallets/test-user-id
# Kỳ vọng: HTTP 200 + { id, external_owner_id, balance, currency_code }
```

### 6.3. Nạp tiền
```bash
curl -X POST http://localhost:5040/wallets/test-user-id/top-up \
  -H "Content-Type: application/json" \
  -d '{"amount":50000,"providerReference":"bank-transfer-001"}'
# Kỳ vọng: HTTP 200 + balance tăng lên
```

### 6.4. Nạp tiền số âm
```bash
curl -X POST http://localhost:5040/wallets/test-user-id/top-up \
  -H "Content-Type: application/json" \
  -d '{"amount":-1000}'
# Kỳ vọng: HTTP 400 {"message":"Amount must be positive"}
```

### 6.5. Gửi gift
```bash
# Tạo ví cho sender và receiver trước
curl -X POST http://localhost:5040/gifts \
  -H "Content-Type: application/json" \
  -d '{"fromUserId":"sender-id","toCreatorId":"receiver-id","amount":10000,"roomId":"en-s1-l10-demo","message":"Chúc mừng!"}'
# Kỳ vọng: HTTP 200 + balance sender giảm, receiver tăng
```

### 6.6. Gift không đủ tiền
```bash
curl -X POST http://localhost:5040/gifts \
  -H "Content-Type: application/json" \
  -d '{"fromUserId":"poor-user","toCreatorId":"creator","amount":99999999}'
# Kỳ vọng: HTTP 400 {"message":"Insufficient wallet balance"}
```

---

## 7. TEST WEB APP (UI)

### 7.1. Mở trình duyệt
```
http://localhost:3000
```

### 7.2. Login / Register
- Nhấn "Register" → Điền email, password, displayName → Submit
- Kỳ vọng: Chuyển đến Home page

### 7.3. Home page
- Kỳ vọng: Hiển thị tên user, 4 card: Phòng học, Ví, Quà tặng, Podcast
- Phase flow: Đăng nhập → Vào phòng → Tương tác → Kết nối

### 7.4. Room Browser
- Click card "Phòng học"
- Kỳ vọng: Danh sách phòng group theo ngôn ngữ + level
- Lọc theo ngôn ngữ
- Click "Join" vào phòng

### 7.5. Room View (sau khi join)
- **Trước khi join:** Form nhập Room ID + nút "← Danh sách phòng"
- **Sau khi join:** 
  - ✅ Form nhập ID biến mất
  - ✅ Hiển thị tên phòng + level: "English · Stage 1 · Level 10"
  - ✅ 3 nút tương tác: ✋ Giơ tay, 🎤 Tắt mic, 📡 Ping
  - ✅ Khung participant list
  - ✅ Khung Chat (bên cạnh)
  - ✅ Nút Ghi âm (⏺)

### 7.6. Room Actions
- **✋ Giơ tay:** Click → icon ✋ xuất hiện cạnh tên
- **🎤 Tắt mic:** Click → mic chuyển 🔇
- **📡 Ping:** Click → hiện latency ms
- **💬 Chat:** Gõ tin nhắn → Enter/Gửi → message hiện trong khung chat
- **⏺ Ghi âm:** Click → cho phép micro → nói → Dừng → nghe lại

### 7.7. Create Room (dành cho Pro/Mentor)
- Từ Home, click "Tạo phòng" (nếu role Pro)
- Chọn ngôn ngữ (English/Chinese/Japanese)
- Chọn Level
- Đặt tên phòng (tùy chọn)
- Kỳ vọng: Room mới xuất hiện trong danh sách

### 7.8. Wallet
- Click card "Ví"
- Kỳ vọng: Xem số dư, nạp tiền

### 7.9. Gifts
- Click card "Quà tặng"
- Kỳ vọng: Gửi quà tặng kèm lời nhắn

### 7.10. Podcasts
- Click card "Podcast"
- Kỳ vọng: Danh sách bản ghi đã lưu

---

## 8. TEST FLUTTER APP (nếu có)

```bash
cd flutter_app
flutter pub get
flutter run
```

Màn hình tương ứng:
- Login / Register
- Home
- Room (join, mic, hand, ping)
- Wallet
- Gift
- Podcast

Android Emulator dùng `10.0.2.2` để gọi API host.

---

## 9. TEST DATABASE

### 9.1. Kiểm tra bảng
```bash
mariadb -u root -p -e "USE lucy_phase5; SHOW TABLES;"
# Kỳ vọng: 24 bảng
```

### 9.2. Kiểm tra dữ liệu mẫu
```bash
mariadb -u root -p -e "USE lucy_phase5; SELECT * FROM realtime_rooms; SELECT * FROM languages; SELECT * FROM roles;"
# Kỳ vọng: Có dữ liệu seed
```

### 9.3. Kiểm tra chat messages (sau khi test)
```bash
mariadb -u root -p -e "USE lucy_phase5; SELECT COUNT(*) FROM room_messages;"
# Kỳ vọng: > 0 messages nếu đã test chat
```

---

## 10. KIỂM TRA CODE

### 10.1. Backend syntax
```bash
node --check phase5-rbl/realtime-audio/src/server.js
# Kỳ vọng: Không lỗi syntax
```

### 10.2. TypeScript
```bash
cd web_app && npx tsc --noEmit
# Kỳ vọng: 0 errors
```

### 10.3. Unit tests
```bash
# Realtime tests (ko cần DB)
cd phase5-rbl/realtime-audio && LUCY_TEST=1 npm test
# Kỳ vọng: 14 pass, 3 skip, 0 fail

# Web tests (cần build)
cd web_app && npm test
# Kỳ vọng: Build success + 2 pass
```

### 10.4. Lint
```bash
cd web_app && npm run lint
# Kỳ vọng: Chỉ có pre-existing accessibility warnings, không lỗi syntax
```

---

## 11. KIẾN TRÚC

Tham khảo file `phase5-rbl/docs/architecture-comparison.md` — so sánh 8 quyết định kiến trúc:
1. SOA vs Monolithic
2. State Pattern vs IF-ELSE
3. JWT vs Session
4. MariaDB vs MongoDB
5. .NET vs Node.js (cho REST)
6. Node.js/Socket.IO vs .NET SignalR (cho Realtime)
7. Java vs other (cho LMS)
8. Shared Database vs Database-per-Service

---

## 12. CHECKLIST NHANH

| # | Hạng mục | Pass/Fail |
|---|---|---|
| 1 | Register + Login | ☐ |
| 2 | JWT token hoạt động | ☐ |
| 3 | Tạo phòng (POST /rooms) | ☐ |
| 4 | Danh sách phòng (GET /rooms) | ☐ |
| 5 | Lọc phòng theo ngôn ngữ/level | ☐ |
| 6 | Room levels group | ☐ |
| 7 | Join room (Socket.IO) | ☐ |
| 8 | Giơ tay / Hạ tay | ☐ |
| 9 | Bật / Tắt mic | ☐ |
| 10 | Ping / Latency | ☐ |
| 11 | Chat gửi + nhận realtime | ☐ |
| 12 | Chat history API | ☐ |
| 13 | Ghi âm + phát lại | ☐ |
| 14 | Recording history API | ☐ |
| 15 | Level hiển thị rõ ràng | ☐ |
| 16 | Wallet + Top-up | ☐ |
| 17 | Gift | ☐ |
| 18 | Podcast | ☐ |
| 19 | UI Join room (sau join ẩn form) | ☐ |
| 20 | Không lỗi TypeScript | ☐ |
