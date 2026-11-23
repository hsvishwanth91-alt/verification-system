import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout.tsx';
import { CertificatePreviewModal } from '../components/CertificatePreviewModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { CertificateRecord, CertificateType } from '../types/index.ts';

export function AdminCertificatesPage() {
  const { apiFetch, downloadCertificatePdf } = useAuth();
  const { showToast } = useToast();

  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [types, setTypes] = useState<CertificateType[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'REVOKED'>('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedCert, setSelectedCert] = useState<CertificateRecord | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<CertificateRecord | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  // Certificate Types Manager Modal
  const [typesModalOpen, setTypesModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDesc, setNewTypeDesc] = useState('');
  const [addingType, setAddingType] = useState(false);

  const loadTypes = useCallback(async () => {
    try {
      const res = await apiFetch<{ types: CertificateType[] }>('/api/admin/certificate-types');
      setTypes(res.types);
    } catch {
      // handled silently if dashboard already warned
    }
  }, [apiFetch]);

  const loadCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        status: statusFilter,
        type: typeFilter,
      });
      if (search.trim()) params.set('q', search.trim());
      const res = await apiFetch<{
        certificates: CertificateRecord[];
        pagination: { page: number; totalPages: number; total: number };
      }>(`/api/admin/certificates?${params.toString()}`);
      setCertificates(res.certificates);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load certificates', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, page, search, showToast, statusFilter, typeFilter]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  const handleConfirmRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTarget) return;
    if (revokeReason.trim().length < 3) {
      showToast('Please provide a reason for revocation.', 'error');
      return;
    }
    setRevoking(true);
    try {
      await apiFetch(
        `/api/admin/certificates/${encodeURIComponent(revokeTarget.certificate_id)}/revoke`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: revokeReason.trim() }),
        },
      );
      showToast(
        `Certificate ${revokeTarget.certificate_id} revoked. Public verification now reflects REVOKED.`,
        'success',
      );
      setRevokeTarget(null);
      setRevokeReason('');
      await loadCertificates();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Revocation failed', 'error');
    } finally {
      setRevoking(false);
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingType(true);
    try {
      await apiFetch('/api/admin/certificate-types', {
        method: 'POST',
        body: JSON.stringify({ name: newTypeName.trim(), description: newTypeDesc.trim() }),
      });
      showToast('Certificate type added.', 'success');
      setNewTypeName('');
      setNewTypeDesc('');
      await loadTypes();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to add type', 'error');
    } finally {
      setAddingType(false);
    }
  };

  const handleToggleType = async (t: CertificateType) => {
    try {
      await apiFetch(`/api/admin/certificate-types/${encodeURIComponent(t.type_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: t.is_active === 0 }),
      });
      await loadTypes();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update type', 'error');
    }
  };

  return (
    <AdminLayout
      title="Certificate Management"
      breadcrumb="CertiTrust / Certificates"
      actions={
        <>
          <button
            type="button"
            onClick={() => setTypesModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-navy-900 hover:bg-slate-50 whitespace-nowrap"
          >
            <Settings2 className="h-3.5 w-3.5 text-teal-600" />
            <span>Manage Types</span>
          </button>
          <Link
            to="/admin/issue"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Issue New</span>
          </Link>
        </>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Certificate ID, student name, USN, or title..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['ALL', 'ACTIVE', 'REVOKED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setStatusFilter(status);
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === status
                      ? 'bg-white text-navy-900 shadow-xs'
                      : 'text-slate-600 hover:text-navy-900'
                  }`}
                >
                  {status === 'ALL' ? 'All' : status === 'ACTIVE' ? 'Active' : 'Revoked'}
                </button>
              ))}
            </div>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by certificate type"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="ALL">All Certificate Types</option>
              {types.map((t) => (
                <option key={t.type_id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : certificates.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-semibold text-navy-900">No matching certificates found</p>
            <p className="text-xs text-slate-500">
              Adjust your search filters or issue a new certificate.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Certificate ID</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Type & Title</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {certificates.map((cert) => (
                  <tr key={cert.certificate_id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-navy-900 whitespace-nowrap">
                      {cert.certificate_id}
                      {Boolean(cert.is_demo) && (
                        <span className="ml-1.5 font-sans text-amber-700 font-medium">· Demo</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{cert.student_name}</p>
                      <p className="font-mono text-xs text-slate-500">{cert.usn}</p>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-xs text-teal-700 font-medium">{cert.certificate_type}</p>
                      <p className="text-sm text-slate-900 truncate">{cert.title}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {cert.issue_date}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {cert.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>Revoked</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedCert(cert)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCertificatePdf(cert.certificate_id)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-navy-900 hover:bg-slate-100"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>PDF</span>
                      </button>
                      {cert.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRevokeTarget(cert);
                            setRevokeReason('');
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="tabular-nums">
            Showing page {page} of {totalPages} ({totalCount} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {selectedCert && (
        <CertificatePreviewModal
          certificate={selectedCert}
          onClose={() => setSelectedCert(null)}
        />
      )}

      {/* Revoke Confirmation Dialog */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700">
                <ShieldAlert className="h-5 w-5" />
                <h2 className="font-display text-lg font-bold">Revoke Certificate</h2>
              </div>
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Revoking <strong className="font-mono text-navy-900">{revokeTarget.certificate_id}</strong> ({revokeTarget.student_name}) immediately marks it <strong>REVOKED</strong> across all public lookups and QR scans.
            </p>
            <form onSubmit={handleConfirmRevoke} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason for Revocation (visible on public revocation notice)
                </label>
                <textarea
                  required
                  rows={3}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. Superseded by revised transcript or issued in error."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRevokeTarget(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revoking}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {revoking ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Certificate Types Modal */}
      {typesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-navy-900">
                Manage Certificate Types
              </h2>
              <button
                type="button"
                onClick={() => setTypesModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddType} className="space-y-3 border-b border-slate-200 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="New type name (e.g. Research Fellowship)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
                <input
                  type="text"
                  required
                  value={newTypeDesc}
                  onChange={(e) => setNewTypeDesc(e.target.value)}
                  placeholder="Short description"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={addingType}
                className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
              >
                {addingType ? 'Adding...' : 'Add Certificate Type'}
              </button>
            </form>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {types.map((t) => (
                <div key={t.type_id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleType(t)}
                    className={`rounded-md border px-3 py-1 text-xs font-medium shrink-0 ${
                      t.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t.is_active ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
