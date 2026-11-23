import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { AdminCertificatesPage } from './pages/AdminCertificatesPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { AdminIssueCertificatePage } from './pages/AdminIssueCertificatePage.tsx';
import { AdminLoginPage } from './pages/AdminLoginPage.tsx';
import { AdminStudentsPage } from './pages/AdminStudentsPage.tsx';
import { AdminVerificationsPage } from './pages/AdminVerificationsPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { StudentDashboardPage } from './pages/StudentDashboardPage.tsx';
import { StudentLoginPage } from './pages/StudentLoginPage.tsx';
import { VerifyCertificatePage } from './pages/VerifyCertificatePage.tsx';
import type { UserRole } from './types/index.ts';

function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to={role === 'ADMIN' ? '/admin/login' : '/student/login'} replace />;
  }
  if (user.role !== role) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/student'} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/verify" element={<VerifyCertificatePage />} />
            <Route path="/verify/:certificateId" element={<VerifyCertificatePage />} />

            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/student/login" element={<StudentLoginPage />} />

            <Route
              path="/admin"
              element={
                <RequireRole role="ADMIN">
                  <AdminDashboardPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/students"
              element={
                <RequireRole role="ADMIN">
                  <AdminStudentsPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/issue"
              element={
                <RequireRole role="ADMIN">
                  <AdminIssueCertificatePage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/certificates"
              element={
                <RequireRole role="ADMIN">
                  <AdminCertificatesPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/verifications"
              element={
                <RequireRole role="ADMIN">
                  <AdminVerificationsPage />
                </RequireRole>
              }
            />

            <Route
              path="/student"
              element={
                <RequireRole role="STUDENT">
                  <StudentDashboardPage />
                </RequireRole>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
