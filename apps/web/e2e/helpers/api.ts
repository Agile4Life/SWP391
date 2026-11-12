import { deflateSync } from 'node:zlib';
import { API, ACCOUNTS, type RoleKey } from './accounts';

export interface Session { token: string; username: string; role: string }

export async function apiLogin(username: string, password: string): Promise<Session> {
  // /auth/* bị giới hạn 60 request/phút: gặp 429 thì chờ sang cửa sổ phút kế tiếp rồi thử lại.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (res.status === 429 && attempt < 4) { await new Promise((r) => setTimeout(r, 20_000)); continue; }
    const body = await res.json();
    if (!res.ok) throw new Error(`login ${username} -> ${res.status} ${body?.message}`);
    return body.data as Session;
  }
}

const sessions = new Map<RoleKey, Session>();
export async function sessionFor(key: RoleKey): Promise<Session> {
  const cached = sessions.get(key);
  if (cached) return cached;
  const account = ACCOUNTS[key];
  const s = await apiLogin(account.username, account.password);
  sessions.set(key, s);
  return s;
}

export async function api<T = unknown>(key: RoleKey, method: string, path: string, body?: unknown): Promise<{ status: number; data: T; body: any }> {
  const { token } = await sessionFor(key);
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed: any;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, data: parsed?.data as T, body: parsed };
}

export const unique = (prefix = 'e2e') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Tạo hội viên mới đã kích hoạt qua API (register -> send-otp debug -> verify-otp). Trả về thông tin đăng nhập. */
export async function createActiveMember(prefix = 'e2em') {
  const id = unique(prefix).toLowerCase();
  const body = { username: id, email: `${id}@example.com`, password: 'Member@123', phone: undefined as string | undefined };
  const reg = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!reg.ok) throw new Error(`register failed ${reg.status} ${await reg.text()}`);
  const otpRes = await fetch(`${API}/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: body.email }) });
  const otp = (await otpRes.json()).data?.debugOtp as string;
  const ver = await fetch(`${API}/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: body.email, otpCode: otp }) });
  if (!ver.ok) throw new Error(`verify failed ${ver.status} ${await ver.text()}`);
  return { username: body.username, email: body.email, password: body.password };
}

/** Gọi API bằng token tùy ý (ví dụ hội viên vừa tạo). */
export async function apiWith<T = any>(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed: any;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, data: parsed?.data as T, body: parsed };
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) { c ^= byte; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** PNG hợp lệ (RGB đồng màu) kích thước tùy chọn; backend yêu cầu ảnh tối thiểu 100x100. */
export function pngDataUrl(width = 128, height = 128): string {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x80)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString('base64')}`;
}
export const TINY_PNG = pngDataUrl();

export interface FreshMember { username: string; email: string; password: string; token: string; id: number }

/** Hội viên mới đã kích hoạt + đã nộp KYC (đang chờ lễ tân duyệt). Mỗi lần chạy là tài khoản riêng nên spec lặp lại được. */
export async function createMemberWithKycPending(prefix = 'e2ek'): Promise<FreshMember> {
  const m = await createActiveMember(prefix);
  const session = await apiLogin(m.username, m.password);
  const kyc = await apiWith(session.token, 'POST', '/profile/kyc', {
    documentType: 'CCCD', citizenId: String(Math.floor(1e11 + Math.random() * 9e11)), fullName: `Nguyen ${m.username}`, nationality: 'VN', frontImageUrl: TINY_PNG, backImageUrl: TINY_PNG,
  });
  if (kyc.status >= 300) throw new Error(`kyc submit failed ${kyc.status} ${JSON.stringify(kyc.body)}`);
  const profile = await apiWith(session.token, 'GET', '/profile');
  return { ...m, token: session.token, id: Number((profile.data as any)?.userId ?? 0) };
}

export async function approveKyc(memberId: number) {
  return api('staff', 'POST', `/members/kyc/${memberId}/approve`);
}

/** Tạo khóa học định kỳ tương lai (1 buổi/tuần, 1 tuần) bằng tài khoản quản lý. Thử lại khi trùng lịch HLV/phòng. */
export async function createCourse(opts: { startInDays: number; capacity?: number; price?: number; name?: string }) {
  const classes = await api<any[]>('manager', 'GET', '/classes');
  const base = (classes.data as any[]).find((c) => c.disciplineName === 'Gym') ?? (classes.data as any[])[0];
  for (let attempt = 0; attempt < 8; attempt++) {
    const start = new Date(Date.now() + (opts.startInDays + attempt) * 86_400_000);
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(start);
    const day = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date(`${iso}T00:00:00+07:00`).getDay()];
    const hour = 6 + Math.floor(Math.random() * 14);
    const res = await api('manager', 'POST', '/classes/recurring', {
      name: opts.name ?? `E2E ${unique('c')}`, disciplineId: base.disciplineId, coachId: base.coachId, roomId: base.roomId,
      capacity: opts.capacity ?? 10, level: 'all', description: 'Khóa học tạo bởi e2e', price: opts.price ?? 500000,
      startDate: iso, endDate: iso, recurringDays: [day], startTime: `${String(hour).padStart(2, '0')}:00:00`, endTime: `${String(hour + 1).padStart(2, '0')}:00:00`,
    });
    if (res.status < 300) return { id: Number((res.data as any).id ?? (res.data as any).classId), startDate: iso, raw: res.data as any };
    if (res.status !== 409) throw new Error(`create course ${res.status} ${JSON.stringify(res.body)}`);
  }
  throw new Error('không tạo được khóa học (trùng lịch liên tục)');
}
