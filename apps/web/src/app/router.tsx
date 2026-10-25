import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LandingPage } from '../features/landing/LandingPage';
import { TrainerStoryPage } from '../features/landing/TrainerStoryPage';
import { SportPage } from '../features/landing/SportPage';
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
import { MemberPackagesPage } from '../features/member/MemberPackagesPage';

import { StaffReceptionPage } from '../features/reception/StaffReceptionPage';
import { StaffCheckInPage } from '../features/reception/StaffCheckInPage';
import { StaffClassesPage } from '../features/classes/StaffClassesPage';
import { CoachAttendancePage } from '../features/coaching/CoachAttendancePage';
import { CoachClassesPage } from '../features/coaching/CoachClassesPage';
import { CoachTrainingPlanPage } from '../features/coaching/CoachTrainingPlanPage';

// Manager Feature Pages
import { ManagerCatalogsPage } from '../features/manager/ManagerCatalogsPage';
import { UserManagerPage } from '../features/manager/UserManagerPage';
import { ManagerReportsPage } from '../features/manager/ManagerReportsPage';
import { ManagerCancellationPage } from '../features/manager/ManagerCancellationPage';

export const router = createBrowserRouter([
  // Public Routes
  { path: '/', element: <LandingPage /> },
  { path: '/swimming', element: <SportPage forcedSport="swimming" /> },
  { path: '/tennis', element: <SportPage forcedSport="tennis" /> },
  { path: '/sports/:sportId', element: <SportPage /> },
  { path: '/trainers', element: <TrainerStoryPage /> },
  { path: '/trainers/:trainerId', element: <TrainerStoryPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Protected Portal App Shell
  {
    element: <AppLayout />,
    children: [
      { path: '/portal', element: <PortalHome /> },

      // Member-only Routes
      {
        element: <RoleGuard allowedRoles={['MEMBER']} />,
        children: [
          {
            path: '/member/dashboard',
            element: <MemberDashboardPage />,
          },
          {
            path: '/member/packages',
            element: <MemberPackagesPage />,
          },
          {
            path: '/member/card',
            element: <MemberCardPage />,
          },
        ],
      },

      // Shared Member Feature Routes
      {
        element: (
          <RoleGuard
            allowedRoles={['MEMBER', 'MANAGER', 'CENTER_MANAGER']}
          />
        ),
        children: [
          {
            path: '/member/classes',
            element: <MemberClassesPage />,
          },
        ],
      },

      // Hồ sơ cá nhân
      {
        element: (
          <RoleGuard
            allowedRoles={['MEMBER', 'STAFF', 'COACH', 'MANAGER']}
          />
        ),
        children: [
          {
            path: '/member/profile',
            element: <MemberProfilePage />,
          },
        ],
      },

      // Staff / Coach Routes
      {
        element: (
          <RoleGuard
            allowedRoles={[
              'STAFF',
              'COACH',
              'RECEPTIONIST',
              'MANAGER',
              'CENTER_MANAGER',
            ]}
          />
        ),
        children: [
          {
            path: '/staff/reception',
            element: <StaffReceptionPage />,
          },
          {
            path: '/staff/check-in',
            element: <StaffCheckInPage />,
          },
          {
            path: '/staff/classes',
            element: <StaffClassesPage />,
          },
          {
            path: '/staff/attendance',
            element: <CoachAttendancePage />,
          },
          {
            path: '/coach/classes',
            element: <CoachClassesPage />,
          },
          {
            path: '/coach/training-plans',
            element: <CoachTrainingPlanPage />,
          },
          {
            path: '/staff/coach-classes',
            element: <CoachClassesPage />,
          },
        ],
      },

      // Manager Routes
      {
        element: (
          <RoleGuard allowedRoles={['MANAGER', 'CENTER_MANAGER']} />
        ),
        children: [
          {
            path: '/manager/catalogs',
            element: <ManagerCatalogsPage />,
          },
          {
            path: '/manager/users',
            element: <UserManagerPage />,
          },
          {
            path: '/manager/reports',
            element: <ManagerReportsPage />,
          },
          {
            path: '/manager/cancellations',
            element: <ManagerCancellationPage />,
          },
        ],
      },
    ],
  },

  // Unknown route
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
