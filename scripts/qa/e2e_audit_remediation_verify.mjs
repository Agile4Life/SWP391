#!/usr/bin/env node
/**
 * Comprehensive headless Chromium Playwright E2E verification script (`P1-E2E-03`)
 * against the freshly built `apps/web/dist` SPA bundle.
 *
 * Verifies all 8 major remediated P0 / P1 / P2 flows across Light & Dark themes
 * and Desktop (1440x900) & Mobile (390x844) viewports with zero console errors,
 * zero page errors, zero unhandled API calls, and zero horizontal overflow.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const distDir = path.join(repoRoot, 'apps/web/dist');

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  throw new Error(`Missing built bundle at ${distDir}. Run npm --prefix apps/web run build first.`);
}

// Resolve playwright-core from apps/web/node_modules or local resolution
function loadChromium() {
  const candidates = [
    path.join(repoRoot, 'apps/web/package.json'),
    import.meta.url,
  ];
  for (const base of candidates) {
    try {
      const req = createRequire(base);
      const pw = req('playwright-core');
      if (pw?.chromium) return pw.chromium;
    } catch {
      // try next candidate
    }
  }
  throw new Error('Could not resolve playwright-core from apps/web/node_modules or repository root.');
}

const chromium = loadChromium();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

/** Start an ephemeral static HTTP server for apps/web/dist with SPA fallback. */
async function startDistServer() {
  const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'));
  const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const cleanPath = decodeURIComponent(reqUrl.pathname);

    if (cleanPath.startsWith('/api/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Unintercepted API call' }));
      return;
    }

    const relPath = cleanPath.replace(/^\/+/, '');
    const candidate = path.resolve(distDir, relPath);
    const insideDist = candidate === distDir || candidate.startsWith(distDir + path.sep);

    if (insideDist && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const ext = path.extname(candidate).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(candidate).pipe(res);
      return;
    }

    // SPA fallback for client routes
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(indexHtml);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

// Date helpers aligned with Asia/Ho_Chi_Minh (UTC+7)
function centerTodayIso() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const d = parts.find((p) => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

function addIsoDays(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function mondayOfIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

const TODAY = centerTodayIso();
const WEEK_MONDAY = mondayOfIso(TODAY);
const WEEK_WEDNESDAY = addIsoDays(WEEK_MONDAY, 2);
const FUTURE_START = addIsoDays(TODAY, 7);
const FUTURE_END = addIsoDays(TODAY, 35);

const FIVE_SLOTS = [
  { slotNumber: 1, code: 'SLOT_1', startTime: '07:00', endTime: '09:30' },
  { slotNumber: 2, code: 'SLOT_2', startTime: '09:45', endTime: '12:15' },
  { slotNumber: 3, code: 'SLOT_3', startTime: '12:30', endTime: '15:00' },
  { slotNumber: 4, code: 'SLOT_4', startTime: '15:15', endTime: '17:45' },
  { slotNumber: 5, code: 'SLOT_5', startTime: '18:00', endTime: '20:30' },
];

const DISCIPLINES_FIXTURE = [
  { id: 1, name: 'Gym', description: 'Tập tạ & sức mạnh nền tảng', status: 'active' },
  { id: 2, name: 'Boxing', description: 'Kỹ thuật đấm & thể lực theo hiệp', status: 'active' },
  { id: 3, name: 'Yoga', description: 'Hơi thở, thăng bằng và phục hồi', status: 'active' },
];

const ROOMS_FIXTURE = [
  { id: 10, name: 'Phòng Gym Tiêu chuẩn', location: 'Tầng 1 - Khu Gym Chính', capacity: 30, status: 'available', tier: 'STANDARD', openTime: '06:00', closeTime: '22:00' },
  { id: 11, name: 'Phòng Gym VIP', location: 'Tầng 2 - Khu VIP Platinum', capacity: 20, status: 'available', tier: 'PLATINUM', openTime: '06:00', closeTime: '22:00' },
  { id: 12, name: 'Zen Garden Studio', location: 'Penthouse', capacity: 18, status: 'available', tier: 'STANDARD', openTime: '06:00', closeTime: '21:00' },
  { id: 13, name: 'Ring Arena 01', location: 'Tầng 1 - East Wing', capacity: 14, status: 'available', tier: 'STANDARD', openTime: '06:00', closeTime: '22:00' },
];

const COACHES_FIXTURE = [
  { id: 20, roleCode: 'COACH', fullName: 'HLV Minh Khôi', email: 'coach.gym@sol.vn', phone: '0901000020', status: 'active', gender: 'male' },
  { id: 21, roleCode: 'COACH', fullName: 'HLV Trần Thị Mỹ Trâm', email: 'coach.yoga@sol.vn', phone: '0901000021', status: 'active', gender: 'female' },
  { id: 22, roleCode: 'COACH', fullName: 'HLV Huỳnh Đắc Tài', email: 'coach.boxing@sol.vn', phone: '0901000022', status: 'active', gender: 'male' },
];

const PUBLIC_CATALOG_FIXTURE = {
  packages: [
    {
      id: 1,
      name: 'Gói Trải Nghiệm 3 Ngày',
      description: 'Trải nghiệm 3 ngày đầy đủ không gian tập luyện SÖL.',
      price: 0,
      durationDays: 3,
      packageType: 'trial',
      status: 'active',
      features: ['Sử dụng khu Gym Tiêu chuẩn', '01 buổi PT 1:1 trải nghiệm'],
    },
    {
      id: 2,
      name: 'Silver Monthly',
      description: 'Tập không giới hạn Gym Tiêu chuẩn cùng 1 khóa lớp nhóm.',
      price: 790000,
      durationDays: 30,
      packageType: 'silver',
      status: 'active',
      features: ['Phòng Gym Tiêu chuẩn', '1 khóa lớp nhóm / chu kỳ'],
    },
    {
      id: 3,
      name: 'Gold Monthly',
      description: '3 bộ môn Gym, Boxing, Yoga kèm 3 lượt PT 1:1 mỗi tháng.',
      price: 1490000,
      durationDays: 30,
      packageType: 'gold',
      status: 'active',
      features: ['3 bộ môn: Gym, Boxing, Yoga', '3 lượt PT 1:1 / tháng', 'Giảm 10% khóa học thêm'],
    },
    {
      id: 4,
      name: 'Platinum Monthly',
      description: 'Đặc quyền Phòng Gym VIP, lớp nhóm không giới hạn và 6 lượt PT 1:1.',
      price: 2490000,
      durationDays: 30,
      packageType: 'platinum',
      status: 'active',
      features: ['Phòng Gym VIP Platinum', 'Lớp nhóm không giới hạn', '6 lượt PT 1:1 / tháng'],
    },
  ],
  coaches: [
    { id: 20, name: 'HLV Minh Khôi', specialization: 'Gym - Sức mạnh', bio: '8 năm huấn luyện sức mạnh, tăng cơ và giảm mỡ cho hội viên mọi trình độ.', certification: 'NASM-CPT', avatarUrl: null },
    { id: 21, name: 'HLV Trần Thị Mỹ Trâm', specialization: 'Yoga & Phục hồi', bio: 'Giáo viên Yoga 6 năm kinh nghiệm, tập trung hơi thở, thăng bằng và phục hồi.', certification: 'RYT-500', avatarUrl: null },
    { id: 22, name: 'HLV Huỳnh Đắc Tài', specialization: 'Boxing', bio: 'Cựu vận động viên Boxing, chuyên kỹ thuật đấm và thể lực theo hiệp.', certification: 'AIBA Level 2', avatarUrl: null },
  ],
  sessions: [
    {
      id: 301,
      classId: 101,
      className: 'Full Body Strength 101',
      disciplineId: 1,
      disciplineName: 'Gym',
      coachId: 20,
      coachName: 'HLV Minh Khôi',
      roomId: 10,
      roomName: 'Phòng Gym Tiêu chuẩn',
      sessionDate: addIsoDays(TODAY, 1),
      startTime: '07:00:00',
      endTime: '09:30:00',
      status: 'scheduled',
      cancelReason: null,
      capacity: 20,
      bookedCount: 8,
    },
    {
      id: 302,
      classId: 102,
      className: 'Boxing Cơ Bản',
      disciplineId: 2,
      disciplineName: 'Boxing',
      coachId: 22,
      coachName: 'HLV Huỳnh Đắc Tài',
      roomId: 13,
      roomName: 'Ring Arena 01',
      sessionDate: addIsoDays(TODAY, 1),
      startTime: '18:00:00',
      endTime: '20:30:00',
      status: 'scheduled',
      cancelReason: null,
      capacity: 14,
      bookedCount: 6,
    },
    {
      id: 303,
      classId: 103,
      className: 'Hatha Yoga Nền Tảng',
      disciplineId: 3,
      disciplineName: 'Yoga',
      coachId: 21,
      coachName: 'HLV Trần Thị Mỹ Trâm',
      roomId: 12,
      roomName: 'Zen Garden Studio',
      sessionDate: addIsoDays(TODAY, 2),
      startTime: '09:45:00',
      endTime: '12:15:00',
      status: 'scheduled',
      cancelReason: null,
      capacity: 18,
      bookedCount: 9,
    },
  ],
};

function apiOk(data, message = 'OK') {
  return {
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ success: true, message, data }),
  };
}

function apiCreated(data, message = 'Created') {
  return {
    status: 201,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ success: true, message, data }),
  };
}

/**
 * Create a Playwright browser context + page with API fixture routing,
 * theme/auth pre-seeding, and strict telemetry capture.
 */
async function createTrackedSession(browser, {
  baseUrl,
  viewport = { width: 1440, height: 900 },
  theme = 'light',
  auth = null,
  extraStorage = null,
  customApiHandler = null,
} = {}) {
  const context = await browser.newContext({
    viewport,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  });

  await context.addInitScript(({ themeVal, authVal, extra }) => {
    localStorage.setItem('scms_theme', themeVal);
    localStorage.setItem('scms_lang', 'vi');
    if (authVal) {
      localStorage.setItem('fitcenter_auth_session', JSON.stringify(authVal.user));
      localStorage.setItem('fitcenter_token', authVal.token || 'eyJhbGciOiJIUzI1NiJ9.e2e-mock-token');
    } else {
      localStorage.removeItem('fitcenter_auth_session');
      localStorage.removeItem('fitcenter_token');
    }
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        localStorage.setItem(k, v);
      }
    }
  }, { themeVal: theme, authVal: auth, extra: extraStorage });

  const page = await context.newPage();

  const state = {
    auth,
    requests: [],
    consoleErrors: [],
    pageErrors: [],
    unhandledRequests: [],
    badHttpResponses: [],
    stateful: {
      createdClasses: [],
      unpaidCourses: [
        {
          enrollmentId: 601,
          paymentId: 9601,
          classId: 102,
          className: 'Boxing Cơ Bản',
          disciplineName: 'Boxing',
          startDate: FUTURE_START,
          endDate: FUTURE_END,
          memberId: 501,
          memberName: 'Nguyễn Minh Quân',
          memberPhone: '0909123456',
          membershipCode: 'SOL-0501',
          amount: 350000,
          method: 'cash',
          createdAt: `${TODAY}T08:15:00+07:00`,
        },
      ],
      memberEnrollments: [],
    },
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      state.consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    state.pageErrors.push(err.message || String(err));
  });
  page.on('response', (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && url.startsWith(baseUrl)) {
      state.badHttpResponses.push({ status, url });
    }
  });

  // Fulfill external Google Fonts deterministically so offline/slow CDN never causes console warnings
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i, (route) => {
    route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' });
  });

  // Intercept all /api/v1/** requests with realistic Wave 0/1/2 ApiResponse<T> contracts
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const urlObj = new URL(request.url());
    const apiPath = urlObj.pathname.replace(/^\/api\/v1/, '');
    let postBody = null;
    try {
      const raw = request.postData();
      postBody = raw ? JSON.parse(raw) : null;
    } catch {
      postBody = request.postData();
    }

    const reqRecord = {
      method,
      path: apiPath,
      search: urlObj.search,
      fullUrl: request.url(),
      body: postBody,
    };
    state.requests.push(reqRecord);

    if (customApiHandler) {
      const custom = await customApiHandler(reqRecord, state);
      if (custom) {
        await route.fulfill(custom);
        return;
      }
    }

    const reply = defaultApiFixture(reqRecord, state);
    if (reply) {
      await route.fulfill(reply);
      return;
    }

    state.unhandledRequests.push(`${method} ${apiPath}${urlObj.search}`);
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: `Unhandled mock route: ${method} ${apiPath}` }),
    });
  });

  return { context, page, state };
}

function backendRoleFor(portalRole) {
  if (portalRole === 'STAFF') return 'RECEPTIONIST';
  if (portalRole === 'MANAGER') return 'CENTER_MANAGER';
  return portalRole;
}

function defaultApiFixture(req, state) {
  const { method, path: p } = req;

  // Session sync (/auth/me)
  if (method === 'GET' && p === '/auth/me') {
    const user = state.auth?.user;
    if (!user) {
      return { status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
    }
    return apiOk({
      username: user.identifier,
      role: backendRoleFor(user.role),
      fullName: user.name,
    });
  }

  // Public catalog
  if (method === 'GET' && p === '/public/catalog') {
    return apiOk(PUBLIC_CATALOG_FIXTURE);
  }

  // Profile & notifications
  if (method === 'GET' && p === '/profile') {
    return apiOk({
      userId: 20,
      fullName: 'Người dùng E2E',
      email: 'e2e@sol.vn',
      phone: '0901234567',
      dob: '1996-05-15',
      gender: 'male',
      avatarUrl: null,
      address: 'Quận 1, TP.HCM',
      membershipCode: 'SOL-0501',
      healthNotes: null,
      fitnessGoal: 'Tăng sức bền và cơ bắp',
      fitnessLevel: 'intermediate',
      emergencyContactName: null,
      emergencyContactPhone: null,
      identityVerified: true,
      kycStatus: 'APPROVED',
    });
  }
  if (method === 'GET' && p === '/notifications/unread-count') {
    return apiOk({ count: 0 });
  }
  if (method === 'GET' && p === '/notifications') {
    return apiOk({ content: [], number: 0, totalPages: 0 });
  }

  // Realtime sessions (explicitly disabled for deterministic headless verification)
  if (method === 'POST' && (
    p === '/chat/realtime-session'
    || p === '/support/realtime-session'
    || p === '/memberships/subscriptions/realtime-session'
  )) {
    return apiOk({ enabled: false, userId: 20 });
  }

  // Chat APIs
  if (method === 'GET' && p === '/chat/unread-count') {
    return apiOk({ count: 2 });
  }
  if (method === 'GET' && p === '/chat/conversations') {
    return apiOk({
      content: [
        {
          id: 77,
          peer: { id: 501, name: 'Nguyễn Minh Quân', role: 'MEMBER', available: true, avatarUrl: null },
          createdAt: `${TODAY}T08:00:00+07:00`,
          lastActivityAt: `${TODAY}T09:00:00+07:00`,
          lastMessage: 'Tin riêng nội bộ lễ tân E2E',
          lastMessageMine: false,
          unreadCount: 2,
        },
      ],
      totalPages: 1,
      number: 0,
    });
  }
  if (method === 'GET' && /^\/chat\/conversations\/\d+\/messages$/.test(p)) {
    return apiOk({
      items: [
        {
          id: 8801,
          conversationId: 77,
          clientMessageId: 'e2e-msg-1',
          senderId: 501,
          mine: false,
          message: 'Tin riêng nội bộ lễ tân E2E',
          createdAt: `${TODAY}T09:00:00+07:00`,
        },
      ],
      hasMore: false,
    });
  }
  if (method === 'POST' && /^\/chat\/conversations\/\d+\/read$/.test(p)) {
    return apiOk({ count: 0 });
  }
  if (method === 'GET' && p === '/chat/contacts') {
    return apiOk({ content: [], totalPages: 0, number: 0 });
  }

  // Support tickets (if chat opens support)
  if (method === 'GET' && (p === '/support/tickets' || p === '/support/tickets/my')) {
    return apiOk([]);
  }

  // Catalogs: disciplines, rooms, coaches, packages
  if (method === 'GET' && p === '/disciplines') {
    return apiOk(DISCIPLINES_FIXTURE);
  }
  if (method === 'GET' && p === '/rooms') {
    return apiOk(ROOMS_FIXTURE);
  }
  if (method === 'GET' && p === '/classes/coaches') {
    return apiOk(COACHES_FIXTURE);
  }
  if (method === 'GET' && (p === '/memberships/packages' || p === '/packages')) {
    return apiOk(PUBLIC_CATALOG_FIXTURE.packages);
  }

  // Classes & recurring scheduling
  if (method === 'GET' && p === '/classes') {
    return apiOk([
      {
        id: 101,
        name: 'Full Body Strength 101',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 20,
        coachName: 'HLV Minh Khôi',
        roomId: 10,
        roomName: 'Phòng Gym Tiêu chuẩn',
        capacity: 20,
        level: 'all',
        description: 'Khóa rèn luyện sức mạnh toàn thân 4 tuần.',
        status: 'active',
        price: 350000,
        startDate: FUTURE_START,
        endDate: FUTURE_END,
        recurringDays: 'MONDAY,WEDNESDAY,FRIDAY',
        startTime: '07:00:00',
        endTime: '09:30:00',
      },
      {
        id: 102,
        name: 'Boxing Cơ Bản',
        disciplineId: 2,
        disciplineName: 'Boxing',
        coachId: 22,
        coachName: 'HLV Huỳnh Đắc Tài',
        roomId: 13,
        roomName: 'Ring Arena 01',
        capacity: 14,
        level: 'beginner',
        description: 'Kỹ thuật đấm cơ bản và di chuyển chân.',
        status: 'active',
        price: 400000,
        startDate: FUTURE_START,
        endDate: FUTURE_END,
        recurringDays: 'TUESDAY,THURSDAY',
        startTime: '18:00:00',
        endTime: '20:30:00',
      },
      ...state.stateful.createdClasses,
    ]);
  }
  if (method === 'GET' && p === '/classes/sessions') {
    return apiOk([
      {
        id: 401,
        classId: 101,
        className: 'Full Body Strength 101',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 20,
        coachName: 'HLV Minh Khôi',
        roomId: 10,
        roomName: 'Phòng Gym Tiêu chuẩn',
        sessionDate: WEEK_WEDNESDAY,
        startTime: '07:00:00',
        endTime: '09:30:00',
        status: 'scheduled',
        cancelReason: null,
        capacity: 20,
        bookedCount: 11,
      },
    ]);
  }
  if (method === 'POST' && p === '/classes/recurring/availability') {
    const startDate = req.body?.startDate || FUTURE_START;
    const endDate = req.body?.endDate || FUTURE_END;
    return apiOk({
      validSchedule: true,
      scheduleErrorCode: null,
      scheduleErrorMessage: null,
      sessionCount: 8,
      firstSessionDate: startDate,
      lastSessionDate: endDate,
      selectedSlotAvailable: true,
      selectedSlotConflictCode: null,
      selectedSlotConflictReason: null,
      slots: FIVE_SLOTS.map((s) => ({
        slotNumber: s.slotNumber,
        code: s.code,
        startTime: s.startTime,
        endTime: s.endTime,
        available: true,
        disciplineConflict: false,
        conflictCode: null,
        conflictReason: null,
        availableRoomCount: 4,
        availableCoachCount: 3,
      })),
      rooms: ROOMS_FIXTURE.map((r) => ({
        id: r.id,
        name: r.name,
        location: r.location,
        capacity: r.capacity,
        tier: r.tier,
        available: true,
        conflictCode: null,
        conflictReason: null,
      })),
      coaches: COACHES_FIXTURE.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        email: c.email,
        available: true,
        conflictCode: null,
        conflictReason: null,
      })),
    });
  }
  if (method === 'POST' && p === '/classes/recurring') {
    const created = {
      id: 999,
      name: req.body?.name || 'Khóa học mới',
      disciplineId: req.body?.disciplineId || 1,
      disciplineName: DISCIPLINES_FIXTURE.find((d) => d.id === req.body?.disciplineId)?.name || 'Gym',
      coachId: req.body?.coachId || 20,
      coachName: COACHES_FIXTURE.find((c) => c.id === req.body?.coachId)?.fullName || 'HLV Minh Khôi',
      roomId: req.body?.roomId || 10,
      roomName: ROOMS_FIXTURE.find((r) => r.id === req.body?.roomId)?.name || 'Phòng Gym Tiêu chuẩn',
      capacity: req.body?.capacity || 15,
      level: req.body?.level || 'all',
      description: req.body?.description || null,
      status: 'active',
      price: req.body?.price ?? 0,
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
      recurringDays: Array.isArray(req.body?.recurringDays) ? req.body.recurringDays.join(',') : '',
      startTime: req.body?.startTime,
      endTime: req.body?.endTime,
    };
    state.stateful.createdClasses.push(created);
    return apiCreated(created, 'Đã tạo khóa học định kỳ thành công.');
  }

  // Member membership, enrollments, quota, wallet & checkout
  if (method === 'GET' && p === '/memberships/subscriptions/my') {
    return apiOk({
      id: 700,
      memberId: 501,
      packageId: 3,
      packageName: 'Gold Monthly',
      previousSubscriptionId: null,
      startDate: addIsoDays(TODAY, -5),
      endDate: addIsoDays(TODAY, 25),
      paidThroughDate: addIsoDays(TODAY, 25),
      status: 'active',
      qrCode: 'SOL-QR-700',
      createdAt: `${addIsoDays(TODAY, -5)}T08:00:00+07:00`,
    });
  }
  if (method === 'GET' && p === '/classes/enrollments/my') {
    return apiOk(state.stateful.memberEnrollments);
  }
  if (method === 'GET' && p === '/classes/my-quota') {
    return apiOk({
      tier: 'GOLD',
      totalCredits: 2,
      usedCredits: 2,
      remainingCredits: 0,
      unlimited: false,
      enrollBlockedUntil: null,
      discountPercent: 10,
    });
  }
  if (method === 'POST' && /^\/classes\/\d+\/checkout$/.test(p)) {
    const classId = Number(p.split('/')[2]);
    const payMethod = req.body?.method || 'cash';
    if (payMethod === 'online_wallet') {
      state.stateful.memberEnrollments.push({
        id: 801,
        classId,
        className: 'Full Body Strength 101',
        memberId: 501,
        sessionId: null,
        sessionDate: null,
        startTime: null,
        endTime: null,
        status: 'booked',
        enrolledAt: `${TODAY}T10:00:00+07:00`,
        cancelledAt: null,
        cancelReason: null,
      });
    }
    return apiCreated({
      enrollmentId: 801,
      paymentId: 9801,
      classId,
      className: 'Full Body Strength 101',
      amount: 315000,
      paymentMethod: payMethod,
      paymentStatus: payMethod === 'online_wallet' ? 'pending' : 'pending',
      paymentUrl: null,
      holdUntil: null,
    });
  }
  if (method === 'GET' && p === '/wallet/my') {
    return apiOk({
      balance: 2000000,
      updatedAt: `${TODAY}T08:00:00+07:00`,
      transactions: [],
    });
  }
  if (method === 'POST' && p === '/wallet/pay') {
    return apiOk({
      balance: 1685000,
      updatedAt: `${TODAY}T10:01:00+07:00`,
      transactions: [],
    });
  }
  if (method === 'POST' && p === '/payments/vnpay/release-abandoned') {
    return apiOk(null);
  }

  // PT 1:1 bookings & attendance
  if (method === 'GET' && p === '/coach-bookings/coaches') {
    return apiOk([
      {
        id: 20,
        fullName: 'HLV Minh Khôi',
        email: 'coach.gym@sol.vn',
        phone: '0901000020',
        specialization: 'Gym - Sức mạnh',
        bio: '8 năm kinh nghiệm huấn luyện cá nhân.',
        certification: 'NASM-CPT',
        avatarUrl: null,
        defaultHourlyRate: 200000,
      },
    ]);
  }
  if (method === 'GET' && p === '/coach-bookings/available-slots') {
    return apiOk(
      FIVE_SLOTS.map((s) => ({
        slotNumber: s.slotNumber,
        startTime: s.startTime,
        endTime: s.endTime,
        available: s.slotNumber >= 4,
        reason: s.slotNumber < 4 ? 'too_soon' : null,
      })),
    );
  }
  if (method === 'GET' && p === '/coach-bookings/my') {
    return apiOk([]);
  }
  if (method === 'GET' && p === '/coach-bookings/quota-status') {
    return apiOk({
      packageName: 'Gold Monthly',
      monthlyQuota: 3,
      usedThisMonth: 1,
      remainingQuota: 2,
    });
  }
  if (method === 'GET' && p === '/coach-bookings/coach-schedule') {
    return apiOk([]);
  }
  if (method === 'GET' && p === '/coach-bookings/attendance') {
    return apiOk([
      {
        id: 701,
        memberId: 501,
        memberName: 'Nguyễn Minh Quân',
        coachId: 20,
        coachName: 'HLV Minh Khôi',
        coachSpecialization: 'Gym - Sức mạnh',
        coachAvatarUrl: null,
        disciplineId: 1,
        disciplineName: 'Gym',
        bookingDate: TODAY,
        startTime: '07:00:00',
        endTime: '09:30:00',
        hourlyRate: 200000,
        paymentMethod: 'package_quota',
        paymentStatus: 'paid',
        status: 'confirmed',
        notes: null,
        createdAt: `${addIsoDays(TODAY, -1)}T09:00:00+07:00`,
        cancelledAt: null,
        cancelReason: null,
        attendedAt: null,
        membershipCode: 'SOL-0501',
        memberPhone: '0909123456',
        memberEmail: 'quan@sol.vn',
      },
    ]);
  }

  // Coaching members & training plans
  if (method === 'GET' && p === '/coaching/members') {
    return apiOk([
      {
        id: 501,
        memberCode: 'SOL-0501',
        fullName: 'Nguyễn Minh Quân',
        email: 'quan@sol.vn',
        phone: '0909123456',
        fitnessGoal: 'Tăng cơ lưng & vai',
        healthNotes: 'Lưu ý khởi động khớp vai kỹ',
        fitnessLevel: 'intermediate',
        canViewWorkoutPlan: true,
      },
    ]);
  }
  if (method === 'GET' && p === '/coaching/training-plans') {
    return apiOk([]);
  }

  // Reception desk queues
  if (method === 'GET' && p === '/memberships/subscriptions/pending') {
    return apiOk([]);
  }
  if (method === 'GET' && p === '/memberships/subscriptions/holds/pending') {
    return apiOk([]);
  }
  if (method === 'GET' && p === '/coach-bookings/unpaid') {
    return apiOk([]);
  }
  if (method === 'GET' && p === '/reception/trials') {
    return apiOk([]);
  }
  if (method === 'GET' && p === '/classes/enrollments/unpaid') {
    return apiOk(state.stateful.unpaidCourses);
  }
  if (method === 'POST' && /^\/classes\/enrollments\/(\d+)\/confirm-payment$/.test(p)) {
    const enrollId = Number(p.split('/')[3]);
    state.stateful.unpaidCourses = state.stateful.unpaidCourses.filter((x) => x.enrollmentId !== enrollId);
    return apiOk({
      id: 9601,
      memberId: 501,
      amount: 350000,
      method: req.body?.method || 'cash',
      status: 'success',
      invoiceNumber: 'INV-COURSE-601',
      createdAt: `${TODAY}T10:15:00+07:00`,
    });
  }

  // Admin audit logs
  if (method === 'GET' && p === '/admin/audit-logs') {
    return apiOk({
      content: [
        {
          id: 5001,
          userId: 1,
          userFullName: 'Quản trị hệ thống',
          userEmail: 'admin@sol.vn',
          action: 'CLASS_CREATE_RECURRING',
          entityType: 'classes',
          entityId: 101,
          oldValue: null,
          newValue: { name: 'Full Body Strength 101', capacity: 20 },
          ipAddress: '127.0.0.1',
          createdAt: `${TODAY}T08:30:00+07:00`,
        },
        {
          id: 5002,
          userId: 3,
          userFullName: 'Lễ tân Quầy 1',
          userEmail: 'reception@sol.vn',
          action: 'COUNTER_PAYMENT',
          entityType: 'payments',
          entityId: 9601,
          oldValue: { status: 'pending' },
          newValue: { status: 'success', amount: 350000 },
          ipAddress: '127.0.0.1',
          createdAt: `${TODAY}T09:05:00+07:00`,
        },
      ],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 8,
    });
  }
  if (method === 'GET' && p === '/reports/class-utilization') {
    return apiOk([]);
  }

  return null;
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert.ok(
    metrics.scrollWidth <= metrics.innerWidth + 1,
    `[${label}] Horizontal overflow detected: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`,
  );
  return metrics;
}

function assertCleanTelemetry(state, label) {
  assert.deepEqual(state.unhandledRequests, [], `[${label}] Unhandled API requests: ${JSON.stringify(state.unhandledRequests)}`);
  assert.deepEqual(state.badHttpResponses, [], `[${label}] Unexpected 4xx/5xx responses: ${JSON.stringify(state.badHttpResponses)}`);
  assert.deepEqual(state.consoleErrors, [], `[${label}] Console errors: ${JSON.stringify(state.consoleErrors)}`);
  assert.deepEqual(state.pageErrors, [], `[${label}] Page errors: ${JSON.stringify(state.pageErrors)}`);
}

const results = [];

async function runScenario(id, name, fn) {
  const started = Date.now();
  try {
    const details = await fn();
    const ms = Date.now() - started;
    results.push({ id, name, status: 'PASS', ms, details });
    console.log(`PASS [${id}] ${name} (${ms}ms) — ${details}`);
  } catch (err) {
    const ms = Date.now() - started;
    results.push({ id, name, status: 'FAIL', ms, error: err?.stack || String(err) });
    console.error(`FAIL [${id}] ${name} (${ms}ms)\n${err?.stack || err}`);
  }
}

async function main() {
  const { server, baseUrl } = await startDistServer();
  const chromeFallback = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  let browser;
  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({
        headless: true,
        executablePath: fs.existsSync(chromeFallback) ? chromeFallback : undefined,
      });
    }

    // =========================================================================
    // S1 — Public Landing, 3 Active Sports, 5-Slot Widget & Retired Redirects
    // =========================================================================
    await runScenario('S1', 'Public Landing, 3 Active Sports, 5-Slot Widget & Retired Sport Redirects', async () => {
      // Desktop Light + Dark, Mobile Dark + Light
      for (const [theme, vp] of [
        ['light', { width: 1440, height: 900 }],
        ['dark', { width: 1440, height: 900 }],
        ['light', { width: 390, height: 844 }],
        ['dark', { width: 390, height: 844 }],
      ]) {
        const { context, page, state } = await createTrackedSession(browser, { baseUrl, viewport: vp, theme });
        try {
          await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
          await page.locator('#hero-title').waitFor({ state: 'visible' });

          const bodyText = await page.locator('body').innerText();
          // 5-slot widget presence
          const slotWidgetText = await page.locator('.fit-preview-slots').innerText();
          assert.ok(slotWidgetText.includes('07:00') && slotWidgetText.includes('09:30'), 'Slot 1 (07:00-09:30) missing in 5-slot widget');
          assert.ok(slotWidgetText.includes('18:00') && slotWidgetText.includes('20:30'), 'Slot 5 (18:00-20:30) missing in 5-slot widget');
          // Old misleading copy is gone
          assert.ok(!bodyText.includes('đặt PT và chọn gói'), 'Misleading legacy copy "đặt PT và chọn gói" still present!');

          // Dark mode .fit-round-arrow computed color check
          if (theme === 'dark') {
            const arrowColors = await page.evaluate(() => {
              const arrows = [...document.querySelectorAll('.fit-round-arrow')].filter(
                (el) => !el.closest('.fit-plan-featured'),
              );
              return arrows.map((el) => getComputedStyle(el).color);
            });
            assert.ok(arrowColors.length > 0, 'Expected non-featured .fit-round-arrow elements on Landing');
            for (const c of arrowColors) {
              assert.equal(c, 'rgb(32, 32, 32)', `Dark mode .fit-round-arrow color should be rgb(32, 32, 32), got ${c}`);
            }
          }

          await assertNoHorizontalOverflow(page, `S1 / ${theme} ${vp.width}x${vp.height}`);
          assertCleanTelemetry(state, `S1 / ${theme} ${vp.width}x${vp.height}`);
        } finally {
          await context.close();
        }
      }

      // Retired sport redirects + active sport pages (/boxing, /yoga)
      const { context, page, state } = await createTrackedSession(browser, { baseUrl, viewport: { width: 1440, height: 900 }, theme: 'dark' });
      try {
        for (const retiredPath of ['/sports/tennis', '/sports/swimming', '/sports/badminton']) {
          await page.goto(`${baseUrl}${retiredPath}`, { waitUntil: 'networkidle' });
          await page.waitForURL((u) => u.pathname === '/', { timeout: 5000 });
          const h1Text = await page.locator('h1').first().innerText();
          assert.ok(!/Boxing/i.test(h1Text), `${retiredPath} must not render Boxing heading, got "${h1Text}"`);
        }

        await page.goto(`${baseUrl}/boxing`, { waitUntil: 'networkidle' });
        const boxingTitle = await page.locator('#sport-page-title').innerText();
        assert.ok(/Boxing/i.test(boxingTitle), `Expected Boxing heading on /boxing, got "${boxingTitle}"`);
        await assertNoHorizontalOverflow(page, 'S1 /boxing');

        await page.goto(`${baseUrl}/yoga`, { waitUntil: 'networkidle' });
        const yogaTitle = await page.locator('#sport-page-title').innerText();
        assert.ok(/Yoga/i.test(yogaTitle), `Expected Yoga heading on /yoga, got "${yogaTitle}"`);
        await assertNoHorizontalOverflow(page, 'S1 /yoga');

        assertCleanTelemetry(state, 'S1 sport pages & redirects');
      } finally {
        await context.close();
      }
      return 'Light+Dark x Desktop+Mobile 0 overflow, 5-slot widget verified, dark .fit-round-arrow=rgb(32, 32, 32), retired sports redirect to /, /boxing & /yoga render cleanly';
    });

    // =========================================================================
    // S2 — Login Security & ?expired=1 Resilience
    // =========================================================================
    await runScenario('S2', 'Login Security & ?expired=1 Resilience', async () => {
      const { context, page, state } = await createTrackedSession(browser, {
        baseUrl,
        viewport: { width: 1440, height: 900 },
        theme: 'light',
        auth: {
          user: { id: '501', name: 'Stale Member', identifier: 'stale_member', role: 'MEMBER' },
          token: 'stale-expired-jwt',
        },
        extraStorage: {
          scms_auth: JSON.stringify({ id: '501', role: 'MEMBER', token: 'stale-scms-auth' }),
        },
      });
      try {
        await page.goto(
          `${baseUrl}/login?expired=1&google_oauth=error&error=FAKE_INJECTED_TEXT&debug_otp=999999`,
          { waitUntil: 'networkidle' },
        );
        await page.locator('#login-identifier').waitFor({ state: 'visible' });

        const bodyText = await page.locator('body').innerText();
        assert.ok(!bodyText.includes('FAKE_INJECTED_TEXT'), 'Arbitrary ?error= text must NOT be reflected in DOM');
        assert.ok(!bodyText.includes('999999'), 'debug_otp query parameter must NOT appear in DOM');

        const inputValues = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.value));
        for (const val of inputValues) {
          assert.ok(!val.includes('999999'), `debug_otp 999999 must NOT be auto-filled into input, got "${val}"`);
        }

        // Verify stale real session was cleared on ?expired=1
        const storedSession = await page.evaluate(() => localStorage.getItem('fitcenter_auth_session'));
        assert.equal(storedSession, null, 'Stale fitcenter_auth_session should be cleared on ?expired=1');

        // Type into username & password and assert login form stays visible and does NOT disappear on first keystroke
        await page.locator('#login-identifier').type('member_e2e');
        assert.ok(await page.locator('#login-identifier').isVisible(), 'Username input disappeared after first keystroke!');
        await page.locator('#login-password').type('SecretPass123!');
        assert.ok(await page.locator('#login-password').isVisible(), 'Password input disappeared after typing!');
        assert.equal(await page.locator('#login-identifier').inputValue(), 'member_e2e');
        assert.equal(await page.locator('#login-password').inputValue(), 'SecretPass123!');

        assertCleanTelemetry(state, 'S2 /login');
      } finally {
        await context.close();
      }
      return 'FAKE_INJECTED_TEXT blocked, debug_otp 999999 ignored, stale session cleared, form stays mounted during typing';
    });

    // =========================================================================
    // S3 — Manager 4-Step Class Creation Wizard (P0-01)
    // =========================================================================
    await runScenario('S3', 'Manager 4-Step Class Creation Wizard (P0-01)', async () => {
      const { context, page, state } = await createTrackedSession(browser, {
        baseUrl,
        viewport: { width: 1440, height: 900 },
        theme: 'dark',
        auth: {
          user: { id: '2', name: 'Quản lý Trung tâm', identifier: 'manager_sol', role: 'MANAGER' },
        },
      });
      try {
        await page.goto(`${baseUrl}/manager/classes`, { waitUntil: 'networkidle' });
        await page.locator('[data-testid="create-class-btn"]').waitFor({ state: 'visible' });
        await assertNoHorizontalOverflow(page, 'S3 /manager/classes desktop dark');

        // Open "+ Tạo lớp học" wizard
        await page.locator('[data-testid="create-class-btn"]').click();
        await page.locator('[data-testid="wizard-step-1"]').waitFor({ state: 'visible' });

        // Step 1: Course name + price (discipline pre-selected)
        await page.locator('#cls-name').fill('Yoga Phục Hồi Sáng E2E');
        await page.locator('#cls-price').fill('250000');

        // Advance to Step 2 and wait for POST /api/v1/classes/recurring/availability
        const availPromise = page.waitForResponse(
          (res) => res.url().includes('/api/v1/classes/recurring/availability') && res.request().method() === 'POST',
        );
        await page.locator('[data-testid="wizard-next-btn"]').click();
        await page.locator('[data-testid="wizard-step-2"]').waitFor({ state: 'visible' });
        await availPromise;

        // Ensure Slot 1 is selected & availability summary is ok
        const slot1Btn = page.locator('[data-testid="slot-option-1"]');
        if ((await slot1Btn.getAttribute('aria-pressed')) !== 'true') {
          const slotAvailPromise = page.waitForResponse(
            (res) => res.url().includes('/api/v1/classes/recurring/availability') && res.request().method() === 'POST',
          );
          await slot1Btn.click();
          await slotAvailPromise;
        }
        await page.locator('[data-testid="wizard-schedule-summary"].is-ok').waitFor({ state: 'visible' });

        // Advance to Step 3: Room, Capacity, Coach
        await page.locator('[data-testid="wizard-next-btn"]').click();
        await page.locator('[data-testid="wizard-step-3"]').waitFor({ state: 'visible' });

        await page.locator('[data-testid="wizard-room-10"]').click();
        await page.locator('#cls-capacity').fill('15');
        await page.locator('[data-testid="wizard-coach-20"]').click();

        // Click "Tiếp tục" (wizard-next-btn) -> MUST go to Step 4 Review and NOT submit yet!
        await page.locator('[data-testid="wizard-next-btn"]').click();
        await page.locator('[data-testid="wizard-step-4"]').waitFor({ state: 'visible' });

        // CRITICAL P0-01 ASSERTION: POST /classes/recurring call count MUST STILL BE 0!
        const createCallsBeforeConfirm = state.requests.filter(
          (r) => r.method === 'POST' && r.path === '/classes/recurring',
        );
        assert.equal(
          createCallsBeforeConfirm.length,
          0,
          `P0-01 REGRESSION: POST /api/v1/classes/recurring was prematurely called ${createCallsBeforeConfirm.length} time(s) on Step 3 Next!`,
        );

        const step4Text = await page.locator('[data-testid="wizard-step-4"]').innerText();
        assert.ok(step4Text.includes('Yoga Phục Hồi Sáng E2E'), 'Step 4 review missing course name');
        assert.ok(step4Text.includes('Phòng Gym Tiêu chuẩn'), 'Step 4 review missing room name');
        assert.ok(step4Text.includes('HLV Minh Khôi'), 'Step 4 review missing coach name');

        // Confirm on Step 4 -> POST /api/v1/classes/recurring called EXACTLY ONCE and modal closes cleanly
        const createResPromise = page.waitForResponse(
          (res) => res.url().endsWith('/api/v1/classes/recurring') && res.request().method() === 'POST',
        );
        await page.locator('[data-testid="wizard-submit-btn"]').click();
        await createResPromise;
        await page.locator('[data-testid="wizard-step-4"]').waitFor({ state: 'detached' });

        const createCallsAfterConfirm = state.requests.filter(
          (r) => r.method === 'POST' && r.path === '/classes/recurring',
        );
        assert.equal(createCallsAfterConfirm.length, 1, `Expected exactly 1 POST /classes/recurring call, got ${createCallsAfterConfirm.length}`);
        assert.equal(createCallsAfterConfirm[0].body.name, 'Yoga Phục Hồi Sáng E2E');
        assert.equal(createCallsAfterConfirm[0].body.capacity, 15);
        assert.equal(createCallsAfterConfirm[0].body.price, 250000);
        assert.equal(createCallsAfterConfirm[0].body.roomId, 10);
        assert.equal(createCallsAfterConfirm[0].body.coachId, 20);

        assertCleanTelemetry(state, 'S3 /manager/classes');
      } finally {
        await context.close();
      }
      return 'Step 3 Next -> Step 4 Review with 0 premature POSTs; Step 4 Submit -> exactly 1 POST /classes/recurring and clean modal close';
    });

    // =========================================================================
    // S4 — Member Portal, Retired Redirects, 5-Slot Group Classes & PT 1:1
    // =========================================================================
    await runScenario('S4', 'Member Portal, Retired Redirects, 5-Slot Group Classes & PT 1:1', async () => {
      const { context, page, state } = await createTrackedSession(browser, {
        baseUrl,
        viewport: { width: 1440, height: 900 },
        theme: 'light',
        auth: {
          user: { id: '501', name: 'Nguyễn Minh Quân', identifier: 'member_quan', role: 'MEMBER' },
        },
      });
      try {
        // Retired member routes redirect to /member/dashboard
        for (const retiredRoute of ['/member/orders', '/member/streak', '/member/explore']) {
          await page.goto(`${baseUrl}${retiredRoute}`, { waitUntil: 'networkidle' });
          await page.waitForURL((u) => u.pathname === '/member/dashboard', { timeout: 5000 });
        }

        // Visit /member/classes -> Group Classes tab
        await page.goto(`${baseUrl}/member/classes?tab=classes`, { waitUntil: 'networkidle' });
        await page.locator('[data-testid="member-class-card-101"]').waitFor({ state: 'visible' });
        await assertNoHorizontalOverflow(page, 'S4 /member/classes group classes');

        // Verify group class cards have NO border-left-width: 4px
        const cardBorderLefts = await page.evaluate(() =>
          [...document.querySelectorAll('[data-testid^="member-class-card-"]')].map(
            (el) => getComputedStyle(el).borderLeftWidth,
          ),
        );
        assert.ok(cardBorderLefts.length >= 1, 'Expected at least 1 group class card');
        for (const blw of cardBorderLefts) {
          assert.notEqual(blw, '4px', `Group class card must NOT have 4px left border accent, got ${blw}`);
        }

        // Paid group course checkout with online_wallet (quota remainingCredits=0)
        await page.locator('[data-testid="member-class-card-101"] button:has-text("Đăng ký khóa học")').click();
        await page.locator('dialog[open]').waitFor({ state: 'visible' });
        const walletRadio = page.locator('dialog[open] [role="radio"]:has-text("Ví điện tử SÖL")');
        assert.equal(await walletRadio.getAttribute('aria-checked'), 'true', 'online_wallet should be selected');

        const checkoutPromise = page.waitForResponse(
          (res) => res.url().includes('/api/v1/classes/101/checkout') && res.request().method() === 'POST',
        );
        const walletPayPromise = page.waitForResponse(
          (res) => res.url().includes('/api/v1/wallet/pay') && res.request().method() === 'POST',
        );
        await page.locator('dialog[open] button:has-text("Xác nhận đăng ký")').click();
        await checkoutPromise;
        await walletPayPromise;
        await page.locator('dialog[open]').waitFor({ state: 'detached' });

        const checkoutReq = state.requests.find((r) => r.method === 'POST' && r.path === '/classes/101/checkout');
        assert.ok(checkoutReq, 'Expected POST /api/v1/classes/101/checkout');
        assert.equal(
          checkoutReq.body?.method ?? checkoutReq.body?.paymentMethod,
          'online_wallet',
          `Expected online_wallet in checkout payload, got ${JSON.stringify(checkoutReq.body)}`,
        );

        // Switch to PT 1:1 tab
        await page.locator('#member-classes-tab-pt').click();
        await page.locator('#member-classes-panel-pt').waitFor({ state: 'visible' });
        // Wait for coach & slots to finish rendering
        await page.waitForFunction(() => document.querySelector('#member-classes-panel-pt')?.innerText.includes('/ slot'));

        const ptPanelText = await page.locator('#member-classes-panel-pt').innerText();
        assert.ok(ptPanelText.includes('/ slot'), 'PT 1:1 tab must render "/ slot" pricing');
        const perHourMatches = ptPanelText.match(/\/\s*giờ/gi) || [];
        assert.equal(perHourMatches.length, 0, `PT 1:1 tab must have 0 "/ giờ" occurrences, found: ${perHourMatches.length}`);

        const nativeDateInputCount = await page.locator('input[type="date"]').count();
        assert.equal(nativeDateInputCount, 0, `Expected 0 native <input type="date"> on PT 1:1 tab, found ${nativeDateInputCount}`);

        assertCleanTelemetry(state, 'S4 /member/classes');
      } finally {
        await context.close();
      }
      return '/member/orders, /streak, /explore -> /member/dashboard; cards have no 4px left border; online_wallet checkout + /wallet/pay succeeded; PT tab uses "/ slot", 0 "/ giờ", 0 native date inputs';
    });

    // =========================================================================
    // S5 — Coach Portal (P0-06, P1-FE-46, P1-FE-48, P1-FE-52)
    // =========================================================================
    await runScenario('S5', 'Coach Portal (/coach/classes, /pt-attendance, /training-plans)', async () => {
      const { context, page, state } = await createTrackedSession(browser, {
        baseUrl,
        viewport: { width: 1440, height: 900 },
        theme: 'dark',
        auth: {
          user: { id: 'coach_gym', name: 'HLV Minh Khôi', identifier: 'coach_gym', role: 'COACH' },
        },
      });
      try {
        // 1. /coach/classes
        await page.goto(`${baseUrl}/coach/classes`, { waitUntil: 'networkidle' });
        await page.locator('text=Full Body Strength 101').first().waitFor({ state: 'visible' });

        const sessionReqs = state.requests.filter((r) => r.method === 'GET' && r.path === '/classes/sessions');
        assert.ok(sessionReqs.length >= 1, 'Expected GET /api/v1/classes/sessions on /coach/classes');
        for (const r of sessionReqs) {
          assert.ok(
            !r.search.includes('coachId=coach_gym'),
            `P0-06 REGRESSION: GET /classes/sessions sent non-numeric coachId=coach_gym (${r.fullUrl})`,
          );
        }

        // 2. /coach/pt-attendance -> "Đang diễn ra" (IN_PROGRESS) tab exists
        await page.goto(`${baseUrl}/coach/pt-attendance`, { waitUntil: 'networkidle' });
        const inProgressTab = page.locator('[role="tab"]:has-text("Đang diễn ra")');
        await inProgressTab.waitFor({ state: 'visible' });
        await inProgressTab.click();
        assert.equal(await inProgressTab.getAttribute('aria-selected'), 'true', 'IN_PROGRESS filter tab should be selectable');

        // 3. /coach/training-plans -> 0 pre-filled sample exercises + AI modal has no BMI/height/weight
        await page.goto(`${baseUrl}/coach/training-plans`, { waitUntil: 'networkidle' });
        await page.locator('button:has-text("Gợi ý giáo án bằng AI")').waitFor({ state: 'visible' });

        // Switch to Step 2 ("Bài tập theo ngày") to confirm 0 pre-filled exercises & no "Assisted Pull-up"
        await page.locator('.plan-step__button:has-text("Bài tập theo ngày")').click();
        await page.locator('text=Chưa có bài tập nào cho ngày này').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.exercise-item-card').count(), 0, 'New training plan must start with 0 pre-filled exercises');
        const planBodyText = await page.locator('.plan-editor-page').innerText();
        assert.ok(!planBodyText.includes('Assisted Pull-up'), 'Pre-filled sample exercise "Assisted Pull-up" must NOT exist!');

        // Open AI assistant modal -> verify NO BMI / Chiều cao / Cân nặng
        await page.locator('button:has-text("Gợi ý giáo án bằng AI")').click();
        const aiDialog = page.locator('dialog[open]');
        await aiDialog.waitFor({ state: 'visible' });
        const aiModalText = await aiDialog.innerText();
        assert.ok(!/\bBMI\b/i.test(aiModalText), `AI modal must NOT show retired BMI metric: "${aiModalText}"`);
        assert.ok(!aiModalText.includes('Chiều cao'), 'AI modal must NOT show retired "Chiều cao" field');
        assert.ok(!aiModalText.includes('Cân nặng'), 'AI modal must NOT show retired "Cân nặng" field');

        assertCleanTelemetry(state, 'S5 Coach portal');
      } finally {
        await context.close();
      }
      return '/coach/classes omits coachId=coach_gym & renders group session; /pt-attendance has "Đang diễn ra" tab; /training-plans starts empty (no Assisted Pull-up) & AI modal has no BMI/Chiều cao/Cân nặng';
    });

    // =========================================================================
    // S6 — Reception Desk Unpaid Courses Queue & Confirmations (P0-03, P1-FE-56)
    // =========================================================================
    await runScenario('S6', 'Reception Desk Unpaid Courses Queue & Confirmations', async () => {
      const { context, page, state } = await createTrackedSession(browser, {
        baseUrl,
        viewport: { width: 1440, height: 900 },
        theme: 'light',
        auth: {
          user: { id: '3', name: 'Lễ tân Quầy 1', identifier: 'reception_01', role: 'STAFF' },
        },
      });
      try {
        await page.goto(`${baseUrl}/staff/reception`, { waitUntil: 'networkidle' });
        await page.locator('[data-testid="unpaid-course-601"]').waitFor({ state: 'visible' });
        await assertNoHorizontalOverflow(page, 'S6 /staff/reception desktop light');

        // Confirm "Khóa học" filter pill is visible
        const courseTab = page.locator('button:has-text("Khóa học")').first();
        await courseTab.waitFor({ state: 'visible' });

        // Click cash confirm -> alertdialog MUST open BEFORE calling confirm-payment API
        await page.locator('[data-testid="confirm-course-cash-601"]').click();
        const confirmDlg = page.locator('dialog[open][role="alertdialog"]');
        await confirmDlg.waitFor({ state: 'visible' });

        const callsBeforeConfirm = state.requests.filter(
          (r) => r.method === 'POST' && r.path === '/classes/enrollments/601/confirm-payment',
        );
        assert.equal(callsBeforeConfirm.length, 0, 'confirm-payment must NOT fire before user confirms alertdialog');

        // Confirm inside alertdialog -> triggers POST /classes/enrollments/601/confirm-payment cleanly
        const confirmPromise = page.waitForResponse(
          (res) => res.url().includes('/api/v1/classes/enrollments/601/confirm-payment') && res.request().method() === 'POST',
        );
        await confirmDlg.locator('button:has-text("Xác nhận đã thu")').click();
        await confirmPromise;
        await confirmDlg.waitFor({ state: 'detached' });

        const callsAfterConfirm = state.requests.filter(
          (r) => r.method === 'POST' && r.path === '/classes/enrollments/601/confirm-payment',
        );
        assert.equal(callsAfterConfirm.length, 1, 'Expected exactly 1 confirm-payment POST after confirming dialog');
        assert.equal(callsAfterConfirm[0].body?.method, 'cash', 'Expected method=cash in confirm-payment request');

        assertCleanTelemetry(state, 'S6 /staff/reception');
      } finally {
        await context.close();
      }
      return 'Unpaid course #601 rendered, alertdialog gated API call (0 calls before confirm -> 1 POST with method=cash after confirm)';
    });

    // =========================================================================
    // S7 — Admin Audit Logs Mobile Scroll & Retired Shop Cleanup
    // =========================================================================
    await runScenario('S7', 'Admin Audit Logs Mobile Scroll & Retired Shop Cleanup', async () => {
      const retiredShopValues = ['products', 'product_orders', 'COMPLETE_ORDER', 'CANCEL_ORDER'];

      for (const [theme, vp] of [
        ['light', { width: 1440, height: 900 }],
        ['dark', { width: 390, height: 844 }],
        ['light', { width: 390, height: 844 }],
      ]) {
        const { context, page, state } = await createTrackedSession(browser, {
          baseUrl,
          viewport: vp,
          theme,
          auth: {
            user: { id: '1', name: 'Quản trị hệ thống', identifier: 'admin_sol', role: 'ADMIN' },
          },
        });
        try {
          await page.goto(`${baseUrl}/admin/audit-logs`, { waitUntil: 'networkidle' });
          await page.locator('.portal-table-wrapper table.audit-table').waitFor({ state: 'visible' });

          // Assert .portal-table-wrapper wraps audit table
          const wrappedTableCount = await page.locator('.portal-table-wrapper table.audit-table').count();
          assert.equal(wrappedTableCount, 1, 'Audit table must be wrapped inside .portal-table-wrapper');

          // Assert 0 horizontal page overflow on both 1440x900 and 390x844
          await assertNoHorizontalOverflow(page, `S7 /admin/audit-logs ${theme} ${vp.width}x${vp.height}`);

          // Assert DatePicker from/to controls exist and no native <input type="date">
          await page.locator('#audit-from-date').waitFor({ state: 'visible' });
          await page.locator('#audit-to-date').waitFor({ state: 'visible' });
          assert.equal(await page.locator('input[type="date"]').count(), 0, 'Audit logs should use custom DatePicker, not native date input');

          // Inspect ALL option values in action & entity selects -> retired Shop values must NOT exist
          const allOptionValues = await page.evaluate(() =>
            [...document.querySelectorAll('select.ui-select__native option')].map((o) => o.value),
          );
          assert.ok(allOptionValues.includes('CLASS_CREATE_RECURRING'), 'Expected active action option CLASS_CREATE_RECURRING');
          assert.ok(allOptionValues.includes('classes'), 'Expected active entity option classes');
          for (const retired of retiredShopValues) {
            assert.ok(
              !allOptionValues.includes(retired),
              `Retired Shop filter value "${retired}" must NOT be present in audit dropdown options`,
            );
          }

          assertCleanTelemetry(state, `S7 ${theme} ${vp.width}x${vp.height}`);
        } finally {
          await context.close();
        }
      }
      return '.portal-table-wrapper wraps audit table; 0 overflow at 1440x900 & 390x844 (Light+Dark); custom from/to DatePickers present; 0 retired Shop dropdown values';
    });

    // =========================================================================
    // S8 — Chat Widget Session Isolation & Escape inside Modal (P0-07, P1-FE-62)
    // =========================================================================
    await runScenario('S8', 'Chat Widget Session Isolation & Escape inside Modal', async () => {
      // Part A: On /staff/reception, Escape while a <dialog open> is present must NOT hide chat widget
      const { context: staffCtx, page: staffPage, state: staffState } = await createTrackedSession(browser, {
        baseUrl,
        viewport: { width: 1440, height: 900 },
        theme: 'dark',
        auth: {
          user: { id: '3', name: 'Lễ tân Quầy 1', identifier: 'reception_01', role: 'STAFF' },
        },
      });
      try {
        await staffPage.goto(`${baseUrl}/staff/reception`, { waitUntil: 'networkidle' });
        await staffPage.locator('.chat-widget__trigger').waitFor({ state: 'visible' });

        // Open chat widget
        await staffPage.locator('.chat-widget__trigger').click();
        const chatPanel = staffPage.locator('#sol-direct-chat');
        await chatPanel.waitFor({ state: 'visible' });
        await staffPage.locator('#sol-direct-chat :text("Nguyễn Minh Quân")').first().waitFor({ state: 'visible' });

        // Simulate a real open native <dialog open> modal (matching Modal.tsx's showModal() behavior)
        await staffPage.evaluate(() => {
          const dlg = document.createElement('dialog');
          dlg.id = 'e2e-blocking-dialog';
          dlg.setAttribute('aria-label', 'E2E Modal');
          dlg.textContent = 'Blocking modal';
          document.body.appendChild(dlg);
          dlg.showModal();
          dlg.addEventListener('cancel', (ev) => {
            ev.preventDefault();
          });
        });

        // Press Escape while <dialog open> is open -> chat panel MUST stay visible (NOT hidden)
        await staffPage.keyboard.press('Escape');
        const hiddenWhileDialogOpen = await chatPanel.evaluate((el) => el.hidden);
        assert.equal(
          hiddenWhileDialogOpen,
          false,
          'P1-FE-62 REGRESSION: Escape hid ChatWidget panel while a <dialog open> modal was open!',
        );

        // Close/remove the blocking <dialog open>, then press Escape -> chat panel closes cleanly
        await staffPage.evaluate(() => {
          const dlg = document.getElementById('e2e-blocking-dialog');
          if (dlg) {
            if (dlg.open) dlg.close();
            dlg.remove();
          }
        });
        await staffPage.keyboard.press('Escape');
        const hiddenAfterDialogClosed = await chatPanel.evaluate((el) => el.hidden);
        assert.equal(hiddenAfterDialogClosed, true, 'ChatWidget should close on Escape when no <dialog open> is present');

        // Reopen chat, load staff conversation, then clear auth session -> signed-in chat unmounts cleanly
        await staffPage.locator('.chat-widget__trigger').click();
        await chatPanel.waitFor({ state: 'visible' });
        await staffPage.locator('#sol-direct-chat button:has-text("Nguyễn Minh Quân")').click();
        await staffPage.locator('#sol-direct-chat .direct-chat__bubble:has-text("Tin riêng nội bộ lễ tân E2E")').waitFor({ state: 'visible' });

        // Clear auth session (cross-tab storage event simulation -> triggers useCurrentUser() update)
        await staffPage.evaluate(() => {
          localStorage.removeItem('fitcenter_auth_session');
          localStorage.removeItem('fitcenter_token');
          window.dispatchEvent(new StorageEvent('storage', { key: 'fitcenter_auth_session', newValue: null }));
        });
        // RoleGuard redirects away from /staff/reception to /login and signed-in chat is unmounted
        await staffPage.waitForURL((u) => u.pathname === '/login', { timeout: 5000 });
        assert.equal(await staffPage.locator('#sol-direct-chat').count(), 0, 'Signed-in chat must unmount after clearing auth session');

        assertCleanTelemetry(staffState, 'S8 /staff/reception');
      } finally {
        await staffCtx.close();
      }

      // Part B: On public `/` where ChatWidget remains mounted as anonymous, clearing auth session
      // immediately unmounts SignedInChatWidget & wipes messages without leaving stale threads
      const { context: pubCtx, page: pubPage, state: pubState } = await createTrackedSession(browser, {
        baseUrl,
        viewport: { width: 1440, height: 900 },
        theme: 'light',
        auth: {
          user: { id: '3', name: 'Lễ tân Quầy 1', identifier: 'reception_01', role: 'STAFF' },
        },
      });
      try {
        await pubPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await pubPage.locator('.chat-widget__trigger').click();
        await pubPage.locator('#sol-direct-chat button:has-text("Nguyễn Minh Quân")').click();
        await pubPage.locator('#sol-direct-chat .direct-chat__bubble:has-text("Tin riêng nội bộ lễ tân E2E")').waitFor({ state: 'visible' });

        await pubPage.evaluate(() => {
          localStorage.removeItem('fitcenter_auth_session');
          localStorage.removeItem('fitcenter_token');
          window.dispatchEvent(new StorageEvent('storage', { key: 'fitcenter_auth_session', newValue: null }));
        });

        // Signed-in panel & unread badge unmount immediately
        await pubPage.locator('#sol-direct-chat').waitFor({ state: 'detached' });
        assert.equal(await pubPage.locator('.chat-widget__badge').count(), 0, 'Unread badge must clear on session removal');
        const bodyText = await pubPage.locator('body').innerText();
        assert.ok(!bodyText.includes('Tin riêng nội bộ lễ tân E2E'), 'Private staff chat text leaked after session clear!');

        // Reopening widget as guest shows login prompt instead of STAFF chat
        await pubPage.locator('.chat-widget__trigger').click();
        await pubPage.locator('#sol-direct-chat a[href="/login"]').waitFor({ state: 'visible' });

        assertCleanTelemetry(pubState, 'S8 / public chat session isolation');
      } finally {
        await pubCtx.close();
      }

      return 'Escape with <dialog open> preserves chat panel; Escape without dialog closes panel; clearing auth session immediately unmounts signed-in chat & wipes messages on both /staff/reception and /';
    });
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  console.log('\n================ E2E REMEDIATION VERIFICATION SUMMARY ================');
  let passed = 0;
  for (const r of results) {
    if (r.status === 'PASS') passed += 1;
    console.log(`${r.status.padEnd(4)} | ${r.id} | ${r.name} (${r.ms}ms)`);
  }
  console.log(`TOTAL: ${passed}/${results.length} PASSED`);
  console.log('======================================================================\n');

  if (passed !== results.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal E2E runner error:', err);
  process.exitCode = 1;
});
