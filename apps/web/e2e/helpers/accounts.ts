/** Tài khoản do DemoDataSeeder + bootstrap admin tạo trong stack e2e (xem e2e/stack/compose.e2e.yml). */
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080';
export const API = `${API_URL}/api/v1`;
export const DEMO_PASSWORD = 'Demo@12345';

export type RoleKey = 'admin' | 'manager' | 'staff' | 'coach' | 'coachYoga' | 'an' | 'binh' | 'chi' | 'dung' | 'em' | 'phuc' | 'lan' | 'hieu' | 'khoa' | 'giang';

export const ACCOUNTS: Record<RoleKey, { username: string; password: string; role: string }> = {
  admin: { username: 'admin@e2e.sol.vn', password: 'Admin@12345', role: 'ADMIN' },
  manager: { username: 'manager@demo.sol.vn', password: DEMO_PASSWORD, role: 'MANAGER' },
  staff: { username: 'letan@demo.sol.vn', password: DEMO_PASSWORD, role: 'STAFF' },
  coach: { username: 'hung@demo.sol.vn', password: DEMO_PASSWORD, role: 'COACH' },
  coachYoga: { username: 'mai@demo.sol.vn', password: DEMO_PASSWORD, role: 'COACH' },
  an: { username: 'an@demo.sol.vn', password: DEMO_PASSWORD, role: 'MEMBER' }, // Platinum đang hoạt động, dữ liệu đầy đủ nhất
  binh: { username: 'binh@demo.sol.vn', password: DEMO_PASSWORD, role: 'MEMBER' }, // Gold đang hoạt động
  chi: { username: 'chi@demo.sol.vn', password: DEMO_PASSWORD, role: 'MEMBER' }, // Silver mới 5 ngày
  dung: { username: 'dung@demo.sol.vn', password: DEMO_PASSWORD, role: 'MEMBER' }, // Gold hết hạn
  em: { username: 'em@demo.sol.vn', password: DEMO_PASSWORD, role: 'MEMBER' }, // Silver đang bảo lưu
  phuc: { username: 'phuc@demo.sol.vn', password: DEMO_PASSWORD, role: 'MEMBER' }, // Gold chờ thanh toán, KYC chờ duyệt
  lan: { username: 'lan@demo.sol.vn', password: DEMO_PASSWORD, role: 'MEMBER' }, // chưa có gói
  hieu: { username: 'hieu@demo.sol.vn', password: DEMO_PASSWORD, role: 'MEMBER' }, // Platinum sắp hết hạn
  giang: { username: 'giang@demo.sol.vn', password: DEMO_PASSWORD, role: 'MEMBER' }, // Gold đang hoạt động, đã dùng hết lượt khóa học
  khoa: { username: 'khoa@demo.sol.vn', password: DEMO_PASSWORD, role: 'MEMBER' }, // gói đã hủy
};

export const authFile = (key: RoleKey) => `e2e/.auth/${key}.json`;
