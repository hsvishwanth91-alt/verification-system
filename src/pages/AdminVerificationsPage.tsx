import { CheckCircle2, ClipboardList, History, Search, ShieldAlert, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '../components/AdminLayout.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { AuditLog, VerificationLog } from '../types/index.ts';

export function AdminVerificationsPage() {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'verifications' | 'audit'>('verifications');
  const [verificationLogs, setVerificationLogs] = useState<VerificationLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [resultFilter, setResultFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ result: resultFilter });
      if (search.trim()) params.set('q', search.trim());
      const res = await apiFetch<{
        verificationLogs: VerificationLog[];
        auditLogs: AuditLog[];
      }>(`/api/admin/verifications?${params.toString()}`);
      setVerificationLogs(res.verificationLogs);
      setAuditLogs(res.auditLogs);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load history', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, resultFilter, search, showToast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <AdminLayout title="Verification History & Audit Trail" breadcrumb="CertiTrust / Verification Logs">
      <div className="space-y-5">
        {/* Privacy & Retention Policy Note */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            <strong className="text-navy-900">Privacy-Conscious Logging:</strong> Verifier IP addresses are anonymized via one-way SHA-256 truncation prior to storage.
          </span>
          <span className="text-slate-500">Latest 250 verification lookups & 100 admin audit events retained in view.</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setTab('verifications')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  tab === 'verifications'
                    ? 'bg-white text-navy-900 shadow-xs'
                    : 'text-slate-600 hover:text-navy-900'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>Verification Checks ({verificationLogs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('audit')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  tab === 'audit'
                    ? 'bg-white text-navy-900 shadow-xs'
                    : 'text-slate-600 hover:text-navy-900'
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Admin Audit Log ({auditLogs.length})</span>
              </button>
            </div>

            {tab === 'verifications' && (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter Certificate ID..."
                    className="rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs font-mono focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <select
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="ALL">All Results</option>
                  <option value="VALID">VALID</option>
                  <option value="REVOKED">REVOKED</option>
                  <option value="NOT_FOUND">NOT FOUND</option>
                  <option value="HASH_MISMATCH">HASH MISMATCH</option>
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : tab === 'verifications' ? (
            verificationLogs.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No verification checks match your filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Certificate ID / Digest</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Verifier Hash</th>
                      <th className="py-3 px-4">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {verificationLogs.map((log) => (
                      <tr key={log.log_id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {new Date(log.verified_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-navy-900 whitespace-nowrap">
                          {log.certificate_id}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {log.source.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {log.verifier_ip_hash}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : auditLogs.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No audit records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {auditLogs.map((aud) => (
                    <tr key={aud.audit_id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {new Date(aud.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {aud.actor_email}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-navy-900 whitespace-nowrap">
                        {aud.action}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {aud.target_id || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">{aud.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
