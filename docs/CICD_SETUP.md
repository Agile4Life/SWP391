# CI/CD: GitHub Actions → Vercel + Render

Repo có hai workflow trong tab **Actions**:

- **CI** (`ci.yml`): test/lint/build frontend, kiểm tra cấu hình database và test backend.
- **CD** (`cd.yml`): sau khi CI thành công trên `main`, deploy đúng commit đó lên Vercel và Render. PR và `develop` chỉ chạy CI. Commit đã bị thay thế trên `main` được bỏ qua.

CD đợi Vercel deploy xong và Render báo `live`; lỗi deploy làm job đỏ.
Hai job deploy chạy độc lập: một nền tảng lỗi không tự rollback nền tảng còn lại.

## 1. GitHub Secrets và Variables

Trong repo GitHub, mở **Settings → Secrets and variables → Actions**.
Thêm các **Repository secrets** sau, không đưa token vào source hoặc chat:

| Secret | Giá trị |
| --- | --- |
| `VERCEL_TOKEN` | Token có quyền deploy project hiện tại, tạo tại Vercel Account Settings → Tokens. |
| `VERCEL_ORG_ID` | Team/account ID của project Vercel đã deploy. |
| `VERCEL_PROJECT_ID` | ID của project frontend hiện tại. |
| `RENDER_API_KEY` | API key tạo tại Render Account Settings → API Keys, có quyền truy cập service backend. |
| `RENDER_SERVICE_ID` | ID `srv-...` trong URL dashboard của service backend hiện tại. |

Lấy hai ID Vercel từ project settings hoặc `.vercel/project.json` sau khi chạy
`vercel link` cho project hiện tại. Không tạo project mới.

Trong tab **Variables**, thêm `VERCEL_CLI_VERSION`: phiên bản CLI chính xác dạng
`x.y.z` đã kiểm tra. Có thể xem bản hiện có bằng `npm view vercel version`, rồi
lưu số phiên bản đó; không dùng `latest` hoặc range để tránh CLI tự đổi giữa các lần chạy.

## 2. Vercel

- Dùng project frontend hiện tại, liên kết cùng repo này và production branch `main`.
- Project Settings → Build and Deployment → **Root Directory** phải là `apps/web`.
  Workflow chạy CLI từ gốc monorepo; Vercel áp dụng Root Directory đã lưu.
- Giữ các biến môi trường frontend trong Vercel với target **Production**.
  `vercel pull` tải cấu hình này trước khi build.
- Khi chuyển production sang Actions, tắt Git auto-deploy production trên Vercel
  để tránh mỗi commit tạo hai deployment. Nếu vẫn cần preview PR, chỉ tắt
  auto-deploy của nhánh `main` bằng cấu hình `git.deploymentEnabled` tương ứng.
  Workflow này không tự thay đổi cấu hình cloud.
- Rewrite API hiện tại nằm trong `apps/web/vercel.json`, trỏ về Render.

## 3. Render

- Dùng service backend hiện tại, liên kết cùng repo và nhánh `main`.
- Settings → Build & Deploy → **Auto-Deploy = Off** khi dùng workflow này.
  Không chọn `After CI Checks Pass` đồng thời với CD để tránh deploy hai lần.
- Giữ build/start command, Dockerfile và biến môi trường backend hiện có.
  API vẫn dùng profile `supabase`, JDBC PostgreSQL qua TLS; không thay database.
- CD gọi Render API với `commitId` của CI, rồi kiểm tra trạng thái tối đa 30 phút.
  Timeout hoặc hủy Actions không tự hủy deployment đã gửi lên Render; xem dashboard trước khi chạy lại.

## 4. Đưa workflow lên GitHub

Push/merge `.github/workflows/cd.yml`, `scripts/deploy-render.py` và tài liệu này
lên nhánh mặc định `main`. `workflow_run` yêu cầu file CD nằm trên nhánh mặc định.
Sau đó push/merge thay đổi vào `main`, hoặc mở **Actions → CI → Run workflow → main**.
CI thành công sẽ kích hoạt CD; bên trái Actions sẽ có **CI** và **CD**.

Chỉ chạy CI trên `main` sau khi đã thêm Secrets/Variable và kiểm tra đúng project/service.
Workflow thiếu cấu hình sẽ báo lỗi rõ ràng, không tạo project/service mới.

Kiểm tra script Render offline:

```sh
python -m unittest discover -s scripts -p test_deploy_render.py
```

Tài liệu chính thức: [Vercel + GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel),
[Render trigger deploy](https://api-docs.render.com/reference/create-deploy),
[Render auto-deploy](https://render.com/docs/deploys#configuring-auto-deploys),
[GitHub workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run).
