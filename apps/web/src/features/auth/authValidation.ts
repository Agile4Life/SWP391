import { z } from 'zod';

export const PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
/** Cùng quy tắc với PasswordPolicy ở backend: 8–50 ký tự, ít nhất một chữ cái và một chữ số, không có khoảng trắng. */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)\S{8,50}$/;
export const PASSWORD_RULE_ERROR = 'Mật khẩu phải dài 8–50 ký tự, có ít nhất 1 chữ cái và 1 chữ số, không chứa khoảng trắng.';
export const PASSWORD_RULE_HINT = '8–50 ký tự, có chữ cái và chữ số, không khoảng trắng';
/** Kiểm tra mật khẩu theo quy tắc chung (8–50 ký tự, có chữ và số, không khoảng trắng). */
export const isValidPassword = (value: string) => PASSWORD_REGEX.test(value);
export const EMAIL_REGEX = /^[a-zA-Z0-9]+([._%+-][a-zA-Z0-9]+)*@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
const GMAIL_LOCAL_REGEX = /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*(\+[a-zA-Z0-9._-]+)?$/;
const INVALID_GMAIL_DOMAIN_REGEX = /^(gmail\.(?!com$).+|(gmai|gmial|gmal|gamil)\..+)$/i;

/**
 * Kiểm tra email: đúng định dạng và loại bỏ tên miền gmail gõ sai (gmai, gmial...); email Gmail còn kiểm tra
 * phần trước @.
 */
export function isValidEmailAddress(raw: string): boolean {
  const value = raw.trim();
  if (!EMAIL_REGEX.test(value)) return false;
  const [localPart, domainPart] = value.split('@');
  const domain = domainPart.toLowerCase();
  if (INVALID_GMAIL_DOMAIN_REGEX.test(domain)) return false;
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return GMAIL_LOCAL_REGEX.test(localPart);
  }
  return true;
}

/** Chuẩn hóa số điện thoại Việt Nam: bỏ khoảng trắng, dấu chấm, gạch, ngoặc và đổi +84/84 thành 0. */
export function normalizePhoneNumber(raw?: string | null): string {
  if (!raw) return '';
  const compact = raw.trim().replace(/[\s.\-()]+/g, '');
  if (/^\+84\d{9}$/.test(compact)) return '0' + compact.slice(3);
  if (/^84\d{9}$/.test(compact)) return '0' + compact.slice(2);
  return compact;
}

/** Kiểm tra số điện thoại Việt Nam hợp lệ sau khi chuẩn hóa. */
export function isValidPhoneNumber(raw: string): boolean {
  return PHONE_REGEX.test(normalizePhoneNumber(raw));
}

export const registrationSchema = z.object({
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự).').max(150, 'Họ và tên tối đa 150 ký tự.'),
  username: z.string().trim().min(3, 'Tên đăng nhập cần tối thiểu 3 ký tự.'),
  email: z.string().trim().refine(isValidEmailAddress, 'Email không đúng định dạng (vd: user@example.com).'),
  phone: z.string().transform(normalizePhoneNumber)
    .refine(value => !value || PHONE_REGEX.test(value), 'Số điện thoại không hợp lệ (vd: 0912 345 678).')
    .transform(value => value || undefined),
  password: z.string().regex(PASSWORD_REGEX, PASSWORD_RULE_ERROR),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập hoặc email.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});

export const otpSchema = z.string().trim().regex(/^\d{6}$/, 'Mã OTP gồm đúng 6 chữ số.');
/** Kiểu dữ liệu đầu vào của biểu mẫu đăng ký. */
export type RegistrationFields = z.input<typeof registrationSchema>;

/** Kiểm tra một trường của biểu mẫu đăng ký; trả về thông báo lỗi đầu tiên hoặc undefined nếu hợp lệ. */
export function validateRegistrationField(field: keyof RegistrationFields, value: string): string | undefined {
  const parsed = registrationSchema.shape[field].safeParse(value);
  return parsed.success ? undefined : parsed.error.issues[0]?.message;
}
