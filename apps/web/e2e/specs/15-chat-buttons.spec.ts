import { test, expect, settled } from '../fixtures';
import { authFile } from '../helpers/accounts';
import type { Page } from '@playwright/test';

/**
 * Bấm thật từng nút trong tin nhắn (widget nổi và trang /messages). Playwright từ chối click khi nút bị phần tử khác
 * đè lên ("intercepts pointer events"), nên spec này bắt đúng lỗi "nút nhìn thấy nhưng không ấn được".
 */
const widget = (page: Page) => page.locator('.chat-widget');
const panel = (page: Page) => page.getByRole('dialog', { name: 'Tin nhắn SÖL' });

async function openWidget(page: Page) {
  await page.goto('/member/dashboard');
  await settled(page);
  await page.getByRole('button', { name: /^Mở tin nhắn/ }).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: 'Hội thoại của bạn' })).toBeVisible();
  await expect(panel(page).getByRole('status').filter({ hasText: /Đang mở|Đang tải/ })).toHaveCount(0, { timeout: 15_000 });
}

/** Mở cuộc trò chuyện đầu tiên trong danh bạ (lễ tân/HLV) và chờ khung soạn tin sẵn sàng. */
async function openFirstContact(root: Page | ReturnType<typeof panel>, page: Page) {
  await root.getByRole('button', { name: 'Cuộc trò chuyện mới' }).click();
  await expect(root.getByRole('button', { name: 'Đóng danh bạ' })).toBeVisible();
  const contact = root.locator('button[data-contact-id]').first();
  await expect(contact).toBeVisible({ timeout: 15_000 });
  await contact.click();
  await expect(root.locator('#chat-message')).toBeEnabled({ timeout: 15_000 });
  void page;
}

test.describe('Tin nhắn — widget nổi (hội viên)', () => {
  test.use({ storageState: authFile('binh') });

  test('nút nổi mở/đóng được bằng chuột, nút Đóng và Escape', async ({ page }) => {
    await openWidget(page);
    await panel(page).getByRole('button', { name: 'Đóng cửa sổ tin nhắn' }).click();
    await expect(panel(page)).toBeHidden();
    await page.getByRole('button', { name: /^Mở tin nhắn/ }).click();
    await expect(panel(page)).toBeVisible();
    // Khi panel mở, nút nổi được ẩn có chủ đích (opacity 0, pointer-events none); đóng bằng nút X, Escape hoặc bấm ra ngoài.
    await page.mouse.click(300, 600);
    await expect(panel(page)).toBeHidden();
    await page.getByRole('button', { name: /^Mở tin nhắn/ }).click();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
  });

  test('nút Mở rộng / Thu nhỏ bấm được và đổi trạng thái', async ({ page }) => {
    await openWidget(page);
    const expand = panel(page).getByRole('button', { name: 'Mở rộng cửa sổ tin nhắn' });
    await expand.click();
    await expect(panel(page).getByRole('button', { name: 'Thu nhỏ cửa sổ tin nhắn' })).toHaveAttribute('aria-pressed', 'true');
    await panel(page).getByRole('button', { name: 'Thu nhỏ cửa sổ tin nhắn' }).click();
    await expect(panel(page).getByRole('button', { name: 'Mở rộng cửa sổ tin nhắn' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('danh bạ: mở/đóng, tìm kiếm, chọn người, soạn emoji, gửi, thả tim', async ({ page }) => {
    await openWidget(page);
    await openFirstContact(panel(page), page);
    const composer = panel(page).locator('#chat-message');

    // Emoji: mở thanh, chèn một biểu tượng, nút Gửi bật lên.
    await panel(page).getByRole('button', { name: 'Chọn biểu tượng cảm xúc' }).click();
    await expect(panel(page).getByRole('group', { name: 'Biểu tượng cảm xúc' })).toBeVisible();
    await panel(page).getByRole('button', { name: /^Chèn 👍/ }).click();
    await expect(composer).toHaveValue('👍');

    const text = `e2e chat ${Date.now()}`;
    await composer.fill(text);
    const send = panel(page).getByRole('button', { name: 'Gửi', exact: true });
    await expect(send).toBeEnabled();
    await send.click();
    await expect(panel(page).locator('.direct-chat__messages')).toContainText(text);

    // Thả tim rồi bỏ tim.
    const like = panel(page).getByRole('button', { name: 'Thả tim tin nhắn' }).last();
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'false');

    // Trong hội thoại, danh sách bị thay bằng khung chat: nút Quay lại phải đưa về danh sách.
    await panel(page).getByRole('button', { name: 'Quay lại danh sách' }).click();
    await expect(panel(page).getByRole('heading', { name: 'Hội thoại của bạn' })).toBeVisible();
    await panel(page).getByRole('button', { name: 'Cuộc trò chuyện mới' }).click();
    await panel(page).getByRole('button', { name: 'Đóng danh bạ' }).click();
    await expect(panel(page).locator('#chat-directory')).toHaveCount(0);
  });

  test('đang trong hội thoại (người và SÖL AI): nút Mở rộng và Đóng ở góc phải vẫn bấm được', async ({ page }) => {
    const header = (name: string | RegExp) => panel(page).getByRole('button', { name });
    for (const kind of ['ai', 'human'] as const) {
      await openWidget(page);
      if (kind === 'ai') await panel(page).getByRole('button', { name: /SÖL AI/ }).first().click();
      else await openFirstContact(panel(page), page);
      await expect(panel(page).locator('.direct-chat__thread')).toBeVisible();
      // Playwright từ chối click nếu nút bị phần tử khác đè lên, nên đây bắt đúng lỗi "nhìn thấy nhưng không ấn được".
      await header('Mở rộng cửa sổ tin nhắn').click();
      await expect(header('Thu nhỏ cửa sổ tin nhắn')).toHaveAttribute('aria-pressed', 'true');
      await header('Thu nhỏ cửa sổ tin nhắn').click();
      await expect(header('Mở rộng cửa sổ tin nhắn')).toHaveAttribute('aria-pressed', 'false');
      await header('Đóng cửa sổ tin nhắn').click();
      await expect(panel(page)).toBeHidden();
    }
  });

  test('ô tìm danh bạ: nút Tìm bấm được và lọc không lỗi', async ({ page }) => {
    await openWidget(page);
    await panel(page).getByRole('button', { name: 'Cuộc trò chuyện mới' }).click();
    await panel(page).getByPlaceholder('Tìm kiếm người nhận...').fill('zzzz-khong-ton-tai');
    await panel(page).getByRole('button', { name: 'Tìm', exact: true }).click();
    await expect(panel(page)).toContainText('Không tìm thấy lễ tân hoặc huấn luyện viên của lớp bạn đã đăng ký.');
  });

  test('SÖL AI: chọn trong danh sách, hội thoại mới, gửi tin', async ({ page }) => {
    await openWidget(page);
    await panel(page).getByRole('button', { name: /SÖL AI/ }).first().click();
    await expect(panel(page).locator('.direct-chat__thread--ai')).toBeVisible();
    await panel(page).getByRole('button', { name: 'Cuộc trò chuyện mới với SÖL AI' }).click();
    await panel(page).getByRole('button', { name: 'Chọn biểu tượng cảm xúc' }).click();
    await panel(page).getByRole('button', { name: /^Chèn 💪/ }).click();
    const send = panel(page).getByRole('button', { name: 'Gửi', exact: true });
    await expect(send).toBeEnabled();
    await send.click();
    await expect(panel(page).locator('.direct-chat__transcript')).toContainText('💪');
  });
});

test.describe('Tin nhắn — trang /messages (hội viên)', () => {
  test.use({ storageState: authFile('binh') });

  test('làm mới, danh bạ, chọn người, gửi và thả tim', async ({ page }) => {
    await page.goto('/messages');
    await settled(page);
    const main = page.locator('main');
    await main.getByRole('button', { name: 'Làm mới tin nhắn' }).click();
    await openFirstContact(main as never, page);
    const text = `e2e trang ${Date.now()}`;
    await main.locator('#chat-message').fill(text);
    await main.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(main.locator('.direct-chat__messages')).toContainText(text);
    const like = main.getByRole('button', { name: 'Thả tim tin nhắn' }).last();
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Tin nhắn — hội viên trên điện thoại', () => {
  test.use({ storageState: authFile('binh'), viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('nút nổi, danh bạ, chọn người, Quay lại danh sách bấm được', async ({ page }) => {
    await page.goto('/member/dashboard');
    await settled(page);
    await page.getByRole('button', { name: /^Mở tin nhắn/ }).tap();
    await expect(panel(page)).toBeVisible();
    await openFirstContact(panel(page), page);
    await panel(page).locator('#chat-message').fill('e2e mobile');
    await panel(page).getByRole('button', { name: 'Gửi', exact: true }).tap();
    await expect(panel(page).locator('.direct-chat__messages')).toContainText('e2e mobile');
    await panel(page).getByRole('button', { name: 'Quay lại danh sách' }).tap();
    await expect(panel(page).getByRole('heading', { name: 'Hội thoại của bạn' })).toBeVisible();
    await panel(page).getByRole('button', { name: 'Đóng cửa sổ tin nhắn' }).tap();
    await expect(panel(page)).toBeHidden();
  });
});

test.describe('Tin nhắn — HLV (người nhận)', () => {
  test.describe('HLV Mai', () => {
    test.use({ storageState: authFile('coachYoga') });
    // Hội viên ở các test trên đã nhắn cho HLV đầu danh bạ (Mai) nên hội thoại này có sẵn khi chạy cả file.
    test('mở widget, chọn hội thoại, trả lời', async ({ page }) => {
      await page.goto('/coach/classes');
      await settled(page);
      await page.getByRole('button', { name: /^Mở tin nhắn/ }).click();
      await expect(panel(page)).toBeVisible();
      await expect(widget(page)).toBeVisible();
      // Danh sách chỉ hiện (kèm SÖL AI ghim đầu) sau khi tải xong; đợi nó trước khi đếm hội thoại.
      await expect(panel(page).locator('.direct-chat__person--ai')).toBeVisible({ timeout: 15_000 });
      const conversation = panel(page).locator('.direct-chat__list button.direct-chat__person:not(.direct-chat__person--ai)').first();
      test.skip(await conversation.count() === 0, 'HLV chưa có hội thoại nào trong DB e2e (chạy cả file để hội viên nhắn trước)');
      await conversation.click();
      await expect(panel(page).locator('#chat-message')).toBeEnabled({ timeout: 15_000 });
      const text = `e2e tra loi ${Date.now()}`;
      await panel(page).locator('#chat-message').fill(text);
      await panel(page).getByRole('button', { name: 'Gửi', exact: true }).click();
      await expect(panel(page).locator('.direct-chat__messages')).toContainText(text);
    });
  });
});

test.describe('Tin nhắn — hội viên chưa đăng ký lớp của HLV nào', () => {
  test.use({ storageState: authFile('lan') });

  test('chỉ thấy lễ tân và có thông báo dẫn tới trang lớp học', async ({ page }) => {
    await openWidget(page);
    await panel(page).getByRole('button', { name: 'Cuộc trò chuyện mới' }).click();
    const notice = panel(page).getByTestId('chat-no-coach');
    await expect(notice).toContainText('Chưa có huấn luyện viên để nhắn tin');
    await expect(notice.getByRole('link', { name: 'Xem lớp học' })).toHaveAttribute('href', '/member/classes');
    await expect(panel(page).locator('button[data-contact-id]').first()).toBeVisible();
    await expect(panel(page).getByText('Huấn luyện viên', { exact: true })).toHaveCount(0);
  });
});

test.describe('Tin nhắn — API chặn HLV không có lớp chung', () => {
  test('hội viên chưa có lớp bị 403 CHAT_COACH_NOT_ENROLLED, có lớp thì mở được', async () => {
    const { api } = await import('../helpers/api');
    const contacts = await api<{ content: { id: number; role: string }[] }>('an', 'GET', '/chat/contacts?query=');
    const coachId = contacts.data.content.find((c) => c.role === 'COACH')!.id;
    const denied = await api('lan', 'POST', '/chat/conversations', { contactId: coachId });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('CHAT_COACH_NOT_ENROLLED');
    const allowed = await api('an', 'POST', '/chat/conversations', { contactId: coachId });
    expect(allowed.status).toBe(200);
  });
});
