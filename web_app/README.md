# LUCY Web

Frontend web tương thích với Flutter app và backend Phase 4 hiện có.

## Chạy local

Yêu cầu Node.js `>=22.13.0`, sau đó:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Mặc định ứng dụng dùng:

- Auth: `http://localhost:5000`
- Wallet, gift và podcast: `http://localhost:5040`
- Realtime Socket.IO: `http://localhost:3020`

Có thể thay đổi bằng `AUTH_BASE_URL`, `WALLET_BASE_URL` và
`NEXT_PUBLIC_REALTIME_URL`. Browser gọi Auth/Wallet qua proxy cùng origin tại
`/api/backend`; không cần sửa CORS của hai backend này.

## Kiểm tra

```powershell
npm run build
npm test
```

Gift giữ nguyên contract Flutter, không gửi `roomId`. Backend hiện tại cần được
cập nhật riêng để chấp nhận gift không có room trước khi flow này chạy end-to-end.
