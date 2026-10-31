import { z } from 'zod';

export const registrationSchema = z.object({
  username: z.string().trim().min(3, 'Tên đăng nhập cần tối thiểu 3 ký tự.'),
  email: z.string().trim().email('Email không đúng định dạng (vd: user@example.com).'),
  phone: z.string().transform(value => value.replace(/\s/g, ''))
    .refine(value => !value || /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(value), 'Số điện thoại không hợp lệ (vd: 0912 345 678).')
    .transform(value => value || undefined),
  password: z.string().min(6, 'Mật khẩu cần tối thiểu 6 ký tự.'),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập hoặc email.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});

export const otpSchema = z.string().trim().regex(/^\d{6}$/, 'Mã OTP gồm đúng 6 chữ số.');
export type RegistrationFields = z.input<typeof registrationSchema>;
