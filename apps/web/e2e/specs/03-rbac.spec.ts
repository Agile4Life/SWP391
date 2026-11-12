import { test, expect } from '../fixtures';
import { API, authFile, type RoleKey } from '../helpers/accounts';
import { sessionFor } from '../helpers/api';

type R = 'member' | 'staff' | 'coach' | 'manager' | 'admin';
const KEY: Record<R, RoleKey> = { member: 'an', staff: 'staff', coach: 'coach', manager: 'manager', admin: 'admin' };
const HOME: Record<R, RegExp> = { member: /member\/dashboard/, staff: /staff\/reception/, coach: /staff\/attendance/, manager: /manager\/reports/, admin: /admin\/users/ };

// [route, vai trò được phép] — khớp router.tsx
const ROUTES: [string, R[]][] = [
  ['/member/packages', ['member']],
  ['/member/classes', ['member']],
  ['/member/card', ['member']],
  ['/staff/reception', ['staff']],
  ['/staff/kyc', ['staff']],
  ['/staff/holds', ['staff']],
  ['/staff/classes', ['staff', 'manager']],
  ['/coach/training-plans', ['coach']],
  ['/staff/attendance', ['coach']],
  ['/manager/reports', ['manager']],
  ['/manager/catalogs', ['manager']],
  ['/manager/staff-accounts', ['manager']],
  ['/admin/users', ['admin']],
  ['/messages', ['member', 'staff', 'coach']],
];

test.describe('Phân quyền giao diện: route trái vai trò bị chuyển về trang chủ của vai trò', () => {
  for (const role of Object.keys(KEY) as R[]) {
    test.describe(`vai trò ${role}`, () => {
      test.use({ storageState: authFile(KEY[role]) });
      for (const [path, allowed] of ROUTES) {
        const ok = allowed.includes(role);
        test(`${path} -> ${ok ? 'được vào' : 'bị chuyển hướng'}`, async ({ page }) => {
          await page.goto(path);
          if (ok) {
            await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/')));
            await expect(page.locator('main').first()).toBeVisible();
          } else {
            await expect(page).toHaveURL(HOME[role]);
          }
        });
      }
    });
  }
});

// [method, path, vai trò được phép]. Quyền được áp ở tầng bảo mật trước khi tới controller nên đường dẫn "x" vẫn trả 403 cho vai trò sai.
const API_MATRIX: [string, string, R[]][] = [
  ['GET', '/reports/x', ['manager']],
  ['GET', '/admin/audit-logs', ['manager']],
  ['GET', '/members/kyc/x', ['staff', 'manager']],
  ['GET', '/operations/requests/x', ['manager']],
  ['GET', '/operations/requests/my', ['staff', 'coach']],
  ['GET', '/check-in/history', ['staff', 'manager', 'member']],
  ['GET', '/coaching/monthly-reviews/x', ['manager']],
  ['GET', '/support/requests', ['manager', 'staff']],
  ['GET', '/support/requests/my', ['member']],
  ['GET', '/memberships/subscriptions/my', ['member']],
  ['GET', '/court-bookings', ['staff', 'manager']],
  ['GET', '/court-bookings/my', ['member']],
  ['GET', '/classes/enrollments/my', ['member']],
  ['POST', '/check-in/scan', ['staff', 'manager']],
  ['POST', '/classes', ['manager']],
];

test.describe('Phân quyền API: backend luôn kiểm tra vai trò (ẩn menu không phải là bảo mật)', () => {
  for (const [method, path, allowed] of API_MATRIX) {
    test(`${method} ${path}`, async () => {
      const call = async (token?: string) => {
        const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: method === 'GET' ? undefined : '{}' });
        return res.status;
      };
      expect(await call(), 'chưa đăng nhập phải 401').toBe(401);
      for (const role of Object.keys(KEY) as R[]) {
        const status = await call((await sessionFor(KEY[role])).token);
        if (allowed.includes(role)) expect([401, 403], `${role} được phép nhưng nhận ${status}`).not.toContain(status);
        else expect(status, `${role} không được phép`).toBe(403);
      }
    });
  }

  test('token giả mạo/sửa đổi bị từ chối', async () => {
    const { token } = await sessionFor('an');
    const [h, p, sig] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'an@demo.sol.vn', userId: 1, role: 'ADMIN', exp: 9999999999 })).toString('base64url');
    for (const bad of [`${h}.${forgedPayload}.${sig}`, `${h}.${p}.`, 'abc.def.ghi', '']) {
      const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${bad}` } });
      expect(res.status).toBe(401);
    }
  });

  test('hội viên không thể tự nâng quyền qua API quản trị người dùng', async () => {
    const { token } = await sessionFor('an');
    for (const [method, path] of [['GET', '/users'], ['POST', '/users'], ['PUT', '/users/1/role'], ['DELETE', '/users/1']]) {
      const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: method === 'GET' || method === 'DELETE' ? undefined : '{}' });
      expect([403, 404, 405], `${method} ${path} -> ${res.status}`).toContain(res.status);
    }
  });
});
