import { apiFetch } from '../../shared/api/client';

/** Vai trò nhân sự: HLV hoặc lễ tân. */
export type StaffRole = 'COACH' | 'RECEPTIONIST';
/** Một tài khoản nhân sự: họ tên, email, điện thoại, vai trò và trạng thái. */
export interface StaffAccount {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  roleCode: StaffRole;
  status: string;
}
/** Dữ liệu tạo tài khoản nhân sự: họ tên, email, điện thoại, mật khẩu, giới tính và vai trò. */
export interface StaffAccountInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  gender: 'male' | 'female' | 'other';
  roleCode: StaffRole;
}

/** Lấy danh sách tài khoản nhân sự. */
export const listStaffAccounts = () => apiFetch<StaffAccount[]>('/staff-accounts');
/** Khóa hoặc mở khóa một tài khoản nhân sự. */
export const setStaffAccountLocked = (id: number, locked: boolean) =>
  apiFetch<StaffAccount>(`/staff-accounts/${id}/${locked ? 'lock' : 'unlock'}`, { method: 'PATCH' });
/** Tạo tài khoản nhân sự mới. */
export const createStaffAccount =(input: StaffAccountInput) => apiFetch<StaffAccount>('/staff-accounts', {
  method: 'POST', body: JSON.stringify(input),
});
