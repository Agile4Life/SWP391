import { clearNotices } from '../lib/portalNotices';
import { clearPurchaseIntent } from '../lib/purchaseIntent';
import { getLanguage, sourceMessage, type SourceMessage } from '../i18n';

/** Thông tin phiên đăng nhập lưu ở trình duyệt: id, tên hiển thị, tên đăng nhập và vai trò trên portal. */
export interface UserSession {
  id: string;
  name: string;
  identifier: string;
  role: 'MEMBER' | 'STAFF' | 'COACH' | 'MANAGER' | 'ADMIN';
}

/** Kết quả đăng nhập: JWT và thông tin phiên. */
export interface LoginResponse {
  token: string;
  user: UserSession;
}

export const AUTH_STORAGE_KEY = 'fitcenter_auth_session';

export const TOKEN_STORAGE_KEY = 'fitcenter_token';

const VALID_PORTAL_ROLES = new Set<UserSession['role']>(['MEMBER', 'STAFF', 'COACH', 'MANAGER', 'ADMIN']);

// Ánh xạ mã vai trò từ backend sang vai trò phiên trên giao diện
const SESSION_ROLE: Record<string, UserSession['role']> = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  COACH: 'COACH',
  RECEPTIONIST: 'STAFF',
  CENTER_MANAGER: 'MANAGER',
};

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Bỏ qua khi trình duyệt chặn localStorage (chế độ riêng tư / hạn ngạch).
  }
}

function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Bỏ qua khi trình duyệt chặn localStorage.
  }
}

const sessionListeners = new Set<() => void>();
let storageListenerAttached = false;

/** Báo cho mọi listener trong tab hiện tại rằng phiên đăng nhập vừa thay đổi. */
function notifySessionChange(): void {
  sessionListeners.forEach((listener) => listener());
}

function onSessionStorage(event: StorageEvent): void {
  if (event.key === null || event.key === AUTH_STORAGE_KEY || event.key === TOKEN_STORAGE_KEY) {
    notifySessionChange();
  }
}

/** Theo dõi thay đổi session ở tab hiện tại và (qua một listener `storage` dùng chung) ở các tab khác. */
export function subscribeAuthSession(listener: () => void): () => void {
  sessionListeners.add(listener);
  if (!storageListenerAttached && typeof window !== 'undefined') {
    window.addEventListener('storage', onSessionStorage);
    storageListenerAttached = true;
  }
  return () => {
    sessionListeners.delete(listener);
    if (sessionListeners.size === 0 && storageListenerAttached && typeof window !== 'undefined') {
      window.removeEventListener('storage', onSessionStorage);
      storageListenerAttached = false;
    }
  };
}

/** Chuỗi session thô: dùng làm snapshot ổn định cho useSyncExternalStore. */
export function readRawAuthSession(): string | null {
  return safeStorageGet(AUTH_STORAGE_KEY);
}

/** Đọc chuỗi JSON phiên, xác thực hình dạng tối thiểu và chuẩn hóa mã vai trò; chuỗi lỗi hoặc sai cấu trúc trả null. */
export function parseAuthSession(raw: string | null): UserSession | null {
  try {
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
    if (typeof obj.role !== 'string' || !obj.role.trim()) return null;
    const normalizedRole = SESSION_ROLE[obj.role] ?? (VALID_PORTAL_ROLES.has(obj.role as UserSession['role']) ? (obj.role as UserSession['role']) : undefined);
    if (!normalizedRole) return null;
    const identifier = typeof obj.identifier === 'string' && obj.identifier.trim() ? obj.identifier : obj.id;
    const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name : identifier;
    return {
      id: obj.id,
      name,
      identifier,
      role: normalizedRole,
    };
  } catch {
    return null;
  }
}

// Lấy thông tin user hiện tại
export function getCurrentUser(): UserSession | null {
  return parseAuthSession(readRawAuthSession());
}

// Lưu session
export function setCurrentUser(user: UserSession): void {
  safeStorageSet(AUTH_STORAGE_KEY, JSON.stringify(user));
  notifySessionChange();
}

let redirectingForToken: string | null = null;

function clearAuthSessionInternal(): void {
  safeStorageRemove(AUTH_STORAGE_KEY);
  safeStorageRemove(TOKEN_STORAGE_KEY);
  clearNotices();
  clearPurchaseIntent();
  notifySessionChange();
}

// Xóa session (Logout hoặc khi gặp 401)
export function clearAuthSession(): void {
  redirectingForToken = null;
  clearAuthSessionInternal();
}

/**
 * Chỉ kết thúc phiên khi token gây ra 401 vẫn là token đang lưu.
 * - Nếu trình duyệt đang lưu một token khác (khác null và khác sentToken), phiên đã bị thay thế → trả về true (SESSION_REPLACED).
 * - Nếu token đã bị xóa (do một request 401 song song hoặc do người dùng chủ động đăng xuất) hoặc đang điều hướng cho chính token này → không xóa lại, không redirect trùng, và không gán nhầm SESSION_REPLACED.
 */
function handleUnauthorized(sentToken: string): boolean {
  const currentToken = safeStorageGet(TOKEN_STORAGE_KEY);
  if (currentToken !== null && currentToken !== sentToken) return true;
  if (currentToken === null || redirectingForToken === sentToken) return false;
  redirectingForToken = sentToken;
  try {
    clearAuthSessionInternal();
    window.location.assign(expiredLoginPath());
  } finally {
    if (safeStorageGet(TOKEN_STORAGE_KEY) !== sentToken) {
      redirectingForToken = null;
    }
  }
  return false;
}

const SESSION_REPLACED_MESSAGE = 'Phiên đăng nhập đã thay đổi. Vui lòng tải lại trang.';
const SESSION_REPLACED_TRANSLATION = sourceMessage(
  SESSION_REPLACED_MESSAGE,
  'Your login session has changed. Please reload the page.',
);

/** Đường dẫn trang đăng nhập khi phiên hết hạn; đang ở trang chọn gói thì kèm returnTo để quay lại. */
function expiredLoginPath(): string {
  const target = window.location.pathname === '/member/packages' ? window.location.pathname + window.location.search : null;
  return '/login?expired=1' + (target ? `&returnTo=${encodeURIComponent(target)}` : '');
}

/**
 * Lỗi khi gọi API: giữ mã HTTP, mã lỗi backend, bản dịch hai ngôn ngữ và chi tiết lỗi (nếu có).
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  translation?: SourceMessage;
  details?: unknown;
  constructor(message: string, status: number, code?: string, translation?: SourceMessage, details?: unknown) {
    super(translation ? (getLanguage() === 'en' ? translation.en : translation.vi) : message);
    this.translation = translation;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Gọi API thật kèm JWT đã lưu; mở gói ApiResponse.data và ném ApiError khi thất bại
/** Thời gian chờ mặc định trước khi hủy request; tải file lên có thời gian chờ dài hơn. Người gọi tự truyền `signal` sẽ toàn quyền kiểm soát. */
export const API_TIMEOUT_MS = 30_000;
export const API_UPLOAD_TIMEOUT_MS = 120_000;
const TIMEOUT_MESSAGE = sourceMessage(
  'Máy chủ phản hồi quá lâu. Kiểm tra mạng rồi thử lại. Nếu đang thanh toán, hãy xem lại lịch sử giao dịch trước khi làm lại.',
  'The server took too long to respond. Check your connection and try again. If you were paying, check your transaction history before retrying.',
);
const NETWORK_ERROR_MESSAGE = sourceMessage(
  'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.',
  'Unable to connect to the server. Check your connection and try again.',
);
const BINARY_NETWORK_ERROR_MESSAGE = sourceMessage(
  'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
  'Unable to connect to the server. Please try again.',
);
const INVALID_RESPONSE_MESSAGE = sourceMessage(
  'Phản hồi từ máy chủ không hợp lệ.',
  'The server returned an invalid response.',
);

const CANONICAL_HEADER_NAMES: Record<string, string> = {
  'accept-language': 'Accept-Language',
  authorization: 'Authorization',
  'content-type': 'Content-Type',
};

function isTimeoutDomException(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'TimeoutError') ||
    (error instanceof Error && error.name === 'TimeoutError')
  );
}

function isAbortDomException(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function toTransportError(
  error: unknown,
  timedOut: boolean,
  callerSignal: AbortSignal | null | undefined,
  networkMessage: SourceMessage,
): unknown {
  if (timedOut || isTimeoutDomException(error) || (callerSignal?.aborted && isTimeoutDomException(callerSignal.reason))) {
    return new ApiError(TIMEOUT_MESSAGE.vi, 0, 'TIMEOUT', TIMEOUT_MESSAGE);
  }
  if (isAbortDomException(error) || callerSignal?.aborted) {
    return error;
  }
  return new ApiError(networkMessage.vi, 0, undefined, networkMessage);
}

function buildRequestHeaders(
  initHeaders: HeadersInit | undefined,
  body: RequestInit['body'],
  token: string | null,
): { headers: Record<string, string>; sentToken: string | null } {
  const merged = new Headers();
  if (typeof body === 'string' && body.length > 0) {
    merged.set('Content-Type', 'application/json');
  }
  merged.set('Accept-Language', getLanguage());
  if (token) {
    merged.set('Authorization', `Bearer ${token}`);
  }

  if (initHeaders !== undefined) {
    const caller = new Headers(initHeaders);
    caller.forEach((value, key) => {
      merged.set(key, value);
    });
  }

  const rawAuth = merged.get('authorization');
  if (rawAuth !== null && rawAuth.trim() === '') {
    merged.delete('authorization');
  }

  const finalAuth = merged.get('authorization');
  const bearerMatch = finalAuth?.match(/^Bearer\s+(.+)$/i);
  const sentToken = bearerMatch ? bearerMatch[1].trim() || null : null;

  const headers: Record<string, string> = {};
  merged.forEach((value, key) => {
    const canonical = CANONICAL_HEADER_NAMES[key.toLowerCase()] ?? key;
    headers[canonical] = value;
  });
  return { headers, sentToken };
}

interface ApiEnvelope {
  success?: boolean;
  message?: string;
  code?: string;
  details?: unknown;
  data?: unknown;
}

async function readJsonBody(
  res: Response,
  isTimedOut: () => boolean,
  callerSignal: AbortSignal | null | undefined,
): Promise<{ empty: boolean; body: ApiEnvelope | null }> {
  if (res.status === 204 || res.status === 205) {
    return { empty: true, body: null };
  }
  const contentLength = typeof res.headers?.get === 'function' ? res.headers.get('content-length')?.trim() : null;
  if (contentLength === '0') {
    return { empty: true, body: null };
  }

  if (typeof res.text === 'function') {
    let rawText: string;
    try {
      rawText = await res.text();
    } catch (error) {
      throw toTransportError(error, isTimedOut(), callerSignal, NETWORK_ERROR_MESSAGE);
    }
    if (rawText.trim() === '') {
      return { empty: true, body: null };
    }
    try {
      return { empty: false, body: JSON.parse(rawText) as ApiEnvelope | null };
    } catch {
      if (!res.ok) return { empty: false, body: null };
      throw new ApiError(INVALID_RESPONSE_MESSAGE.vi, res.status, 'INVALID_RESPONSE', INVALID_RESPONSE_MESSAGE);
    }
  }

  if (typeof res.json === 'function') {
    try {
      const parsed = (await res.json()) as ApiEnvelope | null;
      return { empty: false, body: parsed };
    } catch (error) {
      if (isTimedOut() || isTimeoutDomException(error) || isAbortDomException(error) || callerSignal?.aborted) {
        throw toTransportError(error, isTimedOut(), callerSignal, NETWORK_ERROR_MESSAGE);
      }
      if (!res.ok) return { empty: false, body: null };
      throw new ApiError(INVALID_RESPONSE_MESSAGE.vi, res.status, 'INVALID_RESPONSE', INVALID_RESPONSE_MESSAGE);
    }
  }

  return { empty: true, body: null };
}

/**
 * Gọi API backend kèm JWT: tự hủy sau API_TIMEOUT_MS (tải file thì lâu hơn) trừ khi người gọi tự truyền signal;
 * quá giờ thì ném ApiError TIMEOUT; nếu người gọi tự hủy qua AbortSignal thì ném lại AbortError nguyên gốc.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = safeStorageGet(TOKEN_STORAGE_KEY);
  const isUpload = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const timeoutController = !init.signal && typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = timeoutController
    ? setTimeout(() => { timedOut = true; timeoutController.abort(); }, isUpload ? API_UPLOAD_TIMEOUT_MS : API_TIMEOUT_MS)
    : undefined;
  try {
    return await sendApiRequest<T>(path, init, token, timeoutController?.signal, () => timedOut);
  } catch (error) {
    if (timedOut) throw new ApiError(TIMEOUT_MESSAGE.vi, 0, 'TIMEOUT', TIMEOUT_MESSAGE);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Gửi request thật tới /api/v1: gắn ngôn ngữ và JWT, xử lý lỗi mạng/timeout/abort, 401 (phiên bị thay/hết hạn),
 * 413 (file quá lớn), lỗi HTTP khác, rồi trả về phần data của ApiResponse.
 */
async function sendApiRequest<T>(
  path: string,
  init: RequestInit,
  token: string | null,
  timeoutSignal: AbortSignal | undefined,
  isTimedOut: () => boolean,
): Promise<T> {
  const { headers, sentToken } = buildRequestHeaders(init.headers, init.body, token);
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      ...init,
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
      headers,
    });
  } catch (error) {
    throw toTransportError(error, isTimedOut(), init.signal, NETWORK_ERROR_MESSAGE);
  }

  const { empty, body } = await readJsonBody(res, isTimedOut, init.signal);
  if (res.status === 401 && sentToken && (!path.startsWith('/auth/') || path === '/auth/me')) {
    // Phiên đăng nhập hết hạn: đưa người dùng về trang đăng nhập kèm lời giải thích
    if (handleUnauthorized(sentToken)) {
      throw new ApiError(SESSION_REPLACED_MESSAGE, 401, 'SESSION_REPLACED', SESSION_REPLACED_TRANSLATION);
    }
  }
  if (res.status === 413 && !body?.message) {
    // Proxy từ chối payload quá lớn trước khi request tới API nên không có thông báo JSON để hiển thị.
    const tooLarge = 'Dữ liệu gửi lên quá lớn. Hãy chọn ảnh nhỏ hơn rồi thử lại.';
    throw new ApiError(tooLarge, 413, 'PAYLOAD_TOO_LARGE', sourceMessage(tooLarge, 'The upload is too large. Choose a smaller photo and try again.'));
  }
  if (!res.ok) {
    throw new ApiError(
      body?.message ?? `Yêu cầu thất bại (HTTP ${res.status})`,
      res.status,
      body?.code,
      body?.message ? undefined : sourceMessage(`Yêu cầu thất bại (HTTP ${res.status})`, `Request failed (HTTP ${res.status})`),
      body?.details,
    );
  }
  if (empty) {
    return null as T;
  }
  // ApiResponse lược bỏ trường data khi null (Jackson NON_NULL); không truyền HTTP status của wrapper vào DTO tính năng.
  if (body && typeof body === 'object' && ('data' in body || body.success === true)) {
    return (body.data ?? null) as T;
  }
  return body as T;
}

async function fetchBinary(path: string, init: RequestInit, requirePdf: boolean): Promise<Blob> {
  const token = safeStorageGet(TOKEN_STORAGE_KEY);
  const { headers, sentToken } = buildRequestHeaders(init.headers, init.body, token);
  const timeoutController = !init.signal && typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = timeoutController
    ? setTimeout(() => { timedOut = true; timeoutController.abort(); }, API_TIMEOUT_MS)
    : undefined;

  try {
    let res: Response;
    try {
      res = await fetch(`/api/v1${path}`, {
        ...init,
        ...(timeoutController ? { signal: timeoutController.signal } : {}),
        headers,
      });
    } catch (error) {
      throw toTransportError(error, timedOut, init.signal, BINARY_NETWORK_ERROR_MESSAGE);
    }

    if (res.status === 401 && sentToken) {
      if (handleUnauthorized(sentToken)) {
        throw new ApiError(SESSION_REPLACED_MESSAGE, 401, 'SESSION_REPLACED', SESSION_REPLACED_TRANSLATION);
      }
    }
    if (!res.ok) {
      const { body } = await readJsonBody(res, () => timedOut, init.signal);
      throw new ApiError(
        body?.message ?? `Yêu cầu thất bại (HTTP ${res.status})`,
        res.status,
        body?.code,
        body?.message ? undefined : sourceMessage(`Yêu cầu thất bại (HTTP ${res.status})`, `Request failed (HTTP ${res.status})`),
        body?.details,
      );
    }
    if (requirePdf && !res.headers.get('Content-Type')?.toLowerCase().startsWith('application/pdf')) {
      throw new ApiError(
        'Máy chủ không trả về file PDF hợp lệ.',
        res.status,
        undefined,
        sourceMessage('Máy chủ không trả về file PDF hợp lệ.', 'The server did not return a valid PDF file.'),
      );
    }
    try {
      return await res.blob();
    } catch (error) {
      throw toTransportError(error, timedOut, init.signal, BINARY_NETWORK_ERROR_MESSAGE);
    }
  } catch (error) {
    if (timedOut) throw new ApiError(TIMEOUT_MESSAGE.vi, 0, 'TIMEOUT', TIMEOUT_MESSAGE);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Tải nội dung nhị phân PDF có xác thực JWT cho các endpoint không dùng vỏ JSON ApiResponse; lỗi thì ném ApiError.
 */
export async function apiFetchPdf(path: string, init: RequestInit = {}): Promise<Blob> {
  return fetchBinary(path, init, true);
}

/**
 * Tải nội dung nhị phân có xác thực JWT (ví dụ tài liệu y tế); người gọi tự chuyển blob thành object URL.
 */
export async function apiFetchBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  return fetchBinary(path, init, false);
}

/** Đăng nhập bằng tên đăng nhập/mật khẩu, lưu JWT và phiên rồi trả về thông tin người dùng. */
export async function loginApi(identifier: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<{ token: string; username: string; role: string; fullName?: string | null }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: identifier.trim(), password }),
  });
  const user = setAuthSession(data.token, data.username, data.role, data.fullName);
  return { token: data.token, user };
}

/** `name` là tên hiển thị của người dùng (họ tên thật); chỉ rơi về tên đăng nhập khi tài khoản chưa có họ tên. */
export function setAuthSession(token: string, username: string, roleCode: string, fullName?: string | null): UserSession {
  const role = SESSION_ROLE[roleCode];
  if (!role) throw new ApiError('Vai trò tài khoản chưa được hỗ trợ trên portal.', 403, undefined, sourceMessage('Vai trò tài khoản chưa được hỗ trợ trên portal.', 'This account role is not supported in the portal.'));
  const user: UserSession = { id: username, name: fullName?.trim() || username, identifier: username, role };
  redirectingForToken = null;
  safeStorageSet(TOKEN_STORAGE_KEY, token);
  setCurrentUser(user);
  return user;
}

/**
 * Đối chiếu role/username trong localStorage với dữ liệu hiện hành trên server (JWT filter luôn đọc role từ DB).
 * Nếu phát hiện phiên mồ côi (còn AUTH_STORAGE_KEY nhưng mất TOKEN_STORAGE_KEY), xóa sạch ngay để tránh vòng lặp 401.
 * Lỗi mạng/5xx bị bỏ qua; 401 do apiFetch xử lý (chỉ khi token vẫn là token hiện tại).
 */
export async function syncSessionWithServer(): Promise<void> {
  const token = safeStorageGet(TOKEN_STORAGE_KEY);
  if (!token) {
    if (readRawAuthSession() !== null) {
      clearAuthSession();
    }
    return;
  }
  let me: { username?: string; role?: string; fullName?: string | null } | null;
  try {
    me = await apiFetch<{ username?: string; role?: string; fullName?: string | null }>('/auth/me');
  } catch {
    return;
  }
  if (safeStorageGet(TOKEN_STORAGE_KEY) !== token) return;
  const role = me?.role ? SESSION_ROLE[me.role] : undefined;
  if (!me?.username || !role) {
    // Vai trò hiện tại không được portal hỗ trợ: không thể giữ phiên cũ
    clearAuthSession();
    window.location.assign(expiredLoginPath());
    return;
  }
  const current = getCurrentUser();
  if (!current) return;
  const displayName = me.fullName?.trim() || me.username;
  if (current.role === role && current.identifier === me.username && current.name === displayName) return;
  setCurrentUser(current.identifier === me.username
    ? { ...current, role, name: displayName }
    : { id: me.username, name: displayName, identifier: me.username, role });
}

// Màn hình mặc định sau đăng nhập theo từng vai trò
export const homePath = (role: UserSession['role']): string => {
  switch (role) {
    case 'ADMIN':
      return '/admin/users';
    case 'MANAGER':
      return '/manager/reports';
    case 'STAFF':
      return '/staff/reception';
    case 'COACH':
      return '/coach/pt-attendance';
    case 'MEMBER':
    default:
      return '/member/dashboard';
  }
};
