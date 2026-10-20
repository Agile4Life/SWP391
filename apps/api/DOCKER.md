# Chay backend bang Docker

Backend su dung Java 21, profile `supabase` va database Supabase PostgreSQL qua TLS.
Frontend duoc deploy rieng len Vercel.

## Build va chay tren may

Mo Docker Desktop. Chay cac lenh PowerShell sau tu thu muc goc repository:

```powershell
Copy-Item apps/api/docker/.env.example apps/api/docker/.env
```

Dien thong tin ket noi Supabase dev/test va JWT secret ngau nhien vao
`apps/api/docker/.env`. File nay da duoc ignore boi `docker/.gitignore` va
bi loai khoi Docker build context. Khong commit thong tin bi mat.

URL JDBC phai dung host, port va username trong cau hinh ket noi Supabase
cua project. Khong them `sslmode` vao URL JDBC; dat `DB_SSL_MODE=require`
de bat TLS qua cau hinh datasource. JWT secret can it nhat 32 byte.

```powershell
docker build -t scms-api ./apps/api
docker run --rm --name scms-api -p 8080:8080 --env-file ./apps/api/docker/.env scms-api
```

Theo doi log khoi dong. Khi API san sang, truy cap:

```text
http://localhost:8080/swagger-ui.html
```

Dung container bang `Ctrl+C` trong terminal dang chay.

Dockerfile build JAR bang Maven, sau do chi copy JAR sang image Java runtime.
Container chay bang user khong co quyen root. `PORT` mac dinh la `8080`.
Lenh build image bo qua chay test; can chay cac kiem tra cua repository
truoc khi deploy. Build image thanh cong khong dam bao ket noi DB thanh cong.

API ap dung Hibernate `ddl-auto=update` va nap trigger theo co che hien co
khi khoi dong. Dung database dev/test khi thu nghiem; khong chay DDL lich su.

## Deploy len Render

Tao Web Service lien ket voi repository, su dung:

| Truong | Gia tri |
| --- | --- |
| Language / Runtime | Docker |
| Root Directory | `apps/api` |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context | `.` |

Giu Docker Command mac dinh de dung ENTRYPOINT trong image.
Trong Environment cua Render, nhap cac bien trong `docker/.env.example`
voi gia tri thuc. Khong upload file `.env` len Git.

Dat `APP_CORS_ALLOWED_ORIGINS` va `APP_WEB_ORIGIN` bang URL HTTPS frontend
Vercel, khong co dau `/` o cuoi. Dockerfile da dat profile `supabase`;
API lang nghe tren `0.0.0.0` va su dung `PORT` do Render cung cap.

Neu su dung gui OTP qua email, cau hinh them cac bien SMTP va
`APP_OTP_DELIVERY` theo cau hinh ung dung. Cac bien nay duoc truyen khi
chay, khong duoc nhung vao Docker image.
