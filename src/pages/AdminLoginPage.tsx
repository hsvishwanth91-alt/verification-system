import { AlertCircle, Eye, EyeOff, KeyRound, Lock, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SiteFooter, TopNavBar } from '../components/BrandMark.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { AuthUser } from '../types/index.ts';

export function AdminLoginPage() {
  const { login, setSession, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [checkingStatus, setCheckingStatus] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [envConfigured, setEnvConfigured] = useState(false);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // First-run onboarding state
  const [adminName, setAdminName] = useState('');
  const [loadDemoData, setLoadDemoData] = useState(true);
  const [demoStudentPassword, setDemoStudentPassword] = useState('');

  // Reset info modal
  const [resetModalOpen, setResetModalOpen] = useState(false);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      navigate('/admin', { replace: true });
      return;
    }
    let mounted = true;
    fetch('/api/auth/admin-status')
      .then((r) => r.json())
      .then((data: { needsInitialSetup?: boolean; envAdminConfigured?: boolean }) => {
        if (!mounted) return;
        setNeedsSetup(Boolean(data.needsInitialSetup));
        setEnvConfigured(Boolean(data.envAdminConfigured));
      })
      .catch(() => {
        if (mounted) setErrorMsg('Unable to reach authentication server.');
      })
      .finally(() => {
        if (mounted) setCheckingStatus(false);
      });
    return () => {
      mounted = false;
    };
  }, [navigate, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your administrator email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password, 'ADMIN');
      showToast('Signed in to Administrator Console.', 'success');
      navigate('/admin');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (adminName.trim().length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim().includes('@')) {
      setErrorMsg('Please enter a valid institutional email address.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Administrator password must be at least 8 characters long.');
      return;
    }
    if (loadDemoData && demoStudentPassword && demoStudentPassword.length < 8) {
      setErrorMsg('Demo student portal password must be at least 8 characters (or leave blank).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/admin-bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: adminName.trim(),
          email: email.trim(),
          password,
          loadDemoData,
          demoStudentPassword: demoStudentPassword.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        user?: AuthUser;
        error?: string;
      };
      if (!res.ok || !data.token || !data.user) {
        throw new Error(data.error || 'Failed to complete administrator onboarding.');
      }
      setSession(data.token, data.user);
      showToast(
        loadDemoData
          ? 'Administrator account created and demonstration dataset loaded.'
          : 'Administrator account created successfully.',
        'success',
      );
      navigate('/admin');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Onboarding failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNavBar />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700">
              <ShieldCheck className="h-4 w-4" />
              <span>Authorized Personnel Only</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-navy-900">
              {needsSetup ? 'Initial Administrator Setup' : 'Administrator Login'}
            </h1>
            <p className="text-sm text-slate-600">
              {needsSetup
                ? 'Claim the primary institutional registrar account for this CertiTrust deployment.'
                : 'Sign in to register students, issue signed PDF certificates, and manage revocations.'}
            </p>
          </div>

          {checkingStatus ? (
            <div className="space-y-3 py-4">
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-10 bg-slate-200 rounded-lg animate-pulse" />
            </div>
          ) : needsSetup ? (
            <form onSubmit={handleBootstrap} className="space-y-4">
              {errorMsg && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Administrator Full Name
                </label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Dr. Eleanor Vance"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Institutional Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="registrar@university.edu"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Create Password (min. 8 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a strong password"
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

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loadDemoData}
                    onChange={(e) => setLoadDemoData(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    <strong className="font-semibold text-navy-900 block">
                      Load Demonstration Evaluation Data
                    </strong>
                    Populates 3 sample students, 3 watermarked demo PDFs (2 active, 1 revoked), and sample verification logs in the database.
                  </span>
                </label>

                {loadDemoData && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Optional Demo Student Portal Password (min. 8 chars)
                    </label>
                    <input
                      type="password"
                      value={demoStudentPassword}
                      onChange={(e) => setDemoStudentPassword(e.target.value)}
                      placeholder="Set a password to test Student Login"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Setting Up Account...' : 'Create Admin Account & Enter Console'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {errorMsg && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="registrar@university.edu"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetModalOpen(true)}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800"
                  >
                    Password reset
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter administrator password"
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
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60 transition-colors"
              >
                <Lock className="h-4 w-4" />
                <span>{submitting ? 'Authenticating...' : 'Sign In as Administrator'}</span>
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <Link to="/student/login" className="font-medium text-teal-700 hover:underline">
              Student Login Portal
            </Link>
            <Link to="/verify" className="hover:text-navy-900">
              Public Verification
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
                <h2 className="font-display text-lg font-bold">Administrator Password Reset</h2>
              </div>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {envConfigured
                ? 'Administrator login is currently managed by server environment variables (ADMIN_EMAIL / ADMIN_PASSWORD). Update the password in your runtime Secrets configuration.'
                : 'For security, administrator passwords cannot be reset from unauthenticated public forms. Once signed in, use Update Password in the sidebar, or configure ADMIN_EMAIL and ADMIN_PASSWORD in your environment secrets to override.'}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
