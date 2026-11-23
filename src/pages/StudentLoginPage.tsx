import { AlertCircle, Eye, EyeOff, GraduationCap, KeyRound, Lock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SiteFooter, TopNavBar } from '../components/BrandMark.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export function StudentLoginPage() {
  const { login, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'STUDENT') {
      navigate('/student', { replace: true });
    }
  }, [navigate, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your student email and portal password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password, 'STUDENT');
      showToast('Signed in to Student Credential Portal.', 'success');
      navigate('/student');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetStatus(null);
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Unable to submit reset request.');
      setResetStatus(data.message || 'Reset request recorded.');
    } catch (err) {
      setResetStatus(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNavBar />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700">
              <GraduationCap className="h-4 w-4" />
              <span>Student Credential Portal</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-navy-900">Student Login</h1>
            <p className="text-sm text-slate-600">
              Access your issued academic certificates, download official PDFs, and share verification QR codes.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label htmlFor="student-email" className="block text-sm font-medium text-slate-700 mb-1">
                Student Email Address
              </label>
              <input
                id="student-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="student-password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetStatus(null);
                    setResetModalOpen(true);
                  }}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="student-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your portal password"
                  className="w-full rounded-lg border border-slate-300 pl-3.5 pr-11 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              <Lock className="h-4 w-4" />
              <span>{submitting ? 'Signing In...' : 'Access My Certificates'}</span>
            </button>
          </form>

          <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">
            Student portal accounts are provisioned by your institutional registrar during student registration. Contact your administrator if your portal password has not been activated yet.
          </p>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <Link to="/admin/login" className="font-medium text-navy-900 hover:underline">
              Administrator Login
            </Link>
            <Link to="/verify" className="hover:text-navy-900">
              Verify a Certificate
            </Link>
          </div>
        </div>
      </main>

      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-navy-900">
                <KeyRound className="h-5 w-5 text-teal-600" />
                <h2 className="font-display text-lg font-bold">Request Password Reset</h2>
              </div>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Submit your registered student email to flag a password reset request for your college administrator.
            </p>
            <form onSubmit={handleResetRequest} className="space-y-3">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
              />
              {resetStatus && (
                <p className="text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg p-3">
                  {resetStatus}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
                >
                  {resetLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
