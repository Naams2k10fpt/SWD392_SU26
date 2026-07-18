# 🧪 Phase 4 — Full Flow Test (4 Services)

> Dành cho demo SWD392 — SOA/Microservices & Monetization  
> Chạy **4 terminals** + **1 terminal test**

---

## 📦 Mở 4 Terminals

### Terminal 1: Auth API (port 5000)
```bash
cd ~/Projects/swd/phase4-rbl/dotnet-auth && dotnet run
```

### Terminal 2: Wallet API (port 5040)
```bash
cd ~/Projects/swd/phase4-rbl/dotnet-wallet && dotnet run
```

### Terminal 3: Realtime Audio (port 3020)
```bash
cd ~/Projects/swd/phase4-rbl/realtime-audio && npm start
```

### Terminal 4: Database (optional — check dữ liệu)
```bash
mariadb -u root -p1
USE lucy_phase4;
```

---

## 🔥 7 Bước Test (dùng Terminal 5)

### Bước 1: Auth — Register 3 users

```bash
# Pro (Mentor)
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"mentor@lucy.local","password":"Mentor@123","displayName":"Mentor One","role":"Pro"}'

# Anonymous (Learner)
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"learner@lucy.local","password":"Learn@123","displayName":"Nguyen Van A","role":"Anonymous"}'

# Super (Creator)
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"creator@lucy.local","password":"Super@123","displayName":"Creator One","role":"Super"}'
```

#### Check DB:
```sql
SELECT id, email, display_name, status FROM users;
```

---

### Bước 2: Auth — Login + JWT

```bash
# Login lấy JWT token
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mentor@lucy.local","password":"Mentor@123"}'
# → Copy accessToken

# Dùng token để xem profile — thay <TOKEN> bằng token ở trên
curl http://localhost:5000/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

---

### Bước 3: Wallet — Tạo ví + Nạp tiền

```bash
# Tạo ví cho 3 users (tự động tạo nếu chưa có)
curl http://localhost:5040/wallets/mentor-1
curl http://localhost:5040/wallets/learner-1
curl http://localhost:5040/wallets/creator-1

# Nạp 1.000.000 VND cho mentor
curl -X POST http://localhost:5040/wallets/mentor-1/top-up \
  -H "Content-Type: application/json" \
  -d '{"amount":1000000,"providerReference":"topup-mentor-1"}'

# Nạp 500.000 VND cho creator
curl -X POST http://localhost:5040/wallets/creator-1/top-up \
  -H "Content-Type: application/json" \
  -d '{"amount":500000,"providerReference":"topup-creator-1"}'

# Nạp 200.000 VND cho learner
curl -X POST http://localhost:5040/wallets/learner-1/top-up \
  -H "Content-Type: application/json" \
  -d '{"amount":200000,"providerReference":"topup-learner-1"}'

# Xem số dư
curl http://localhost:5040/wallets/mentor-1
curl http://localhost:5040/wallets/creator-1
curl http://localhost:5040/wallets/learner-1
```

#### Test lỗi:
```bash
# Nạp số âm → 400
curl -X POST http://localhost:5040/wallets/mentor-1/top-up \
  -H "Content-Type: application/json" \
  -d '{"amount":-50000,"providerReference":"fail"}'
# Kỳ vọng: HTTP 400 "Amount must be positive"
```

#### Check DB:
```sql
SELECT external_owner_id, balance, currency_code FROM wallet_accounts;
SELECT * FROM wallet_transactions;
```

---

### Bước 4: Wallet — Gửi Gift (Monetization)

```bash
# Learner tặng 10.000 VND cho Creator
curl -X POST http://localhost:5040/gifts \
  -H "Content-Type: application/json" \
  -d '{"fromUserId":"learner-1","toCreatorId":"creator-1","amount":10000,"message":"Cam on bai hoc!"}'

# Kiểm tra số dư đã thay đổi
curl http://localhost:5040/wallets/learner-1   # Phải giảm: 200.000 → 190.000
curl http://localhost:5040/wallets/creator-1    # Phải tăng: 500.000 → 510.000

# Xem lịch sử gift
curl http://localhost:5040/gifts
```

#### Test lỗi:
```bash
# Gift quá số dư → 400
curl -X POST http://localhost:5040/gifts \
  -H "Content-Type: application/json" \
  -d '{"fromUserId":"learner-1","toCreatorId":"creator-1","amount":99999999,"message":"fake"}'
# Kỳ vọng: HTTP 400 "Insufficient wallet balance"

# Gift số âm → 400
curl -X POST http://localhost:5040/gifts \
  -H "Content-Type: application/json" \
  -d '{"fromUserId":"learner-1","toCreatorId":"creator-1","amount":-10000,"message":"fake"}'
# Kỳ vọng: HTTP 400 "Gift amount must be positive"
```

#### Check DB:
```sql
SELECT * FROM gift_transactions;
SELECT external_owner_id, balance FROM wallet_accounts;
```

---

### Bước 5: Realtime — Socket.IO Phòng Học

```bash
# Xem danh sách phòng hiện có
curl http://localhost:3020/rooms

# Lấy token Agora scaffold
curl -X POST http://localhost:3020/agora/token \
  -H "Content-Type: application/json" \
  -d '{"channelName":"english-level-1","uid":"mentor-1"}'
```

#### Test Socket.IO (mở Browser → F12 → Console)
```javascript
// Tab 1 — Mentor vào phòng
const s1 = io('http://localhost:3020');
s1.emit('room:join', {
  roomId: 'english-level-1',
  userId: 'mentor-1',
  displayName: 'Mentor One',
  role: 'Pro'
});
s1.on('room:state', state => console.log('📢 Room state:', state));

// Tab 2 — Learner vào cùng phòng
const s2 = io('http://localhost:3020');
s2.emit('room:join', {
  roomId: 'english-level-1',
  userId: 'learner-1',
  displayName: 'Nguyen Van A',
  role: 'Anonymous'
});
s2.on('room:state', state => console.log('📢 Room state:', state));

// Mentor giơ tay
s1.emit('hand:raise', { roomId: 'english-level-1', raised: true });

// Learner bật mic
s2.emit('mic:toggle', { roomId: 'english-level-1', enabled: true });

// Ping đo độ trễ
s1.emit('latency:ping', { clientSentAt: Date.now() });
```

#### Check DB:
```sql
SELECT room_code, title, status FROM realtime_rooms;
SELECT display_name, role_name, mic_enabled, hand_raised FROM realtime_room_participants;
SELECT * FROM realtime_latency_samples;
```

---

### Bước 6: Wallet — Podcast Recording (Super/Creator)

```bash
# Tạo recording mới
curl -X POST http://localhost:5040/podcasts/recordings \
  -H "Content-Type: application/json" \
  -d '{"creatorId":"creator-1","roomId":"english-level-1","title":"Bai hoc English Level 1 - Greetings","storageUri":"s3://recordings/english-level-1-greetings.mp3","duration":3600}'

# Tạo thêm 1 recording nữa
curl -X POST http://localhost:5040/podcasts/recordings \
  -H "Content-Type: application/json" \
  -d '{"creatorId":"creator-1","roomId":"english-level-2","title":"Bai hoc English Level 2 - Family","storageUri":"s3://recordings/english-level-2-family.mp3","duration":2700}'

# Xem danh sách tất cả recordings
curl http://localhost:5040/podcasts/recordings
```

#### Check DB:
```sql
SELECT * FROM podcast_recordings;
```

---

### Bước 7: Java LMS (optional — nếu muốn)

```bash
cd ~/Projects/swd/phase4-rbl/java-lms
mvn compile
mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication
```

Kết quả mong đợi:
```
Mentor dashboard: mentor-pro-1
Pinned materials: 2
- English Stage 1 Speaking Drill [en]
- Japanese Stage 1 Listening [ja]
Learners: 2
- Anonymous Level 1 level 1 -> GUIDED_PRACTICE
- Anonymous Level 4 level 4 -> PEER_EXCHANGE
```

---

## 📊 Tổng kết nhanh

### Mở Swagger UI (nếu không muốn dùng curl)
```
http://localhost:5040/swagger
```

### Dọn dẹp sau demo
```bash
# Kill hết services
kill $(lsof -t -i:5000) 2>/dev/null
kill $(lsof -t -i:5040) 2>/dev/null
kill $(lsof -t -i:3020) 2>/dev/null
echo "✅ Done"
```

### Checklist demo cho thầy
- [ ] Auth: Register 3 users (Pro, Anonymous, Super)
- [ ] Auth: Login + JWT
- [ ] Wallet: Tạo ví, nạp tiền
- [ ] Wallet: Gửi gift (tiền realtime)
- [ ] Wallet: Podcast recording metadata
- [ ] Realtime: Socket.IO join room
- [ ] Realtime: Giơ tay, bật/tắt mic
- [ ] Realtime: Agora token scaffold
- [ ] LMS: Dashboard + sub-level transition
- [ ] Swagger UI: http://localhost:5040/swagger
