import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RoleGuard } from '../shared/ui/RoleGuard';
import { PortalHome } from '../shared/ui/PortalHome';
import { PortalRouteError, RouteLoading, RouteLoadError } from '../shared/ui/RouteState';

export const router = createBrowserRouter([
  // Public chỉ giới thiệu Gym; bỏ route Shop Member/Public, giữ route gói/PT và quản lý độc lập.
  { path: '/', lazy: async () => ({ Component: (await import('../features/landing/LandingPage')).LandingPage }) },
  { path: '/trainers', lazy: async () => ({ Component: (await import('../features/landing/TrainerStoryPage')).TrainerStoryPage }) },
  { path: '/trainers/:trainerId', lazy: async () => ({ Component: (await import('../features/landing/TrainerStoryPage')).TrainerStoryPage }) },
  { path: '/login', lazy: async () => ({ Component: (await import('../features/auth/LoginPage')).LoginPage }) },
  { path: '/register', lazy: async () => ({ Component: (await import('../features/auth/RegisterPage')).RegisterPage }) },

  // Protected Portal App Shell
  {
    id: 'portal',
    lazy: async () => ({ Component: (await import('../shared/ui/AppLayout')).AppLayout }),
    children: [
      { path: '/portal', element: <PortalHome /> },
      {
        element: <RoleGuard allowedRoles={['MEMBER', 'STAFF', 'COACH', 'MANAGER']} />,
        children: [{ path: '/messages', lazy: async () => ({ Component: (await import('../features/chat/ChatPage')).ChatPage }) }],
      },

      // Notifications (Shared between Member & Coach)
      {
        element: <RoleGuard allowedRoles={['MEMBER', 'COACH', 'MANAGER', 'CENTER_MANAGER', 'STAFF', 'RECEPTIONIST', 'ADMIN']} />,
        children: [
          {
            path: '/member/notifications',
            lazy: async () => ({ Component: (await import('../features/member/MemberNotificationsPage')).MemberNotificationsPage }),
          },
        ],
      },

      // Member-only Routes
      {
        element: <RoleGuard allowedRoles={['MEMBER']} />,
        children: [
          {
            path: '/member/dashboard',
            lazy: async () => ({ Component: (await import('../features/member/MemberDashboardPage')).MemberDashboardPage }),
          },
          {
            path: '/member/explore',
            lazy: async () => ({ Component: (await import('../features/explore3d/ExplorePage')).ExplorePage }),
          },
          {
            path: '/member/packages',
            lazy: async () => ({ Component: (await import('../features/member/MemberPackagesPage')).MemberPackagesPage }),
          },
          {
            path: '/member/packages/checkout',
            lazy: async () => ({ Component: (await import('../features/member/MemberCheckoutPage')).MemberCheckoutPage }),

          },
          { path: '/member/payments/vnpay/return', lazy: async () => ({ Component: (await import('../features/payments/VnpayReturnPage')).VnpayReturnPage }) },
          {
            path: '/member/hold',
            lazy: async () => ({ Component: (await import('../features/member/MemberHoldPage')).MemberHoldPage }),
          },
          {
            path: '/member/card',
            lazy: async () => ({ Component: (await import('../features/member/MemberCardPage')).MemberCardPage }),
          },
          {
            path: '/member/check-in',
            lazy: async () => ({ Component: (await import('../features/member/MemberCheckInPage')).MemberCheckInPage }),
          },
          {
            path: '/member/invoices',
            lazy: async () => ({ Component: (await import('../features/member/MemberInvoicesPage')).MemberInvoicesPage }),
          },
          {
            // Giữ URL cũ cho Giáo án; quyền Member vẫn được kiểm tra bởi RoleGuard.
            path: '/member/progress',
            lazy: async () => ({ Component: (await import('../features/member/MemberProgressPage')).MemberProgressPage }),
          },
          {
            // Hỗ trợ & khiếu nại đã gộp vào Tin nhắn; giữ đường dẫn cũ cho email, thông báo và liên kết 3D.
            path: '/member/support',
            element: <Navigate to="/messages?tab=support" replace />,
          },
        ],
      },

      // Member Classes Route
      {
        element: (
          <RoleGuard
            allowedRoles={['MEMBER']}
          />
        ),
        children: [
          {
            path: '/member/classes',
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
            lazy: async () => ({ Component: (await import('../features/member/MemberProfilePage')).MemberProfilePage }),
          },
          {
            path: '/profile',
            lazy: async () => ({ Component: (await import('../features/member/MemberProfilePage')).MemberProfilePage }),
          },
        ],
      },

      // Receptionist (STAFF) Dedicated Routes
      {
        element: <RoleGuard allowedRoles={['STAFF', 'RECEPTIONIST']} />,
        children: [
          {
            path: '/staff/reception',
            lazy: async () => ({ Component: (await import('../features/reception/StaffReceptionPage')).StaffReceptionPage }),
          },
          {
            path: '/staff/check-in',
            lazy: async () => ({ Component: (await import('../features/reception/StaffCheckInPage')).StaffCheckInPage }),
          },
          {
            path: '/staff/check-out',
            lazy: async () => ({ Component: (await import('../features/reception/StaffCheckOutPage')).StaffCheckOutPage }),
          },
          {
            path: '/staff/reception-history',
            lazy: async () => ({ Component: (await import('../features/reception/StaffRequestHistoryPage')).StaffRequestHistoryPage }),
          },
          {
            path: '/staff/kyc',
            lazy: async () => ({ Component: (await import('../features/reception/KycReviewPage')).KycReviewPage }),
          },
          {
            path: '/staff/holds',
            lazy: async () => ({ Component: (await import('../features/reception/HoldManagementPage')).HoldManagementPage }),
          },
          { path: '/staff/support', element: <Navigate to="/messages?tab=support" replace /> },
          { path: '/staff/courts', element: <Navigate to="/staff/reception" replace /> },
        ],
      },

      // Coach Dedicated Routes
      {
        element: <RoleGuard allowedRoles={['COACH']} />,
        children: [
          {
            path: '/coach/pt-attendance',
            lazy: async () => ({ Component: (await import('../features/coaching/PtAttendancePage')).PtAttendancePage }),
          },
          {
            path: '/staff/attendance',
            element: <Navigate to="/coach/pt-attendance" replace />,
          },
          {
            path: '/staff/attendance/:sessionId',
            element: <Navigate to="/coach/pt-attendance" replace />,
          },
          {
            path: '/coach/classes',
            lazy: async () => ({ Component: (await import('../features/coaching/CoachClassesPage')).CoachClassesPage }),
          },
          {
            path: '/coach/training-plans',
            lazy: async () => ({ Component: (await import('../features/coaching/CoachTrainingPlanPage')).CoachTrainingPlanPage }),
          },
          {
            path: '/coach/health-metrics',
            element: <Navigate to="/coach/training-plans" replace />,
          },
          {
            path: '/coach/saved-plans',
            lazy: async () => ({ Component: (await import('../features/coaching/CoachSavedPlansPage')).CoachSavedPlansPage }),
          },
          {
            path: '/staff/coach-classes',
            element: <Navigate to="/coach/classes" replace />,
          },
        ],
      },

      // Staff & Coach Shared Internal Requests Route
      {
        element: <RoleGuard allowedRoles={['STAFF', 'RECEPTIONIST', 'COACH']} />,
        children: [
          {
            path: '/staff/requests',
            lazy: async () => ({ Component: (await import('../features/operations/StaffInternalRequestsPage')).StaffInternalRequestsPage }),
          },
        ],
      },

      // Class Schedule & Product Orders (Receptionist & Manager)
      {
        element: <RoleGuard allowedRoles={['STAFF', 'RECEPTIONIST', 'MANAGER', 'CENTER_MANAGER']} />,
        children: [
          {
            path: '/staff/pt-attendance',
            element: <Navigate to="/staff/reception" replace />,
          },
          {
            path: '/staff/classes',
            element: <Navigate to="/staff/reception" replace />,
          },
          {
            path: '/staff/orders',
            element: <Navigate to="/staff/reception" replace />,
          },
        ],
      },

      // Admin Dedicated Route
      {
        element: <RoleGuard allowedRoles={['ADMIN']} />,
        children: [
          { path: '/admin/users', lazy: async () => ({ Component: (await import('../features/manager/UserManagerPage')).UserManagerPage }) },
          { path: '/admin/audit-logs', lazy: async () => ({ Component: (await import('../features/admin/AdminAuditLogsPage')).AdminAuditLogsPage }) },
          { path: '/admin/payments', lazy: async () => ({ Component: (await import('../features/admin/AdminPaymentReconciliationPage')).AdminPaymentReconciliationPage }) },
        ],
      },
      // Center Manager Dedicated Routes
      {
        element: (
          <RoleGuard allowedRoles={['MANAGER', 'CENTER_MANAGER']} />
        ),
        children: [
          {
            path: '/manager/catalogs',
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
            lazy: async () => ({ Component: (await import('../features/manager/ManagerCoachAssignmentsPage')).ManagerCoachAssignmentsPage }),
          },
          {
            path: '/manager/staff-accounts',
            lazy: async () => ({ Component: (await import('../features/manager/StaffAccountsPage')).StaffAccountsPage }),
          },
          {
            path: '/manager/users',
            element: <Navigate to="/manager/staff-accounts" replace />,
          },
          {
            path: '/manager/reports',
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
            lazy: async () => ({ Component: (await import('../features/operations/ManagerInternalRequestsPage')).ManagerInternalRequestsPage }),
          },
        ],
      },
    // Lỗi của từng màn hình hiển thị trong vỏ portal, không làm mất sidebar/topbar.
    ].map(child => ({ ...child, ErrorBoundary: PortalRouteError })),
  },

  // Unknown route
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
].map(route => ({ ...route, HydrateFallback: RouteLoading, ErrorBoundary: RouteLoadError })));
