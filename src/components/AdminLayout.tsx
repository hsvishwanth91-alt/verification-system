import {
  FileBadge2,
  FilePlus2,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { CertiTrustMark } from './BrandMark.tsx';

interface AdminLayoutProps {
  title: string;
  breadcrumb: string;
  actions?: ReactNode;
  children: ReactNode;
}

const navItems = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
  { label: 'Students', to: '/admin/students', icon: Users },
  { label: 'Issue Certificate', to: '/admin/issue', icon: FilePlus2 },
  { label: 'Certificates', to: '/admin/certificates', icon: FileBadge2 },
  { label: 'Verification History', to: '/admin/verifications', icon: History },
];

export function AdminLayout({ title, breadcrumb, actions, children }: AdminLayoutProps) {
  const { user, logout, apiFetch } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const handleLogout = () => {
    logout();
    showToast('Signed out of administrator session.', 'info');
    navigate('/admin/login');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters.', 'error');
      return;
    }
    setSavingPw(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showToast('Administrator password updated.', 'success');
      setPwModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update password', 'error');
    } finally {
      setSavingPw(false);
    }
  };

  const SidebarContent = (
    <div className="flex flex-col h-full bg-navy-900 text-slate-100">
      <div className="h-16 px-5 flex items-center justify-between border-b border-navy-800">
        <Link to="/" className="focus-visible:outline-2 focus-visible:outline-teal-400 rounded">
          <CertiTrustMark dark />
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-slate-300 hover:text-white p-1.5 rounded-lg"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 py-4 border-b border-navy-800">
        <p className="text-xs font-medium text-teal-400">Registrar Console</p>
        <p className="text-sm font-semibold text-white truncate mt-0.5">{user?.fullName}</p>
        <p className="text-xs text-slate-400 truncate">{user?.email}</p>
      </div>

      <nav aria-label="Administrator navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-300 hover:bg-navy-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t border-navy-800">
          <Link
            to="/verify"
            className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-300 hover:bg-navy-800 hover:text-white whitespace-nowrap"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-400" />
            <span>Public Verifier</span>
          </Link>
        </div>
      </nav>

      <div className="p-3 border-t border-navy-800 space-y-1.5">
        <button
          type="button"
          onClick={() => setPwModalOpen(true)}
          className="w-full flex items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 hover:bg-navy-800 hover:text-white transition-colors"
        >
          <KeyRound className="h-4 w-4 shrink-0" />
          <span>Update Password</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium text-red-300 hover:bg-red-950/50 hover:text-red-200 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10 shadow-xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">{breadcrumb}</p>
              <h1 className="font-display text-lg font-bold text-navy-900 truncate">{title}</h1>
            </div>
          </div>
          {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Password Update Modal */}
      {pwModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-navy-900">Update Password</h2>
              <button
                type="button"
                onClick={() => setPwModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  New Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPwModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPw}
                  className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
                >
                  {savingPw ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
