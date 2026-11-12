import { test, expect, settled } from '../fixtures';
import { api, apiLogin, apiWith, createActiveMember, createMemberWithKycPending, TINY_PNG } from '../helpers/api';
import { contextFor, memberWithPlan, PACKAGES } from '../helpers/session';

/** Hồi quy cho các lỗi do người dùng báo; mỗi describe ứng với một lỗi. */
test.describe.configure({ mode: 'serial' });

const COACH_MAI = 5; // HLV Yoga (mai@demo)
const isoDay = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offset * 86_400_000));

test.describe('Lỗi 1 — nút "Quản lý lịch PT" mở đúng trang lịch PT', () => {
  test('bấm từ hộp thoại lịch của tôi chuyển sang tab Đặt lịch HLV 1:1', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.PLATINUM_3M, 1599000);
    let booked = false;
    for (let offset = 2; offset < 8 && !booked; offset++) {
      const res = await apiWith(m.token, 'POST', '/coach-bookings', { coachId: COACH_MAI, bookingDate: isoDay(offset), startTime: '10:00', endTime: '11:00', paymentMethod: 'cash' });
      booked = res.status === 201 || res.status === 200;
    }
    test.skip(!booked, 'không dựng được lịch PT cho hội viên mới');
    const context = await contextFor(browser, m);
    const page = await context.newPage();
    await page.goto('/member/classes');
    await settled(page);
    await expect(page.getByRole('tab', { name: 'Lịch của tôi' })).toHaveAttribute('aria-selected', 'true');
    await page.locator('.mcal__next').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('link', { name: 'Quản lý lịch PT' }).click();
    await expect(page).toHaveURL(/\/member\/classes\?tab=pt/);
    await expect(page.getByRole('tab', { name: /Đặt lịch HLV 1:1/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Lịch của tôi' })).toHaveAttribute('aria-selected', 'false');
    await context.close();
  });
});

const TENNIS = 6;
/** Đặt sân tennis ở một giờ ngẫu nhiên của ngày `offset`; thử giờ khác khi bị trùng (DB e2e dùng chung giữa các spec). */
async function bookCourt(token: string, offset: number, method: 'cash' | 'vnpay' | undefined) {
  let last: Awaited<ReturnType<typeof apiWith>> | undefined;
  for (let attempt = 0; attempt < 12; attempt++) {
    const hour = 7 + Math.floor(Math.random() * 13);
    last = await apiWith(token, 'POST', '/court-bookings', { roomId: TENNIS, date: isoDay(offset), startTime: `${String(hour).padStart(2, '0')}:00`, paymentMethod: method });
    if (last.status !== 409 || last.body?.code !== 'COURT_BOOKING_SLOT_TAKEN') return last;
  }
  return last!;
}

test.describe('Lỗi 2 — không giữ chỗ sân vô hạn bằng lượt chưa thanh toán', () => {
  test('hạng Silver chỉ giữ được 1 lượt chưa thanh toán; hủy lượt cũ thì đặt tiếp được', async () => {
    const m = await memberWithPlan(PACKAGES.SILVER_3M, 549000);
    // Lượt đầu nằm trong quyền lợi của gói (miễn phí, không phải "giữ chỗ chưa trả tiền").
    const included = await bookCourt(m.token, 3, undefined);
    expect(included.status, JSON.stringify(included.body)).toBe(201);
    expect(included.data.paymentStatus).toBe('covered');

    // Lượt thứ hai phải trả tiền: thanh toán tại quầy tạo một lượt đang chờ thanh toán.
    const held = await bookCourt(m.token, 4, 'cash');
    expect(held.status, JSON.stringify(held.body)).toBe(201);
    expect(held.data.paymentStatus).toBe('pending');

    // Lượt trả tiền thứ ba bị chặn: Silver chỉ giữ tối đa 1 lượt chưa thanh toán.
    const blocked = await bookCourt(m.token, 5, 'cash');
    expect(blocked.status, JSON.stringify(blocked.body)).toBe(409);
    expect(blocked.body.code).toBe('COURT_BOOKING_UNPAID_LIMIT');
    expect(blocked.body.message).toContain('chưa thanh toán');
    const blockedVnpay = await bookCourt(m.token, 5, 'vnpay');
    expect(blockedVnpay.body.code).toBe('COURT_BOOKING_UNPAID_LIMIT');

    // Hủy lượt đang giữ thì giải phóng chỗ và được đặt lượt khác.
    const cancel = await apiWith(m.token, 'PATCH', `/court-bookings/${held.data.id}/cancel`, {});
    expect(cancel.status, JSON.stringify(cancel.body)).toBe(200);
    const again = await bookCourt(m.token, 5, 'cash');
    expect(again.status, JSON.stringify(again.body)).toBe(201);
  });
});

test.describe('Lỗi 3 — quy định đặt sân theo hạng gói', () => {
  test('API trả đúng quy định của từng hạng và chặn đặt quá xa', async () => {
    const silver = await memberWithPlan(PACKAGES.SILVER_3M, 549000);
    const gold = await memberWithPlan(PACKAGES.GOLD_3M, 799000);
    const plat = await memberWithPlan(PACKAGES.PLATINUM_3M, 1599000);
    const rules = async (token: string) => (await apiWith(token, 'GET', '/court-bookings/quota')).data as any;
    const s = await rules(silver.token), g = await rules(gold.token), p = await rules(plat.token);
    expect([s.advanceDays, s.maxUpcoming, s.maxUnpaid, s.monthlyQuota]).toEqual([7, 3, 1, 1]);
    expect([g.advanceDays, g.maxUpcoming, g.maxUnpaid, g.monthlyQuota]).toEqual([14, 5, 2, 2]);
    expect([p.advanceDays, p.maxUpcoming, p.maxUnpaid, p.monthlyQuota]).toEqual([30, 8, 3, 3]);
    expect(s.releaseLeadMinutes).toBe(120);

    // Quá giới hạn đặt trước của hạng → 400 TOO_FAR, kèm số ngày trong thông báo.
    const tooFar = await bookCourt(silver.token, 8, undefined);
    expect(tooFar.status, JSON.stringify(tooFar.body)).toBe(400);
    expect(tooFar.body.code).toBe('COURT_BOOKING_TOO_FAR');
    expect(tooFar.body.message).toContain('7 ngày');
    // Cùng ngày xa (+10) thì Gold đặt được, Silver thì không.
    expect((await bookCourt(silver.token, 10, undefined)).body.code).toBe('COURT_BOOKING_TOO_FAR');
    const goldFar = await bookCourt(gold.token, 10, undefined);
    expect(goldFar.status, JSON.stringify(goldFar.body)).toBe(201);
    // Gold không đặt được quá 14 ngày, Platinum thì được đến 30.
    expect((await bookCourt(gold.token, 15, undefined)).body.code).toBe('COURT_BOOKING_TOO_FAR');
    const platFar = await bookCourt(plat.token, 29, undefined);
    expect(platFar.status, JSON.stringify(platFar.body)).toBe(201);
    expect((await bookCourt(plat.token, 31, undefined)).body.code).toBe('COURT_BOOKING_TOO_FAR');
  });

  test('Silver chỉ giữ tối đa 3 lượt chưa diễn ra (kể cả đã trả); giải phóng một lượt thì đặt tiếp được', async () => {
    const m = await memberWithPlan(PACKAGES.SILVER_3M, 549000);
    const deskConfirm = async (id: number) => (await api('staff', 'PATCH', `/court-bookings/${id}/confirm-payment`, {})).status;
    const first = await bookCourt(m.token, 2, undefined); // trong quyền lợi gói
    const second = await bookCourt(m.token, 3, 'cash');
    expect([first.status, second.status], JSON.stringify([first.body, second.body])).toEqual([201, 201]);
    expect(await deskConfirm(second.data.id)).toBe(200); // lễ tân đã thu tiền → không còn là lượt "giữ chỗ"
    const third = await bookCourt(m.token, 4, 'cash');
    expect(third.status, JSON.stringify(third.body)).toBe(201);
    expect(await deskConfirm(third.data.id)).toBe(200);
    expect((await apiWith(m.token, 'GET', '/court-bookings/quota')).data.upcoming).toBe(3);

    // Đã có 3 lượt chưa diễn ra (dù đã trả) → lượt thứ tư bị chặn bởi giới hạn lượt chưa diễn ra.
    const fourth = await bookCourt(m.token, 5, 'cash');
    expect(fourth.status, JSON.stringify(fourth.body)).toBe(409);
    expect(fourth.body.code).toBe('COURT_BOOKING_UPCOMING_LIMIT');
    const cancel = await apiWith(m.token, 'PATCH', `/court-bookings/${first.data.id}/cancel`, {});
    expect(cancel.status, JSON.stringify(cancel.body)).toBe(200);
    expect((await bookCourt(m.token, 5, 'cash')).status).toBe(201);
  });

  test('màn Đặt sân hiển thị quy định của gói và chỉ cho chọn ngày trong hạn đặt trước', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.GOLD_3M, 799000);
    const context = await contextFor(browser, m);
    const page = await context.newPage();
    await page.goto('/member/courts');
    await settled(page);
    const card = page.locator('.court-policy');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Quy định đặt sân của gói');
    await expect(card).toContainText('Đặt trước tối đa 14 ngày');
    await expect(card).toContainText('Tối đa 5 lượt chưa diễn ra cùng lúc (hiện có 0)');
    await expect(card).toContainText('Tối đa 2 lượt chưa thanh toán cùng lúc (hiện giữ 0)');
    await expect(card).toContainText('2 giờ trước giờ bắt đầu');
    await context.close();
  });
});

test.describe('Lỗi 4 — hiển thị họ tên thật thay vì email/tên đăng nhập', () => {
  test('đăng ký có họ tên: đăng nhập và /auth/me trả họ tên, giao diện hiện tên chứ không hiện email', async ({ page }) => {
    const id = `e2ename${Date.now().toString(36)}`;
    const email = `${id}@example.com`;
    const fullName = 'Trần Văn Kiểm Thử';
    const reg = await fetch('http://localhost:8080/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: email, email, password: 'Member@123', fullName }) });
    expect(reg.status).toBe(201);
    const otp = (await (await fetch('http://localhost:8080/api/v1/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })).json()).data.debugOtp;
    expect((await fetch('http://localhost:8080/api/v1/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: email, otpCode: otp }) })).status).toBe(200);

    const login = await (await fetch('http://localhost:8080/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: email, password: 'Member@123' }) })).json();
    expect(login.data.fullName).toBe(fullName);
    const me = await apiWith(login.data.token, 'GET', '/auth/me');
    expect((me.data as any).fullName).toBe(fullName);

    await page.goto('/login');
    await page.locator('#login-identifier').fill(email);
    await page.locator('#login-password').fill('Member@123');
    await page.getByRole('button', { name: /ĐĂNG NHẬP/ }).click();
    await expect(page).toHaveURL(/\/member\//);
    const account = page.locator('.portal-account-name');
    await expect(account).toHaveText(fullName);
    await expect(account).not.toContainText('@');
  });

  test('đăng ký bắt buộc nhập họ tên', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#reg-username').fill('khongcoten');
    await page.locator('#reg-email').fill('khongcoten@example.com');
    await page.locator('#reg-password').fill('Member@123');
    let called = false;
    page.on('request', (r) => { if (r.url().includes('/auth/register')) called = true; });
    await page.getByRole('button', { name: /TIẾP TỤC XÁC THỰC/ }).click();
    await expect(page.locator('#reg-fullName-error')).toBeVisible();
    expect(called).toBe(false);
  });

  test('quầy check-in hiện họ tên hội viên, không hiện email/tên đăng nhập', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.GOLD, 299000);
    const qr = await apiWith(m.token, 'GET', '/memberships/subscriptions/my/dynamic-qr');
    expect(qr.status).toBe(200);
    const context = await browser.newContext({ storageState: 'e2e/.auth/staff.json' });
    const page = await context.newPage();
    await page.goto('/staff/check-in');
    await settled(page);
    await page.getByPlaceholder(/Nhập mã QR thẻ hội viên/).or(page.getByLabel(/Nhập mã QR thẻ hội viên/)).first().fill(qr.data.qrCode);
    await page.getByRole('button', { name: 'Check-in', exact: true }).click();
    await expect(page.locator('main')).toContainText(/XÁC THỰC HỢP LỆ/i);
    // Họ tên theo hồ sơ KYC của hội viên ("Nguyen <username>"), không phải email.
    await expect(page.locator('main')).toContainText(`Nguyen ${m.username}`);
    await expect(page.locator('main')).not.toContainText(m.email);
    await context.close();
  });
});

test.describe('Lỗi 5 — Lịch lớp học không còn khối "lịch buổi học theo tuần" thừa', () => {
  test.use({ storageState: 'e2e/.auth/binh.json' });

  test('chỉ một nhóm chuyển chế độ; bộ lọc tuần/thứ chỉ hiện khi xem buổi học', async ({ page }) => {
    await page.goto('/member/classes?tab=list');
    await settled(page);
    await expect(page.getByRole('tab', { name: 'Lịch lớp học' })).toHaveAttribute('aria-selected', 'true');
    const view = page.getByRole('group', { name: 'Chế độ xem lịch lớp học' });
    await expect(view.getByRole('button', { name: 'Buổi học theo tuần' })).toHaveAttribute('aria-pressed', 'true');
    // Tuần và thứ chỉ có ý nghĩa với từng buổi học.
    await expect(page.getByRole('group', { name: 'Lọc theo tuần' })).toBeVisible();
    await expect(page.getByLabel('Thứ trong tuần')).toBeVisible();
    // Dòng chuyển chế độ riêng và câu giải thích trùng lặp đã bị bỏ.
    await expect(page.getByText('Xem chi tiết lịch học từng buổi trong tuần')).toHaveCount(0);
    await expect(page.getByText('Lịch buổi học theo tuần')).toHaveCount(0);

    await view.getByRole('button', { name: /Khóa học định kỳ/ }).click();
    await expect(view.getByRole('button', { name: /Khóa học định kỳ/ })).toHaveAttribute('aria-pressed', 'true');
    // Khóa học trọn gói không phụ thuộc tuần/thứ: các bộ lọc đó không còn hiện.
    await expect(page.getByRole('group', { name: 'Lọc theo tuần' })).toHaveCount(0);
    await expect(page.getByLabel('Thứ trong tuần')).toHaveCount(0);
    await expect(page.getByText(/Tổng cộng \d+ khóa học trọn gói/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Lọc theo bộ môn' })).toBeVisible();

    await view.getByRole('button', { name: 'Buổi học theo tuần' }).click();
    await expect(page.getByRole('group', { name: 'Lọc theo tuần' })).toBeVisible();
  });
});

/** Hội viên mới đang dùng gói Trải nghiệm 3 ngày (lễ tân đã duyệt). */
async function trialMember() {
  const m = await createActiveMember('e2etrial');
  const session = await apiLogin(m.username, m.password);
  const claim = await apiWith(session.token, 'POST', '/memberships/trial/request', {
    documentType: 'CCCD', documentNumber: String(Math.floor(1e11 + Math.random() * 9e11)), fullName: `Trial ${m.username}`, nationality: 'VN', frontImageUrl: TINY_PNG, backImageUrl: TINY_PNG,
  });
  expect(claim.status, JSON.stringify(claim.body)).toBe(201);
  const list = await api('staff', 'GET', '/reception/trials');
  const mine = ((list.data as any)?.content ?? list.data as any[]).find((item: any) => item.memberEmail === m.email);
  expect((await api('staff', 'POST', `/reception/trials/${mine.id}/approve`)).status).toBe(200);
  const sub = await apiWith(session.token, 'GET', '/memberships/subscriptions/my');
  const profile = await apiWith(session.token, 'GET', '/profile');
  return { ...m, token: session.token, subscriptionId: (sub.data as any).id as number, memberId: Number((profile.data as any).userId) };
}

test.describe('Lỗi 6 — gói Trải nghiệm nâng được lên mọi gói trả phí (Silver, Gold, Platinum)', () => {
  const PLANS = [{ id: 2, tier: 'SILVER', price: 199000 }, { id: 3, tier: 'GOLD', price: 299000 }, { id: 4, tier: 'PLATINUM', price: 599000 }];
  for (const plan of PLANS) {
    test(`Trải nghiệm → ${plan.tier}: tạo yêu cầu, lễ tân thu tiền, gói chuyển sang ${plan.tier}`, async () => {
      const t = await trialMember();
      const up = await apiWith(t.token, 'POST', `/memberships/subscriptions/${t.subscriptionId}/upgrade`, { packageId: plan.id });
      expect(up.status, JSON.stringify(up.body)).toBe(201);
      expect((up.data as any).upgradeCharge).toBe(plan.price); // gói Trải nghiệm miễn phí nên không có phần quy đổi
      const pay = await api('staff', 'POST', '/payments/process', { memberId: t.memberId, subscriptionId: (up.data as any).id, amount: plan.price, method: 'cash', note: 'e2e' });
      expect(pay.status, JSON.stringify(pay.body)).toBe(201);
      const now = await apiWith(t.token, 'GET', '/memberships/subscriptions/my');
      expect((now.data as any).status).toBe('active');
      expect(String((now.data as any).packageName).toUpperCase()).toContain(plan.tier);
    });
  }

  test('giao diện: cả ba gói đều có nút "Nâng cấp gói" bấm được với hội viên đang dùng gói Trải nghiệm', async ({ browser }) => {
    const t = await trialMember();
    const context = await contextFor(browser, t);
    const page = await context.newPage();
    await page.goto('/member/packages');
    await settled(page);
    for (const tier of ['SILVER', 'GOLD', 'PLATINUM']) {
      const card = page.locator('article', { hasText: tier }).first();
      await expect(card.getByRole('button', { name: 'Nâng cấp gói' })).toBeEnabled();
    }
    await page.locator('article', { hasText: 'GOLD' }).first().getByRole('button', { name: 'Nâng cấp gói' }).click();
    await expect(page.getByText(/Yêu cầu #\d+/)).toBeVisible();
    await context.close();
  });
});

test.describe('Lỗi 7 — lễ tân và HLV chủ động nhắn tin cho hội viên', () => {
  const send = (token: string, conversationId: number, message: string) =>
    apiWith(token, 'POST', `/chat/conversations/${conversationId}/messages`, { clientMessageId: crypto.randomUUID(), message });

  test('lễ tân tìm hội viên, mở hội thoại, nhắn trước; hội viên thấy tin chưa đọc và trả lời được', async () => {
    const m = await createMemberWithKycPending('e2echat');
    const found = await api('staff', 'GET', `/chat/contacts?query=${encodeURIComponent(m.username)}`);
    expect(found.status, JSON.stringify(found.body)).toBe(200);
    const hit = ((found.data as any).content as any[]).find((c) => c.id === m.id);
    expect(hit?.role).toBe('MEMBER');

    const opened = await api('staff', 'POST', '/chat/conversations', { contactId: m.id });
    expect(opened.status, JSON.stringify(opened.body)).toBe(200);
    const conversationId = (opened.data as any).id as number;
    expect((opened.data as any).peer.role).toBe('MEMBER');
    // Mở lại là dùng lại đúng hội thoại, không tạo trùng.
    expect(((await api('staff', 'POST', '/chat/conversations', { contactId: m.id })).data as any).id).toBe(conversationId);

    const greeting = `Chào bạn, lễ tân SÖL đây ${Date.now()}`;
    const sent = await send((await apiLogin('letan@demo.sol.vn', 'Demo@12345')).token, conversationId, greeting);
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);

    const inbox = await apiWith(m.token, 'GET', '/chat/conversations');
    const mine = ((inbox.data as any).content as any[]).find((c) => c.id === conversationId);
    expect(mine.lastMessage).toBe(greeting);
    expect(mine.unreadCount).toBe(1);
    expect(mine.peer.role).toBe('RECEPTIONIST');
    expect((await send(m.token, conversationId, 'Em cảm ơn ạ')).status).toBe(200);
  });

  test('HLV chỉ nhắn được hội viên mình đang dạy; quản lý không có quyền', async () => {
    const coach = await apiLogin('hung@demo.sol.vn', 'Demo@12345');
    const list = await apiWith(coach.token, 'GET', '/chat/contacts?query=');
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    const mine = (list.data as any).content as any[];
    expect(mine.every((c) => c.role === 'MEMBER')).toBe(true);
    test.skip(mine.length === 0, 'HLV demo chưa có hội viên đang dạy');
    const ok = await apiWith(coach.token, 'POST', '/chat/conversations', { contactId: mine[0].id });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);

    const stranger = await createMemberWithKycPending('e2estranger');
    const denied = await apiWith(coach.token, 'POST', '/chat/conversations', { contactId: stranger.id });
    expect(denied.status, JSON.stringify(denied.body)).toBe(403);
    expect(denied.body.code).toBe('COACH_MEMBER_NOT_ASSIGNED');

    expect((await api('manager', 'GET', '/chat/contacts?query=')).status).toBe(403);
    expect((await api('manager', 'POST', '/chat/conversations', { contactId: stranger.id })).status).toBe(403);
  });

  test.describe('giao diện lễ tân', () => {
    test.use({ storageState: 'e2e/.auth/staff.json' });
    test('"Cuộc trò chuyện mới" tìm hội viên và gửi tin nhắn đầu tiên', async ({ page }) => {
      const m = await createMemberWithKycPending('e2eui');
      await page.goto('/staff/reception');
      await settled(page);
      await page.getByRole('button', { name: /^Mở tin nhắn/ }).click();
      const panel = page.getByRole('dialog', { name: 'Tin nhắn SÖL' });
      await panel.getByRole('button', { name: 'Cuộc trò chuyện mới' }).click();
      await expect(panel.getByText('Tìm hội viên')).toBeVisible();
      await panel.getByPlaceholder('Tên hội viên...').fill(m.username);
      await panel.getByRole('button', { name: 'Tìm', exact: true }).click();
      await panel.locator(`button[data-contact-id="${m.id}"]`).click();
      const text = `Lễ tân nhắn trước ${Date.now()}`;
      await panel.locator('#chat-message').fill(text);
      await panel.getByRole('button', { name: 'Gửi', exact: true }).click();
      await expect(panel.locator('.direct-chat__messages')).toContainText(text);
      const unread = await apiWith(m.token, 'GET', '/chat/unread-count');
      expect((unread.data as any).count).toBeGreaterThanOrEqual(1);
    });
  });
});

test.describe('Lỗi 8 — hồ sơ giấy tờ hội viên gửi lên phải hiện cho lễ tân đang mở sẵn trang duyệt', () => {
  test.use({ storageState: 'e2e/.auth/staff.json' });

  test('hồ sơ gửi sau khi trang đã mở: hiện bằng nút Làm mới và tự hiện sau 30 giây', async ({ page }) => {
    await page.clock.install();
    await page.goto('/staff/kyc');
    await settled(page);
    await expect(page.getByRole('heading', { name: 'Duyệt hồ sơ định danh' })).toBeVisible();

    // Hội viên gửi hồ sơ trong lúc lễ tân giữ nguyên trang: trước đây phải tải lại cả trang mới thấy.
    const first = await createMemberWithKycPending('e2ekycdesk');
    await page.getByRole('button', { name: 'Làm mới danh sách hồ sơ' }).click();
    await expect(page.getByTestId(`kyc-${first.id}`)).toContainText(`Nguyen ${first.username}`);

    const second = await createMemberWithKycPending('e2ekycauto');
    await page.clock.fastForward(31_000);
    await expect(page.getByTestId(`kyc-${second.id}`)).toBeVisible();
  });
});

/** Ảnh BMP thật (giải mã được) có dung lượng lớn như ảnh chụp từ điện thoại; nén ở trình duyệt phải thu nhỏ nó. */
function bigBmp(width: number, height: number) {
  const row = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + row * height;
  const buffer = Buffer.alloc(size);
  buffer.write('BM', 0); buffer.writeUInt32LE(size, 2); buffer.writeUInt32LE(54, 10); buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18); buffer.writeInt32LE(height, 22); buffer.writeUInt16LE(1, 26); buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(row * height, 34);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = 54 + y * row + x * 3;
    buffer[at] = (x * 255) / width; buffer[at + 1] = (y * 255) / height; buffer[at + 2] = ((x + y) * 7) & 255;
  }
  return { name: 'cccd.bmp', mimeType: 'image/bmp', buffer };
}

test.describe('Lỗi 9 — gửi CCCD: ảnh lớn không còn làm yêu cầu bị chặn trước khi tới lễ tân', () => {
  test('gói trải nghiệm: ảnh ~3,5MB mỗi mặt được thu nhỏ trước khi gửi và lễ tân thấy đơn', async ({ browser }) => {
    const m = await createActiveMember('e2ebig');
    const session = await apiLogin(m.username, m.password);
    const context = await contextFor(browser, { username: m.username, token: session.token });
    const page = await context.newPage();
    const photo = bigBmp(1100, 1100); // ~3,6MB
    expect(photo.buffer.length).toBeGreaterThan(3 * 1024 * 1024);
    let bodyBytes = 0;
    page.on('request', (r) => { if (r.url().includes('/trial/claim') && r.method() === 'POST') bodyBytes = r.postDataBuffer()?.length ?? 0; });
    await page.goto('/member/packages');
    await settled(page);
    await page.getByRole('button', { name: /Nhận 3 ngày tập miễn phí/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input:not([type=file])').first().fill('Nguyen Van Anh Lon');
    await dialog.getByPlaceholder(/001200001234/).fill(String(Math.floor(1e11 + Math.random() * 9e11)));
    await dialog.locator('input[type=file]').first().setInputFiles(photo);
    await expect(dialog.locator('img').first()).toBeVisible();
    await dialog.locator('input[type=file]').first().setInputFiles(photo);
    await expect(dialog.locator('img')).toHaveCount(2);
    await dialog.locator('button[type=submit]').click();
    await expect(dialog).toBeHidden();
    // Trước khi nén, hai ảnh này thành ~9,6MB và gần chạm giới hạn 10MB của nginx (ảnh lớn hơn nữa bị 413).
    expect(bodyBytes).toBeGreaterThan(0);
    expect(bodyBytes).toBeLessThan(1_000_000);

    const list = await api('staff', 'GET', '/reception/trials?status=PENDING_APPROVAL');
    const mine = ((list.data as any)?.content ?? list.data as any[]).find((x: any) => x.memberEmail === m.email);
    expect(mine, 'lễ tân phải thấy đơn trải nghiệm').toBeTruthy();
    expect(String(mine.frontImageUrl)).toMatch(/^data:image\/jpeg;base64,/);
    await context.close();
  });

  test('xác minh ở trang thanh toán: ảnh được chuẩn hóa sang JPEG nhỏ và lễ tân thấy hồ sơ', async ({ browser }) => {
    const m = await createActiveMember('e2ebigkyc');
    const session = await apiLogin(m.username, m.password);
    const context = await contextFor(browser, { username: m.username, token: session.token });
    const page = await context.newPage();
    const photo = bigBmp(800, 800); // ~1,9MB: dưới giới hạn 2MB của form nhưng không phải JPEG/PNG/WebP mà máy chủ chấp nhận
    let bodyBytes = 0;
    page.on('request', (r) => { if (r.url().includes('/profile/kyc') && r.method() === 'POST') bodyBytes = r.postDataBuffer()?.length ?? 0; });
    await page.goto('/member/packages/checkout?packageId=2');
    await settled(page);
    await page.locator('#checkout-doc-number').fill(String(Math.floor(1e11 + Math.random() * 9e11)));
    await page.locator('#checkout-fullname').fill('Nguyen Van Kyc Lon');
    await page.locator('input[type=file]').first().setInputFiles(photo);
    await expect(page.getByRole('button', { name: 'Xóa' })).toHaveCount(1);
    await page.locator('input[type=file]').first().setInputFiles(photo);
    await page.getByRole('button', { name: /Xác minh & Đồng bộ họ tên/ }).click();
    await expect(page.getByTestId('kyc-pending')).toBeVisible();
    expect(bodyBytes).toBeLessThan(1_000_000);
    const desk = await api('staff', 'GET', '/members/kyc/pending');
    const mine = (desk.data as any[]).find((x) => x.fullName === 'Nguyen Van Kyc Lon' && x.membershipCode);
    expect(mine, 'lễ tân phải thấy hồ sơ').toBeTruthy();
    expect(String(mine.frontImageUrl)).toMatch(/^data:image\/jpeg;base64,/);
    await context.close();
  });
});
