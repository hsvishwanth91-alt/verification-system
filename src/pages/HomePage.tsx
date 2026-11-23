import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  Lock,
  QrCode,
  Search,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SiteFooter, TopNavBar } from '../components/BrandMark.tsx';

export function HomePage() {
  const [quickId, setQuickId] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [sealImgFailed, setSealImgFailed] = useState(false);
  const navigate = useNavigate();

  const handleQuickVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickId.trim();
    if (!cleaned) {
      navigate('/verify');
      return;
    }
    navigate(`/verify/${encodeURIComponent(cleaned)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNavBar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
                <p className="text-sm font-semibold text-teal-700">
                  Academic Credential Issuance & Verification Registry
                </p>

                <h1
                  className="font-display font-bold tracking-tight text-navy-900 leading-[1.12]"
                  style={{
                    fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
                    textWrap: 'balance',
                  }}
                >
                  Issue and verify academic certificates with cryptographic certainty.
                </h1>

                <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                  CertiTrust enables university registrars to issue tamper-evident PDF credentials embedded with scannable QR verification links and SHA-256 integrity digests—giving employers and verifiers instant, privacy-safe confirmation.
                </p>

                {/* Primary & Portal Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    to="/verify"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Verify Certificate</span>
                  </Link>
                  <Link
                    to="/admin/login"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-5 py-3 text-sm font-semibold text-white hover:bg-navy-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <UserCog className="h-4 w-4" />
                    <span>Admin Login</span>
                  </Link>
                  <Link
                    to="/student/login"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-navy-900 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <GraduationCap className="h-4 w-4 text-teal-700" />
                    <span>Student Login</span>
                  </Link>
                </div>

                {/* Inline Instant Certificate Lookup */}
                <form
                  onSubmit={handleQuickVerify}
                  className="pt-3 max-w-xl"
                >
                  <label htmlFor="hero-cert-id" className="block text-xs font-medium text-slate-500 mb-2">
                    Instant Public Verification Lookup
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="hero-cert-id"
                        type="text"
                        value={quickId}
                        onChange={(e) => setQuickId(e.target.value)}
                        placeholder="Enter Certificate ID (e.g. CT-DEMO-2026-A101)"
                        className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm font-mono text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Check Status</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Hero Editorial Visual */}
              <div className="lg:col-span-5 flex">
                <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-navy-900 min-h-[280px]">
                  {!heroImgFailed ? (
                    <img
                      src="/src/assets/images/hero_university_campus_1795454110114.jpg"
                      alt="University senate hall and stone colonnade representing accredited academic institutions"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover lg:h-full"
                    />
                  ) : (
                    <div className="w-full h-full min-h-[300px] bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 p-8 flex flex-col justify-end text-white">
                      <ShieldCheck className="h-10 w-10 text-teal-400 mb-3" />
                      <p className="font-display text-xl font-bold">
                        Institutional Credential Registry
                      </p>
                      <p className="text-sm text-slate-300 mt-1">
                        Tamper-evident PDFs · QR Authentication · Real-Time Revocation
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Full-Width Key Institutional Pillars Strip */}
            <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="font-display text-lg font-bold text-navy-900 tabular-nums">SHA-256</p>
                <p className="text-sm text-slate-600 mt-1">
                  Every finalized PDF certificate is hashed post-generation for byte-level integrity checks.
                </p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-navy-900">QR URL Binding</p>
                <p className="text-sm text-slate-600 mt-1">
                  Embedded QR codes resolve to the live registry rather than static embedded text.
                </p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-navy-900">Instant Revocation</p>
                <p className="text-sm text-slate-600 mt-1">
                  Revoked records reflect immediately across all public lookups and QR scans.
                </p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-navy-900">Privacy-First Lookup</p>
                <p className="text-sm text-slate-600 mt-1">
                  Public verifiers see only essential credential facts without exposing student contact PII.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 lg:py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-sm font-semibold text-teal-700">How It Works</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-navy-900 mt-2">
                Three-stage credential lifecycle from issuance to employer verification.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
                <p className="font-mono text-xs font-semibold text-teal-700">01. Registrar Issuance</p>
                <h3 className="font-display text-lg font-bold text-navy-900">
                  Register Students & Generate PDFs
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Authorized college administrators register verified student records, select an accredited certificate type, and generate a formatted PDF or stamp an uploaded archival document.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
                <p className="font-mono text-xs font-semibold text-teal-700">02. Cryptographic Binding</p>
                <h3 className="font-display text-lg font-bold text-navy-900">
                  Embed QR & Compute SHA-256 Digest
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  A unique cryptographically random Certificate ID and live verification QR code are embedded directly into the PDF before calculating the final SHA-256 file fingerprint.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
                <p className="font-mono text-xs font-semibold text-teal-700">03. Public Verification</p>
                <h3 className="font-display text-lg font-bold text-navy-900">
                  Confirm Authenticity & Active Status
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Employers scan the QR code, enter the Certificate ID, or upload the PDF file. CertiTrust checks institutional authorization and real-time revocation status on the server.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features & Security Architecture */}
        <section id="security" className="py-16 lg:py-20 bg-white border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-5 flex">
                <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-navy-900 min-h-[280px]">
                  {!sealImgFailed ? (
                    <img
                      src="/src/assets/images/credential_seal_archival_1795454109615.jpg"
                      alt="Embossed university institutional seal next to official academic certificate parchment"
                      referrerPolicy="no-referrer"
                      onError={() => setSealImgFailed(true)}
                      className="w-full h-full object-cover lg:h-full"
                    />
                  ) : (
                    <div className="w-full h-full min-h-[300px] bg-navy-900 p-8 flex flex-col justify-center text-white">
                      <Lock className="h-10 w-10 text-teal-400 mb-3" />
                      <p className="font-display text-xl font-bold">Zero-Trust Verification</p>
                      <p className="text-sm text-slate-300 mt-2">
                        Institutional authorization + file integrity hashing + audit logs.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
                <div>
                  <p className="text-sm font-semibold text-teal-700">Security & Integrity</p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-navy-900 mt-2">
                    Built to prevent credential forgery and unauthorized issuance.
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-navy-900 font-semibold text-sm">
                      <Lock className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>Role-Based Access Control</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Only authenticated institutional administrators can register students, issue PDFs, or revoke records. Students access strictly their own credentials.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-navy-900 font-semibold text-sm">
                      <FileCheck2 className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>Post-Finalization SHA-256</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Hashes are computed after QR embedding to eliminate circular dependencies and detect single-byte tampering on uploaded PDFs.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-navy-900 font-semibold text-sm">
                      <QrCode className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>Live Status QR Resolution</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      QR codes never embed static &ldquo;VALID&rdquo; claims; every scan queries the server registry so revocations take effect immediately.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-navy-900 font-semibold text-sm">
                      <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>Rate-Limited Audit Trail</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Public lookups are rate-limited and logged with anonymized verifier hashes, while issuance and revocation actions record immutable admin audit events.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Evaluation & Demo Guide */}
        <section className="py-14 bg-navy-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-2 max-w-2xl">
              <p className="text-sm font-semibold text-teal-400">College Project Evaluation Mode</p>
              <h2 className="font-display text-2xl font-bold">
                Ready for live end-to-end demonstration.
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Sign in via Admin Login to complete first-run registrar onboarding and optionally load clearly watermarked demonstration students, active and revoked PDF credentials, and sample verification history directly into the database.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                to="/admin/login"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 transition-colors whitespace-nowrap"
              >
                <span>Open Admin Portal</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/verify"
                className="inline-flex items-center gap-2 rounded-lg border border-navy-700 bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 transition-colors whitespace-nowrap"
              >
                <span>Public Verification</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
