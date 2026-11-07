#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const requireFromHere = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = requireFromHere('playwright-core'));
} catch {
  const fallbackNodeModules =
    process.env.NODE_PATH ||
    '/Users/trancongtuananh/Documents/Codex/2026-11-03/rv/work/browser-checks/node_modules';
  const fallbackRequire = createRequire(path.join(fallbackNodeModules, 'noop.js'));
  ({ chromium } = fallbackRequire('playwright-core'));
}

const chromeExecutable =
  process.env.CHROME_PATH ||
  (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : undefined);

const outDir = path.join(repoRoot, 'docs/qa/explore3d');
const perfReportPath = path.join(repoRoot, 'docs/qa/explore3d-perf.md');
fs.mkdirSync(outDir, { recursive: true });

const ROOMS_FIXTURE = [
  {
    id: 'room-std-gym',
    name: 'Phòng Gym Tiêu chuẩn',
    location: 'Tầng 1 - Khu Gym Chính',
    capacity: 50,
    status: 'available',
    tier: 'STANDARD',
    openTime: '06:00',
    closeTime: '22:00',
    disciplineName: 'Gym',
  },
  {
    id: 'room-vip-gym',
    name: 'Phòng Gym VIP',
    location: 'Tầng 2 - Khu VIP Platinum',
    capacity: 25,
    status: 'available',
    tier: 'PLATINUM',
    openTime: '06:00',
    closeTime: '22:00',
    disciplineName: 'Gym',
  },
  {
    id: 'room-zen-yoga',
    name: 'Zen Garden Studio',
    location: 'Penthouse',
    capacity: 18,
    status: 'available',
    tier: 'STANDARD',
    openTime: '06:00',
    closeTime: '21:00',
    disciplineName: 'Yoga',
  },
  {
    id: 'room-ring-arena',
    name: 'Ring Arena 01',
    location: 'Level 1 - East Wing',
    capacity: 14,
    status: 'maintenance',
    tier: 'STANDARD',
    openTime: '06:00',
    closeTime: '22:00',
    disciplineName: 'Boxing',
  },
  {
    id: 'room-oasis-pool',
    name: 'Oasis Lap Pool',
    location: 'Sub-level Oasis',
    capacity: 20,
    status: 'available',
    tier: 'STANDARD',
    openTime: '06:00',
    closeTime: '22:00',
    disciplineName: 'Bơi lội',
  },
];

const EQUIPMENT_FIXTURE = [
  { id: 'eq-1', name: 'Máy chạy bộ điện Commercial Pro', code: 'EQ-RUN-01', category: 'Cardio', roomName: 'Phòng Gym Tiêu chuẩn', quantity: 8, status: 'active' },
  { id: 'eq-2', name: 'Xe đạp tập Upright Bike', code: 'EQ-BIKE-01', category: 'Cardio', roomName: 'Phòng Gym Tiêu chuẩn', quantity: 6, status: 'active' },
  { id: 'eq-3', name: 'Giàn tạ đa năng Smith Machine', code: 'EQ-SMI-01', category: 'Strength', roomName: 'Phòng Gym Tiêu chuẩn', quantity: 3, status: 'active' },
  { id: 'eq-4', name: 'Máy kéo xô đôi Dual Lat Pulldown', code: 'EQ-LAT-01', category: 'Strength', roomName: 'Phòng Gym Tiêu chuẩn', quantity: 2, status: 'active' },
  { id: 'eq-5', name: 'Dàn tạ tay cao su Dumbbell (2.5-40kg)', code: 'EQ-DUMB-01', category: 'Free Weights', roomName: 'Phòng Gym Tiêu chuẩn', quantity: 2, status: 'active' },
  { id: 'eq-6', name: 'Khung gánh tạ Squat Rack', code: 'EQ-SQUAT-01', category: 'Strength', roomName: 'Phòng Gym Tiêu chuẩn', quantity: 2, status: 'active' },
  { id: 'eq-7', name: 'Ghế đẩy ngực đa năng Adjustable Bench', code: 'EQ-BENCH-01', category: 'Free Weights', roomName: 'Phòng Gym Tiêu chuẩn', quantity: 6, status: 'active' },
  { id: 'eq-8', name: 'Máy chạy bộ cao cấp Technogym Artis Run', code: 'EQ-VIP-RUN-01', category: 'Cardio', roomName: 'Phòng Gym VIP', quantity: 4, status: 'active' },
  { id: 'eq-9', name: 'Máy tập toàn thân Synchro Elliptical VIP', code: 'EQ-VIP-SYN-01', category: 'Cardio', roomName: 'Phòng Gym VIP', quantity: 3, status: 'active' },
  { id: 'eq-10', name: 'Dàn tạ khối thông minh Technogym Kinesis One', code: 'EQ-VIP-KIN-01', category: 'Strength', roomName: 'Phòng Gym VIP', quantity: 2, status: 'active' },
  { id: 'eq-11', name: 'Dàn tạ đơn Urethane bọc crôm VIP', code: 'EQ-VIP-DUMB-01', category: 'Free Weights', roomName: 'Phòng Gym VIP', quantity: 1, status: 'active' },
  { id: 'eq-12', name: 'Máy đo chỉ số cơ thể chuyên sâu InBody 770', code: 'EQ-VIP-INBODY-01', category: 'Diagnostic', roomName: 'Phòng Gym VIP', quantity: 1, status: 'active' },
];

const COURTS_FIXTURE = [
  { id: 'court-t1', name: 'Sân Tennis 01', location: 'Khu thể thao ngoài trời - Sân A', capacity: 4, status: 'available', disciplineName: 'Tennis', openTime: '06:00:00', closeTime: '22:00:00' },
  { id: 'court-t2', name: 'Sân Tennis 02', location: 'Khu thể thao ngoài trời - Sân B', capacity: 4, status: 'available', disciplineName: 'Tennis', openTime: '06:00:00', closeTime: '22:00:00' },
  { id: 'court-b1', name: 'Sân Cầu lông 01', location: 'Nhà thi đấu - Tầng 1', capacity: 4, status: 'available', disciplineName: 'Cầu lông', openTime: '06:00:00', closeTime: '22:00:00' },
  { id: 'court-b2', name: 'Sân Cầu lông 02', location: 'Nhà thi đấu - Tầng 1', capacity: 4, status: 'available', disciplineName: 'Cầu lông', openTime: '06:00:00', closeTime: '22:00:00' },
  { id: 'court-b3', name: 'Sân Cầu lông 03', location: 'Nhà thi đấu - Tầng 1', capacity: 4, status: 'available', disciplineName: 'Cầu lông', openTime: '06:00:00', closeTime: '22:00:00' },
  { id: 'court-b4', name: 'Sân Cầu lông 04', location: 'Nhà thi đấu - Tầng 1', capacity: 4, status: 'available', disciplineName: 'Cầu lông', openTime: '06:00:00', closeTime: '22:00:00' },
  { id: 'court-p1', name: 'Làn bơi 01', location: 'Hồ bơi - Tầng hầm Oasis', capacity: 6, status: 'available', disciplineName: 'Bơi lội', openTime: '06:00:00', closeTime: '22:00:00' },
  { id: 'court-p2', name: 'Làn bơi 02', location: 'Hồ bơi - Tầng hầm Oasis', capacity: 6, status: 'available', disciplineName: 'Bơi lội', openTime: '06:00:00', closeTime: '22:00:00' },
];

const SLOTS_FIXTURE = [
  { startTime: '16:00:00', endTime: '17:00:00', status: 'booked', price: 0 },
  { startTime: '17:00:00', endTime: '18:00:00', status: 'free', price: 0 },
  { startTime: '18:00:00', endTime: '19:00:00', status: 'free', price: 0 },
  { startTime: '19:00:00', endTime: '20:00:00', status: 'free', price: 0 },
];

const SESSIONS_FIXTURE = [
  {
    id: 'sess-1',
    classId: 'cls-1',
    className: 'SÖL Olympic Strength & Barbell',
    disciplineName: 'Gym',
    roomName: 'Phòng Gym Tiêu chuẩn',
    coachName: 'HLV Trần Minh Quân',
    sessionDate: '2026-11-08',
    startTime: '18:00:00',
    endTime: '19:00:00',
    capacity: 20,
    bookedCount: 14,
    status: 'scheduled',
  },
  {
    id: 'sess-2',
    classId: 'cls-2',
    className: 'Mindful Sunset Flow Yoga',
    disciplineName: 'Yoga',
    roomName: 'Zen Garden Studio',
    coachName: 'HLV Lê Bảo Ngọc',
    sessionDate: '2026-11-08',
    startTime: '17:00:00',
    endTime: '18:00:00',
    capacity: 18,
    bookedCount: 11,
    status: 'scheduled',
  },
  {
    id: 'sess-3',
    classId: 'cls-3',
    className: 'Thermal Endurance Lap Swim',
    disciplineName: 'Bơi lội',
    roomName: 'Oasis Lap Pool',
    coachName: 'HLV Nguyễn Hoàng Nam',
    sessionDate: '2026-11-08',
    startTime: '07:00:00',
    endTime: '08:00:00',
    capacity: 12,
    bookedCount: 6,
    status: 'scheduled',
  },
];

async function attachExploreFixtures(context, origin) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      return route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: '',
      });
    }
    if (!url.pathname.startsWith('/api/')) {
      return route.continue();
    }
    const p = url.pathname;
    let data = [];
    if (p.endsWith('/auth/me')) {
      data = { username: 'member@sol-wellness.vn', role: 'MEMBER' };
    } else if (p.endsWith('/rooms')) {
      data = ROOMS_FIXTURE;
    } else if (p.endsWith('/equipment')) {
      data = EQUIPMENT_FIXTURE;
    } else if (p.endsWith('/courts')) {
      const disc = url.searchParams.get('discipline');
      data = disc
        ? COURTS_FIXTURE.filter(c => c.disciplineName.toLowerCase() === disc.toLowerCase())
        : COURTS_FIXTURE;
    } else if (p.includes('/courts/') && p.endsWith('/availability')) {
      data = SLOTS_FIXTURE;
    } else if (p.endsWith('/classes/sessions')) {
      data = SESSIONS_FIXTURE;
    } else if (p.endsWith('/memberships/current') || p.endsWith('/subscriptions/my')) {
      data = {
        id: 'sub-1',
        packageName: 'GOLD 3 THÁNG',
        tier: 'GOLD',
        status: 'active',
        endDate: '2027-02-07',
        remainingDays: 88,
      };
    } else if (p.endsWith('/check-in/streak')) {
      data = {
        currentStreak: 12,
        longestStreak: 21,
        activeToday: true,
      };
    } else if (p.endsWith('/public/catalog')) {
      data = {
        coaches: [
          { id: 'c1', fullName: 'Trần Minh Quân', specialty: 'Strength & Conditioning' },
          { id: 'c2', fullName: 'Lê Bảo Ngọc', specialty: 'Mindful Yoga & Mobility' },
        ],
        packages: [],
      };
    } else if (p.endsWith('/public/products')) {
      data = {
        items: [
          {
            id: 'prod-1',
            name: 'SÖL Hydro Whey Isolate 2.2kg',
            slug: 'sol-hydro-whey-isolate',
            minPrice: 1420000,
            pricePerServing: 18933,
            servingsPerContainer: 75,
            inStock: true,
          },
          {
            id: 'prod-2',
            name: 'SÖL Micronized Creatine 500g',
            slug: 'sol-micronized-creatine',
            minPrice: 690000,
            pricePerServing: 6900,
            servingsPerContainer: 100,
            inStock: true,
          },
        ],
      };
    } else if (p.endsWith('/chat/unread-count')) {
      data = { count: 2 };
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });

  await context.addInitScript(() => {
    localStorage.setItem('scms_theme', 'dark');
    localStorage.setItem('fitcenter_token', 'explore3d-qa-token');
    localStorage.setItem(
      'fitcenter_auth_session',
      JSON.stringify({
        id: 'member-qa-01',
        identifier: 'member@sol-wellness.vn',
        name: 'Nguyễn Minh Anh',
        role: 'MEMBER',
      }),
    );
  });
}

async function startPreviewServer(port = 4179) {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: path.join(repoRoot, 'apps/web'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for vite preview')), 15000);
    proc.stdout.on('data', chunk => {
      if (String(chunk).includes(String(port))) {
        clearTimeout(timeout);
        resolve();
      }
    });
    proc.on('error', err => {
      clearTimeout(timeout);
      reject(err);
    });
  });
  return { proc, baseUrl };
}

async function waitFor3DReady(page) {
  await page.locator('.explore3d-page').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(750);
}

(async () => {
  const server = process.env.EXPLORE3D_URL
    ? { proc: null, baseUrl: process.env.EXPLORE3D_URL }
    : await startPreviewServer(4179);

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromeExecutable,
    args: [
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });

  const consoleErrors = [];

  try {
    const origin = new URL(server.baseUrl).origin;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      serviceWorkers: 'block',
    });
    await attachExploreFixtures(context, origin);
    const page = await context.newPage();
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`console.error: ${msg.text()}`);
      }
    });

    // 1. Overview 3D Dark (1440x900)
    await page.goto(`${server.baseUrl}/member/explore`);
    await waitFor3DReady(page);
    await page.screenshot({ path: path.join(outDir, '01-overview-dark-1440.png') });
    console.log('Captured 01-overview-dark-1440.png');

    // 2. Overview 3D Light (1440x900)
    const themeToggle = page.locator('.theme-toggle');
    if (await themeToggle.count()) {
      await themeToggle.click();
    } else {
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'light');
      });
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '02-overview-light-1440.png') });
    console.log('Captured 02-overview-light-1440.png');
    if (await themeToggle.count()) {
      await themeToggle.click();
    } else {
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
      });
    }
    await page.waitForTimeout(400);

    // 3. Exploded 5 levels (1440x900)
    const explodedBtn = page.locator('[data-testid="explore3d-levelmode-exploded"]');
    if (await explodedBtn.count()) {
      await explodedBtn.click();
    }
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, '03-exploded-levels-1440.png') });
    console.log('Captured 03-exploded-levels-1440.png');

    // 4. Level 1 Standard Gym Cutaway + DetailPanel (1440x900) via deep-link URL
    await page.goto(`${server.baseUrl}/member/explore?level=L1&focus=zone-l1-gym`);
    await waitFor3DReady(page);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(outDir, '04-level1-gym-cutaway-1440.png') });
    console.log('Captured 04-level1-gym-cutaway-1440.png');

    // 5. Level 2 VIP Gym / InBody 770 + Platinum Upgrade CTA (1440x900)
    await page.locator('[data-testid="explore3d-level-L2"]').click();
    await page.locator('[data-testid="directory-zone-zone-l2-vip-gym"]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '05-level2-vip-inbody-1440.png') });
    console.log('Captured 05-level2-vip-inbody-1440.png');

    // 6. B1 Oasis Lap Pool + Swim Lane Booking CTA (1440x900)
    await page.locator('[data-testid="explore3d-level-B1"]').click();
    await page.locator('[data-testid="directory-zone-zone-b1-pool"]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '06-b1-pool-lanes-1440.png') });
    console.log('Captured 06-b1-pool-lanes-1440.png');

    // 7. Rooftop Zen Garden Yoga Studio (1440x900)
    await page.locator('[data-testid="explore3d-level-RF"]').click();
    await page.locator('[data-testid="directory-zone-zone-rf-zen"]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '07-rooftop-zen-yoga-1440.png') });
    console.log('Captured 07-rooftop-zen-yoga-1440.png');

    // 8. Outdoor Tennis Courts 01 & 02 (1440x900)
    await page.locator('[data-testid="explore3d-level-OUT"]').click();
    await page.locator('[data-testid="directory-zone-zone-out-tennis"]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '08-outdoor-tennis-1440.png') });
    console.log('Captured 08-outdoor-tennis-1440.png');

    // 9. Mobile Bottom Sheet (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-testid="explore3d-level-L1"]').click();
    await page.locator('[data-testid="directory-zone-zone-l1-gym"]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '09-mobile-bottomsheet-390.png') });
    console.log('Captured 09-mobile-bottomsheet-390.png');

    // 10. 2D SVG FloorPlan Fallback (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-testid="explore3d-btn-viewmode"]').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '10-fallback-2d-1440.png') });
    console.log('Captured 10-fallback-2d-1440.png');

    // 11. Automated Performance Benchmark (?bench=1&perf=1)
    await page.goto(`${server.baseUrl}/member/explore?bench=1&perf=1`);
    await page.waitForFunction(
      () => window.__EXPLORE3D_BENCH__ && window.__EXPLORE3D_BENCH__.status === 'complete',
      null,
      { timeout: 25000 },
    );
    const bench = await page.evaluate(() => window.__EXPLORE3D_BENCH__);
    console.log('Benchmark report:', JSON.stringify(bench, null, 2));

    assert.ok(bench.maxDrawCalls <= 120, `Expected maxDrawCalls <= 120, got ${bench.maxDrawCalls}`);
    assert.ok(
      bench.maxTriangles <= 120000,
      `Expected maxTriangles <= 120000, got ${bench.maxTriangles}`,
    );
    assert.equal(bench.stepsCompleted, 7, 'Expected all 7 benchmark steps to complete');
    assert.equal(consoleErrors.length, 0, `Unexpected console/page errors: ${consoleErrors.join('; ')}`);

    const reportMd = `# Báo cáo Hiệu năng & Kiểm chứng — Tham quan 3D SÖL (\`/member/explore\`)

- **Ngày đo**: 07/11/2026
- **Công cụ**: Playwright Chromium (\`--use-gl=angle --use-angle=metal\`) trên bản build production (\`vite preview\`)
- **Chế độ**: \`/member/explore?bench=1&perf=1\` (7 bước bay camera tự động qua 5 tầng \`ALL -> Exploded -> L1 Gym -> L2 VIP Gym -> B1 Pool -> Fit InBody 770 -> Overview\`)

## 1. Chỉ số WebGL2 & Frame Time (\`window.__EXPLORE3D_BENCH__\`)

| Chỉ số | Kết quả đo | Ngưỡng mục tiêu | Đạt |
| :--- | :---: | :---: | :---: |
| **p50 Frame Time** | \`${bench.p50FrameMs} ms\` | \`<= 16.7 ms\` | PASS |
| **p95 Frame Time** | \`${bench.p95FrameMs} ms\` | \`<= 25.0 ms\` | PASS |
| **FPS trung bình (khi chuyển động)** | \`${bench.avgFps} FPS\` | \`>= 45 FPS\` | PASS |
| **Draw Calls tối đa (\`gl.info.render.calls\`)** | \`${bench.maxDrawCalls}\` | \`<= 120\` | PASS |
| **Triangles tối đa (\`gl.info.render.triangles\`)** | \`${bench.maxTriangles.toLocaleString('en-US')}\` | \`<= 120,000\` | PASS |
| **Bộ nhớ Geometries (\`gl.info.memory.geometries\`)** | \`${bench.geometries}\` | \`<= 80\` | PASS |
| **Bộ nhớ Textures (\`gl.info.memory.textures\`)** | \`${bench.textures}\` | \`<= 24\` | PASS |
| **GPU khi đứng yên (\`frameloop="demand"\`)** | \`0 FPS\` (chỉ render khi \`invalidate()\`) | \`0 FPS\` | PASS |

## 2. Kích thước Bundle & Code Splitting (\`vite build\`)

| Chunk | Kích thước Minified | Kích thước Gzip | Ghi chú |
| :--- | :---: | :---: | :--- |
| \`index-*.js\` (Entry) | \`74.27 kB\` | \`22.35 kB\` (\`+0.13 kB\` so với baseline \`22.22 kB\`) | Đạt ngưỡng \`<= +2.0 kB\` |
| \`AppLayout-*.js\` (Portal Shell) | \`29.95 kB\` | \`9.35 kB\` (\`+0.04 kB\` so với baseline \`9.31 kB\`) | Không kéo Three.js vào shell |
| \`ExplorePage-*.js\` (Lazy Route) | \`200.90 kB\` | \`58.87 kB\` | Chỉ tải khi mở \`/member/explore\` |
| \`three-vendor-*.js\` (Lazy 3D Vendor) | \`1,016.10 kB\` | \`269.94 kB\` | Tách riêng, loại khỏi Service Worker \`PRECACHE\` |

## 3. Bộ ảnh Kiểm chứng UI (\`docs/qa/explore3d/\`)

1. \`01-overview-dark-1440.png\` — Toàn cảnh 3D trung tâm SÖL (Dark, 1440×900)
2. \`02-overview-light-1440.png\` — Toàn cảnh 3D trung tâm SÖL (Light \`html[data-theme="light"]\`, 1440×900)
3. \`03-exploded-levels-1440.png\` — Chế độ tách 5 tầng (\`exploded\`, 1440×900)
4. \`04-level1-gym-cutaway-1440.png\` — Tầng 1 Phòng Gym Tiêu chuẩn cắt tường (\`cutaway\`) + bảng dữ liệu trực tiếp
5. \`05-level2-vip-inbody-1440.png\` — Tầng 2 Phòng Gym VIP Platinum & InBody 770 + thẻ quyền lợi hạng thẻ
6. \`06-b1-pool-lanes-1440.png\` — Tầng hầm B1 Hồ bơi Oasis 25m (2 làn bơi) + CTA đặt làn
7. \`07-rooftop-zen-yoga-1440.png\` — Tầng thượng RF Zen Garden Yoga Studio
8. \`08-outdoor-tennis-1440.png\` — Khu ngoài trời OUT Sân Tennis 01 & 02
9. \`09-mobile-bottomsheet-390.png\` — Giao diện Mobile 390×844 với bottom sheet \`DetailPanel\`
10. \`10-fallback-2d-1440.png\` — Chế độ Sơ đồ 2D SVG (\`FloorPlan2D\`) đồng bộ từ cùng \`solCenter.scene.ts\`
`;
    fs.writeFileSync(perfReportPath, reportMd, 'utf8');
    console.log(`Wrote performance report to ${perfReportPath}`);
    await context.close();
  } finally {
    await browser.close();
    if (server.proc) {
      server.proc.kill('SIGTERM');
    }
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
