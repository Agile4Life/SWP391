import { useStaffI18n, type StaffMessage, staffError as errorMessage } from '../operations/staffI18n';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Select } from '../../shared/ui/Select';
import { DatePicker } from '../../shared/ui/DatePicker';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { Modal } from '../../shared/ui/Modal';
import { formatPrice } from '../../shared/lib/membershipPresentation';
import {
  auditApi,
  type AuditLogItem,
  type ClassOccupancyItem,
} from './auditApi';
import './admin-audit-logs.css';
import { formatCenterDateTime } from '../../shared/lib/centerTime';

/** Hai tab của trang: nhật ký thao tác (audit) và mức lấp đầy lớp học. */
type ActiveTab = 'audit' | 'occupancy';

/**
 * Trang quản trị: xem nhật ký thao tác hệ thống (lọc theo người, đối tượng, hành động, khoảng ngày, xem khác
 * biệt giá trị cũ/mới) và thống kê mức lấp đầy, tỷ lệ đi học của các lớp.
 */
export function AdminAuditLogsPage() {
  const { t } = useStaffI18n();
  const [activeTab, setActiveTab] = useState<ActiveTab>('audit');

  // Trạng thái danh sách nhật ký thao tác
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [logsError, setLogsError] = useState<StaffMessage>('');
  const [logsReload, setLogsReload] = useState<number>(0);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(0);

  // Trạng thái bộ lọc nhật ký
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('ALL');
  const [actorSearch, setActorSearch] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Nếu người dùng nhập số nguyên hoặc #ID (ví dụ: 5 hoặc #5), gửi thẳng user_id lên server để lọc toàn hệ thống.
  const parsedActorUserId = useMemo(() => {
    const match = /^#?(\d+)$/.exec(actorSearch.trim());
    if (!match) return undefined;
    const id = Number(match[1]);
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
  }, [actorSearch]);

  const dateRangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);

  // Trạng thái hộp thoại xem khác biệt (diff)
  const [diffLog, setDiffLog] = useState<AuditLogItem | null>(null);
  const [showRawDiffJson, setShowRawDiffJson] = useState<boolean>(false);

  // Trạng thái báo cáo mức lấp đầy lớp học
  const [occupancyList, setOccupancyList] = useState<ClassOccupancyItem[]>([]);
  const [loadingOccupancy, setLoadingOccupancy] = useState<boolean>(true);
  const [occupancyError, setOccupancyError] = useState<StaffMessage>('');
  const [occupancyReload, setOccupancyReload] = useState<number>(0);

  // Tải danh sách nhật ký thao tác
  useEffect(() => {
    if (dateRangeInvalid) {
      setLoadingLogs(false);
      setLogs([]);
      setTotalElements(0);
      setTotalPages(1);
      setLogsError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
      return undefined;
    }
    let mounted = true;
    // Tải nhật ký thao tác theo bộ lọc và trang hiện tại.
    const fetchAudit = async () => {
      setLoadingLogs(true);
      setLogsError('');
      try {
        const res = await auditApi.getAuditLogs({
          userId: parsedActorUserId,
          action: selectedAction,
          entityType: selectedEntityType,
          from: fromDate || undefined,
          to: toDate || undefined,
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
  }, [parsedActorUserId, selectedAction, selectedEntityType, fromDate, toDate, dateRangeInvalid, currentPage, logsReload]);

  // Tải báo cáo mức lấp đầy lớp học
  useEffect(() => {
    let mounted = true;
    // Tải thống kê mức lấp đầy của các lớp.
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

  // Lọc nhật ký tại client theo tên/email người thực hiện trên trang hiện tại (nếu nhập #ID thì đã lọc trên server).
  const isClientActorFilter = Boolean(actorSearch.trim()) && parsedActorUserId === undefined;
  const filteredLogs = useMemo(() => {
    if (!isClientActorFilter) return logs;
    const q = actorSearch.toLowerCase().trim();
    return logs.filter(
      (l) =>
        (l.userFullName ?? '').toLowerCase().includes(q) ||
        (l.userEmail ?? '').toLowerCase().includes(q)
    );
  }, [logs, actorSearch, isClientActorFilter]);

  // Chỉ số tổng hợp mức lấp đầy: tỷ lệ lấp đầy trung bình, lớp cao nhất (ẩn khi mọi lớp đều 0%), tổng sức chứa và tổng ghi danh.
  const occupancyMetrics = useMemo(() => {
    if (occupancyList.length === 0) {
      return { avgUtilization: 0, highestClass: '—', totalCapacity: 0, totalEnrolled: 0 };
    }
    const totalCap = occupancyList.reduce((acc, c) => acc + c.capacity, 0);
    const totalEnr = occupancyList.reduce((acc, c) => acc + c.enrolledCount, 0);
    const avg = totalCap > 0 ? (totalEnr / totalCap) * 100 : 0;
    const sorted = [...occupancyList].sort((a, b) => b.utilizationRate - a.utilizationRate);
    const topClass = sorted[0];

    return {
      avgUtilization: Math.round(avg * 10) / 10,
      highestClass: topClass && topClass.utilizationRate > 0 ? topClass.className : '—',
      totalCapacity: totalCap,
      totalEnrolled: totalEnr,
    };
  }, [occupancyList]);

  // Định dạng giá trị JSON (chuỗi JSON được parse lại) thành văn bản thụt lề dễ đọc.
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

  // Chuyển mã dạng camelCase/snake_case thành câu dễ đọc, viết hoa chữ đầu.
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

  // Đọc giá trị (đối tượng hoặc chuỗi JSON) thành object thuần; không phải object thì trả null.
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

  // Hiển thị IP; địa chỉ loopback IPv6 được đổi thành 127.0.0.1.
  const formatIpAddress = (ip?: string | null) => {
    if (!ip) return '';
    const trimmed = ip.trim();
    if (trimmed === '0:0:0:0:0:0:0:1' || trimmed === '::1') return '127.0.0.1';
    return trimmed;
  };

  // Chọn class màu của huy hiệu theo loại hành động (tạo, sửa, xóa, hủy...).
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
    if (a === 'SCAN' || a === 'PT_ATTENDANCE_MARK' || a === 'CLASS_ATTENDANCE_RECORD') return 'is-scan';
    return '';
  };

  // Nhãn tiếng Việt/Anh của loại hành động.
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
      case 'CLASS_ATTENDANCE_RECORD': return t('Điểm danh lớp học', 'Record class attendance');
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

  // Nhãn tiếng Việt/Anh của loại đối tượng (tài khoản, hội viên...).
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

  // Nhãn tiếng Việt/Anh của tên trường trong bảng khác biệt.
  const getDiffFieldLabel = (key: string) => {
    switch (key) {
      case 'id': return 'ID';
      case 'userId':
      case 'user_id': return t('Mã tài khoản', 'User ID');
      case 'memberId':
      case 'member_id': return t('Mã hội viên', 'Member ID');
      case 'membershipCode':
      case 'membership_code': return t('Mã thẻ hội viên', 'Membership code');
      case 'packageId':
      case 'package_id': return t('Mã gói tập', 'Package ID');
      case 'packageName':
      case 'package_name': return t('Tên gói tập', 'Package name');
      case 'classId':
      case 'class_id': return t('Mã lớp học', 'Class ID');
      case 'className':
      case 'class_name': return t('Tên lớp học', 'Class name');
      case 'sessionId':
      case 'session_id': return t('Mã buổi học', 'Session ID');
      case 'roomId':
      case 'room_id': return t('Mã phòng tập', 'Room ID');
      case 'coachId':
      case 'coach_id': return t('Mã HLV', 'Coach ID');
      case 'status': return t('Trạng thái', 'Status');
      case 'paymentStatus':
      case 'payment_status': return t('Trạng thái thanh toán', 'Payment status');
      case 'holdStatus':
      case 'hold_status': return t('Trạng thái bảo lưu', 'Hold status');
      case 'invoiceNumber':
      case 'invoice_number': return t('Số hóa đơn', 'Invoice number');
      case 'orderNumber':
      case 'order_number': return t('Mã đơn hàng', 'Order number');
      case 'amount':
      case 'totalAmount':
      case 'total_amount': return t('Số tiền', 'Amount');
      case 'refundAmount':
      case 'refund_amount': return t('Số tiền hoàn', 'Refund amount');
      case 'balance': return t('Số dư', 'Balance');
      case 'price': return t('Đơn giá', 'Price');
      case 'method':
      case 'paymentMethod':
      case 'payment_method': return t('Phương thức thanh toán', 'Payment method');
      case 'name': return t('Tên', 'Name');
      case 'title': return t('Tiêu đề', 'Title');
      case 'description': return t('Mô tả', 'Description');
      case 'fullName':
      case 'full_name': return t('Họ và tên', 'Full name');
      case 'email': return 'Email';
      case 'phone': return t('Số điện thoại', 'Phone');
      case 'role':
      case 'roleCode':
      case 'role_code':
      case 'roleName': return t('Vai trò', 'Role');
      case 'permission':
      case 'permissionCode':
      case 'permission_code': return t('Quyền hạn', 'Permission');
      case 'kycStatus':
      case 'kyc_status': return t('Trạng thái định danh', 'Verification status');
      case 'idCardType':
      case 'id_card_type':
      case 'documentType':
      case 'document_type': return t('Loại giấy tờ', 'Document type');
      case 'citizenId':
      case 'citizen_id':
      case 'documentNumber':
      case 'document_number': return t('Số giấy tờ', 'Document number');
      case 'nationality': return t('Quốc tịch', 'Nationality');
      case 'startDate':
      case 'start_date': return t('Ngày bắt đầu', 'Start date');
      case 'endDate':
      case 'end_date': return t('Ngày kết thúc', 'End date');
      case 'holdStartDate':
      case 'hold_start_date': return t('Ngày bắt đầu bảo lưu', 'Hold start date');
      case 'holdEndDate':
      case 'hold_end_date': return t('Ngày kết thúc bảo lưu', 'Hold end date');
      case 'durationDays':
      case 'duration_days': return t('Thời hạn (ngày)', 'Duration (days)');
      case 'capacity': return t('Sức chứa', 'Capacity');
      case 'tier': return t('Hạng gói', 'Tier');
      case 'stock':
      case 'stockQuantity':
      case 'stock_quantity': return t('Tồn kho', 'Stock');
      case 'shift':
      case 'targetShift':
      case 'target_shift': return t('Ca trực', 'Shift');
      case 'requestType':
      case 'request_type': return t('Loại yêu cầu', 'Request type');
      case 'reason':
      case 'holdReason':
      case 'hold_reason':
      case 'rejectionReason':
      case 'rejection_reason':
      case 'denialReason':
      case 'denial_reason': return t('Lý do', 'Reason');
      case 'note':
      case 'notes':
      case 'managerNotes':
      case 'manager_notes': return t('Ghi chú', 'Notes');
      case 'isActive':
      case 'active': return t('Kích hoạt', 'Active');
      case 'fitnessGoal':
      case 'fitness_goal': return t('Mục tiêu tập luyện', 'Fitness goal');
      case 'gate': return t('Cổng kiểm soát', 'Gate');
      case 'createdAt':
      case 'created_at': return t('Thời điểm tạo', 'Created at');
      case 'updatedAt':
      case 'updated_at': return t('Thời điểm cập nhật', 'Updated at');
      case 'deletedAt':
      case 'deleted_at': return t('Thời điểm xóa', 'Deleted at');
      default: return humanizeCode(key) || key;
    }
  };

  // Định dạng giá trị của một trường khác biệt: dịch các mã enum/trạng thái quen thuộc (không rò rỉ CCCD hay snake_case sang EN).
  const formatDiffFieldValue = (val: unknown, key?: string) => {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'boolean') return val ? t('Có', 'Yes') : t('Không', 'No');
    if (typeof val === 'number') {
      if (key && /^(amount|totalAmount|total_amount|price|refundAmount|refund_amount|balance)$/.test(key)) {
        return formatPrice(val);
      }
      return String(val);
    }
    if (typeof val === 'object') return JSON.stringify(val);
    const raw = String(val).trim();
    const normalized = raw.toLowerCase();
    switch (normalized) {
      case 'cccd': return t('CCCD', 'Identity card');
      case 'passport': return t('Hộ chiếu', 'Passport');
      case 'pending_payment': return t('Chờ thanh toán', 'Pending payment');
      case 'pending_approval': return t('Chờ duyệt', 'Pending approval');
      case 'pending': return t('Chờ duyệt', 'Pending');
      case 'active': return t('Đang hoạt động', 'Active');
      case 'inactive': return t('Ngưng hoạt động', 'Inactive');
      case 'suspended': return t('Tạm khóa', 'Suspended');
      case 'approved': return t('Đã duyệt', 'Approved');
      case 'rejected': return t('Đã từ chối', 'Rejected');
      case 'cancelled':
      case 'canceled': return t('Đã hủy', 'Cancelled');
      case 'completed': return t('Hoàn tất', 'Completed');
      case 'expired': return t('Hết hạn', 'Expired');
      case 'frozen':
      case 'on_hold':
      case 'hold': return t('Đang bảo lưu', 'On hold');
      case 'paid': return t('Đã thanh toán', 'Paid');
      case 'unpaid': return t('Chưa thanh toán', 'Unpaid');
      case 'failed': return t('Thất bại', 'Failed');
      case 'refunded': return t('Đã hoàn tiền', 'Refunded');
      case 'granted': return t('Cho phép', 'Granted');
      case 'denied': return t('Từ chối', 'Denied');
      case 'cash': return t('Tiền mặt', 'Cash');
      case 'bank_transfer': return t('Chuyển khoản', 'Bank transfer');
      case 'online_wallet': return t('Ví / Trực tuyến', 'Wallet / Online');
      case 'pos': return t('Thẻ / POS', 'Card / POS');
      case 'ready_for_pickup': return t('Sẵn sàng nhận tại quầy', 'Ready for pickup');
      case 'lose_weight': return t('Giảm cân', 'Weight loss');
      case 'gain_muscle': return t('Tăng cơ', 'Muscle gain');
      case 'maintain': return t('Duy trì vóc dáng', 'Maintenance');
      case 'general_fitness': return t('Thể lực tổng quát', 'General fitness');
      case 'member': return t('Hội viên', 'Member');
      case 'staff': return t('Lễ tân', 'Staff');
      case 'receptionist': return t('Lễ tân', 'Receptionist');
      case 'coach': return t('Huấn luyện viên', 'Coach');
      case 'manager':
      case 'center_manager': return t('Quản lý', 'Manager');
      case 'admin': return t('Quản trị viên', 'Administrator');
      case 'leave': return t('Xin nghỉ phép', 'Leave');
      case 'shift_exchange': return t('Đổi ca trực', 'Shift exchange');
      case 'schedule_change': return t('Đổi lịch dạy', 'Schedule change');
      case 'other': return t('Khác', 'Other');
      default: return raw;
    }
  };

  return (
    <div data-i18n-managed className="audit-page portal-container">
      <PageHeader
        title={t("Nhật ký & lấp đầy lớp")}
        actions={
          <RefreshButton
            label={activeTab === 'audit' ? t('Làm mới nhật ký', 'Refresh audit log') : t('Làm mới thống kê lấp đầy', 'Refresh occupancy')}
            disabled={activeTab === 'audit' ? loadingLogs : loadingOccupancy}
            onClick={() => activeTab === 'audit' ? setLogsReload((n) => n + 1) : setOccupancyReload((n) => n + 1)}
          />
        }
      />

      {/* Các tab điều hướng */}
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
          {/* Thanh bộ lọc */}
          <div className="portal-card audit-filter-bar">
            <div className="audit-filter-group" style={{ flex: 1.2, minWidth: '220px' }}>
              <label htmlFor="audit-actor-search" className="portal-label filter-label">{t("Tìm kiếm Người thực hiện", "Search actor")}</label>
              <input
                id="audit-actor-search"
                type="text"
                className="portal-input"
                placeholder={t("Tên, email (trang này) hoặc #ID...", "Name, email (this page) or #ID...")}
                value={actorSearch}
                onChange={(e) => {
                  const next = e.target.value;
                  const prevId = /^#?(\d+)$/.exec(actorSearch.trim())?.[1];
                  const nextId = /^#?(\d+)$/.exec(next.trim())?.[1];
                  setActorSearch(next);
                  if (prevId !== nextId) setCurrentPage(0);
                }}
                aria-label={t("Tìm kiếm người thực hiện", "Search actor")}
              />
            </div>

            <div className="audit-filter-group" style={{ minWidth: '165px' }}>
              <label htmlFor="audit-from-date" className="portal-label filter-label">{t("Từ ngày", "From")}</label>
              <DatePicker
                id="audit-from-date"
                value={fromDate}
                max={toDate || undefined}
                aria-label={t("Từ ngày", "From date")}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(0);
                }}
              />
            </div>

            <div className="audit-filter-group" style={{ minWidth: '165px' }}>
              <label htmlFor="audit-to-date" className="portal-label filter-label">{t("Đến ngày", "To")}</label>
              <DatePicker
                id="audit-to-date"
                value={toDate}
                min={fromDate || undefined}
                aria-label={t("Đến ngày", "To date")}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(0);
                }}
              />
            </div>

            <div className="audit-filter-group" style={{ minWidth: '160px' }}>
              <label htmlFor="audit-action-filter" className="portal-label filter-label">{t("Hành động", "Action")}</label>
              <Select
                id="audit-action-filter"
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
                <option value="USER_CLEANUP_INACTIVE">{t("Dọn dẹp tự động", "Auto cleanup")}</option>
              </Select>
            </div>

            <div className="audit-filter-group" style={{ minWidth: '180px' }}>
              <label htmlFor="audit-entity-filter" className="portal-label filter-label">{t("Đối tượng", "Entity")}</label>
              <Select
                id="audit-entity-filter"
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
                <option value="cancellation_requests">{t("Yêu cầu hủy", "Cancellations")}</option>
                <option value="support_requests">{t("Phiếu hỗ trợ", "Support tickets")}</option>
                <option value="users">{t("Tài khoản", "Accounts")}</option>
                <option value="role_permissions">{t("Phân quyền vai trò", "Role permissions")}</option>
                <option value="receptionists">{t("Ca trực lễ tân", "Reception shifts")}</option>
              </Select>
            </div>
          </div>

          {/* Bảng nhật ký thao tác */}
          <div className="portal-card portal-card--flush audit-table-card">
            {loadingLogs ? (
              <LoadingSkeleton label={t("Đang tải nhật ký kiểm toán…")} variant="table" count={8} />
            ) : logsError ? (
              <div data-i18n-managed className="portal-alert" role="alert">
                <span>{t(logsError)}</span>
                {!dateRangeInvalid && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setLogsReload((n) => n + 1)}>{t("Thử lại")}</button>
                )}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div data-i18n-managed style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--portal-muted)' }}>
                <p>
                  {isClientActorFilter && logs.length > 0
                    ? t('Không có bản ghi nào trên trang hiện tại khớp tên/email này. Nhập #ID để lọc toàn hệ thống.', 'No rows on this page match that name or email. Enter #ID to filter server-wide.')
                    : t("Không tìm thấy bản ghi nhật ký kiểm toán nào phù hợp.")}
                </p>
              </div>
            ) : (
              <div className="portal-table-wrapper">
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
                            onClick={() => { setShowRawDiffJson(false); setDiffLog(log); }}
                            aria-label={t(`Xem diff bản ghi #${log.id}`, `View record diff #${log.id}`)}
                          >
                            {t("Xem thay đổi", "View changes")}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Điều khiển phân trang: ẩn khi đang tải, lỗi hoặc không có kết quả */}
            {!loadingLogs && !logsError && totalElements > 0 && (
              <div className="audit-pagination-bar">
                <span>
                  {isClientActorFilter ? (
                    t(
                      `Khớp ${filteredLogs.length}/${logs.length} dòng trên trang ${currentPage + 1}/${totalPages} (tổng ${totalElements} bản ghi · nhập #ID để lọc toàn hệ thống)`,
                      `Matched ${filteredLogs.length}/${logs.length} rows on page ${currentPage + 1}/${totalPages} (${totalElements} total · enter #ID to filter server-wide)`,
                    )
                  ) : (
                    <>{t("Hiển thị trang ")}<strong>{currentPage + 1}</strong> / <strong>{totalPages}</strong> ({totalElements}{t(" bản ghi)")}</>
                  )}
                </span>
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
            )}
          </div>
        </section>
      ) : (
        /* Tab 2: Khu vực biểu đồ mức lấp đầy lớp học */
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
            <h3 style={{ fontSize: '1.15rem', color: 'var(--portal-paper)', margin: '0 0 12px' }}>
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
                            <dd>{formatDiffFieldValue(oldObj[key], key)}</dd>
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
                            <dd>{formatDiffFieldValue(newObj[key], key)}</dd>
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
                <details
                  className="diff-raw-details"
                  open={showRawDiffJson}
                  onToggle={(e) => setShowRawDiffJson(e.currentTarget.open)}
                >
                  <summary>{t('Xem dữ liệu JSON gốc', 'View raw JSON payload')}</summary>
                  {showRawDiffJson && (
                    <div className="diff-grid-comparison diff-raw-grid">
                      <pre className="diff-code-content">
                        {diffLog.oldValue ? formatJsonPretty(diffLog.oldValue) : 'null'}
                      </pre>
                      <pre className="diff-code-content">
                        {diffLog.newValue ? formatJsonPretty(diffLog.newValue) : 'null'}
                      </pre>
                    </div>
                  )}
                </details>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
