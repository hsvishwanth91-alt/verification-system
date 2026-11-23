import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  FileSearch,
  FileUp,
  HelpCircle,
  QrCode,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SiteFooter, TopNavBar } from '../components/BrandMark.tsx';
import { QrScannerPanel } from '../components/QrScannerPanel.tsx';
import type { VerificationResult } from '../types/index.ts';

type VerifyMode = 'id' | 'qr' | 'file';

export function VerifyCertificatePage() {
  const { certificateId: routeCertId } = useParams<{ certificateId?: string }>();
  const navigate = useNavigate();

  const [mode, setMode] = useState<VerifyMode>('id');
  const [certIdInput, setCertIdInput] = useState(routeCertId || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const runVerificationLookup = useCallback(
    async (idToVerify: string, source: 'WEB' | 'QR_SCAN' = 'WEB') => {
      const cleaned = idToVerify.trim();
      if (!cleaned) return;
      setLoading(true);
      setResult(null);
      setFileError(null);
      try {
        const res = await fetch(
          `/api/verify/${encodeURIComponent(cleaned)}?source=${source}`,
        );
        const data = (await res.json()) as VerificationResult;
        setResult(data);
      } catch {
        setResult({
          status: 'NOT_FOUND',
          certificateId: cleaned,
          message: 'Network error while verifying certificate. Please try again.',
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (routeCertId) {
      setCertIdInput(routeCertId);
      runVerificationLookup(routeCertId, 'WEB');
    }
  }, [routeCertId, runVerificationLookup]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = certIdInput.trim();
    if (!cleaned) return;
    if (routeCertId !== cleaned) {
      navigate(`/verify/${encodeURIComponent(cleaned)}`);
    } else {
      runVerificationLookup(cleaned, 'WEB');
    }
  };

  const handleQrDecoded = (decodedId: string) => {
    setCertIdInput(decodedId);
    setMode('id');
    navigate(`/verify/${encodeURIComponent(decodedId)}`);
    runVerificationLookup(decodedId, 'QR_SCAN');
  };

  const handlePdfFileCheck = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setResult(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/verify/file-check', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json()) as VerificationResult;
      if (data.error && !data.status) {
        setFileError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setFileError('Unable to upload PDF for verification.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNavBar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-teal-700">Public Credential Registry</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-navy-900">
            Verify Academic Certificate
          </h1>
          <p className="text-sm sm:text-base text-slate-600">
            Confirm authenticity against authorized issuing institutions using a Certificate ID, QR code scan, or downloaded PDF file.
          </p>
        </div>

        {/* Mode Selector & Input Card */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-7 space-y-6">
          <div
            role="tablist"
            aria-label="Verification method"
            className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'id'}
              onClick={() => setMode('id')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                mode === 'id'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              <Search className="h-4 w-4" />
              <span>Certificate ID</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'qr'}
              onClick={() => setMode('qr')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                mode === 'qr'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              <QrCode className="h-4 w-4" />
              <span>Scan QR Code</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'file'}
              onClick={() => setMode('file')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                mode === 'file'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              <FileSearch className="h-4 w-4" />
              <span>PDF File Hash</span>
            </button>
          </div>

          {mode === 'id' && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <label htmlFor="verify-input" className="block text-sm font-medium text-slate-700">
                Enter Certificate ID
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="verify-input"
                  type="text"
                  required
                  value={certIdInput}
                  onChange={(e) => setCertIdInput(e.target.value)}
                  placeholder="e.g. CT-2026-A4F1B2-9C8D0E or CT-DEMO-2026-A101"
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-mono text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>{loading ? 'Verifying...' : 'Verify Certificate'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-500">
                The Certificate ID is printed at the bottom-right beside the QR code on every CertiTrust PDF.
              </p>
            </form>
          )}

          {mode === 'qr' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Use your device camera or upload a PNG/JPG screenshot of the certificate QR code.
              </p>
              <QrScannerPanel onDecoded={handleQrDecoded} />
            </div>
          )}

          {mode === 'file' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Upload a downloaded CertiTrust PDF file. The server computes its SHA-256 digest and verifies both file integrity and active institutional status.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/70 p-8 cursor-pointer transition-colors text-center">
                <FileUp className="h-8 w-8 text-teal-600" />
                <span className="text-sm font-semibold text-navy-900">
                  Select PDF Certificate to Verify
                </span>
                <span className="text-xs text-slate-500">Maximum file size 10 MB · .pdf only</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handlePdfFileCheck}
                  className="sr-only"
                />
              </label>
              {fileError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                  {fileError}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Loading Skeleton */}
        {loading && (
          <section
            aria-label="Verification in progress"
            className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-4"
          >
            <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-72 bg-slate-100 rounded animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          </section>
        )}

        {/* Verification Results */}
        {!loading && result && (
          <section aria-live="polite">
            {result.status === 'VALID' && (
              <div className="bg-white rounded-xl border border-emerald-300 shadow-sm overflow-hidden">
                <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-700 shrink-0" />
                    <div>
                      <h2 className="font-display text-lg font-bold text-emerald-950">
                        Verified Authentic Credential
                      </h2>
                      <p className="text-xs text-emerald-800">
                        Confirmed active against an authorized issuing institution in the CertiTrust registry.
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-semibold text-emerald-900">
                    {result.certificateId}
                  </span>
                </div>

                {result.isDemo && (
                  <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs font-semibold text-amber-900">
                    DEMO — NOT AN OFFICIAL CREDENTIAL (Evaluation Sample Record)
                  </div>
                )}

                <div className="p-6 space-y-6">
                  <div>
                    <p className="text-xs font-medium text-teal-700">{result.certificateType}</p>
                    <h3 className="font-display text-xl sm:text-2xl font-bold text-navy-900 mt-1">
                      {result.title}
                    </h3>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
                    <div>
                      <dt className="text-xs text-slate-500">Recipient</dt>
                      <dd className="text-sm font-semibold text-slate-900 mt-0.5">
                        {result.studentName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Academic Program / Department</dt>
                      <dd className="text-sm font-medium text-slate-900 mt-0.5">
                        {result.courseName} · {result.department}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>Issuing Institution</span>
                      </dt>
                      <dd className="text-sm font-semibold text-slate-900 mt-0.5">
                        {result.institutionName}
                      </dd>
                      <dd className="text-xs text-slate-500">{result.verificationAuthority}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>Issue Date & Signatory</span>
                      </dt>
                      <dd className="text-sm font-medium text-slate-900 mt-0.5 tabular-nums">
                        {result.issueDate}
                      </dd>
                      <dd className="text-xs text-slate-500">{result.issuingAuthority}</dd>
                    </div>
                  </dl>

                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                    <span>
                      SHA-256 Digest:{' '}
                      <strong className="font-mono text-slate-800">
                        {result.pdfHashFingerprint}
                      </strong>
                    </span>
                    <span className="tabular-nums text-slate-500">
                      Checked {result.verifiedAt ? new Date(result.verifiedAt).toLocaleString() : 'now'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {result.status === 'REVOKED' && (
              <div className="bg-white rounded-xl border border-red-300 shadow-sm overflow-hidden">
                <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-6 w-6 text-red-700 shrink-0" />
                    <div>
                      <h2 className="font-display text-lg font-bold text-red-950">
                        Certificate Revoked — Do Not Accept as Active
                      </h2>
                      <p className="text-xs text-red-800">
                        This credential was previously issued but has been formally revoked by the issuing institution.
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-semibold text-red-900">
                    {result.certificateId}
                  </span>
                </div>

                {result.isDemo && (
                  <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs font-semibold text-amber-900">
                    DEMO — NOT AN OFFICIAL CREDENTIAL (Evaluation Sample Record)
                  </div>
                )}

                <div className="p-6 space-y-4">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Credential Title</dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">{result.title}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Issuing Institution</dt>
                      <dd className="font-medium text-slate-900 mt-0.5">{result.institutionName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Original Issue Date</dt>
                      <dd className="font-medium text-slate-900 mt-0.5 tabular-nums">
                        {result.issueDate}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Revoked Timestamp</dt>
                      <dd className="font-medium text-red-700 mt-0.5 tabular-nums">
                        {result.revokedAt ? new Date(result.revokedAt).toLocaleString() : 'Recorded'}
                      </dd>
                    </div>
                  </dl>
                  <div className="rounded-lg border border-red-200 bg-red-50/70 p-4 text-sm text-red-900">
                    <span className="font-semibold block mb-1">Revocation Notice:</span>
                    {result.revocationReason}
                  </div>
                </div>
              </div>
            )}

            {(result.status === 'NOT_FOUND' ||
              result.status === 'INVALID_FORMAT' ||
              result.status === 'UNAUTHORIZED_INSTITUTION') && (
              <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
                  {result.status === 'UNAUTHORIZED_INSTITUTION' ? (
                    <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 text-slate-700 shrink-0" />
                  )}
                  <div>
                    <h2 className="font-display text-lg font-bold text-navy-900">
                      {result.status === 'UNAUTHORIZED_INSTITUTION'
                        ? 'Issuing Institution Not Authorized'
                        : 'Certificate Not Found'}
                    </h2>
                    <p className="text-xs text-slate-600">
                      {result.message || result.error}
                    </p>
                  </div>
                </div>
                <div className="p-6 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2 font-semibold text-navy-900">
                    <HelpCircle className="h-4 w-4 text-teal-600" />
                    <span>Verification Guidance</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600">
                    <li>Verify every hyphen and character in the Certificate ID (e.g., <span className="font-mono text-xs">CT-2026-XXXXXX-XXXXXX</span>).</li>
                    <li>If you uploaded a PDF, ensure it is the original unmodified file exported from CertiTrust—re-saving or compressing a PDF changes its SHA-256 fingerprint.</li>
                    <li>If the credential cannot be located, contact the issuing institution&apos;s Registrar Office directly.</li>
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
