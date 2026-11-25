import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, settled } from '../fixtures';
import { authFile } from '../helpers/accounts';

const CAPTURE_DIR = process.env.EXPLORE3D_CAPTURE_DIR?.trim() || '';

const GPU_LAUNCH_ARGS =
  process.platform === 'darwin'
    ? ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist']
    : [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
      ];

// Hình chữ nhật trên màn hình (toạ độ và kích thước).
interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Hai hình chữ nhật có chồng lên nhau không (cộng thêm khoảng đệm pad).
function rectsOverlap(a: BoxRect, b: BoxRect, pad = 2): boolean {
  return !(
    a.x + a.width - pad <= b.x ||
    b.x + b.width - pad <= a.x ||
    a.y + a.height - pad <= b.y ||
    b.y + b.height - pad <= a.y
  );
}

// Chụp ảnh màn hình sau khi chờ cảnh ổn định.
async function captureShot(page: Page, filename: string, settleMs = 1100) {
  await page.waitForTimeout(settleMs);
  if (!CAPTURE_DIR) return;
  mkdirSync(CAPTURE_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(CAPTURE_DIR, filename),
    fullPage: false,
  });
}

// Đảm bảo giao diện đang ở theme sáng hoặc tối mong muốn.
async function ensureTheme(page: Page, desired: 'dark' | 'light') {
  const current = await page.locator('html').getAttribute('data-theme');
  const isLight = current === 'light';
  if ((desired === 'light') !== isLight) {
    await page.getByRole('button', { name: /chế độ (tối|sáng)|theme|dark|light/i }).first().click();
    await page.waitForTimeout(650);
  }
  if (desired === 'light') {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  } else {
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
  }
}

// Gắn bộ bắt lỗi shader trên console và trả về danh sách lỗi.
async function attachShaderErrorGuard(page: Page): Promise<string[]> {
  const shaderIssues: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (/Shader Error|Program Info Log|GL_INVALID|webglcontextlost/i.test(text)) {
      shaderIssues.push(text.slice(0, 320));
    }
  });
  return shaderIssues;
}

// Dịch chuyển người đi bộ tới toạ độ (x, z) rồi chờ.
async function walkTeleport(page: Page, x: number, z: number, waitMs = 300) {
  await page.evaluate(
    ([tx, tz]) => {
      window.dispatchEvent(
        new CustomEvent('scms:explore3d-floor-click', {
          detail: { x: tx, z: tz },
        }),
      );
    },
    [x, z] as const,
  );
  await page.waitForTimeout(waitMs);
}

// Giữ một phím trong khoảng thời gian cho trước (có thể kèm Shift).
async function holdKey(page: Page, key: string, durationMs: number, withShift = false) {
  if (withShift) await page.keyboard.down('Shift');
  await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  await page.keyboard.up(key);
  if (withShift) await page.keyboard.up('Shift');
  await page.waitForTimeout(180);
}

test.use({
  storageState: authFile('an'),
  launchOptions: { args: GPU_LAUNCH_ARGS },
});

test.describe('Tham quan 3D — Đi dạo toàn cảnh, cầu thang, kính, bầu trời & đường phố', () => {
  test.describe.configure({ timeout: 180_000 });

  test('1. Toàn cảnh, Tách 5 tầng, Đổi giao diện Sáng/Tối & Bố cục HUD không chồng lấp', async ({
    page,
  }) => {
    const shaderIssues = await attachShaderErrorGuard(page);

    await page.addInitScript(() => {
      sessionStorage.removeItem('scms_explore3d_view_v1');
    });
    await page.goto('/member/explore');
    await settled(page);

    const canvas = page.locator('[data-testid="explore3d-stage"] canvas').first();
    await expect(canvas).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(3200);

    await ensureTheme(page, 'dark');
    await captureShot(page, '01-overview-dark.png', 1400);

    // Kiểm tra các cụm HUD không đè lên nhau và không cuộn trang
    const overflow = await page.evaluate(() => ({
      dx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dy: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    expect(overflow.dx).toBeLessThanOrEqual(1);
    expect(overflow.dy).toBeLessThanOrEqual(1);

    const crumbBox = await page.getByTestId('explore3d-breadcrumb').boundingBox();
    const switcherBox = await page.getByTestId('explore3d-level-switcher').boundingBox();
    const toolbarBox = await page.getByTestId('explore3d-toolbar').boundingBox();
    expect(crumbBox).not.toBeNull();
    expect(switcherBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(rectsOverlap(crumbBox!, switcherBox!)).toBe(false);
    expect(rectsOverlap(switcherBox!, toolbarBox!)).toBe(false);

    // Chuyển sang giao diện Sáng (Giờ vàng)
    await ensureTheme(page, 'light');
    await captureShot(page, '02-overview-light.png', 1400);

    // Tách 5 tầng ở cả Sáng và Tối
    await page.getByTestId('explore3d-levelmode-exploded').click();
    await captureShot(page, '03-exploded-5floors-light.png', 1400);

    await ensureTheme(page, 'dark');
    await captureShot(page, '04-exploded-5floors-dark.png', 1400);

    // Trở về gộp tầng & kiểm tra chế độ tường cao
    await page.getByTestId('explore3d-levelmode-stacked').click();
    await page.getByTestId('explore3d-wallmode-up').click();
    await captureShot(page, '05-walls-up-facade-dark.png', 1100);
    await page.getByTestId('explore3d-wallmode-cutaway').click();

    expect(shaderIssues, 'Không có lỗi biên dịch shader WebGL').toEqual([]);
  });

  test('2. Đi bộ góc nhìn 1.65m qua Sảnh L1, Kính phòng Gym nhìn ra phố & Leo cầu thang bộ B1 -> L1 -> L2 -> RF', async ({
    page,
  }) => {
    const shaderIssues = await attachShaderErrorGuard(page);

    // Bắt đầu ở Sảnh lễ tân L1
    await page.goto('/member/explore?focus=zone-l1-lobby');
    await settled(page);
    await expect(page.locator('[data-testid="explore3d-stage"] canvas').first()).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(2500);
    await ensureTheme(page, 'dark');

    // Bật chế độ đi bộ 1.65m
    await page.getByTestId('explore3d-btn-walk').click();
    await expect(page.getByTestId('explore3d-walk-hud')).toBeVisible();
    await expect(page.getByTestId('walk-floor-L1')).toHaveAttribute('aria-pressed', 'true');
    await captureShot(page, '06-l1-lobby-walk-dark.png', 1000);

    // Đi bộ vào Phòng Gym Tiêu chuẩn L1 và nhìn qua cửa kính lớn ra đường phố bên ngoài
    await page.goto('/member/explore?focus=zone-l1-gym');
    await settled(page);
    await page.waitForTimeout(1800);
    await page.getByTestId('explore3d-btn-walk').click();
    await expect(page.getByTestId('explore3d-walk-hud')).toBeVisible();
    // Đi dọc hành lang thoáng giữa khu Cardio & tạ để hướng thẳng ra vách kính phía Tây & đường phố
    await walkTeleport(page, -11.0, -6.7, 450);
    await walkTeleport(page, -15.2, -6.7, 450);
    await captureShot(page, '07-l1-gym-glass-street-dark.png', 1100);

    await ensureTheme(page, 'light');
    await captureShot(page, '08-l1-gym-glass-street-light.png', 1100);

    // Đi qua khu Võ đài Boxing & Sân Cầu lông L1
    await page.goto('/member/explore?focus=zone-l1-boxing');
    await settled(page);
    await page.waitForTimeout(1600);
    await page.getByTestId('explore3d-btn-walk').click();
    await captureShot(page, '09-l1-boxing-ring-walk-light.png', 950);

    await page.goto('/member/explore?focus=zone-l1-badminton');
    await settled(page);
    await page.waitForTimeout(1600);
    await page.getByTestId('explore3d-btn-walk').click();
    await captureShot(page, '10-l1-badminton-hall-walk-light.png', 1000);

    // Kiểm thử leo cầu thang bộ thực tế xuyên suốt B1 -> L1 -> L2 -> RF & đồng bộ Breadcrumb
    await ensureTheme(page, 'dark');
    await page.goto('/member/explore?focus=item-b1-stairs');
    await settled(page);
    await page.waitForTimeout(1800);
    await page.getByTestId('explore3d-btn-walk').click();
    await expect(page.getByTestId('walk-floor-B1')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('explore3d-breadcrumb')).toContainText('Tầng B1');
    await captureShot(page, '11a-stair-base-b1-dark.png', 1000);

    // Leo vế thang B1 -> L1 bằng phím Shift + W
    await holdKey(page, 'w', 1200, true);
    await captureShot(page, '11b-stair-climbing-b1-to-l1.png', 600);
    await holdKey(page, 'w', 1300, true);
    await expect(page.getByTestId('walk-floor-L1')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('explore3d-breadcrumb')).toContainText('Tầng L1');

    // Vòng sang hành lang phía Đông thang bộ L1 để tiếp cận chân thang L1 -> L2
    await walkTeleport(page, 13.5, 8.8, 300);
    await walkTeleport(page, 13.5, 14.3, 300);
    await walkTeleport(page, 10.5, 14.3, 300);
    await walkTeleport(page, 10.5, 13.9, 300);
    await captureShot(page, '11c-stair-base-l1-dark.png', 800);

    // Leo vế thang L1 -> L2
    await holdKey(page, 'w', 2400, true);
    await expect(page.getByTestId('walk-floor-L2')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('explore3d-breadcrumb')).toContainText('Tầng L2');
    await captureShot(page, '11d-stair-arrival-l2-dark.png', 800);

    // Vòng sang hành lang L2 để tiếp cận chân thang L2 -> RF
    await walkTeleport(page, 13.5, 8.8, 300);
    await walkTeleport(page, 13.5, 14.3, 300);
    await walkTeleport(page, 10.5, 14.3, 300);
    await walkTeleport(page, 10.5, 13.9, 300);

    // Leo vế thang L2 -> RF lên lồng kính tầng thượng
    await holdKey(page, 'w', 2500, true);
    await expect(page.getByTestId('walk-floor-RF')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('explore3d-breadcrumb')).toContainText('Tầng RF');
    await captureShot(page, '11e-stair-top-rf-bulkhead-dark.png', 1000);

    expect(shaderIssues, 'Không có lỗi biên dịch shader WebGL').toEqual([]);
  });

  test('3. Sân thượng RF (Bầu trời & Đường phố), Tầng 2 VIP Gym, Sân Tennis OUT & Hồ bơi B1', async ({
    page,
  }) => {
    const shaderIssues = await attachShaderErrorGuard(page);

    // 3A. Góc nhìn tổng quan Tầng thượng RF ở cả Tối (Chạng vạng) và Sáng (Giờ vàng)
    await page.goto('/member/explore?level=RF');
    await settled(page);
    await expect(page.locator('[data-testid="explore3d-stage"] canvas').first()).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(2600);

    await ensureTheme(page, 'dark');
    await captureShot(page, '12-rf-orbit-overview-dark.png', 1200);

    await ensureTheme(page, 'light');
    await captureShot(page, '13-rf-orbit-overview-light.png', 1200);

    // 3B. Đi bộ trên Sân thượng RF: Ngước nhìn bầu trời mây/sao và nhìn qua lan can kính xuống đường phố
    await page.goto('/member/explore?focus=zone-rf-terrace');
    await settled(page);
    await page.waitForTimeout(1800);
    await page.getByTestId('explore3d-btn-walk').click();
    await expect(page.getByTestId('walk-floor-RF')).toHaveAttribute('aria-pressed', 'true');

    // Đi ra sát lan can kính phía Đông – Nam ngắm đường phố & sân Tennis bên dưới (Sáng)
    await walkTeleport(page, 18.8, 9.5, 350);
    await walkTeleport(page, 20.4, 11.2, 350);
    await holdKey(page, 'f', 320);
    await captureShot(page, '14-rf-walk-street-sightline-light.png', 1100);

    // Ngước cao lên bầu trời giờ vàng trên sân thượng mở phía Đông
    await holdKey(page, 'r', 950);
    await captureShot(page, '15-rf-walk-sky-golden-light.png', 1100);

    // Chuyển sang giao diện Tối (Chạng vạng): ngắm bầu trời sao/mây chạng vạng và phố lên đèn
    await ensureTheme(page, 'dark');
    await captureShot(page, '16-rf-walk-sky-twilight-dark.png', 1100);

    await holdKey(page, 'f', 980);
    await captureShot(page, '17-rf-walk-street-sightline-dark.png', 1100);

    // Đi vào bên trong Zen Garden Yoga Studio trên tầng thượng
    await page.goto('/member/explore?focus=zone-rf-zen');
    await settled(page);
    await page.waitForTimeout(1600);
    await page.getByTestId('explore3d-btn-walk').click();
    await captureShot(page, '18-rf-zen-yoga-studio-walk-dark.png', 1100);

    // 3C. Tầng 2 VIP Platinum Gym, InBody 770 & Lounge nhìn qua vách kính ra phố
    await page.goto('/member/explore?focus=zone-l2-vip-gym');
    await settled(page);
    await page.waitForTimeout(1800);
    await ensureTheme(page, 'light');
    await page.getByTestId('explore3d-btn-walk').click();
    await walkTeleport(page, -11.5, -4.5, 400);
    await walkTeleport(page, -16.8, -7.2, 400);
    await captureShot(page, '19-l2-vip-gym-glass-street-light.png', 1100);

    await ensureTheme(page, 'dark');
    await captureShot(page, '20-l2-vip-gym-glass-street-dark.png', 1100);

    await page.goto('/member/explore?focus=zone-l2-lounge');
    await settled(page);
    await page.waitForTimeout(1600);
    await page.getByTestId('explore3d-btn-walk').click();
    await captureShot(page, '21-l2-platinum-lounge-walk-dark.png', 1000);

    // 3D. Khu Sân Tennis Ngoài trời OUT: Trang phục nhân vật & chuỗi đánh bóng đối kháng
    await page.goto('/member/explore?focus=zone-out-tennis');
    await settled(page);
    await page.waitForTimeout(1800);
    await ensureTheme(page, 'light');
    await captureShot(page, '22-out-tennis-orbit-light.png', 1100);

    await page.getByTestId('explore3d-btn-walk').click();
    await expect(page.getByTestId('walk-floor-OUT')).toHaveAttribute('aria-pressed', 'true');
    await captureShot(page, '23a-out-tennis-walk-rally-1-light.png', 900);
    await captureShot(page, '23b-out-tennis-walk-rally-2-light.png', 950);

    await ensureTheme(page, 'dark');
    await captureShot(page, '24-out-tennis-walk-night-floodlights.png', 1000);

    // 3E. Tầng hầm B1 Oasis Pool & Thermal Spa
    await page.goto('/member/explore?focus=zone-b1-pool');
    await settled(page);
    await page.waitForTimeout(1800);
    await captureShot(page, '25-b1-pool-orbit-dark.png', 1100);
    await page.getByTestId('explore3d-btn-walk').click();
    await expect(page.getByTestId('walk-floor-B1')).toHaveAttribute('aria-pressed', 'true');
    await captureShot(page, '26-b1-poolside-walk-dark.png', 1100);

    expect(shaderIssues, 'Không có lỗi biên dịch shader WebGL').toEqual([]);
  });

  test('4. Tham quan có hướng dẫn, Tìm kiếm (/), Sơ đồ 2D dự phòng & Giao diện Di động 390x844', async ({
    page,
  }) => {
    await page.goto('/member/explore');
    await settled(page);
    await page.waitForTimeout(2200);

    // Bật Tham quan có hướng dẫn (Guided Tour) và chuyển qua 2 điểm dừng
    await page.getByTestId('explore3d-btn-tour').click();
    const tourBar = page.getByTestId('explore3d-tour-bar');
    await expect(tourBar).toBeVisible();
    await expect(page.getByTestId('explore3d-tour-counter')).toContainText('1 /');
    await captureShot(page, '27-guided-tour-step1.png', 1000);

    // Không đè thanh công cụ phía dưới
    const tourBox = await tourBar.boundingBox();
    const toolbarBox = await page.getByTestId('explore3d-toolbar').boundingBox();
    expect(tourBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(rectsOverlap(tourBox!, toolbarBox!)).toBe(false);

    await tourBar.getByRole('button', { name: /Điểm dừng tiếp theo|Next tour stop/i }).click();
    await expect(page.getByTestId('explore3d-tour-counter')).toContainText('2 /');
    await tourBar.getByRole('button', { name: /Thoát chế độ tham quan|Exit guided tour/i }).click();
    await expect(tourBar).toBeHidden();

    // Mở hộp thoại tìm kiếm bằng phím tắt `/` và chọn Buồng InBody 770
    await page.keyboard.press('/');
    const searchModal = page.getByTestId('explore3d-search-modal');
    await expect(searchModal).toBeVisible();
    await page.getByTestId('explore3d-search-input').fill('InBody 770');
    await page.keyboard.press('Enter');
    await expect(searchModal).toBeHidden();
    await expect(page.getByTestId('explore3d-level-L2')).toHaveAttribute('aria-pressed', 'true');

    // Chuyển sang Sơ đồ 2D SVG và kiểm tra không đè thanh chọn tầng / thanh công cụ
    await page.getByTestId('explore3d-btn-viewmode').click();
    await expect(page.locator('[data-testid="explore3d-stage"] svg').first()).toBeVisible();
    const fpCanvasWrap = await page.locator('.explore3d-floorplan-canvas-wrap').boundingBox();
    const fpA11yList = await page.locator('.explore3d-floorplan-a11y-list').boundingBox();
    const fpSwitcher = await page.getByTestId('explore3d-level-switcher').boundingBox();
    const fpToolbar = await page.getByTestId('explore3d-toolbar').boundingBox();
    expect(fpCanvasWrap).not.toBeNull();
    expect(fpA11yList).not.toBeNull();
    expect(fpSwitcher).not.toBeNull();
    expect(fpToolbar).not.toBeNull();
    expect(rectsOverlap(fpSwitcher!, fpCanvasWrap!)).toBe(false);
    expect(rectsOverlap(fpToolbar!, fpA11yList!)).toBe(false);
    await captureShot(page, '28-floorplan-2d-l2.png', 900);
    await page.getByTestId('explore3d-btn-viewmode').click();
    await expect(page.locator('[data-testid="explore3d-stage"] canvas').first()).toBeVisible();

    // Kiểm tra trên màn hình di động 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(900);
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(mobileOverflow, 'Di động 390px không được tràn ngang').toBeLessThanOrEqual(1);
    await captureShot(page, '29-mobile-390x844-dark.png', 1000);
  });
});
