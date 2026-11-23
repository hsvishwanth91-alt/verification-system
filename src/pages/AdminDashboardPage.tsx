import {
  CheckCircle2,
  Database,
  FileBadge2,
  FilePlus2,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminLayout } from '../components/AdminLayout.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { DashboardResponse } from '../types/index.ts';

export function AdminDashboardPage() {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [demoStudentPw, setDemoStudentPw] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<DashboardResponse>('/api/admin/dashboard');
      setData(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSeedDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (demoStudentPw && demoStudentPw.length < 8) {
      showToast('Demo student password must be at least 8 characters.', 'error');
      return;
    }
    setSeedingDemo(true);
    try {
      await apiFetch('/api/admin/demo/seed', {
        method: 'POST',
        body: JSON.stringify({ demoStudentPassword: demoStudentPw.trim() }),
      });
      showToast('Demonstration dataset and PDFs created in database.', 'success');
      setDemoStudentPw('');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load demo records', 'error');
    } finally {
      setSeedingDemo(false);
    }
  };

  return (
    <AdminLayout
      title="Administrator Dashboard"
      breadcrumb="CertiTrust / Overview"
      actions={
        <>
          <Link
            to="/admin/students"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-navy-900 hover:bg-slate-50 whitespace-nowrap"
          >
            <UserPlus className="h-3.5 w-3.5 text-teal-600" />
            <span>Register Student</span>
          </Link>
          <Link
            to="/admin/issue"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            <span>Issue Certificate</span>
          </Link>
        </>
      }
    >
      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
          <div className="h-72 rounded-xl bg-white border border-slate-200 animate-pulse" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* 5 Live Database KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Certificates</span>
                <FileBadge2 className="h-4 w-4 text-navy-700" />
              </div>
              <p className="font-display text-3xl font-bold text-navy-900 mt-2 tabular-nums">
                {data.stats.totalCertificates}
              </p>
              <p className="text-xs text-slate-500 mt-1">Stored in registry</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Active Credentials</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="font-display text-3xl font-bold text-emerald-700 mt-2 tabular-nums">
                {data.stats.activeCertificates}
              </p>
              <p className="text-xs text-slate-500 mt-1">Valid for verification</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Revoked</span>
                <ShieldAlert className="h-4 w-4 text-red-600" />
              </div>
              <p className="font-display text-3xl font-bold text-red-700 mt-2 tabular-nums">
                {data.stats.revokedCertificates}
              </p>
              <p className="text-xs text-slate-500 mt-1">Blocked on QR scan</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Students</span>
                <Users className="h-4 w-4 text-teal-600" />
              </div>
              <p className="font-display text-3xl font-bold text-navy-900 mt-2 tabular-nums">
                {data.stats.totalStudents}
              </p>
              <p className="text-xs text-slate-500 mt-1">Registered profiles</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Verifications</span>
                <ShieldCheck className="h-4 w-4 text-teal-600" />
              </div>
              <p className="font-display text-3xl font-bold text-navy-900 mt-2 tabular-nums">
                {data.stats.totalVerifications}
              </p>
              <p className="text-xs text-slate-500 mt-1">Public & QR checks</p>
            </div>
          </div>

          {/* Optional Demonstration Setup Banner */}
          {!data.demoSeeded && (
            <form
              onSubmit={handleSeedDemo}
              className="rounded-xl border border-teal-200 bg-teal-50/70 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
                  <Database className="h-4 w-4 text-teal-700" />
                  <span>Evaluation Demonstration Mode</span>
                </div>
                <p className="text-xs text-slate-700 max-w-2xl">
                  Populate 3 clearly watermarked sample students, 3 signed demonstration PDF certificates (2 active, 1 revoked), and verification history in the database.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                <input
                  type="password"
                  value={demoStudentPw}
                  onChange={(e) => setDemoStudentPw(e.target.value)}
                  placeholder="Optional demo student password (8+ chars)"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-teal-600 focus:outline-none sm:w-60"
                />
                <button
                  type="submit"
                  disabled={seedingDemo}
                  className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-60 whitespace-nowrap"
                >
                  {seedingDemo ? 'Loading Demo Data...' : 'Load Demo Data'}
                </button>
              </div>
            </form>
          )}

          {/* Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-4">
                <h2 className="font-display text-base font-bold text-navy-900">
                  Issuance & Verification Activity (7 Days)
                </h2>
                <p className="text-xs text-slate-500">
                  Live database counts of issued credentials vs. public verification requests
                </p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.activitySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="verifications"
                      name="Verifications"
                      stroke="#0D9488"
                      fill="#CCFBF1"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="issued"
                      name="Issued"
                      stroke="#0B1F3A"
                      fill="#E6EEF8"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-4">
                <h2 className="font-display text-base font-bold text-navy-900">
                  Certificates by Type
                </h2>
                <p className="text-xs text-slate-500">Distribution across credential categories</p>
              </div>
              {data.byType.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center text-sm text-slate-500">
                  <p>No certificates issued yet.</p>
                  <Link
                    to="/admin/issue"
                    className="mt-2 text-xs font-semibold text-teal-700 hover:underline"
                  >
                    Issue first certificate
                  </Link>
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byType} layout="vertical" margin={{ left: 10, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={115}
                        tick={{ fontSize: 11, fill: '#334155' }}
                      />
                      <Tooltip />
                      <Bar dataKey="count" name="Certificates" fill="#0B1F3A" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Recent Certificates & Recent Verifications */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-navy-900">
                  Recent Certificates
                </h2>
                <Link to="/admin/certificates" className="text-xs font-semibold text-teal-700 hover:underline">
                  View all
                </Link>
              </div>
              {data.recentCertificates.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No certificates issued yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recentCertificates.map((cert) => (
                    <div
                      key={cert.certificate_id}
                      className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy-900 truncate">
                          {cert.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          <span className="font-mono">{cert.certificate_id}</span>
                          <span className="mx-1.5">·</span>
                          <span>{cert.student_name}</span>
                          {Boolean(cert.is_demo) && (
                            <>
                              <span className="mx-1.5">·</span>
                              <span className="text-amber-700 font-medium">DEMO</span>
                            </>
                          )}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${
                          cert.status === 'ACTIVE' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {cert.status === 'ACTIVE' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <ShieldAlert className="h-3.5 w-3.5" />
                        )}
                        <span>{cert.status === 'ACTIVE' ? 'Active' : 'Revoked'}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-navy-900">
                  Recent Verification Activity
                </h2>
                <Link to="/admin/verifications" className="text-xs font-semibold text-teal-700 hover:underline">
                  View history
                </Link>
              </div>
              {data.recentVerifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No verification checks recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recentVerifications.map((log) => (
                    <div
                      key={log.log_id}
                      className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-navy-900 truncate">
                          {log.certificate_id}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          {log.source.replace(/_/g, ' ')} ·{' '}
                          {new Date(log.verified_at).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${
                          log.result === 'VALID'
                            ? 'text-emerald-700'
                            : log.result === 'REVOKED'
                              ? 'text-red-700'
                              : 'text-slate-600'
                        }`}
                      >
                        {log.result === 'VALID' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : log.result === 'REVOKED' ? (
                          <ShieldAlert className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        <span>{log.result}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
