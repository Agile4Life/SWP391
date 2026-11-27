import { staffTranslation, useStaffI18n, type StaffMessage, staffMessage, staffError as errorMessage, staffNotify as notify } from '../operations/staffI18n';
import { getCurrentUser } from '../../shared/api/client';
import { Select } from '../../shared/ui/Select';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  userApi,
  UserAccount,
  SystemRole,
  UserGender,
  CORE_ROLES,
  Permission,
} from './userApi';
import { Modal } from '../../shared/ui/Modal';
import { formatCenterDate, formatCenterDateTime } from '../../shared/lib/centerTime';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { PageHeader } from '../../shared/ui/PageHeader';
import { ActionMenu } from '../../shared/ui/ActionMenu';
import { isValidEmailAddress, isValidPhoneNumber, normalizePhoneNumber, isValidPassword, PASSWORD_RULE_ERROR, PASSWORD_RULE_HINT } from '../auth/authValidation';

/**
 * Kiểm tra email người dùng: bắt buộc, đúng định dạng (cảnh báo gõ nhầm @gmail.co) và không trùng người dùng
 * khác.
 */
function validateUserEmail(raw: string, existingUsers: UserAccount[] = []): string | undefined {
  const cleanEmail = raw.trim();
  if (!cleanEmail) return 'Vui lòng nhập email liên hệ.';
  if (cleanEmail.toLowerCase().endsWith('@gmail.co')) {
    return 'Có vẻ bạn gõ nhầm @gmail.co? Vui lòng sửa thành @gmail.com';
  }
  if (!isValidEmailAddress(cleanEmail)) {
    return 'Email liên hệ không đúng định dạng (vd: mai@sol.vn).';
  }
  if (existingUsers.some(u => u.email?.trim().toLowerCase() === cleanEmail.toLowerCase())) {
    return 'Email đã tồn tại.';
  }
  return undefined;
}

/**
 * Kiểm tra số điện thoại người dùng: bắt buộc tùy cờ required, đúng 10 số và không trùng người dùng khác (trừ
 * excludeUserId).
 */
function validateUserPhone(raw: string, required = true, existingUsers: UserAccount[] = [], excludeUserId?: string): string | undefined {
  const cleanPhone = raw.trim();
  if (!cleanPhone) return required ? 'Vui lòng nhập số điện thoại.' : undefined;
  if (!isValidPhoneNumber(cleanPhone)) {
    return 'Số điện thoại không hợp lệ (Phải là 10 số, vd: 0912345678).';
  }
  const target = normalizePhoneNumber(cleanPhone);
  if (existingUsers.some(u => u.id !== excludeUserId && u.phone && normalizePhoneNumber(u.phone) === target)) {
    return 'Số điện thoại đã tồn tại.';
  }
  return undefined;
}

/**
 * Màn quản trị người dùng và phân quyền: danh sách và tài khoản đã xóa, tạo/sửa/khóa/xóa/khôi phục tài khoản,
 * dọn dẹp tài khoản không hoạt động và bật/tắt quyền theo vai trò.
 */
export function UserManagerPage() {
  const { t } = useStaffI18n();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [rolePerms, setRolePerms] = useState<Record<SystemRole, string[]>>({
    ADMIN: [],
    CENTER_MANAGER: [],
    COACH: [],
    RECEPTIONIST: [],
    MEMBER: [],
  });
  const [activeTab, setActiveTab] = useState<'USERS' | 'DELETED' | 'ROLES'>('USERS');
  const [deletedUsers, setDeletedUsers] = useState<UserAccount[]>([]);
  const [restoringUserId, setRestoringUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<StaffMessage | null>(null);
  const [editError, setEditError] = useState<StaffMessage | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'COACH' as SystemRole,
    gender: 'female' as UserGender,
  });

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    gender?: string;
  }>({});

  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    role: 'COACH' as SystemRole,
    gender: 'female' as UserGender,
  });
  const [editFieldErrors, setEditFieldErrors] = useState<{
    name?: string;
    phone?: string;
  }>({});

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<StaffMessage>('');
  const [deletedLoadError, setDeletedLoadError] = useState<StaffMessage>('');
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [lockingUserIds, setLockingUserIds] = useState<Set<string>>(() => new Set());
  const lockingUserIdsRef = useRef<Set<string>>(new Set());
  const [togglingPermKeys, setTogglingPermKeys] = useState<Set<string>>(() => new Set());
  const togglingPermKeysRef = useRef<Set<string>>(new Set());

  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isCleaning, setIsCleaning] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ deletedCount: number; message?: string } | null>(null);

  const currentUser = getCurrentUser();
  const activeAdminCount = useMemo(
    () => users.filter((u) => u.role === 'ADMIN' && u.status === 'ACTIVE').length,
    [users],
  );
  const totalAdminCount = useMemo(
    () => users.filter((u) => u.role === 'ADMIN').length,
    [users],
  );

  function getAccountProtection(u: UserAccount) {
    const isSelf = Boolean(
      currentUser &&
        (currentUser.id === u.id ||
          (currentUser.identifier && currentUser.identifier.toLowerCase() === u.email.toLowerCase())),
    );
    const isLastActiveAdmin = u.role === 'ADMIN' && u.status === 'ACTIVE' && activeAdminCount <= 1;
    const isLastAdmin = u.role === 'ADMIN' && totalAdminCount <= 1;
    const lockDisabled = isSelf || (u.status === 'ACTIVE' && isLastActiveAdmin);
    const deleteDisabled = isSelf || isLastActiveAdmin || isLastAdmin;
    const lockReason = isSelf
      ? t('Không thể khóa tài khoản của chính bạn', 'Cannot lock your own account')
      : u.status === 'ACTIVE' && isLastActiveAdmin
        ? t('Không thể khóa tài khoản Quản trị hệ thống hoạt động cuối cùng', 'Cannot lock the last active administrator account')
        : u.status === 'ACTIVE'
          ? t('Khóa tài khoản', 'Lock account')
          : t('Mở khóa tài khoản', 'Unlock account');
    const deleteReason = isSelf
      ? t('Không thể xóa tài khoản của chính bạn', 'Cannot delete your own account')
      : isLastActiveAdmin || isLastAdmin
        ? t('Không thể xóa tài khoản Quản trị hệ thống cuối cùng', 'Cannot delete the last administrator account')
        : t('Xóa tài khoản', 'Delete account');
    return { lockDisabled, deleteDisabled, lockReason, deleteReason };
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function reloadDeletedUsers() {
    if (typeof userApi.getDeletedUsers !== 'function') {
      setDeletedUsers([]);
      setDeletedLoadError('');
      return;
    }
    setLoadingDeleted(true);
    setDeletedLoadError('');
    try {
      const deleted = await userApi.getDeletedUsers();
      setDeletedUsers(deleted);
    } catch (err) {
      setDeletedLoadError(
        err instanceof Error && err.name === 'Error' && err.message
          ? err
          : staffMessage('Không thể tải danh sách tài khoản đã xóa.', 'Could not load deleted accounts.'),
      );
    } finally {
      setLoadingDeleted(false);
    }
  }

  // Tải người dùng, vai trò, quyền và tài khoản đã xóa (không nuốt lỗi thùng rác).
  async function loadData() {
    setLoading(true);
    setLoadError('');
    setDeletedLoadError('');
    try {
      const [u, r, p] = await Promise.all([
        userApi.getUsers(),
        userApi.getRolePermissions(),
        userApi.getPermissions(),
      ]);
      setUsers(u);
      setRolePerms(r);
      setPermissions(p);

      if (typeof userApi.getDeletedUsers === 'function') {
        try {
          const d = await userApi.getDeletedUsers();
          setDeletedUsers(d);
        } catch (trashErr) {
          setDeletedLoadError(
            trashErr instanceof Error && trashErr.name === 'Error' && trashErr.message
              ? trashErr
              : staffMessage('Không thể tải danh sách tài khoản đã xóa.', 'Could not load deleted accounts.'),
          );
        }
      } else {
        setDeletedUsers([]);
      }
    } catch (err) {
      setLoadError(errorMessage(err, 'Không thể tải dữ liệu.'));
    } finally {
      setLoading(false);
    }
  }

  // Người dùng sau khi lọc theo từ khóa (tên, email, số điện thoại) và vai trò.
  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        !term ||
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.phone.includes(term);
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, searchTerm, roleFilter]);

  // Tài khoản đã xóa sau khi lọc theo từ khóa.
  const filteredDeletedUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return deletedUsers.filter((u) => {
      const matchSearch =
        !term ||
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.phone.includes(term);
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [deletedUsers, searchTerm, roleFilter]);

  // Khóa hoặc mở khóa tài khoản sau khi xác nhận (kèm khóa in-flight theo từng dòng để tránh đảo trạng thái khi click đúp).
  async function handleToggleLock(user: UserAccount) {
    if (lockingUserIdsRef.current.has(user.id)) return;
    const locking = user.status === 'ACTIVE';
    const confirmed = await confirm({
      title: locking ? staffMessage('Khóa tài khoản?', staffTranslation('Khóa tài khoản?')) : staffMessage('Mở khóa tài khoản?', staffTranslation('Mở khóa tài khoản?')),
      message: locking
        ? staffMessage(`"${user.name}" sẽ không thể đăng nhập cho tới khi được mở khóa.`, `"${user.name}" will not be able to sign in until unlocked.`)
        : staffMessage(`"${user.name}" sẽ đăng nhập lại được ngay.`, `"${user.name}" will be able to sign in immediately.`),
      confirmLabel: locking ? staffMessage('Khóa tài khoản', staffTranslation('Khóa tài khoản')) : staffMessage('Mở khóa', staffTranslation('Mở khóa')),
      danger: locking,
    });
    if (!confirmed || lockingUserIdsRef.current.has(user.id)) return;

    lockingUserIdsRef.current.add(user.id);
    setLockingUserIds(new Set(lockingUserIdsRef.current));
    try {
      const updated = await userApi.toggleLockUser(user.id, locking);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      notify(
        updated.status === 'ACTIVE'
          ? staffMessage(`Đã mở khóa tài khoản "${user.name}".`, `Unlocked account "${user.name}".`)
          : staffMessage(`Đã khóa tài khoản "${user.name}".`, `Locked account "${user.name}".`),
        'success'
      );
    } catch (err) {
      const msg = errorMessage(err, 'Thao tác thất bại.');
      notify(msg, 'error');
    } finally {
      lockingUserIdsRef.current.delete(user.id);
      setLockingUserIds(new Set(lockingUserIdsRef.current));
    }
  }

  // Xác nhận xóa tài khoản đang chọn và chuyển nó sang danh sách tài khoản đã xóa.
  async function handleConfirmDelete() {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await userApi.deleteUser(deletingUser.id);
      const deletedItem: UserAccount = { ...deletingUser, deleted_at: new Date().toISOString() };
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      setDeletedUsers((prev) => [deletedItem, ...prev.filter((u) => u.id !== deletingUser.id)]);
      notify(staffMessage(`Đã xóa mềm tài khoản "${deletingUser.name}". Bạn có thể khôi phục lại từ tab "Tài khoản đã xóa".`, `Soft-deleted account "${deletingUser.name}". You can restore it from the "Deleted accounts" tab.`), 'success');
      setDeletingUser(null);
    } catch (err) {
      const msg = errorMessage(err, 'Không thể xóa tài khoản.');
      notify(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  // Khôi phục tài khoản đã xóa sau khi xác nhận.
  async function handleRestoreUser(user: UserAccount) {
    if (restoringUserId) return;
    const confirmed = await confirm({
      title: staffMessage('Khôi phục tài khoản?', staffTranslation('Khôi phục tài khoản?')),
      message: staffMessage(
        `Tài khoản "${user.name}" sẽ được khôi phục hoạt động và chuyển lại về danh sách tài khoản chính.`,
        `Account "${user.name}" will be restored to active status and moved back to the main accounts list.`
      ),
      confirmLabel: staffMessage('Khôi phục tài khoản', staffTranslation('Khôi phục tài khoản')),
      danger: false,
    });
    if (!confirmed) return;

    setRestoringUserId(user.id);
    try {
      const restored = await userApi.restoreUser(user.id);
      setDeletedUsers((prev) => prev.filter((u) => u.id !== user.id));
      setUsers((prev) => [restored, ...prev.filter((u) => u.id !== user.id)]);
      notify(
        staffMessage(`Đã khôi phục thành công tài khoản "${user.name}".`, `Successfully restored account "${user.name}".`),
        'success'
      );
    } catch (err) {
      notify(
        err instanceof Error && err.name === 'Error' && err.message
          ? err
          : staffMessage('Không thể khôi phục tài khoản.', 'Could not restore account.'),
        'error',
      );
    } finally {
      setRestoringUserId(null);
    }
  }

  // Chạy dọn dẹp tài khoản không hoạt động và làm mới đồng thời cả danh sách chính lẫn thùng rác.
  async function handleRunCleanup() {
    setIsCleaning(true);
    try {
      const res = await userApi.cleanupInactiveUsers();
      setCleanupResult(res);
      notify(res.message ? new Error(res.message) : staffMessage(`Đã dọn dẹp ${res.deletedCount} tài khoản không hoạt động.`, `Cleaned up ${res.deletedCount} inactive accounts.`), 'success');
      // Làm mới danh sách người dùng và tab tài khoản đã xóa
      const u = await userApi.getUsers();
      setUsers(u);
      await reloadDeletedUsers();
    } catch (err) {
      const msg = errorMessage(err, 'Dọn dẹp tài khoản thất bại.');
      notify(msg, 'error');
    } finally {
      setIsCleaning(false);
    }
  }

  // Tạo người dùng mới sau khi kiểm tra tên, email, số điện thoại và mật khẩu.
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();

    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim();
    const cleanPhone = formData.phone.trim();

    const errors: { name?: string; email?: string; phone?: string; password?: string; gender?: string } = {};

    if (!cleanName) {
      errors.name = 'Vui lòng nhập họ và tên.';
    } else if (cleanName.length < 2) {
      errors.name = 'Họ và tên quá ngắn (tối thiểu 2 ký tự).';
    }

    const emailErr = validateUserEmail(cleanEmail, users);
    if (emailErr) errors.email = emailErr;

    const phoneErr = validateUserPhone(cleanPhone, true, users);
    if (phoneErr) errors.phone = phoneErr;

    if (!isValidPassword(formData.password)) {
      errors.password = PASSWORD_RULE_ERROR;
    }

    if (!formData.gender) {
      errors.gender = 'Vui lòng chọn giới tính.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setCreateError(null);
    setIsCreating(true);

    try {
      const created = await userApi.createUser({
        name: cleanName,
        email: cleanEmail,
        phone: normalizePhoneNumber(cleanPhone),
        password: formData.password,
        role: formData.role,
        gender: formData.gender,
      });
      setUsers((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setFormData({ name: '', email: '', phone: '', password: '', role: 'COACH', gender: 'female' });
      notify(staffMessage(`Đã tạo tài khoản "${created.name}".`, `Created account "${created.name}".`), 'success');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg = err instanceof Error ? err.message : '';
      const isAmbiguousDuplicate = /(?:^|[\s,.;:(])(?:hoặc|or)(?:$|[\s,.;:)])/i.test(msg);
      const matchesEmail = /email.*tồn tại|email\s+(?:address\s+)?already exists/i.test(msg);
      const matchesPhone = /(?:số\s+)?điện thoại.*tồn tại|phone(?:\s+number)?\s+already exists/i.test(msg);
      if (code === 'EMAIL_EXISTS' || (!isAmbiguousDuplicate && matchesEmail && !matchesPhone)) {
        setFieldErrors((prev) => ({ ...prev, email: 'Email đã tồn tại.' }));
      }
      if (code === 'PHONE_EXISTS' || (!isAmbiguousDuplicate && matchesPhone && !matchesEmail)) {
        setFieldErrors((prev) => ({ ...prev, phone: 'Số điện thoại đã tồn tại.' }));
      }
      setCreateError(errorMessage(err, 'Không thể tạo người dùng.'));
    } finally {
      setIsCreating(false);
    }
  }

  // Mở hộp chỉnh sửa với dữ liệu của người dùng.
  function handleOpenEdit(user: UserAccount) {
    setEditError(null);
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      phone: user.phone || '',
      role: user.role,
      gender: user.gender || 'other',
    });
    setEditFieldErrors({});
  }

  // Cập nhật tên, số điện thoại, vai trò và giới tính của người dùng.
  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    const cleanName = editFormData.name.trim();
    const cleanPhone = editFormData.phone.trim();

    const errors: { name?: string; phone?: string } = {};

    if (!cleanName) {
      errors.name = 'Vui lòng nhập họ và tên.';
    } else if (cleanName.length < 2) {
      errors.name = 'Họ và tên quá ngắn (tối thiểu 2 ký tự).';
    }

    const editPhoneErr = validateUserPhone(cleanPhone, false, users, editingUser.id);
    if (editPhoneErr) {
      errors.phone = editPhoneErr;
    }

    if (Object.keys(errors).length > 0) {
      setEditFieldErrors(errors);
      return;
    }

    setEditFieldErrors({});
    setEditError(null);
    setIsUpdating(true);

    try {
      const updated = await userApi.updateUser(editingUser.id, {
        name: cleanName,
        phone: cleanPhone ? normalizePhoneNumber(cleanPhone) : '',
        role: editFormData.role,
        gender: editFormData.gender,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditingUser(null);
      notify(staffMessage(`Đã cập nhật tài khoản "${updated.name}".`, `Updated account "${updated.name}".`), 'success');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'PHONE_EXISTS') setEditFieldErrors((prev) => ({ ...prev, phone: 'Số điện thoại đã tồn tại.' }));
      setEditError(errorMessage(err, 'Không thể cập nhật tài khoản.'));
    } finally {
      setIsUpdating(false);
    }
  }

  // Bật/tắt một quyền của vai trò (kèm khóa in-flight từng ô và gửi trạng thái đích tường minh để chống click đúp).
  async function handleTogglePermission(role: SystemRole, permId: string) {
    if (role === 'ADMIN') return;
    const permKey = `${role}:${permId}`;
    if (togglingPermKeysRef.current.has(permKey)) return;

    // Cập nhật lạc quan
    const previous = rolePerms[role] ?? [];
    const hasPerm = previous.includes(permId);
    const shouldGrant = !hasPerm;
    const updatedList = hasPerm
      ? previous.filter((id) => id !== permId)
      : [...previous, permId];

    togglingPermKeysRef.current.add(permKey);
    setTogglingPermKeys(new Set(togglingPermKeysRef.current));
    setRolePerms((prev) => ({ ...prev, [role]: updatedList }));

    try {
      await userApi.toggleRolePermission(role, permId, shouldGrant);
      notify('Đã cập nhật quyền.', 'success');
    } catch (err) {
      // Hoàn tác khi có lỗi
      setRolePerms((prev) => ({ ...prev, [role]: previous }));
      const msg = errorMessage(err, 'Không thể cập nhật quyền.');
      notify(msg, 'error');
    } finally {
      togglingPermKeysRef.current.delete(permKey);
      setTogglingPermKeys(new Set(togglingPermKeysRef.current));
    }
  }

  // Huy hiệu hiển thị tên vai trò.
  const getRoleBadge = (role: SystemRole) => {
    switch (role) {
      case 'ADMIN':
        return <span data-i18n-managed className="badge badge-info">{t("Quản trị hệ thống")}</span>;
      case 'CENTER_MANAGER':
        return <span data-i18n-managed className="badge badge-warning">{t("Quản lý trung tâm")}</span>;
      case 'COACH':
        return <span data-i18n-managed className="badge badge-info">{t("Huấn luyện viên")}</span>;
      case 'RECEPTIONIST':
        return <span data-i18n-managed className="badge badge-neutral">{t("Lễ tân")}</span>;
      case 'MEMBER':
        return <span data-i18n-managed className="badge badge-neutral">{t("Hội viên")}</span>;
    }
  };

  return (
    <div data-i18n-managed className="portal-container">
      <PageHeader
        title={t("Tài khoản & phân quyền")}
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFieldErrors({});
              setCreateError(null);
              setIsModalOpen(true);
            }}
          >
            {t("Thêm tài khoản", "Add account")}
          </button>
        }
      />

      {/* Các tab */}
      <div className="portal-tabs" role="tablist" aria-label={t('Mục quản lý tài khoản', 'Account management sections')}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'USERS'}
          className={`portal-tab ${activeTab === 'USERS' ? 'active' : ''}`}
          onClick={() => setActiveTab('USERS')}
        >
          {t('Danh sách tài khoản', 'Accounts')}
          <span className="portal-tab-count">{users.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'DELETED'}
          className={`portal-tab ${activeTab === 'DELETED' ? 'active' : ''}`}
          onClick={() => setActiveTab('DELETED')}
        >
          {t('Tài khoản đã xóa', 'Deleted accounts')}
          <span className="portal-tab-count">{deletedUsers.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ROLES'}
          className={`portal-tab ${activeTab === 'ROLES' ? 'active' : ''}`}
          onClick={() => setActiveTab('ROLES')}
        >
          {t('Phân quyền', 'Permissions')}
        </button>
      </div>

      {loadError && (
        <div
          data-i18n-managed
          role="alert"
          className="portal-alert portal-alert--error"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}
        >
          <span>{t(loadError)}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void loadData()}>
            {t("Thử lại", "Retry")}
          </button>
        </div>
      )}

      {loading ? (
        <div data-i18n-managed className="portal-card" aria-busy="true">
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="portal-skeleton" style={{ height: 42, borderRadius: 8 }} />
            {[1, 2, 3, 4, 5].map((n) => (
              <div data-i18n-managed key={n} className="portal-skeleton" style={{ height: 52, borderRadius: 8 }} />
            ))}
          </div>
        </div>
      ) : loadError ? null : activeTab === 'USERS' ? (
        <div data-i18n-managed>
          {/* Thanh điều khiển / bộ lọc */}
          <div className="portal-toolbar">
            <input
              type="text"
              className="portal-input"
              aria-label={t('Tìm kiếm tài khoản', 'Search accounts')}
              placeholder={t("Tìm kiếm theo họ tên, email hoặc SĐT...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select
              className="portal-select"
              aria-label={t('Lọc theo vai trò', 'Filter by role')}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">{t("Tất cả vai trò")}</option>
              <option value="CENTER_MANAGER">{t("Quản lý trung tâm")}</option>
              <option value="ADMIN">{t("Quản trị hệ thống")}</option>
              <option value="COACH">{t("Huấn luyện viên")}</option>
              <option value="RECEPTIONIST">{t("Lễ tân")}</option>
              <option value="MEMBER">{t("Hội viên")}</option>
            </Select>
            <ActionMenu label={t("Tùy chọn quản trị")}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                title={t("Tài khoản hội viên không đăng nhập quá 6 tháng sẽ tự động bị xóa (trừ hội viên đang bảo lưu).", "Member accounts inactive for over 6 months will be soft-deleted (excluding accounts on hold).")}
                onClick={() => {
                  setCleanupResult(null);
                  setShowCleanupModal(true);
                }}
              >
                {t("Quét & Dọn dẹp ngay")}</button>
            </ActionMenu>
          </div>

          {/* Bảng danh sách người dùng */}
          <div className="portal-card portal-card--flush">
            {filteredUsers.length === 0 ? (
              <div data-i18n-managed className="portal-state" style={{ minHeight: '180px' }}>
                <p style={{ margin: 0 }}>
                  {t("Không tìm thấy tài khoản nào phù hợp với bộ lọc hiện tại.")}</p>
                {(searchTerm || roleFilter !== 'ALL') && (
                  <button data-i18n-managed
                    type="button"
                    className="btn-secondary btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      setSearchTerm('');
                      setRoleFilter('ALL');
                    }}
                  >
                    {t("Xóa bộ lọc tìm kiếm")}</button>
                )}
              </div>
            ) : (
              <div data-i18n-managed className="portal-table-wrapper">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>{t("Họ và tên")}</th>
                      <th>{t("Giới tính")}</th>
                      <th>{t("Liên hệ")}</th>
                      <th>{t("Vai trò")}</th>
                      <th>{t("Trạng thái")}</th>
                      <th>{t("Đăng nhập / Ngày tạo")}</th>
                      <th className="actions">{t("Thao tác")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const protection = getAccountProtection(u);
                      const isRowLocking = lockingUserIds.has(u.id);
                      return (
                      <tr data-i18n-managed key={u.id}>
                        <td>
                          <strong>{u.name}</strong>
                          <div className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>ID: {u.id}</div>
                        </td>
                        <td>
                          {u.gender === 'male' ? (
                            <span data-i18n-managed className="badge badge-neutral">{t("Nam")}</span>
                          ) : u.gender === 'female' ? (
                            <span data-i18n-managed className="badge badge-neutral" style={{ color: 'var(--portal-salmon)' }}>{t("Nữ")}</span>
                          ) : (
                            <span data-i18n-managed className="badge badge-neutral">{t("Khác")}</span>
                          )}
                        </td>
                        <td>
                          <div>{u.email}</div>
                          <div className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{u.phone || '—'}</div>
                        </td>
                        <td>{getRoleBadge(u.role)}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            {u.status === 'ACTIVE' ? (
                              <span data-i18n-managed className="badge badge-success">{t("Đang hoạt động")}</span>
                            ) : (
                              <span data-i18n-managed className="badge badge-warning">{t("Đã khóa")}</span>
                            )}
                            {u.is_frozen && (
                              <span data-i18n-managed
                                className="badge"
                                style={{
                                  background: 'color-mix(in srgb, var(--portal-info) 12%, transparent)',
                                  color: 'var(--portal-info)',
                                  border: '1px solid color-mix(in srgb, var(--portal-info) 30%, transparent)',
                                  fontSize: '0.75rem',
                                }}
                                title={t("Hội viên đang có gói bảo lưu tập (được miễn trừ tự động xóa)")}
                              >
                                {t("Đang bảo lưu tập")}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ fontSize: '0.85rem' }}>
                            {u.last_login_at ? (
                              <span data-i18n-managed>{t("Đăng nhập: ")}{formatCenterDateTime(u.last_login_at.replace(' ', 'T'))}</span>
                            ) : (
                              <span data-i18n-managed className="muted" style={{ fontStyle: 'italic' }}>{t("Chưa đăng nhập")}</span>
                            )}
                          </div>
                          <div className="muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>{t("Tạo: ")}{formatCenterDate(u.created_at)}</div>
                        </td>
                        <td className="actions">
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              title={t("Chỉnh sửa thông tin tài khoản")}
                              onClick={() => handleOpenEdit(u)}
                            >
                              {t("Sửa")}</button>
                            <ActionMenu label={t(`Thao tác khác với ${u.name}`, `More actions for ${u.name}`)}>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={protection.lockDisabled || isRowLocking}
                              title={protection.lockReason}
                              onClick={() => void handleToggleLock(u)}
                            >
                              {isRowLocking
                                ? t('Đang xử lý...', 'Working...')
                                : u.status === 'ACTIVE'
                                  ? t('Khóa')
                                  : t('Kích hoạt')}
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-sm"
                              disabled={protection.deleteDisabled}
                              title={protection.deleteReason}
                              onClick={() => setDeletingUser(u)}
                            >
                              {t("Xóa")}</button>
                            </ActionMenu>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'DELETED' ? (
        <div data-i18n-managed>
          {/* Thanh điều khiển / bộ lọc cho tài khoản đã xóa */}
          <div className="portal-toolbar">
            <input
              type="text"
              className="portal-input"
              aria-label={t('Tìm kiếm trong tài khoản đã xóa', 'Search deleted accounts')}
              placeholder={t("Tìm kiếm trong tài khoản đã xóa...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select
              className="portal-select"
              aria-label={t('Lọc tài khoản đã xóa theo vai trò', 'Filter deleted accounts by role')}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">{t("Tất cả vai trò")}</option>
              <option value="CENTER_MANAGER">{t("Quản lý trung tâm")}</option>
              <option value="ADMIN">{t("Quản trị hệ thống")}</option>
              <option value="COACH">{t("Huấn luyện viên")}</option>
              <option value="RECEPTIONIST">{t("Lễ tân")}</option>
              <option value="MEMBER">{t("Hội viên")}</option>
            </Select>
          </div>

          {deletedLoadError && (
            <div
              data-i18n-managed
              role="alert"
              className="portal-alert portal-alert--error"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}
            >
              <span>{t(deletedLoadError)}</span>
              <button type="button" className="btn-secondary btn-sm" disabled={loadingDeleted} onClick={() => void reloadDeletedUsers()}>
                {t("Thử lại", "Retry")}
              </button>
            </div>
          )}

          {/* Bảng danh sách tài khoản đã xóa */}
          {!deletedLoadError && (
          <div className="portal-card portal-card--flush">
            {filteredDeletedUsers.length === 0 ? (
              <div data-i18n-managed className="portal-state" style={{ minHeight: '180px' }}>
                <p style={{ margin: 0 }}>
                  {deletedUsers.length === 0
                    ? t("Thùng rác trống. Chưa có tài khoản nào bị xóa mềm.")
                    : t("Không tìm thấy tài khoản đã xóa nào phù hợp với bộ lọc hiện tại.")}
                </p>
                {(searchTerm || roleFilter !== 'ALL') && deletedUsers.length > 0 && (
                  <button data-i18n-managed
                    type="button"
                    className="btn-secondary btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      setSearchTerm('');
                      setRoleFilter('ALL');
                    }}
                  >
                    {t("Xóa bộ lọc tìm kiếm")}</button>
                )}
              </div>
            ) : (
              <div data-i18n-managed className="portal-table-wrapper">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>{t("Họ và tên")}</th>
                      <th>{t("Giới tính")}</th>
                      <th>{t("Liên hệ")}</th>
                      <th>{t("Vai trò")}</th>
                      <th>{t("Trạng thái")}</th>
                      <th>{t("Thời gian xóa")}</th>
                      <th className="actions">{t("Thao tác")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeletedUsers.map((u) => (
                      <tr data-i18n-managed key={u.id} style={{ opacity: 0.9 }}>
                        <td>
                          <strong>{u.name}</strong>
                          <div className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>ID: {u.id}</div>
                        </td>
                        <td>
                          {u.gender === 'male' ? (
                            <span data-i18n-managed className="badge badge-neutral">{t("Nam")}</span>
                          ) : u.gender === 'female' ? (
                            <span data-i18n-managed className="badge badge-neutral" style={{ color: 'var(--portal-salmon)' }}>{t("Nữ")}</span>
                          ) : (
                            <span data-i18n-managed className="badge badge-neutral">{t("Khác")}</span>
                          )}
                        </td>
                        <td>
                          <div>{u.email}</div>
                          <div className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{u.phone || '—'}</div>
                        </td>
                        <td>{getRoleBadge(u.role)}</td>
                        <td>
                          <span
                            data-i18n-managed
                            className="badge badge-danger"
                            style={{
                              background: 'color-mix(in srgb, var(--portal-danger) 15%, transparent)',
                              color: 'var(--portal-danger)',
                              border: '1px solid color-mix(in srgb, var(--portal-danger) 30%, transparent)'
                            }}
                          >
                            {t("Đã xóa mềm")}
                          </span>
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ fontSize: '0.85rem' }}>
                            {u.deleted_at ? (
                              <span data-i18n-managed>{formatCenterDateTime(u.deleted_at.replace(' ', 'T'))}</span>
                            ) : (
                              <span data-i18n-managed className="muted">{t("Đã xóa")}</span>
                            )}
                          </div>
                        </td>
                        <td className="actions">
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            disabled={restoringUserId === u.id}
                            title={t("Khôi phục tài khoản này hoạt động trở lại")}
                            onClick={() => void handleRestoreUser(u)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            {restoringUserId === u.id ? t("Đang khôi phục...") : t("Khôi phục")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>
      ) : (
        /* Matrix Phân quyền RBAC */
        <div data-i18n-managed className="portal-card portal-card--flush">
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--portal-border)' }}>
            <h2 className="portal-card-title">{t("Phân quyền vai trò")}</h2>
          </div>

          {permissions.length === 0 ? (
            <div className="portal-empty" role="status" style={{ padding: '32px 24px' }}>
              <p style={{ margin: 0 }}>{t('Chưa có quyền hạn nào để cấu hình.', 'No permissions available to configure.')}</p>
            </div>
          ) : (
          <div className="portal-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th style={{ width: '42%' }}>{t("Chức năng")}</th>
                  {CORE_ROLES.map((r) => (
                    <th data-i18n-managed key={r.id} style={{ textAlign: 'center' }}>
                      {t(r.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm) => (
                  <tr data-i18n-managed key={perm.id}>
                    <td>
                      <strong>{perm.name}</strong>
                    </td>
                    {CORE_ROLES.map((role) => {
                      const isAdminRole = role.id === 'ADMIN';
                      const isChecked = rolePerms[role.id]?.includes(perm.id) ?? false;
                      const isToggling = togglingPermKeys.has(`${role.id}:${perm.id}`);

                      return (
                        <td data-i18n-managed key={role.id} style={{ textAlign: 'center' }}>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 44,
                              minHeight: 44,
                              cursor: isAdminRole || isToggling ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <input data-i18n-managed
                              type="checkbox"
                              checked={isChecked}
                              disabled={isAdminRole || isToggling}
                              aria-label={`${perm.name} — ${t(role.name)}`}
                              title={
                                isAdminRole
                                  ? t('Quyền quản trị hệ thống')
                                  : t('Nhấp để gán hoặc hủy quyền')
                              }
                              onChange={() => void handleTogglePermission(role.id, perm.id)}
                              style={{
                                width: '18px',
                                height: '18px',
                                accentColor: 'var(--portal-salmon)',
                                cursor: isAdminRole || isToggling ? 'not-allowed' : 'pointer',
                                opacity: isAdminRole || isToggling ? 0.7 : 1,
                              }}
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Modal Thêm tài khoản mới */}
      {isModalOpen && (
        <Modal
          busy={isCreating}
          title={t("Thêm tài khoản")}
          onClose={() => {
            if (!isCreating) {
              setIsModalOpen(false);
              setFieldErrors({});
            }
          }}
        >
          <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: 14 }} noValidate>
            <div className="portal-form-group" style={{ marginBottom: 0 }}>
              <label className="portal-label" htmlFor="user-name">{t("Họ và tên *")}</label>
              <input
                id="user-name"
                type="text"
                className="portal-input"
                autoFocus
                placeholder={t("Vd: Nguyễn Thị Mai")}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'user-name-error' : undefined}
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
              />
              {fieldErrors.name && (
                <div id="user-name-error" data-i18n-managed className="form-error" role="alert">
                  {t(fieldErrors.name)}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div className="portal-form-group" style={{ marginBottom: 0 }}>
                <label className="portal-label" htmlFor="user-email">Email *</label>
                <input
                  id="user-email"
                  type="email"
                  className="portal-input"
                  placeholder="mai.nguyen@sol.vn"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'user-email-error' : undefined}
                  value={formData.email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, email: val });
                    if (val.trim() || fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: validateUserEmail(val, users) }));
                    }
                  }}
                  onBlur={() => {
                    if (formData.email.trim() || fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: validateUserEmail(formData.email, users) }));
                    }
                  }}
                />
                {fieldErrors.email && (
                  <div id="user-email-error" data-i18n-managed className="form-error" role="alert">
                    {t(fieldErrors.email)}
                  </div>
                )}
              </div>

              <div className="portal-form-group" style={{ marginBottom: 0 }}>
                <label className="portal-label" htmlFor="user-phone">{t("Số điện thoại *")}</label>
                <input
                  id="user-phone"
                  type="tel"
                  className="portal-input"
                  placeholder="0912345678"
                  maxLength={11}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? 'user-phone-error' : undefined}
                  value={formData.phone}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                    setFormData({ ...formData, phone: onlyNums });
                    if (onlyNums || fieldErrors.phone) {
                      setFieldErrors((prev) => ({ ...prev, phone: validateUserPhone(onlyNums, true, users) }));
                    }
                  }}
                  onBlur={() => {
                    if (formData.phone.trim() || fieldErrors.phone) {
                      setFieldErrors((prev) => ({ ...prev, phone: validateUserPhone(formData.phone, true, users) }));
                    }
                  }}
                />
                {fieldErrors.phone && (
                  <div id="user-phone-error" data-i18n-managed className="form-error" role="alert">
                    {t(fieldErrors.phone)}
                  </div>
                )}
              </div>
            </div>

            <div className="portal-form-group" style={{ marginBottom: 0 }}>
              <label className="portal-label" htmlFor="user-pass">{t("Mật khẩu khởi tạo *")}</label>
              <input
                id="user-pass"
                type="password"
                className="portal-input"
                autoComplete="new-password"
                placeholder={t(PASSWORD_RULE_HINT, '8–50 characters, with letters and numbers, no spaces')}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'user-pass-error' : undefined}
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
              />
              {fieldErrors.password && (
                <div id="user-pass-error" data-i18n-managed className="form-error" role="alert">
                  {t(fieldErrors.password, 'Password must be 8–50 characters with at least 1 letter and 1 number, and no spaces.')}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div className="portal-form-group" style={{ marginBottom: 0 }}>
                <label className="portal-label" htmlFor="user-gender">{t("Giới tính *")}</label>
                <Select
                  id="user-gender"
                  className="portal-select"
                  value={formData.gender}
                  onChange={(e) => {
                    setFormData({ ...formData, gender: e.target.value as UserGender });
                    if (fieldErrors.gender) setFieldErrors((prev) => ({ ...prev, gender: undefined }));
                  }}
                >
                  <option value="male">{t("Nam", "Male")}</option>
                  <option value="female">{t("Nữ", "Female")}</option>
                  <option value="other">{t("Khác", "Other")}</option>
                </Select>
                {fieldErrors.gender && (
                  <div id="user-gender-error" data-i18n-managed className="form-error" role="alert">
                    {t(fieldErrors.gender)}
                  </div>
                )}
              </div>

              <div className="portal-form-group" style={{ marginBottom: 0 }}>
                <label className="portal-label" htmlFor="user-role">{t("Vai trò *")}</label>
                <Select
                  id="user-role"
                  className="portal-select"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as SystemRole })
                  }
                >
                  <option value="COACH">{t("Huấn luyện viên")}</option>
                  <option value="RECEPTIONIST">{t("Lễ tân")}</option>
                  <option value="MEMBER">{t("Hội viên")}</option>
                  <option value="CENTER_MANAGER">{t("Quản lý trung tâm")}</option>
                  <option value="ADMIN">{t("Quản trị hệ thống")}</option>
                </Select>
              </div>
            </div>

            {createError && <p className="form-error" role="alert">{t(createError)}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={isCreating}
                onClick={() => {
                  setIsModalOpen(false);
                  setFieldErrors({});
                }}
              >
                {t("Hủy")}</button>
              <button type="submit" className="btn-primary" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <span data-i18n-managed className="spinner" />
                    <span data-i18n-managed>{t("Đang tạo...")}</span>
                  </>
                ) : (
                  t('Tạo tài khoản')
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingUser && (
        <Modal
          busy={isUpdating}
          title={t(`Chỉnh sửa tài khoản — ${editingUser.name}`, `Edit account — ${editingUser.name}`)}
          onClose={() => {
            if (!isUpdating) {
              setEditingUser(null);
              setEditFieldErrors({});
            }
          }}
        >
          <form onSubmit={handleUpdateUser} style={{ display: 'grid', gap: 14 }} noValidate>
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="edit-user-email">{t("Email (không thể thay đổi)")}</label>
              <input
                id="edit-user-email"
                type="email"
                className="portal-input"
                disabled
                readOnly
                value={editingUser.email}
              />
            </div>

            <div className="portal-form-group">
              <label className="portal-label" htmlFor="edit-user-name">{t("Họ và tên *")}</label>
              <input
                id="edit-user-name"
                type="text"
                className="portal-input"
                autoFocus
                placeholder={t("Vd: Nguyễn Thị Mai")}
                aria-invalid={Boolean(editFieldErrors.name)}
                aria-describedby={editFieldErrors.name ? 'edit-user-name-error' : undefined}
                value={editFormData.name}
                onChange={(e) => {
                  setEditFormData({ ...editFormData, name: e.target.value });
                  if (editFieldErrors.name) setEditFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
              />
              {editFieldErrors.name && (
                <div id="edit-user-name-error" data-i18n-managed className="form-error" role="alert">
                  {t(editFieldErrors.name)}
                </div>
              )}
            </div>

            <div className="portal-form-group">
              <label className="portal-label" htmlFor="edit-user-phone">{t("Số điện thoại")}</label>
              <input
                id="edit-user-phone"
                type="tel"
                className="portal-input"
                placeholder="0912345678"
                maxLength={11}
                aria-invalid={Boolean(editFieldErrors.phone)}
                aria-describedby={editFieldErrors.phone ? 'edit-user-phone-error' : undefined}
                value={editFormData.phone}
                onChange={(e) => {
                  const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                  setEditFormData({ ...editFormData, phone: onlyNums });
                  setEditFieldErrors((prev) => ({ ...prev, phone: validateUserPhone(onlyNums, false, users, editingUser.id) }));
                }}
                onBlur={() => setEditFieldErrors((prev) => ({ ...prev, phone: validateUserPhone(editFormData.phone, false, users, editingUser.id) }))}
              />
              {editFieldErrors.phone && (
                <div id="edit-user-phone-error" data-i18n-managed className="form-error" role="alert">
                  {t(editFieldErrors.phone)}
                </div>
              )}
            </div>

            <div className="portal-form-group">
              <label className="portal-label" htmlFor="edit-user-gender">{t("Giới tính *")}</label>
              <Select
                id="edit-user-gender"
                className="portal-select"
                value={editFormData.gender}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, gender: e.target.value as UserGender })
                }
              >
                <option value="male">{t("Nam", "Male")}</option>
                <option value="female">{t("Nữ", "Female")}</option>
                <option value="other">{t("Khác", "Other")}</option>
              </Select>
            </div>

            <div className="portal-form-group">
              <label className="portal-label" htmlFor="edit-user-role">{t("Vai trò *")}</label>
              <Select
                id="edit-user-role"
                className="portal-select"
                value={editFormData.role}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, role: e.target.value as SystemRole })
                }
              >
                <option value="COACH">{t("Huấn luyện viên")}</option>
                <option value="RECEPTIONIST">{t("Lễ tân")}</option>
                <option value="MEMBER">{t("Hội viên")}</option>
                <option value="CENTER_MANAGER">{t("Quản lý trung tâm")}</option>
                <option value="ADMIN">{t("Quản trị hệ thống")}</option>
              </Select>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              {editError && <p className="form-error" role="alert" style={{ flexBasis: '100%' }}>{t(editError)}</p>}
              <button
                type="button"
                className="btn-secondary"
                disabled={isUpdating}
                onClick={() => {
                  setEditingUser(null);
                  setEditFieldErrors({});
                }}
              >
                {t("Hủy")}</button>
              <button type="submit" className="btn-primary" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <span data-i18n-managed className="spinner" />
                    <span data-i18n-managed>{t("Đang lưu...")}</span>
                  </>
                ) : (
                  t('Lưu thay đổi')
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Xác nhận xóa tài khoản */}
      {deletingUser && (
        <Modal
          busy={isDeleting}
          title={t("Xác nhận xóa tài khoản")}
          onClose={() => {
            if (!isDeleting) setDeletingUser(null);
          }}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              {t("Bạn có chắc chắn muốn xóa tài khoản của ")}<strong>{deletingUser.name}</strong> ({deletingUser.email})?
            </p>
            <p className="muted" style={{ margin: 0, fontSize: '0.86rem' }}>
              {t("Tài khoản này sẽ được xóa mềm và chuyển vào tab \"Tài khoản đã xóa\". Bạn có thể khôi phục lại bất kỳ lúc nào.")}
            </p>
            {deletingUser.is_frozen && (
              <div data-i18n-managed className="portal-alert portal-alert--info" role="status" style={{ marginBottom: 0 }}>
                {t("Tài khoản này đang bảo lưu gói tập.")}
              </div>
            )}
            <div data-i18n-managed className="portal-alert portal-alert--warning" role="alert" style={{ marginBottom: 0 }}>
              {t("Tài khoản sẽ bị xóa khỏi danh sách và mất quyền truy cập.")}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={isDeleting}
                onClick={() => setDeletingUser(null)}
              >
                {t("Hủy")}</button>
              <button
                type="button"
                className="btn-danger"
                disabled={isDeleting}
                onClick={() => void handleConfirmDelete()}
              >
                {isDeleting ? t('Đang xóa...') : t('Xác nhận xóa')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Quét & dọn dẹp tài khoản > 6 tháng */}
      {showCleanupModal && (
        <Modal
          busy={isCleaning}
          title={t("Quét & dọn dẹp tài khoản quá 6 tháng")}
          onClose={() => {
            if (!isCleaning) {
              setShowCleanupModal(false);
              setCleanupResult(null);
            }
          }}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              {t("Tự động xóa mềm các tài khoản hội viên thỏa điều kiện:", "Automatically soft-deletes member accounts matching all criteria:")}</p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.88rem', display: 'grid', gap: 6 }}>
              <li>
                {t('Chỉ áp dụng cho tài khoản ', 'Applies only to ')}
                <strong>{t('Hội viên', 'Member')}</strong>
                {t(' không đăng nhập trong vòng 6 tháng qua (hoặc tạo quá 6 tháng nhưng chưa từng đăng nhập).', ' accounts inactive for over 6 months (or created over 6 months ago with no login).')}
              </li>
              <li>
                <strong>{t('Không', 'Does not')}</strong>
                {t(' xóa tài khoản Quản trị hệ thống, Quản lý trung tâm, Huấn luyện viên hoặc Lễ tân.', ' delete Admin, Center Manager, Coach, or Receptionist accounts.')}
              </li>
              <li>
                <strong>{t('Không', 'Does not')}</strong>
                {t(' xóa tài khoản hội viên đang có gói tập trong trạng thái ', ' delete member accounts with a membership plan currently ')}
                <strong>{t('bảo lưu tập', 'on hold')}</strong>.
              </li>
            </ul>

            {cleanupResult && (
              <div data-i18n-managed className="portal-alert portal-alert--success" role="status" style={{ marginBottom: 0 }}>
                {cleanupResult.message || t(
                  `Đã dọn dẹp thành công ${cleanupResult.deletedCount} tài khoản không hoạt động.`,
                  `Successfully cleaned up ${cleanupResult.deletedCount} inactive ${cleanupResult.deletedCount === 1 ? 'account' : 'accounts'}.`,
                )}
              </div>
            )}

            {!cleanupResult && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isCleaning}
                  onClick={() => {
                    setShowCleanupModal(false);
                    setCleanupResult(null);
                  }}
                >
                  {t('Hủy')}
                </button>
                <button data-i18n-managed
                  type="button"
                  className="btn-primary"
                  disabled={isCleaning}
                  onClick={() => void handleRunCleanup()}
                >
                  {isCleaning ? (
                    <>
                      <span data-i18n-managed className="spinner" />
                      <span data-i18n-managed>{t("Đang quét & dọn dẹp...")}</span>
                    </>
                  ) : (
                    t('Bắt đầu quét & dọn dẹp')
                  )}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}
