import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { CertificateRecord } from '../types/index.ts';

interface CertificatePreviewModalProps {
  certificate: CertificateRecord;
  onClose: () => void;
}

export function CertificatePreviewModal({
  certificate,
  onClose,
}: CertificatePreviewModalProps) {
  const { downloadCertificatePdf } = useAuth();
  const { showToast } = useToast();

  const verifyUrl = `${window.location.origin}/verify/${encodeURIComponent(certificate.certificate_id)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      showToast('Public verification URL copied.', 'success');
    } catch {
      showToast('Copy failed. Please copy the URL manually.', 'error');
    }
  };

  const handleDownload = async () => {
    try {
      await downloadCertificatePdf(certificate.certificate_id);
      showToast('PDF download started.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed', 'error');
    }
  };

  const handleDownloadQr = () => {
    const a = document.createElement('a');
    a.href = certificate.qr_data_url;
    a.download = `QR-${certificate.certificate_id}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-mono text-slate-500">{certificate.certificate_id}</p>
            <h2 className="font-display text-lg font-bold text-navy-900">
              {certificate.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
            aria-label="Close certificate preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {Boolean(certificate.is_demo) && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs font-semibold text-amber-900">
            DEMO — NOT AN OFFICIAL CREDENTIAL (Evaluation Sample Record)
          </div>
        )}

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {certificate.status === 'ACTIVE' ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Active Credential
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-red-700">
                  <ShieldAlert className="h-4 w-4" />
                  Revoked Credential
                </span>
              )}
              <span className="text-slate-300">·</span>
              <span className="text-slate-600 font-normal">{certificate.certificate_type}</span>
            </div>

            {certificate.status === 'REVOKED' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
                <p className="font-semibold">Revoked on {certificate.revoked_at?.slice(0, 10)}</p>
                <p>{certificate.revocation_reason}</p>
              </div>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {certificate.student_name && (
                <div>
                  <dt className="text-xs text-slate-500">Recipient</dt>
                  <dd className="font-medium text-slate-900">{certificate.student_name}</dd>
                </div>
              )}
              {certificate.usn && (
                <div>
                  <dt className="text-xs text-slate-500">USN</dt>
                  <dd className="font-mono text-slate-900">{certificate.usn}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-500">Department</dt>
                <dd className="font-medium text-slate-900">{certificate.department}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Course / Program</dt>
                <dd className="font-medium text-slate-900">{certificate.course_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Issuing Institution</dt>
                <dd className="font-medium text-slate-900">{certificate.institution_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Issue Date</dt>
                <dd className="font-medium text-slate-900 tabular-nums">{certificate.issue_date}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Issuing Authority</dt>
                <dd className="font-medium text-slate-900">{certificate.issuing_authority}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">SHA-256 PDF Digest</dt>
                <dd className="font-mono text-xs text-slate-700 break-all bg-slate-50 border border-slate-200 rounded-md p-2 mt-1">
                  {certificate.pdf_hash}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 text-center space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-navy-900">Verification QR Code</p>
              <p className="text-xs text-slate-500">Links directly to public registry</p>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <img
                src={certificate.qr_data_url}
                alt={`QR code for ${certificate.certificate_id}`}
                className="w-36 h-36 object-contain"
              />
            </div>
            <div className="w-full space-y-2">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Download QR PNG
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Verify URL</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/verify/${encodeURIComponent(certificate.certificate_id)}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Open Public Verification Page</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
            >
              <Download className="h-4 w-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
