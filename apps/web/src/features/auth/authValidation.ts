import { z } from 'zod';

export const PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
export const EMAIL_REGEX = /^[a-zA-Z0-9]+([._%+-][a-zA-Z0-9]+)*@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
const GMAIL_LOCAL_REGEX = /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*(\+[a-zA-Z0-9._-]+)?$/;
const INVALID_GMAIL_DOMAIN_REGEX = /^(gmail\.(?!com$).+|(gmai|gmial|gmal|gamil)\..+)$/i;

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

export function normalizePhoneNumber(raw?: string | null): string {
  if (!raw) return '';
  const compact = raw.trim().replace(/[\s.\-()]+/g, '');
  if (/^\+84\d{9}$/.test(compact)) return '0' + compact.slice(3);
  if (/^84\d{9}$/.test(compact)) return '0' + compact.slice(2);
  return compact;
}

export function isValidPhoneNumber(raw: string): boolean {
  return PHONE_REGEX.test(normalizePhoneNumber(raw));
}

export const registrationSchema = z.object({
  username: z.string().trim().min(3, 'Tên đăng nhập cần tối thiểu 3 ký tự.'),
  email: z.string().trim().refine(isValidEmailAddress, 'Email không đúng định dạng (vd: user@example.com).'),
  phone: z.string().transform(value => value.replace(/\s/g, ''))
    .refine(value => !value || PHONE_REGEX.test(value), 'Số điện thoại không hợp lệ (vd: 0912 345 678).')
    .transform(value => value || undefined),
  password: z.string().min(6, 'Mật khẩu cần tối thiểu 6 ký tự.'),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập hoặc email.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});

export const otpSchema = z.string().trim().regex(/^\d{6}$/, 'Mã OTP gồm đúng 6 chữ số.');
export type RegistrationFields = z.input<typeof registrationSchema>;

export function validateRegistrationField(field: keyof RegistrationFields, value: string): string | undefined {
  const parsed = registrationSchema.shape[field].safeParse(value);
  return parsed.success ? undefined : parsed.error.issues[0]?.message;
}
