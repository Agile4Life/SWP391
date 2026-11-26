import { apiFetch } from '../../shared/api/client';

/** Bộ môn: tên và mô tả. */
export interface Discipline {
  id: number;
  name: string;
  description: string | null;
}

/** Phòng tập: vị trí, sức chứa, trạng thái và hạng. */
export interface Room {
  id: number;
  name: string;
  location: string | null;
  capacity: number;
  status: 'available' | 'maintenance' | 'closed';
  tier?: 'STANDARD' | 'PLATINUM' | string | null;
}

/** Gói tập: giá, thời hạn, giới hạn credit lớp, trạng thái và hạng. */
export interface MembershipPackage {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  classCreditLimit: number | null;
  status: 'active' | 'inactive';
  tier?: 'SILVER' | 'GOLD' | 'PLATINUM' | string | null;
}

/** Dữ liệu gửi lên khi lưu: bản ghi bỏ id. */
type Body<T> = Omit<T, 'id'>;

/** Tạo cấu hình request JSON với phương thức và nội dung. */
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/** Gom các hàm API danh mục bộ môn, phòng và gói tập. */
export const catalogApi = {
  // Danh sách bộ môn.
  disciplines: () => apiFetch<Discipline[]>('/disciplines'),
  // Tạo (id rỗng) hoặc cập nhật bộ môn.
  saveDiscipline: (id: number | null, b: Body<Discipline>) =>
    apiFetch<Discipline>(id ? `/disciplines/${id}` : '/disciplines', json(id ? 'PUT' : 'POST', b)),
  // Xóa bộ môn.
  deleteDiscipline: (id: number) => apiFetch<void>(`/disciplines/${id}`, { method: 'DELETE' }),

  // Danh sách phòng.
  rooms: () => apiFetch<Room[]>('/rooms'),
  createRoom: (b: Body<Room>) => apiFetch<Room>('/rooms', json('POST', b)),
  updateRoom: (id: number, b: Body<Room>) => apiFetch<Room>(`/rooms/${id}`, json('PUT', b)),
  deleteRoom: (id: number) => apiFetch<void>(`/rooms/${id}`, { method: 'DELETE' }),

  // Danh sách gói tập.
  packages: () => apiFetch<MembershipPackage[]>('/packages'),
  // Tạo hoặc cập nhật gói tập.
  savePackage: (id: number | null, b: Body<MembershipPackage>) =>
    apiFetch<MembershipPackage>(id ? `/packages/${id}` : '/packages', json(id ? 'PUT' : 'POST', b)),
  // Xóa gói tập.
  deletePackage: (id: number) => apiFetch<void>(`/packages/${id}`, { method: 'DELETE' }),
  // Đổi trạng thái hoạt động của gói tập.
  setPackageStatus: (id: number, status: MembershipPackage['status']) =>
    apiFetch<MembershipPackage>(`/packages/${id}/status`, json('PATCH', { status })),
};
