import { useStaffI18n, type StaffMessage, staffError as errorMessage } from '../operations/staffI18n';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Select } from '../../shared/ui/Select';
import { Modal } from '../../shared/ui/Modal';
import {
  auditApi,
  type AuditLogItem,
  type ClassOccupancyItem,
} from './auditApi';
import './admin-audit-logs.css';
import { formatCenterDateTime } from '../../shared/lib/centerTime';

type ActiveTab = 'audit' | 'occupancy';

export function AdminAuditLogsPage() {
  const { t } = useStaffI18n();
  const [activeTab, setActiveTab] = useState<ActiveTab>('audit');

  // Audit Logs state
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [logsError, setLogsError] = useState<StaffMessage>('');
  const [logsReload, setLogsReload] = useState<number>(0);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(0);

  // Audit Filter state
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('ALL');
  const [actorSearch, setActorSearch] = useState<string>('');

  // Diff Modal state
  const [diffLog, setDiffLog] = useState<AuditLogItem | null>(null);

  // Occupancy Report state
  const [occupancyList, setOccupancyList] = useState<ClassOccupancyItem[]>([]);
  const [loadingOccupancy, setLoadingOccupancy] = useState<boolean>(true);
  const [occupancyError, setOccupancyError] = useState<StaffMessage>('');
  const [occupancyReload, setOccupancyReload] = useState<number>(0);

  // Fetch Audit Logs
  useEffect(() => {
    let mounted = true;
    const fetchAudit = async () => {
      setLoadingLogs(true);
      setLogsError('');
      try {
        const res = await auditApi.getAuditLogs({
          action: selectedAction,
          entityType: selectedEntityType,
          page: currentPage,
          size: 8,
        });
        if (mounted) {
          setLogs(res.content);
          setTotalElements(res.totalElements);
          setTotalPages(Math.max(1, res.totalPages));
        }
      } catch (err) {
        if (mounted) {
          setLogs([]);
          setTotalElements(0);
          setLogsError(errorMessage(err, 'Không thể tải nhật ký kiểm toán.'));
        }
      } finally {
        if (mounted) setLoadingLogs(false);
      }
    };

    fetchAudit();
    return () => {
      mounted = false;
    };
  }, [selectedAction, selectedEntityType, currentPage, logsReload]);

  // Fetch Occupancy
  useEffect(() => {
    let mounted = true;
    const fetchOccupancy = async () => {
      setLoadingOccupancy(true);
      setOccupancyError('');
      try {
        const data = await auditApi.getClassOccupancy();
        if (mounted) {
          setOccupancyList(data);
        }
      } catch (err) {
        if (mounted) {
          setOccupancyList([]);
          setOccupancyError(errorMessage(err, 'Không thể tải tỷ lệ lấp đầy lớp học.'));
        }
      } finally {
        if (mounted) setLoadingOccupancy(false);
      }
    };

    if (activeTab === 'occupancy') {
      fetchOccupancy();
    }
    return () => {
      mounted = false;
    };
  }, [activeTab, occupancyReload]);

  // Filter logs by actor search locally
  const filteredLogs = useMemo(() => {
    if (!actorSearch.trim()) return logs;
    const q = actorSearch.toLowerCase().trim();
    return logs.filter(
      (l) =>
        (l.userFullName ?? '').toLowerCase().includes(q) ||
        (l.userEmail ?? '').toLowerCase().includes(q)
    );
  }, [logs, actorSearch]);

  // Overall Occupancy Metrics
  const occupancyMetrics = useMemo(() => {
    if (occupancyList.length === 0) {
      return { avgUtilization: 0, highestClass: '—', totalCapacity: 0, totalEnrolled: 0 };
    }
    const totalCap = occupancyList.reduce((acc, c) => acc + c.capacity, 0);
    const totalEnr = occupancyList.reduce((acc, c) => acc + Math.min(c.enrolledCount, c.capacity), 0);
    const avg = totalCap > 0 ? (totalEnr / totalCap) * 100 : 0;
    const sorted = [...occupancyList].sort((a, b) => b.utilizationRate - a.utilizationRate);

    return {
      avgUtilization: Math.round(avg * 10) / 10,
      highestClass: sorted[0]?.className || '—',
      totalCapacity: totalCap,
      totalEnrolled: totalEnr,
    };
  }, [occupancyList]);

  const formatJsonPretty = (val: unknown) => {
    if (val === null || val === undefined) {
      return 'null';
    }
    if (typeof val === 'string') {
      try {
        return JSON.stringify(JSON.parse(val), null, 2);
      } catch {
        return val;
      }
    }
    return JSON.stringify(val, null, 2);
  };

  const humanizeCode = (raw?: string | null) => {
    if (!raw) return '';
    const cleaned = raw
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : '';
  };

  const parseRecordObject = (val: unknown): Record<string, unknown> | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
        return null;
      } catch {
        return null;
      }
    }
    if (typeof val === 'object' && !Array.isArray(val)) {
      return val as Record<string, unknown>;
    }
    return null;
  };

  const formatIpAddress = (ip?: string | null) => {
    if (!ip) return '';
    const trimmed = ip.trim();
    if (trimmed === '0:0:0:0:0:0:0:1' || trimmed === '::1') return '127.0.0.1';
    return trimmed;
  };

  const getActionBadgeClass = (act: string) => {
    const a = (act ?? '').trim().toUpperCase();
    if (
      a === 'CREATE' ||
      a === 'GRANTED' ||
      a === 'USER_CREATE' ||
      a === 'USER_RESTORE' ||
      a === 'STAFF_ACCOUNT_CREATE' ||
      a === 'ROLE_PERMISSION_GRANT' ||
      a === 'MEMBER_KYC_APPROVE' ||
      a === 'HOLD_APPROVE' ||
      a === 'CLASS_CREATE' ||
      a === 'CLASS_CREATE_RECURRING' ||
      a === 'SESSION_CREATE' ||
      a === 'PACKAGE_CREATE' ||
      a === 'CREATE_PRODUCT' ||
      a === 'ADD_PRODUCT_IMAGE' ||
      a === 'CREATE_PRODUCT_CATEGORY'
    ) {
      return 'is-create';
    }
    if (
      a === 'UPDATE' ||
      a === 'USER_UPDATE' ||
      a === 'USER_STATUS_CHANGE' ||
      a === 'STAFF_ACCOUNT_STATUS_CHANGE' ||
      a === 'PASSWORD_CHANGE' ||
      a === 'PROFILE_UPDATE' ||
      a === 'PROFILE_AVATAR_UPDATE' ||
      a === 'COACH_PROFILE_UPDATE' ||
      a === 'RECEPTIONIST_PROFILE_UPDATE' ||
      a === 'MEMBER_KYC_SUBMIT' ||
      a === 'CLASS_UPDATE' ||
      a === 'SESSION_RESCHEDULE' ||
      a === 'COACH_ASSIGNMENT_TRANSFER' ||
      a === 'PACKAGE_UPDATE' ||
      a === 'PACKAGE_STATUS_CHANGE' ||
      a === 'SUPPORT_STATUS_UPDATE' ||
      a === 'SUPPORT_ESCALATE' ||
      a === 'UPDATE_PRODUCT' ||
      a === 'UPDATE_PRODUCT_STATUS' ||
      a === 'REORDER_PRODUCT_IMAGES' ||
      a === 'ADJUST_PRODUCT_STOCK' ||
      a === 'UPDATE_PRODUCT_CATEGORY' ||
      a === 'START_PROCESSING' ||
      a === 'SHIP_ORDER' ||
      a === 'READY_FOR_PICKUP' ||
      a === 'COMPLETE_ORDER' ||
      a === 'COUNTER_PAYMENT'
    ) {
      return 'is-update';
    }
    if (
      a === 'DELETE' ||
      a === 'CANCEL' ||
      a === 'DENIED' ||
      a === 'USER_DELETE' ||
      a === 'USER_CLEANUP_INACTIVE' ||
      a === 'ROLE_PERMISSION_REVOKE' ||
      a === 'MEMBER_KYC_REJECT' ||
      a === 'HOLD_REJECT' ||
      a === 'CLASS_DELETE' ||
      a === 'PT_ATTENDANCE_UNMARK' ||
      a === 'PACKAGE_DELETE' ||
      a === 'PAYMENT_REFUND' ||
      a === 'DELETE_PRODUCT' ||
      a === 'REMOVE_PRODUCT_IMAGE' ||
      a === 'DELETE_PRODUCT_CATEGORY' ||
      a === 'CANCEL_ORDER'
    ) {
      return 'is-delete';
    }
    if (a === 'SCAN' || a === 'PT_ATTENDANCE_MARK') return 'is-scan';
    return '';
  };

  const getActionLabel = (act: string) => {
    const a = (act ?? '').trim().toUpperCase();
    switch (a) {
      case 'CREATE': return t('Tạo mới', 'Create');
      case 'UPDATE': return t('Cập nhật', 'Update');
      case 'DELETE': return t('Xóa', 'Delete');
      case 'CANCEL': return t('Hủy gói', 'Cancel subscription');
      case 'SCAN': return t('Quét QR', 'QR scan');
      case 'GRANTED': return t('Cấp quyền', 'Grant access');
      case 'DENIED': return t('Thu hồi quyền', 'Revoke access');
      case 'HOLD_APPROVE': return t('Duyệt bảo lưu', 'Approve freeze');
      case 'HOLD_REJECT': return t('Từ chối bảo lưu', 'Reject freeze');
      case 'USER_CREATE': return t('Tạo tài khoản', 'Create account');
      case 'USER_UPDATE': return t('Sửa tài khoản', 'Update account');
      case 'USER_DELETE': return t('Xóa tài khoản', 'Delete account');
      case 'USER_RESTORE': return t('Khôi phục tài khoản', 'Restore account');
      case 'USER_STATUS_CHANGE': return t('Đổi trạng thái', 'Change status');
      case 'USER_CLEANUP_INACTIVE': return t('Dọn dẹp tự động', 'Auto cleanup');
      case 'STAFF_ACCOUNT_CREATE': return t('Tạo tài khoản nhân sự', 'Create staff account');
      case 'STAFF_ACCOUNT_STATUS_CHANGE': return t('Đổi trạng thái nhân sự', 'Change staff status');
      case 'ROLE_PERMISSION_GRANT': return t('Cấp quyền vai trò', 'Grant role permission');
      case 'ROLE_PERMISSION_REVOKE': return t('Thu hồi quyền vai trò', 'Revoke role permission');
      case 'PASSWORD_CHANGE': return t('Đổi mật khẩu', 'Change password');
      case 'PROFILE_UPDATE': return t('Cập nhật hồ sơ', 'Update profile');
      case 'PROFILE_AVATAR_UPDATE': return t('Đổi ảnh đại diện', 'Update avatar');
      case 'COACH_PROFILE_UPDATE': return t('Cập nhật hồ sơ HLV', 'Update coach profile');
      case 'RECEPTIONIST_PROFILE_UPDATE': return t('Đổi ca trực', 'Update reception shift');
      case 'MEMBER_KYC_SUBMIT': return t('Gửi hồ sơ định danh', 'Submit identity verification');
      case 'MEMBER_KYC_APPROVE': return t('Duyệt định danh', 'Approve identity verification');
      case 'MEMBER_KYC_REJECT': return t('Từ chối định danh', 'Reject identity verification');
      case 'CLASS_CREATE': return t('Tạo lớp học', 'Create class');
      case 'CLASS_CREATE_RECURRING': return t('Tạo lịch lớp định kỳ', 'Create recurring class');
      case 'CLASS_UPDATE': return t('Cập nhật lớp học', 'Update class');
      case 'CLASS_DELETE': return t('Xóa lớp học', 'Delete class');
      case 'SESSION_CREATE': return t('Tạo buổi học', 'Create session');
      case 'SESSION_RESCHEDULE': return t('Dời lịch buổi học', 'Reschedule session');
      case 'PT_ATTENDANCE_MARK': return t('Điểm danh PT 1:1', 'Mark PT attendance');
      case 'PT_ATTENDANCE_UNMARK': return t('Gỡ điểm danh PT 1:1', 'Unmark PT attendance');
      case 'COACH_ASSIGNMENT_TRANSFER': return t('Chuyển phân công HLV', 'Transfer coach assignment');
      case 'PACKAGE_CREATE': return t('Tạo gói tập', 'Create package');
      case 'PACKAGE_UPDATE': return t('Cập nhật gói tập', 'Update package');
      case 'PACKAGE_STATUS_CHANGE': return t('Đổi trạng thái gói tập', 'Change package status');
      case 'PACKAGE_DELETE': return t('Xóa gói tập', 'Delete package');
      case 'PAYMENT_REFUND': return t('Hoàn tiền', 'Refund payment');
      case 'SUPPORT_STATUS_UPDATE': return t('Cập nhật phiếu hỗ trợ', 'Update support ticket');
      case 'SUPPORT_ESCALATE': return t('Chuyển cấp hỗ trợ', 'Escalate support ticket');
      case 'CREATE_PRODUCT': return t('Tạo sản phẩm', 'Create product');
      case 'UPDATE_PRODUCT': return t('Cập nhật sản phẩm', 'Update product');
      case 'UPDATE_PRODUCT_STATUS': return t('Đổi trạng thái sản phẩm', 'Change product status');
      case 'DELETE_PRODUCT': return t('Xóa sản phẩm', 'Delete product');
      case 'ADD_PRODUCT_IMAGE': return t('Thêm ảnh sản phẩm', 'Add product image');
      case 'REMOVE_PRODUCT_IMAGE': return t('Xóa ảnh sản phẩm', 'Remove product image');
      case 'REORDER_PRODUCT_IMAGES': return t('Sắp xếp ảnh sản phẩm', 'Reorder product images');
      case 'ADJUST_PRODUCT_STOCK': return t('Điều chỉnh tồn kho', 'Adjust product stock');
      case 'CREATE_PRODUCT_CATEGORY': return t('Tạo danh mục sản phẩm', 'Create product category');
      case 'UPDATE_PRODUCT_CATEGORY': return t('Cập nhật danh mục sản phẩm', 'Update product category');
      case 'DELETE_PRODUCT_CATEGORY': return t('Xóa danh mục sản phẩm', 'Delete product category');
      case 'START_PROCESSING': return t('Bắt đầu xử lý đơn', 'Start order processing');
      case 'SHIP_ORDER': return t('Giao đơn vận chuyển', 'Ship order');
      case 'READY_FOR_PICKUP': return t('Sẵn sàng nhận tại quầy', 'Ready for pickup');
      case 'COMPLETE_ORDER': return t('Hoàn tất đơn hàng', 'Complete order');
      case 'COUNTER_PAYMENT': return t('Thu tiền tại quầy', 'Counter payment');
      case 'CANCEL_ORDER': return t('Hủy đơn hàng', 'Cancel order');
      default: return humanizeCode(act) || t('Thao tác khác', 'Other action');
    }
  };

  const getEntityLabel = (type: string) => {
    const normalized = (type ?? '').trim().toLowerCase();
    switch (normalized) {
      case 'users': return t('Tài khoản', 'Accounts');
      case 'members': return t('Hội viên', 'Members');
      case 'coaches': return t('Huấn luyện viên', 'Coaches');
      case 'receptionists': return t('Lễ tân', 'Receptionists');
      case 'center_managers': return t('Quản lý cơ sở', 'Center managers');
      case 'membership_packages': return t('Danh mục gói tập', 'Membership packages');
      case 'membership_subscriptions': return t('Gói tập', 'Memberships');
      case 'classes': return t('Lớp học', 'Classes');
      case 'class_sessions': return t('Buổi học', 'Class sessions');
      case 'class_enrollments': return t('Đăng ký lớp', 'Class enrollments');
      case 'class_waitlists': return t('Danh sách chờ lớp', 'Class waitlists');
      case 'center_checkins': return t('Lượt ra vào', 'Check-ins');
      case 'session_attendance': return t('Điểm danh', 'Attendance');
      case 'payments': return t('Thanh toán', 'Payments');
      case 'invoices': return t('Hóa đơn', 'Invoices');
      case 'invoice_items': return t('Chi tiết hóa đơn', 'Invoice items');
      case 'training_plans': return t('Giáo án tập luyện', 'Training plans');
      case 'training_plan_items': return t('Bài tập giáo án', 'Training plan items');
      case 'session_evaluations': return t('Đánh giá buổi tập', 'Session evaluations');
      case 'notifications': return t('Thông báo', 'Notifications');
      case 'support_requests': return t('Phiếu hỗ trợ', 'Support tickets');
      case 'role_permissions': return t('Phân quyền vai trò', 'Role permissions');
      case 'products': return t('Sản phẩm', 'Products');
      case 'product_categories': return t('Danh mục sản phẩm', 'Product categories');
      case 'product_variants': return t('Biến thể sản phẩm', 'Product variants');
      case 'product_orders': return t('Đơn hàng sản phẩm', 'Product orders');
      case 'coach_bookings': return t('Lịch hẹn HLV 1:1', 'PT bookings');
      case 'cancellation_requests': return t('Yêu cầu hủy', 'Cancellation requests');
      case 'hold_requests': return t('Yêu cầu bảo lưu', 'Freeze requests');
      case 'equipment': return t('Thiết bị', 'Equipment');
      case 'wallets': return t('Ví hội viên', 'Member wallets');
      default: return humanizeCode(type) || t('Bản ghi hệ thống', 'System record');
    }
  };

  const getDiffFieldLabel = (key: string) => {
    switch (key) {
      case 'id': return 'ID';
      case 'status': return t('Trạng thái', 'Status');
      case 'invoiceNumber':
      case 'invoice_number': return t('Số hóa đơn', 'Invoice number');
      case 'orderNumber':
      case 'order_number': return t('Mã đơn hàng', 'Order number');
      case 'amount':
      case 'totalAmount':
      case 'total_amount': return t('Số tiền', 'Amount');
      case 'price': return t('Đơn giá', 'Price');
      case 'name': return t('Tên', 'Name');
      case 'fullName':
      case 'full_name': return t('Họ và tên', 'Full name');
      case 'email': return 'Email';
      case 'phone': return t('Số điện thoại', 'Phone');
      case 'role':
      case 'roleName': return t('Vai trò', 'Role');
      case 'kycStatus':
      case 'kyc_status': return t('Trạng thái định danh', 'Verification status');
      case 'idCardType':
      case 'id_card_type': return t('Loại giấy tờ', 'Document type');
      case 'startDate':
      case 'start_date': return t('Ngày bắt đầu', 'Start date');
      case 'endDate':
      case 'end_date': return t('Ngày kết thúc', 'End date');
      case 'stock':
      case 'stockQuantity':
      case 'stock_quantity': return t('Tồn kho', 'Stock');
      case 'shift': return t('Ca trực', 'Shift');
      case 'reason':
      case 'rejectionReason': return t('Lý do', 'Reason');
      case 'isActive':
      case 'active': return t('Kích hoạt', 'Active');
      case 'fitnessGoal':
      case 'fitness_goal': return t('Mục tiêu tập luyện', 'Fitness goal');
      default: return humanizeCode(key) || key;
    }
  };

  const formatDiffFieldValue = (val: unknown) => {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'boolean') return val ? t('Có', 'Yes') : t('Không', 'No');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <div data-i18n-managed className="audit-page portal-container">
      <PageHeader
        title={t("Nhật ký & lấp đầy lớp")}
      />

      {/* Navigation Tabs */}
      <div className="portal-tabs audit-view-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'audit'}
          className={`portal-tab audit-tab-btn ${activeTab === 'audit' ? 'active is-active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          {t("Nhật ký kiểm toán", "Audit trail")}</button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'occupancy'}
          className={`portal-tab audit-tab-btn ${activeTab === 'occupancy' ? 'active is-active' : ''}`}
          onClick={() => setActiveTab('occupancy')}
        >
          {t("Tỷ lệ lấp đầy phòng học theo bộ môn")}</button>
      </div>

      {activeTab === 'audit' ? (
        <section data-i18n-managed aria-label={t("Bảng tra cứu nhật ký kiểm toán", "Audit log lookup")}>
          {/* Filters Bar */}
          <div className="portal-card audit-filter-bar">
            <div className="audit-filter-group" style={{ flex: 1.2, minWidth: '220px' }}>
              <span className="portal-label filter-label">{t("Tìm kiếm Người thực hiện")}</span>
              <input
                type="text"
                className="portal-input"
                placeholder={t("Nhập tên hoặc email...")}
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
                aria-label={t("Tìm kiếm người thực hiện")}
              />
            </div>

            <div className="audit-filter-group" style={{ minWidth: '160px' }}>
              <span className="portal-label filter-label">{t("Hành động", "Action")}</span>
              <Select
                className="portal-select"
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setCurrentPage(0);
                }}
                aria-label={t("Lọc theo hành động")}
              >
                <option value="ALL">{t("Tất cả hành động", "All actions")}</option>
                <option value="CREATE">{t("Tạo mới", "Create")}</option>
                <option value="UPDATE">{t("Cập nhật", "Update")}</option>
                <option value="DELETE">{t("Xóa", "Delete")}</option>
                <option value="CANCEL">{t("Hủy gói", "Cancel subscription")}</option>
                <option value="SCAN">{t("Quét mã", "QR scan")}</option>
                <option value="USER_CREATE">{t("Tạo tài khoản", "Create user")}</option>
                <option value="USER_UPDATE">{t("Sửa tài khoản", "Update user")}</option>
                <option value="USER_STATUS_CHANGE">{t("Đổi trạng thái", "Change status")}</option>
                <option value="STAFF_ACCOUNT_CREATE">{t("Tạo tài khoản nhân sự", "Create staff account")}</option>
                <option value="STAFF_ACCOUNT_STATUS_CHANGE">{t("Đổi trạng thái nhân sự", "Change staff status")}</option>
                <option value="MEMBER_KYC_APPROVE">{t("Duyệt định danh", "Approve identity verification")}</option>
                <option value="MEMBER_KYC_REJECT">{t("Từ chối định danh", "Reject identity verification")}</option>
                <option value="HOLD_APPROVE">{t("Duyệt bảo lưu", "Approve freeze")}</option>
                <option value="CLASS_CREATE_RECURRING">{t("Tạo lịch lớp định kỳ", "Create recurring class")}</option>
                <option value="PACKAGE_CREATE">{t("Tạo gói tập", "Create package")}</option>
                <option value="PAYMENT_REFUND">{t("Hoàn tiền", "Refund payment")}</option>
                <option value="COUNTER_PAYMENT">{t("Thu tiền tại quầy", "Counter payment")}</option>
                <option value="COMPLETE_ORDER">{t("Hoàn tất đơn hàng", "Complete order")}</option>
                <option value="CANCEL_ORDER">{t("Hủy đơn hàng", "Cancel order")}</option>
                <option value="USER_CLEANUP_INACTIVE">{t("Dọn dẹp tự động", "Auto cleanup")}</option>
              </Select>
            </div>

            <div className="audit-filter-group" style={{ minWidth: '180px' }}>
              <span className="portal-label filter-label">{t("Đối tượng", "Entity")}</span>
              <Select
                className="portal-select"
                value={selectedEntityType}
                onChange={(e) => {
                  setSelectedEntityType(e.target.value);
                  setCurrentPage(0);
                }}
                aria-label={t("Lọc theo đối tượng")}
              >
                <option value="ALL">{t("Tất cả đối tượng", "All entities")}</option>
                <option value="membership_subscriptions">{t("Gói tập", "Memberships")}</option>
                <option value="membership_packages">{t("Danh mục gói tập", "Membership packages")}</option>
                <option value="members">{t("Hội viên", "Members")}</option>
                <option value="payments">{t("Thanh toán", "Payments")}</option>
                <option value="invoices">{t("Hóa đơn", "Invoices")}</option>
                <option value="session_attendance">{t("Điểm danh", "Attendance")}</option>
                <option value="center_checkins">{t("Lượt ra vào", "Check-ins")}</option>
                <option value="classes">{t("Lớp học", "Classes")}</option>
                <option value="class_sessions">{t("Buổi học", "Class sessions")}</option>
                <option value="coach_bookings">{t("Lịch hẹn HLV 1:1", "PT bookings")}</option>
                <option value="products">{t("Sản phẩm", "Products")}</option>
                <option value="product_orders">{t("Đơn hàng sản phẩm", "Product orders")}</option>
                <option value="cancellation_requests">{t("Yêu cầu hủy", "Cancellations")}</option>
                <option value="support_requests">{t("Phiếu hỗ trợ", "Support tickets")}</option>
                <option value="users">{t("Tài khoản", "Accounts")}</option>
                <option value="role_permissions">{t("Phân quyền vai trò", "Role permissions")}</option>
                <option value="receptionists">{t("Ca trực lễ tân", "Reception shifts")}</option>
              </Select>
            </div>
          </div>

          {/* Audit Table */}
          <div className="portal-card portal-card--flush audit-table-card">
            {loadingLogs ? (
              <LoadingSkeleton label={t("Đang tải nhật ký kiểm toán…")} variant="table" count={8} />
            ) : logsError ? (
              <div data-i18n-managed className="portal-alert" role="alert">
                <span>{t(logsError)}</span>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setLogsReload((n) => n + 1)}>{t("Thử lại")}</button>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div data-i18n-managed style={{ textAlign: 'center', padding: '40px 0', color: 'var(--portal-muted)' }}>
                <p>{t("Không tìm thấy bản ghi nhật ký kiểm toán nào phù hợp.")}</p>
              </div>
            ) : (
              <table data-i18n-managed className="portal-table audit-table" aria-label={t("Bảng nhật ký kiểm toán")}>
                <thead>
                  <tr>
                    <th>{t("Thời gian")}</th>
                    <th>{t("Người thực hiện")}</th>
                    <th>{t("Hành động")}</th>
                    <th>{t("Đối tượng")}</th>
                    <th>{t("Bản ghi ID")}</th>
                    <th style={{ textAlign: 'right' }}>{t("Chi tiết thay đổi")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr data-i18n-managed key={log.id}>
                      <td style={{ fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums', color: 'var(--portal-muted)' }}>
                        {log.createdAt ? formatCenterDateTime(log.createdAt) : '—'}
                      </td>
                      <td>
                        <div className="actor-meta">
                          <span className="actor-name">{log.userFullName || t('Hệ thống', 'System')}</span>
                          <span className="actor-email">
                            {log.userEmail ||
                              (log.userId != null
                                ? `${t('Mã người dùng', 'User')} #${log.userId}`
                                : t('Tác vụ tự động', 'Automated task'))}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`action-badge ${getActionBadgeClass(log.action)}`}>
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--portal-paper)' }}>
                          {getEntityLabel(log.entityType)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>#{log.entityId}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-secondary btn-sm btn-view-diff"
                          onClick={() => setDiffLog(log)}
                          aria-label={t(`Xem diff bản ghi #${log.id}`, `View record diff #${log.id}`)}
                        >
                          {t("Xem thay đổi", "View changes")}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination Controls */}
            <div className="audit-pagination-bar">
              <span>
                {t("Hiển thị trang ")}<strong>{currentPage + 1}</strong> / <strong>{totalPages}</strong> ({totalElements}{t(" bản ghi)")}</span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="btn-secondary btn-sm btn-page-nav"
                  disabled={currentPage <= 0}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  aria-label={t("Trang trước")}
                >
                  {t("Trang trước")}</button>
                <button
                  type="button"
                  className="btn-secondary btn-sm btn-page-nav"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  aria-label={t("Trang sau →")}
                >
                  {t("Trang sau →")}</button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Tab 2: Occupancy Chart Section */
        <section data-i18n-managed aria-label={t("Biểu đồ tỷ lệ lấp đầy phòng học theo bộ môn")}>
          {occupancyError && !loadingOccupancy && (
            <div data-i18n-managed className="portal-alert" role="alert">
              <span>{t(occupancyError)}</span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setOccupancyReload((n) => n + 1)}>{t("Thử lại")}</button>
            </div>
          )}
          {loadingOccupancy ? <LoadingSkeleton label={t("Đang tải tổng quan công suất lớp học…")} variant="cards" count={3} className="occupancy-summary-skeleton" /> : occupancyError ? null : <div className="metrics-grid occupancy-summary-cards">
            <div className="metric-card occupancy-stat-card">
              <span className="metric-label stat-card-title">{t("Tỷ lệ lấp đầy trung bình")}</span>
              <span className="metric-value stat-card-number">{occupancyMetrics.avgUtilization}%</span>
            </div>
            <div className="metric-card occupancy-stat-card">
              <span className="metric-label stat-card-title">{t("Lớp công suất cao nhất")}</span>
              <span className="metric-value stat-card-number" style={{ fontSize: '1.25rem', lineHeight: 1.3 }}>
                {occupancyMetrics.highestClass}
              </span>
            </div>
            <div className="metric-card occupancy-stat-card">
              <span className="metric-label stat-card-title">{t("Tổng học viên đã đặt / Sức chứa", "Booked students / Capacity")}</span>
              <span className="metric-value stat-card-number">
                {occupancyMetrics.totalEnrolled} / {occupancyMetrics.totalCapacity}
              </span>
            </div>
          </div>}

          <div className="occupancy-chart-card">
            <h3 style={{ fontSize: '1.15rem', color: 'var(--portal-ink)', margin: '0 0 12px' }}>
              {t("Biểu đồ trực quan tỷ lệ lấp đầy theo lớp & bộ môn")}</h3>

            {loadingOccupancy ? (
              <LoadingSkeleton label={t("Đang tải biểu đồ công suất lớp học…")} count={4} />
            ) : occupancyError ? null : occupancyList.length === 0 ? (
              <div data-i18n-managed style={{ textAlign: 'center', padding: '30px 0', color: 'var(--portal-muted)' }}>
                <p>{t("Không có dữ liệu lớp học nào.")}</p>
              </div>
            ) : (
              <div data-i18n-managed className="chart-discipline-list">
                {occupancyList.map((item) => (
                  <div data-i18n-managed key={item.classId} className="discipline-chart-item">
                    <div className="discipline-chart-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="discipline-name-bold">{item.className}</span>
                        {item.roomName && (
                          <span data-i18n-managed className="badge badge-neutral">
                            {item.roomName}
                          </span>
                        )}
                        {item.disciplineName && (
                          <span data-i18n-managed style={{ fontSize: '0.78rem', color: 'var(--portal-muted)' }}>
                            ({item.disciplineName})
                          </span>
                        )}
                      </div>
                      <span className="discipline-rate-badge">{item.utilizationRate}%</span>
                    </div>

                    <div className="progress-track-bg">
                      <div
                        className="progress-fill-bar"
                        style={{ width: `${Math.min(100, Math.max(0, item.utilizationRate))}%` }}
                      />
                    </div>

                    <div className="discipline-chart-footer">
                      <span>
                        {t("Sĩ số: ")}<strong>{item.enrolledCount}</strong> / <strong>{item.capacity}</strong> {t(" học viên")}</span>
                      <span>
                        {t("Tỷ lệ chuyên cần (thực tế đi học): ")}<strong>{item.attendanceRate}%</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Modal xem chi tiết thay đổi diff */}
      {diffLog && (() => {
        const oldObj = parseRecordObject(diffLog.oldValue);
        const newObj = parseRecordObject(diffLog.newValue);
        const diffKeys = oldObj || newObj
          ? Array.from(new Set([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})]))
          : [];
        const normalizedIp = formatIpAddress(diffLog.ipAddress);

        return (
          <Modal
            title={t(
              `Chi tiết thay đổi bản ghi #${diffLog.id} (${getActionLabel(diffLog.action)} · ${getEntityLabel(diffLog.entityType)})`,
              `Record change details #${diffLog.id} (${getActionLabel(diffLog.action)} · ${getEntityLabel(diffLog.entityType)})`
            )}
            onClose={() => setDiffLog(null)}
          >
            <div className="diff-modal-container">
              <div className="diff-header-summary">
                <div>
                  <strong>{t("Người thực hiện:", "Actor:")}</strong>{' '}
                  {diffLog.userFullName || t('Hệ thống', 'System')}
                  {diffLog.userEmail
                    ? ` (${diffLog.userEmail})`
                    : diffLog.userId != null
                      ? ` (#${diffLog.userId})`
                      : ` · ${t('Tác vụ tự động', 'Automated task')}`}
                </div>
                <div>
                  <strong>{t("Thời gian:", "Timestamp:")}</strong> {diffLog.createdAt ? formatCenterDateTime(diffLog.createdAt) : '—'}
                </div>
                {normalizedIp && (
                  <div data-i18n-managed>
                    <strong>{t("Địa chỉ IP:", "IP address:")}</strong> {normalizedIp}
                  </div>
                )}
              </div>

              <div className="diff-grid-comparison">
                <div className="diff-box is-old">
                  <div className="diff-box-title">
                    <span>{t("Giá trị cũ", "Previous value")}</span>
                  </div>
                  {!diffLog.oldValue ? (
                    <p className="diff-empty-note">
                      {t('(Không có giá trị cũ - Bản ghi tạo mới)', '(No previous value - Newly created record)')}
                    </p>
                  ) : oldObj && diffKeys.length > 0 ? (
                    <dl className="diff-kv-list">
                      {diffKeys.map((key) => {
                        const changed = JSON.stringify(oldObj[key]) !== JSON.stringify(newObj?.[key]);
                        return (
                          <div key={key} className={`diff-kv-row${changed ? ' is-changed' : ''}`}>
                            <dt>{getDiffFieldLabel(key)}</dt>
                            <dd>{formatDiffFieldValue(oldObj[key])}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  ) : (
                    <pre className="diff-code-content">{formatJsonPretty(diffLog.oldValue)}</pre>
                  )}
                </div>

                <div className="diff-box is-new">
                  <div className="diff-box-title">
                    <span>{t("Giá trị mới", "Updated value")}</span>
                  </div>
                  {!diffLog.newValue ? (
                    <p className="diff-empty-note">
                      {t('(Không có giá trị mới - Bản ghi bị xóa)', '(No updated value - Deleted record)')}
                    </p>
                  ) : newObj && diffKeys.length > 0 ? (
                    <dl className="diff-kv-list">
                      {diffKeys.map((key) => {
                        const changed = JSON.stringify(oldObj?.[key]) !== JSON.stringify(newObj[key]);
                        return (
                          <div key={key} className={`diff-kv-row${changed ? ' is-changed' : ''}`}>
                            <dt>{getDiffFieldLabel(key)}</dt>
                            <dd>{formatDiffFieldValue(newObj[key])}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  ) : (
                    <pre className="diff-code-content">{formatJsonPretty(diffLog.newValue)}</pre>
                  )}
                </div>
              </div>

              {(oldObj || newObj) && (diffLog.oldValue != null || diffLog.newValue != null) && (
                <details className="diff-raw-details">
                  <summary>{t('Xem dữ liệu JSON gốc', 'View raw JSON payload')}</summary>
                  <div className="diff-grid-comparison diff-raw-grid">
                    <pre className="diff-code-content">
                      {diffLog.oldValue ? formatJsonPretty(diffLog.oldValue) : 'null'}
                    </pre>
                    <pre className="diff-code-content">
                      {diffLog.newValue ? formatJsonPretty(diffLog.newValue) : 'null'}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
