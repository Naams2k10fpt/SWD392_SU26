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

## Chức năng hiện tại

- Giữ người dùng trong phòng khi chuyển tab; F5/reconnect tự join lại với 3 lần retry.
- Phòng có thể công khai hoặc dùng mật khẩu; mật khẩu được nhập trong modal và lỗi
  sai mật khẩu hiển thị tại chỗ.
- Chat giới hạn 500 ký tự, giữ tối đa 200 tin trên client và cuộn trong khung riêng.
- Tài liệu phòng hiển thị ở panel bên phải, mặc định thu nhỏ; PRO/SUPER được upload.
- PRO/SUPER được ghi âm và CRUD podcast, gồm thay file audio.
- Avatar hiển thị trạng thái đang nói từ Web Audio analyser.
- Learner gửi Super Chat cho PRO/SUPER đang ở cùng phòng.
- Lịch sử quà chỉ hiển thị giao dịch user hiện tại đã gửi hoặc nhận.
- Thoát phòng và trở về danh sách phòng đều có hộp xác nhận.

Thay đổi frontend được dev server cập nhật qua HMR. Thay đổi trong
`phase5-rbl/realtime-audio` cần restart service cổng 3020.
