# LUCY Phase 5

Đây là bản tích hợp hiện hành, kế thừa Phase 1–4 và bổ sung web app, stress test,
cross-testing và final evaluation.

## Tài liệu chính

- [Luồng chức năng đầy đủ](docs/FULL_RBL_FUNCTIONAL_FLOW.md)
- [API Specification](../docs-new/api-specification.md)
- [SRS](../docs-new/srs-swd392-lucy.md)
- [Kiến trúc hệ thống](../docs-new/system-architecture.md)
- [Database Design](../docs-new/database-design.md)
- [Contract phòng học](docs/room-chat-recording-feature.md)
- [Test plan hiện hành](docs/test-full-flow.md)

Tài liệu trong `phase1-rbl` đến `phase4-rbl` là snapshot lịch sử của từng phase.

## Chạy local

Từ thư mục gốc:

```powershell
Copy-Item local-env.example.ps1 local-env.ps1
notepad local-env.ps1
. .\local-env.ps1
```

Import `phase5-rbl/database/dbeaver-import-all.sql`, sau đó chạy mỗi service trong
một terminal:

```powershell
dotnet run --project phase5-rbl\dotnet-auth
dotnet run --project phase5-rbl\dotnet-wallet
Set-Location phase5-rbl\realtime-audio; npm install; npm start
Set-Location web_app; npm install; npm run dev
```

| Service | URL |
|---|---|
| Auth | `http://localhost:5000` |
| Wallet/Swagger | `http://localhost:5041` / `http://localhost:5041/swagger` |
| Realtime | `http://localhost:3020` |
| Web | `http://localhost:3000` |

## Chức năng hiện tại

- Phòng công khai hoặc có password; modal báo sai password.
- Chuyển tab vẫn ở trong phòng; F5/reconnect tự join lại và cho phép retry.
- Chat tối đa 500 ký tự, cuộn trong khung riêng.
- PRO/SUPER gửi tài liệu vào panel riêng, mặc định thu nhỏ.
- PRO/SUPER ghi âm, xem thời gian ghi và CRUD podcast/thay audio.
- Speaking indicator trên avatar khi mic phát âm thanh.
- Learner gửi Super Chat cho PRO/SUPER trong phòng.
- Lịch sử quà chỉ trả giao dịch user hiện tại gửi hoặc nhận.
- Thoát phòng và quay lại danh sách đều có hộp xác nhận.

## Kiểm tra

```powershell
dotnet build phase5-rbl\dotnet-auth
dotnet build phase5-rbl\dotnet-wallet
npm --prefix phase5-rbl\realtime-audio test
npm --prefix web_app test
```

Stress test:

```powershell
Set-Location phase5-rbl
k6 run stress-tests/realtime-auth-wallet-stress.js
```
