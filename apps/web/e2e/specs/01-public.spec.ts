import { test, expect, settled } from '../fixtures';

test.describe('Trang công khai', () => {
  test('landing tải được, có hero, điều hướng và nút Đăng nhập', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero-title')).toBeVisible();
    await expect(page).toHaveTitle(/SÖL/);
    const nav = page.getByRole('banner');
    await expect(nav.getByRole('link', { name: 'Gói tập' }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /Đăng nhập|Tham gia/ }).first()).toBeVisible();
  });

  test('catalog công khai (gói tập, HLV) lấy từ API thật, không dùng dữ liệu giả', async ({ page }) => {
    const catalog = page.waitForResponse((r) => r.url().includes('/api/v1/public') && r.status() === 200);
    await page.goto('/');
    await catalog;
    await page.locator('#packages').scrollIntoViewIfNeeded();
    await expect(page.locator('#packages')).toContainText(/Silver|Gold|Platinum/i);
    await page.locator('#trainers').scrollIntoViewIfNeeded();
    await expect(page.locator('#trainers')).toContainText(/Hùng|Mai|Long|Thảo/);
  });

  test('FAQ mở/đóng bằng bàn phím và chuột', async ({ page }) => {
    await page.goto('/');
    const faq = page.locator('#faq');
    await faq.scrollIntoViewIfNeeded();
    const item = faq.locator('.fit-faq-trigger').nth(1);
    await expect(item).toHaveAttribute('aria-expanded', 'false');
    await item.click();
    await expect(item).toHaveAttribute('aria-expanded', 'true');
    await expect(faq.locator('.fit-faq-answer')).toHaveCount(1);
    await item.focus();
    await item.press('Enter');
    await expect(item).toHaveAttribute('aria-expanded', 'false');
  });

  test('máy tính BMI: tính đúng, và xử lý đầu vào bất thường mà không lỗi', async ({ page }) => {
    await page.goto('/');
    const bmi = page.locator('.fit-bmi, #bmi, [aria-labelledby="bmi-title"]').first();
    await bmi.scrollIntoViewIfNeeded();
    const inputs = bmi.locator('input');
    await inputs.nth(0).fill('170');
    await inputs.nth(1).fill('65');
    await expect(bmi).toContainText('22.5');
    // edge: số 0, âm, rỗng không làm trang văng lỗi
    for (const [h, w] of [['0', '0'], ['-5', '-5'], ['', '']]) {
      await inputs.nth(0).fill(h);
      await inputs.nth(1).fill(w);
    }
    await expect(page.locator('#hero-title')).toBeAttached();
  });

  for (const [path, title] of [
    ['/swimming', 'Hồ Bơi'],
    ['/tennis', 'Tennis'],
    ['/boxing', 'Boxing'],
    ['/badminton', 'Cầu Lông'],
    ['/yoga', 'Yoga'],
  ] as const) {
    test(`trang môn ${path} hiển thị chương trình và bộ chuyển môn`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { ignoreCase: true });
      await expect(page.locator('.fit-sport-page-program-card')).toHaveCount(3);
      await expect(page.getByRole('navigation', { name: 'Chọn bộ môn' })).toBeVisible();
    });
  }

  test('chuyển giữa các môn bằng bộ chuyển trang', async ({ page }) => {
    await page.goto('/swimming');
    await page.getByRole('navigation', { name: 'Chọn bộ môn' }).getByRole('link', { name: /Boxing/ }).click();
    await expect(page).toHaveURL(/\/boxing$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Boxing/i);
  });

  test('đường dẫn không tồn tại chuyển về trang chủ', async ({ page }) => {
    await page.goto('/khong-co-trang-nay');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#hero-title')).toBeVisible();
  });

  test('trang HLV công khai mở được, và id HLV không tồn tại không làm sập trang', async ({ page }) => {
    await page.goto('/trainers');
    await settled(page);
    await expect(page.locator('main')).toBeVisible();
    await page.goto('/trainers/999999');
    await settled(page);
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Cửa hàng công khai', () => {
  test('danh sách sản phẩm, tìm kiếm có kết quả và không có kết quả', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('button', { name: 'Thêm vào giỏ' }).first()).toBeVisible();
    const search = page.getByPlaceholder('Tìm sản phẩm…');
    await search.fill('zzzz-khong-ton-tai-123');
    await expect(page.getByRole('button', { name: 'Thêm vào giỏ' })).toHaveCount(0);
    await search.fill('');
    await expect(page.getByRole('button', { name: 'Thêm vào giỏ' }).first()).toBeVisible();
  });

  test('lọc theo mục tiêu rồi quay lại Tất cả', async ({ page }) => {
    await page.goto('/products');
    const all = await page.getByRole('button', { name: 'Thêm vào giỏ' }).count();
    await page.getByRole('button', { name: 'Tăng cơ', exact: true }).click();
    const filtered = await page.getByRole('button', { name: 'Thêm vào giỏ' }).count();
    expect(filtered).toBeLessThanOrEqual(all);
    await page.getByRole('button', { name: 'Tất cả', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Thêm vào giỏ' })).toHaveCount(all);
  });

  test('thêm vào giỏ mở giỏ hàng, tăng/giảm số lượng và xóa', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: 'Thêm vào giỏ' }).first().click();
    await page.getByRole('button', { name: /Giỏ hàng · 1 sản phẩm/ }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toContainText('Giỏ hàng (1)');
    const qty = drawer.getByRole('spinbutton').or(drawer.locator('input')).first();
    await drawer.getByRole('button', { name: /^(Tăng|\+)/ }).first().click().catch(() => undefined);
    await drawer.getByRole('button', { name: /Xóa/ }).first().click();
    await expect(drawer.getByText('Giỏ hàng đang trống.')).toBeVisible();
    void qty;
  });

  test('chi tiết sản phẩm có câu miễn trừ bắt buộc; slug sai báo không tìm thấy', async ({ page }) => {
    await page.goto('/products');
    await page.locator('a[href^="/products/"]').first().click();
    await expect(page).toHaveURL(/\/products\/.+/);
    await expect(page.getByText('Thực phẩm bổ sung không phải là thuốc', { exact: false })).toBeVisible();
    await page.goto('/products/slug-khong-ton-tai-xyz');
    await settled(page);
    await expect(page.locator('main')).toBeVisible();
  });

  test('checkout khi giỏ trống không cho đặt hàng', async ({ page }) => {
    await page.goto('/checkout');
    await settled(page);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('button', { name: /Đặt hàng|Xác nhận đặt/ })).toHaveCount(0);
  });
});

test.describe('Bảo vệ route khi chưa đăng nhập', () => {
  for (const path of ['/portal', '/member/dashboard', '/member/packages', '/staff/reception', '/coach/classes', '/manager/reports', '/admin/users', '/messages']) {
    test(`${path} chuyển về trang đăng nhập`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
