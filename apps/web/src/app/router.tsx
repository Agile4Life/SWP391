import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RoleGuard } from '../shared/ui/RoleGuard';
import { PortalHome } from '../shared/ui/PortalHome';
import { PortalRouteError, RouteLoading, RouteLoadError } from '../shared/ui/RouteState';
import { LegacyAttendanceRedirect, LegacyClassesRedirect, LegacyStaffRouteRedirect } from './LegacyRedirects';

export const router = createBrowserRouter([
  // Public 3 bộ môn chuẩn (Gym trên trang chủ, Boxing & Yoga có trang riêng); giữ route gói, lớp nhóm, PT và quản lý.
  { path: '/', lazy: async () => ({ Component: (await import('../features/landing/LandingPage')).LandingPage }) },
  { path: '/boxing', lazy: async () => ({ Component: (await import('../features/landing/SportPage')).SportPage }) },
  { path: '/yoga', lazy: async () => ({ Component: (await import('../features/landing/SportPage')).SportPage }) },
  { path: '/sports/:sportId', lazy: async () => ({ Component: (await import('../features/landing/SportPage')).SportPage }) },
  { path: '/trainers', lazy: async () => ({ Component: (await import('../features/landing/TrainerStoryPage')).TrainerStoryPage }) },
  { path: '/trainers/:trainerId', lazy: async () => ({ Component: (await import('../features/landing/TrainerStoryPage')).TrainerStoryPage }) },
  { path: '/login', lazy: async () => ({ Component: (await import('../features/auth/LoginPage')).LoginPage }) },
  { path: '/register', lazy: async () => ({ Component: (await import('../features/auth/RegisterPage')).RegisterPage }) },

  // Khung ứng dụng Portal có bảo vệ đăng nhập
  {
    id: 'portal',
    // Khung portal (sidebar, topbar), tải lười AppLayout.
    lazy: async () => ({ Component: (await import('../shared/ui/AppLayout')).AppLayout }),
    children: [
      { path: '/portal', element: <PortalHome /> },
      {
        element: <RoleGuard allowedRoles={['MEMBER', 'STAFF', 'COACH', 'MANAGER']} />,
        children: [{ path: '/messages', lazy: async () => ({ Component: (await import('../features/chat/ChatPage')).ChatPage }) }],
      },

      // Thông báo (dùng chung cho hội viên, HLV và các vai trò portal)
      {
        element: <RoleGuard allowedRoles={['MEMBER', 'COACH', 'MANAGER', 'CENTER_MANAGER', 'STAFF', 'RECEPTIONIST', 'ADMIN']} />,
        children: [
          {
            path: '/member/notifications',
            // Trang /member/notifications: tải lười MemberNotificationsPage.
            lazy: async () => ({ Component: (await import('../features/member/MemberNotificationsPage')).MemberNotificationsPage }),
          },
        ],
      },

      // Các route chỉ dành cho hội viên
      {
        element: <RoleGuard allowedRoles={['MEMBER']} />,
        children: [
          {
            path: '/member/dashboard',
            // Trang /member/dashboard: tải lười MemberDashboardPage.
            lazy: async () => ({ Component: (await import('../features/member/MemberDashboardPage')).MemberDashboardPage }),
          },
          {
            path: '/member/explore',
            element: <Navigate to="/member/dashboard" replace />,
          },
          {
            path: '/member/orders',
            element: <Navigate to="/member/dashboard" replace />,
          },
          {
            path: '/member/orders/*',
            element: <Navigate to="/member/dashboard" replace />,
          },
          {
            path: '/member/streak',
            element: <Navigate to="/member/dashboard" replace />,
          },
          {
            path: '/member/packages',
            // Trang /member/packages: tải lười MemberPackagesPage.
            lazy: async () => ({ Component: (await import('../features/member/MemberPackagesPage')).MemberPackagesPage }),
          },
          {
            path: '/member/packages/checkout',
            // Trang /member/packages/checkout: tải lười MemberCheckoutPage.
            lazy: async () => ({ Component: (await import('../features/member/MemberCheckoutPage')).MemberCheckoutPage }),

          },
          { path: '/member/payments/vnpay/return', lazy: async () => ({ Component: (await import('../features/payments/VnpayReturnPage')).VnpayReturnPage }) },
          {
            path: '/member/hold',
            // Trang /member/hold: tải lười MemberHoldPage.
            lazy: async () => ({ Component: (await import('../features/member/MemberHoldPage')).MemberHoldPage }),
          },
          {
            path: '/member/card',
            // Trang /member/card: tải lười MemberCardPage.
            lazy: async () => ({ Component: (await import('../features/member/MemberCardPage')).MemberCardPage }),
          },
          {
            path: '/member/check-in',
            // Trang /member/check-in: tải lười MemberCheckInPage.
            lazy: async () => ({ Component: (await import('../features/member/MemberCheckInPage')).MemberCheckInPage }),
          },
          {
            path: '/member/invoices',
            // Trang /member/invoices: tải lười MemberInvoicesPage.
            lazy: async () => ({ Component: (await import('../features/member/MemberInvoicesPage')).MemberInvoicesPage }),
          },
          {
            // Giữ URL cũ cho Giáo án; quyền Member vẫn được kiểm tra bởi RoleGuard.
            path: '/member/progress',
            // Trang /member/progress: tải lười MemberProgressPage.
            lazy: async () => ({ Component: (await import('../features/member/MemberProgressPage')).MemberProgressPage }),
          },
          {
            // Hỗ trợ & khiếu nại đã gộp vào Tin nhắn; giữ đường dẫn cũ cho email và thông báo.
            path: '/member/support',
            element: <Navigate to="/messages?tab=support" replace />,
          },
        ],
      },

      // Route lịch tập của hội viên
      {
        element: (
          <RoleGuard
            allowedRoles={['MEMBER']}
          />
        ),
        children: [
          {
            path: '/member/classes',
            // Trang /member/classes: tải lười MemberClassesPage.
            lazy: async () => ({ Component: (await import('../features/member/MemberClassesPage')).MemberClassesPage }),
          },
        ],
      },

      // Hồ sơ cá nhân
      {
        element: (
          <RoleGuard
            allowedRoles={[
              'MEMBER',
              'STAFF',
              'RECEPTIONIST',
              'COACH',
              'MANAGER',
              'CENTER_MANAGER',
              'ADMIN',
            ]}
          />
        ),
        children: [
          {
            path: '/member/profile',
            // Trang /member/profile: tải lười MemberProfilePage.
            lazy: async () => ({ Component: (await import('../features/member/MemberProfilePage')).MemberProfilePage }),
          },
          {
            path: '/profile',
            // Trang /profile: tải lười MemberProfilePage.
            lazy: async () => ({ Component: (await import('../features/member/MemberProfilePage')).MemberProfilePage }),
          },
        ],
      },

      // Các route dành riêng cho lễ tân (STAFF)
      {
        element: <RoleGuard allowedRoles={['STAFF', 'RECEPTIONIST']} />,
        children: [
          {
            path: '/staff/reception',
            // Trang /staff/reception: tải lười StaffReceptionPage.
            lazy: async () => ({ Component: (await import('../features/reception/StaffReceptionPage')).StaffReceptionPage }),
          },
          {
            path: '/staff/check-in',
            // Trang /staff/check-in: tải lười StaffCheckInPage.
            lazy: async () => ({ Component: (await import('../features/reception/StaffCheckInPage')).StaffCheckInPage }),
          },
          {
            path: '/staff/check-out',
            // Link cũ vẫn đi qua RoleGuard lễ tân trước khi chuyển sang Check-in.
            element: <Navigate to="/staff/check-in" replace />,
          },
          {
            path: '/staff/reception-history',
            // Trang /staff/reception-history: tải lười StaffRequestHistoryPage.
            lazy: async () => ({ Component: (await import('../features/reception/StaffRequestHistoryPage')).StaffRequestHistoryPage }),
          },
          {
            path: '/staff/kyc',
            // Trang /staff/kyc: tải lười KycReviewPage.
            lazy: async () => ({ Component: (await import('../features/reception/KycReviewPage')).KycReviewPage }),
          },
          {
            path: '/staff/holds',
            // Trang /staff/holds: tải lười HoldManagementPage.
            lazy: async () => ({ Component: (await import('../features/reception/HoldManagementPage')).HoldManagementPage }),
          },
          { path: '/staff/support', element: <Navigate to="/messages?tab=support" replace /> },
        ],
      },

      // Các route dành riêng cho huấn luyện viên (COACH)
      {
        element: <RoleGuard allowedRoles={['COACH']} />,
        children: [
          {
            path: '/coach/pt-attendance',
            // Trang /coach/pt-attendance: tải lười PtAttendancePage.
            lazy: async () => ({ Component: (await import('../features/coaching/PtAttendancePage')).PtAttendancePage }),
          },
          {
            path: '/coach/attendance',
            // Trang /coach/attendance: tải lười CoachAttendancePage (điểm danh lớp nhóm).
            lazy: async () => ({ Component: (await import('../features/coaching/CoachAttendancePage')).CoachAttendancePage }),
          },
          {
            path: '/coach/attendance/:sessionId',
            // Trang /coach/attendance/:sessionId: tải lười CoachAttendancePage cho buổi cụ thể.
            lazy: async () => ({ Component: (await import('../features/coaching/CoachAttendancePage')).CoachAttendancePage }),
          },
          {
            path: '/staff/attendance',
            element: <Navigate to="/coach/attendance" replace />,
          },
          {
            path: '/staff/attendance/:sessionId',
            element: <LegacyAttendanceRedirect />,
          },
          {
            path: '/coach/classes',
            // Trang /coach/classes: tải lười CoachClassesPage.
            lazy: async () => ({ Component: (await import('../features/coaching/CoachClassesPage')).CoachClassesPage }),
          },
          {
            path: '/coach/training-plans',
            // Trang /coach/training-plans: tải lười CoachTrainingPlanPage.
            lazy: async () => ({ Component: (await import('../features/coaching/CoachTrainingPlanPage')).CoachTrainingPlanPage }),
          },
          {
            path: '/coach/health-metrics',
            element: <Navigate to="/coach/training-plans" replace />,
          },
          {
            path: '/coach/saved-plans',
            // Trang /coach/saved-plans: tải lười CoachSavedPlansPage.
            lazy: async () => ({ Component: (await import('../features/coaching/CoachSavedPlansPage')).CoachSavedPlansPage }),
          },
          {
            path: '/staff/coach-classes',
            element: <Navigate to="/coach/classes" replace />,
          },
        ],
      },

      // Route đơn nội bộ dùng chung cho nhân viên lễ tân và huấn luyện viên
      {
        element: <RoleGuard allowedRoles={['STAFF', 'RECEPTIONIST', 'COACH']} />,
        children: [
          {
            path: '/staff/requests',
            // Trang /staff/requests: tải lười StaffInternalRequestsPage.
            lazy: async () => ({ Component: (await import('../features/operations/StaffInternalRequestsPage')).StaffInternalRequestsPage }),
          },
        ],
      },

      // Lịch lớp và các liên kết lễ tân đã ngừng (lễ tân và quản lý)
      {
        element: <RoleGuard allowedRoles={['STAFF', 'RECEPTIONIST', 'MANAGER', 'CENTER_MANAGER']} />,
        children: [
          {
            path: '/staff/pt-attendance',
            element: <LegacyStaffRouteRedirect />,
          },
          {
            path: '/staff/classes',
            element: <LegacyClassesRedirect />,
          },
          {
            path: '/staff/orders',
            element: <LegacyStaffRouteRedirect />,
          },
        ],
      },

      // Các route dành riêng cho quản trị viên (ADMIN)
      {
        element: <RoleGuard allowedRoles={['ADMIN']} />,
        children: [
          { path: '/admin/users', lazy: async () => ({ Component: (await import('../features/manager/UserManagerPage')).UserManagerPage }) },
          { path: '/admin/audit-logs', lazy: async () => ({ Component: (await import('../features/admin/AdminAuditLogsPage')).AdminAuditLogsPage }) },
          { path: '/admin/payments', lazy: async () => ({ Component: (await import('../features/admin/AdminPaymentReconciliationPage')).AdminPaymentReconciliationPage }) },
        ],
      },
      // Các route dành riêng cho quản lý trung tâm
      {
        element: (
          <RoleGuard allowedRoles={['MANAGER', 'CENTER_MANAGER']} />
        ),
        children: [
          {
            path: '/manager/classes',
            // Trang /manager/classes: tải lười ManagerClassesPage (quản lý lớp học & xếp lịch).
            lazy: async () => ({ Component: (await import('../features/classes/ManagerClassesPage')).ManagerClassesPage }),
          },
          {
            path: '/manager/catalogs',
            // Trang /manager/catalogs: tải lười ManagerCatalogsPage.
            lazy: async () => ({ Component: (await import('../features/manager/ManagerCatalogsPage')).ManagerCatalogsPage }),
          },
          {
            path: '/manager/products',
            element: <Navigate to="/manager/reports" replace />,
          },
          {
            path: '/manager/products/new',
            element: <Navigate to="/manager/reports" replace />,
          },
          {
            path: '/manager/products/:productId',
            element: <Navigate to="/manager/reports" replace />,
          },
          {
            path: '/manager/equipment',
            element: <Navigate to="/manager/catalogs" replace />,
          },
          {
            path: '/manager/coach-assignments',
            // Trang /manager/coach-assignments: tải lười ManagerCoachAssignmentsPage.
            lazy: async () => ({ Component: (await import('../features/manager/ManagerCoachAssignmentsPage')).ManagerCoachAssignmentsPage }),
          },
          {
            path: '/manager/staff-accounts',
            // Trang /manager/staff-accounts: tải lười StaffAccountsPage.
            lazy: async () => ({ Component: (await import('../features/manager/StaffAccountsPage')).StaffAccountsPage }),
          },
          {
            path: '/manager/users',
            element: <Navigate to="/manager/staff-accounts" replace />,
          },
          {
            path: '/manager/reports',
            // Trang /manager/reports: tải lười ManagerReportsPage.
            lazy: async () => ({ Component: (await import('../features/manager/ManagerReportsPage')).ManagerReportsPage }),
          },
          {
            path: '/manager/cancellations',
            element: <Navigate to="/manager/reports" replace />,
          },
          {
            path: '/manager/coach-reviews',
            element: <Navigate to="/manager/coach-assignments" replace />,
          },
          {
            // Khiếu nại chuyển lên được quản lý xử lý trong khung Tin nhắn như lễ tân.
            path: '/manager/support',
            element: <Navigate to="/messages?tab=support" replace />,
          },
          {
            path: '/manager/requests',
            // Trang /manager/requests: tải lười ManagerInternalRequestsPage.
            lazy: async () => ({ Component: (await import('../features/operations/ManagerInternalRequestsPage')).ManagerInternalRequestsPage }),
          },
        ],
      },
    // Lỗi của từng màn hình hiển thị trong vỏ portal, không làm mất sidebar/topbar.
    ].map(child => ({ ...child, ErrorBoundary: PortalRouteError })),
  },

  // Route không xác định
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
].map(route => ({ ...route, HydrateFallback: RouteLoading, ErrorBoundary: RouteLoadError })));
