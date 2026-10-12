export interface UserSession {
  id: string;
  name: string;
  identifier: string;
  role: 'MEMBER' | 'STAFF' | 'COACH' | 'MANAGER';
}

export interface LoginResponse {
  token: string;
  user: UserSession;
}

export const AUTH_STORAGE_KEY = 'fitcenter_auth_session';

// Lấy thông tin user hiện tại
export function getCurrentUser(): UserSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
}

// Lưu session
export function setCurrentUser(user: UserSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

// Xóa session (Logout hoặc khi gặp 401)
export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem('fitcenter_token');
}

export const TOKEN_STORAGE_KEY = 'fitcenter_token';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Map backend role codes to the UI session roles
const SESSION_ROLE: Record<string, UserSession['role']> = {
  MEMBER: 'MEMBER',
  COACH: 'COACH',
  RECEPTIONIST: 'STAFF',
  CENTER_MANAGER: 'MANAGER',
};

// Calls the real API with the stored JWT; unwraps ApiResponse.data and throws ApiError on failure
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'vi',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.', 0);
  }
  const body = await res.json().catch(() => null);
  if (res.status === 401 && token && !path.startsWith('/auth/')) {
    // Phiên đăng nhập hết hạn: đưa người dùng về trang đăng nhập kèm lời giải thích
    clearAuthSession();
    window.location.assign('/login?expired=1');
  }
  if (!res.ok) throw new ApiError(body?.message ?? `Yêu cầu thất bại (HTTP ${res.status})`, res.status, body?.code);
  return (body && 'data' in body ? body.data : body) as T;
}

export async function loginApi(identifier: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<{ token: string; username: string; role: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: identifier.trim(), password }),
  });
  const role = SESSION_ROLE[data.role];
  if (!role) throw new ApiError('Vai trò tài khoản chưa được hỗ trợ trên portal.', 403);

  const user: UserSession = { id: data.username, name: data.username, identifier: data.username, role };
  localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
  setCurrentUser(user);
  return { token: data.token, user };
}

// Màn hình mặc định sau đăng nhập theo từng vai trò
export const homePath = (role: UserSession['role']): string => {
  switch (role) {
    case 'MANAGER':
      return '/manager/users';
    case 'STAFF':
      return '/staff/reception';
    case 'COACH':
      return '/staff/attendance';
    case 'MEMBER':
    default:
      return '/member/dashboard';
  }
};
