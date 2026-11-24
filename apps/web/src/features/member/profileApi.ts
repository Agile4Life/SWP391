import { apiFetch, setAuthSession } from '../../shared/api/client';

/**
 * Hồ sơ người dùng: thông tin cá nhân, liên hệ khẩn cấp, mục tiêu/sức khỏe (hội viên), chuyên môn (HLV), ca làm
 * (lễ tân) và trạng thái xác minh danh tính.
 */
export interface Profile {
  userId: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  avatarUrl: string | null;
  address: string | null;
  membershipCode: string | null;
  healthNotes: string | null;
  fitnessGoal: string | null;
  fitnessLevel: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  specialization?: string | null;
  bio?: string | null;
  certification?: string | null;
  shift?: string | null;
  documentType?: string | null;
  citizenId?: string | null;
  nationality?: string | null;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  identityVerified?: boolean | null;
  /** PENDING (waiting for the desk), APPROVED or REJECTED; null for members verified before reviews existed. */
  kycStatus?: string | null;
  kycRejectReason?: string | null;
}

/** Dữ liệu hội viên nộp xác minh danh tính (KYC): loại và số giấy tờ, họ tên, quốc tịch và ảnh. */
export interface MemberKycRequest {
  documentType?: 'CCCD' | 'PASSPORT';
  citizenId: string;
  fullName: string;
  nationality?: string;
  frontImageUrl: string;
  backImageUrl?: string;
}

/** Dữ liệu HLV cập nhật hồ sơ: chuyên môn, giới thiệu, chứng chỉ. */
export interface CoachProfileUpdate {
  specialization: string | null;
  bio: string | null;
  certification: string | null;
}

/** Dữ liệu lễ tân cập nhật ca làm. */
export interface ReceptionistProfileUpdate {
  shift: string | null;
}

/** Lấy hồ sơ của người dùng đang đăng nhập. */
export const getProfile = () => apiFetch<Profile>('/profile');

/** Avatar and identity images have their own endpoints; leaving their data URLs out keeps the PUT body small. */
const PROFILE_PUT_SKIPPED = new Set(['avatarUrl', 'frontImageUrl', 'backImageUrl']);
/** Cập nhật hồ sơ (bỏ ảnh đại diện và ảnh giấy tờ khỏi body vì có endpoint riêng). */
export const updateProfile = (profile: Profile) =>
  apiFetch<Profile>('/profile', {
    method: 'PUT',
    body: JSON.stringify(profile, (key, value) => (PROFILE_PUT_SKIPPED.has(key) ? undefined : value)),
  });

/** Nộp hồ sơ xác minh danh tính. */
export const submitMemberKyc = (data: MemberKycRequest) =>
  apiFetch<Profile>('/profile/kyc', { method: 'POST', body: JSON.stringify(data) });

/** Đổi ảnh đại diện (null để xóa). */
export const uploadAvatar = (avatarUrl: string | null) =>
  apiFetch<Profile>('/profile/avatar', { method: 'POST', body: JSON.stringify({ avatarUrl }) });

/**
 * Đổi mật khẩu; backend trả token mới cho phiên này nên được lưu lại.
 *
 * Changing the password signs out every other session; the API returns a fresh token for this one.
 */
export const changePassword = async (currentPassword: string, newPassword: string) => {
  const renewed = await apiFetch<{ token: string; username: string; role: string; fullName?: string | null } | null>('/profile/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (renewed?.token) setAuthSession(renewed.token, renewed.username, renewed.role, renewed.fullName);
};

/** Cập nhật hồ sơ HLV. */
export const updateCoachProfile = (payload: CoachProfileUpdate) =>
  apiFetch<void>('/profile/coach', { method: 'PUT', body: JSON.stringify(payload) });

/** Cập nhật hồ sơ lễ tân. */
export const updateReceptionistProfile = (payload: ReceptionistProfileUpdate) =>
  apiFetch<void>('/profile/receptionist', { method: 'PUT', body: JSON.stringify(payload) });
