import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LandingPage } from '../features/landing/LandingPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { AppLayout } from '../shared/ui/AppLayout';
import { RoleGuard } from '../shared/ui/RoleGuard';
import { PortalHome } from '../shared/ui/PortalHome';

// Member Feature Pages
import { MemberDashboardPage } from '../features/member/MemberDashboardPage';
import { MemberProfilePage } from '../features/member/MemberProfilePage';
import { MemberClassesPage } from '../features/member/MemberClassesPage';
import { MemberCardPage } from '../features/member/MemberCardPage';

// Staff & Coach Feature Pages
import { StaffReceptionPage } from '../features/reception/StaffReceptionPage';
import { StaffCheckInPage } from '../features/reception/StaffCheckInPage';
import { StaffClassesPage } from '../features/classes/StaffClassesPage';
import { CoachAttendancePage } from '../features/coaching/CoachAttendancePage';

// Manager Feature Pages
import { ManagerCatalogsPage } from '../features/manager/ManagerCatalogsPage';
import { UserManagerPage } from '../features/manager/UserManagerPage'; // <-- Màn hình US04 RBAC
import { ManagerReportsPage } from '../features/manager/ManagerReportsPage';

export const router = createBrowserRouter([
  // Public Quiet Luxury Single-Page Landing Experience
  { path: '/', element: <LandingPage /> },

  // Public Auth Route
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Protected Portal App Shell
  {
    element: <AppLayout />,
    children: [
      { path: '/portal', element: <PortalHome /> },

      // Group Member Routes (US01, US03, US04, US05)
      {
        element: <RoleGuard allowedRoles={['MEMBER']} />,
        children: [{ path: '/member/dashboard', element: <MemberDashboardPage /> }],
      },
      {
        element: <RoleGuard allowedRoles={['MEMBER', 'MANAGER', 'CENTER_MANAGER']} />,
        children: [
          { path: '/member/classes', element: <MemberClassesPage /> },
          { path: '/member/card', element: <MemberCardPage /> },
        ],
      },

      // Hồ sơ cá nhân: mọi vai trò đã đăng nhập (SCRUM-55)
      {
        element: <RoleGuard allowedRoles={['MEMBER', 'STAFF', 'COACH', 'MANAGER']} />,
        children: [{ path: '/member/profile', element: <MemberProfilePage /> }],
      },

      // Group Staff / Coach Routes (US02, US04, US05)
      {
        element: <RoleGuard allowedRoles={['STAFF', 'COACH', 'RECEPTIONIST', 'MANAGER', 'CENTER_MANAGER']} />,
        children: [
          { path: '/staff/reception', element: <StaffReceptionPage /> },
          { path: '/staff/check-in', element: <StaffCheckInPage /> },
          { path: '/staff/classes', element: <StaffClassesPage /> },
          { path: '/staff/attendance', element: <CoachAttendancePage /> },
        ],
      },

      // Group Manager Routes (US06, US07, US08 & US04 RBAC)
      {
        element: <RoleGuard allowedRoles={['MANAGER', 'CENTER_MANAGER']} />,
        children: [
          { path: '/manager/catalogs', element: <ManagerCatalogsPage /> },
          { path: '/manager/users', element: <UserManagerPage /> }, // <-- Đã gắn màn hình quản lý tài khoản & phân quyền
          { path: '/manager/reports', element: <ManagerReportsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
