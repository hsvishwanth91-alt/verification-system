import {
  CheckCircle2,
  Download,
  GraduationCap,
  KeyRound,
  LogOut,
  QrCode,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CertiTrustMark, SiteFooter } from '../components/BrandMark.tsx';
import { CertificatePreviewModal } from '../components/CertificatePreviewModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { CertificateRecord, StudentRecord } from '../types/index.ts';

export function StudentDashboardPage() {
  const { user, apiFetch, logout, downloadCertificatePdf } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCert, setSelectedCert] = useState<CertificateRecord | null>(null);

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const loadStudentData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        student: StudentRecord;
        certificates: CertificateRecord[];
      }>('/api/student/me');
      setStudent(res.student);
      setCertificates(res.certificates);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load student portal', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, showToast]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  const handleLogout = () => {
    logout();
    showToast('Signed out of Student Portal.', 'info');
    navigate('/student/login');
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
      showToast('Password updated.', 'success');
      setPwModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update password', 'error');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <Link to="/" className="shrink-0">
            <CertiTrustMark />
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPwModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Change Password</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-800 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        {loading ? (
          <div className="space-y-4">
            <div className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />
            <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
          </div>
        ) : (
          <>
            {/* Welcome & Student Profile */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700">
                    <GraduationCap className="h-4 w-4" />
                    <span>Student Academic Profile</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-900">
                    Welcome, {student?.full_name || user?.fullName}
                  </h1>
                  <p className="text-sm text-slate-600">
                    {student?.email} · USN <span className="font-mono font-semibold">{student?.usn}</span>
                  </p>
                </div>

                {student && (
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 text-sm border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                    <div>
                      <dt className="text-xs text-slate-500">Department</dt>
                      <dd className="font-semibold text-navy-900 mt-0.5">{student.department}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Program</dt>
                      <dd className="font-medium text-slate-900 mt-0.5">{student.course}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Academic / Grad Year</dt>
                      <dd className="font-medium text-slate-900 mt-0.5 tabular-nums">
                        {student.academic_year} ({student.graduation_year})
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            </section>

            {/* My Certificates */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold text-navy-900">
                    My Certificates ({certificates.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Official credentials issued to your academic profile. Records are read-only.
                  </p>
                </div>
                <Link
                  to="/verify"
                  className="text-xs font-semibold text-teal-700 hover:underline whitespace-nowrap"
                >
                  Open Public Verifier
                </Link>
              </div>

              {certificates.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center space-y-2">
                  <p className="text-sm font-semibold text-navy-900">
                    No certificates have been issued to your profile yet
                  </p>
                  <p className="text-xs text-slate-500">
                    Once your institutional registrar issues a credential, it will appear here with its PDF and QR code.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {certificates.map((cert) => (
                    <article
                      key={cert.certificate_id}
                      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between gap-5"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-teal-700">
                            {cert.certificate_type}
                          </span>
                          {cert.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              <span>Revoked</span>
                            </span>
                          )}
                        </div>

                        {Boolean(cert.is_demo) && (
                          <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
                            DEMO — NOT AN OFFICIAL CREDENTIAL
                          </p>
                        )}

                        <div>
                          <h3 className="font-display text-lg font-bold text-navy-900">
                            {cert.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            {cert.institution_name} · Issued{' '}
                            <span className="tabular-nums">{cert.issue_date}</span>
                          </p>
                        </div>

                        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                          <p>
                            Certificate ID:{' '}
                            <span className="font-mono font-semibold text-navy-900">
                              {cert.certificate_id}
                            </span>
                          </p>
                          <p className="truncate font-mono text-[11px] text-slate-500">
                            SHA-256: {cert.pdf_hash}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => downloadCertificatePdf(cert.certificate_id)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800 whitespace-nowrap"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCert(cert)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <QrCode className="h-3.5 w-3.5 text-teal-600" />
                          <span>QR & Details</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {selectedCert && (
        <CertificatePreviewModal
          certificate={selectedCert}
          onClose={() => setSelectedCert(null)}
        />
      )}

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
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  New Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPwModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPw}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {savingPw ? 'Saving...' : 'Update Password'}
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
