import {
  CheckCircle2,
  Download,
  ExternalLink,
  FilePlus2,
  FileUp,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { CertificateType, Institution, StudentRecord } from '../types/index.ts';

interface IssuedResult {
  certificateId: string;
  studentName: string;
  usn: string;
  institutionName: string;
  certificateType: string;
  title: string;
  issueDate: string;
  pdfHash: string;
  qrDataUrl: string;
  verifyUrl: string;
  isDemo: boolean;
}

export function AdminIssueCertificatePage() {
  const { apiFetch, downloadCertificatePdf } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [types, setTypes] = useState<CertificateType[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [mode, setMode] = useState<'generate' | 'upload'>('generate');
  const [studentId, setStudentId] = useState('');
  const [institutionId, setInstitutionId] = useState('inst_meridian');
  const [certificateType, setCertificateType] = useState('Degree Certificate');
  const [title, setTitle] = useState('');
  const [courseName, setCourseName] = useState('');
  const [department, setDepartment] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [issuingAuthority, setIssuingAuthority] = useState('Office of the Academic Registrar');
  const [isDemo, setIsDemo] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [issuedResult, setIssuedResult] = useState<IssuedResult | null>(null);

  const loadFormOptions = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [stuRes, instRes, typeRes] = await Promise.all([
        apiFetch<{ students: StudentRecord[] }>('/api/admin/students'),
        apiFetch<{ institutions: Institution[] }>('/api/admin/institutions'),
        apiFetch<{ types: CertificateType[] }>('/api/admin/certificate-types'),
      ]);
      setStudents(stuRes.students);
      setInstitutions(instRes.institutions);
      const activeTypes = typeRes.types.filter((t) => t.is_active === 1);
      setTypes(activeTypes);
      if (activeTypes[0]) setCertificateType(activeTypes[0].name);
      if (instRes.institutions[0]) setInstitutionId(instRes.institutions[0].institution_id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load issuing options', 'error');
    } finally {
      setLoadingLists(false);
    }
  }, [apiFetch, showToast]);

  useEffect(() => {
    loadFormOptions();
  }, [loadFormOptions]);

  const handleStudentSelect = (id: string) => {
    setStudentId(id);
    const found = students.find((s) => s.student_id === id);
    if (found) {
      setDepartment(found.department);
      setCourseName(found.course);
      setAcademicYear(found.academic_year);
      if (found.is_demo) setIsDemo(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      showToast('Please select a registered student.', 'error');
      return;
    }
    if (mode === 'upload' && !uploadedFile) {
      showToast('Please attach an existing PDF certificate file.', 'error');
      return;
    }

    setSubmitting(true);
    setIssuedResult(null);
    try {
      if (mode === 'generate') {
        const res = await apiFetch<{ certificate: IssuedResult }>('/api/admin/certificates/issue', {
          method: 'POST',
          body: JSON.stringify({
            studentId,
            institutionId,
            certificateType,
            title,
            courseName,
            department,
            academicYear,
            issueDate,
            issuingAuthority,
            isDemo,
          }),
        });
        setIssuedResult(res.certificate);
        showToast(`Certificate ${res.certificate.certificateId} generated and signed.`, 'success');
      } else {
        const formData = new FormData();
        formData.append('pdf', uploadedFile!);
        formData.append('studentId', studentId);
        formData.append('institutionId', institutionId);
        formData.append('certificateType', certificateType);
        formData.append('title', title);
        formData.append('courseName', courseName);
        formData.append('department', department);
        formData.append('academicYear', academicYear);
        formData.append('issueDate', issueDate);
        formData.append('issuingAuthority', issuingAuthority);
        formData.append('isDemo', String(isDemo));

        const res = await apiFetch<{ certificate: IssuedResult }>(
          '/api/admin/certificates/upload',
          {
            method: 'POST',
            body: formData,
          },
        );
        setIssuedResult(res.certificate);
        setUploadedFile(null);
        showToast(`Uploaded PDF stamped & registered (${res.certificate.certificateId}).`, 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Issuance failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout title="Issue Digital Certificate" breadcrumb="CertiTrust / Issue Credential">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          {/* Issuance Mode Toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('generate')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${
                mode === 'generate'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              <FilePlus2 className="h-4 w-4" />
              <span>Generate Official PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${
                mode === 'upload'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              <FileUp className="h-4 w-4" />
              <span>Upload Existing PDF</span>
            </button>
          </div>

          {loadingLists ? (
            <div className="space-y-3 py-4">
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ) : students.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center space-y-2">
              <p className="text-sm font-semibold text-navy-900">No students registered yet</p>
              <p className="text-xs text-slate-600">
                Register at least one student before issuing an academic certificate.
              </p>
              <Link
                to="/admin/students"
                className="inline-block mt-1 rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Go to Student Registration
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Select Student
                  </label>
                  <select
                    required
                    value={studentId}
                    onChange={(e) => handleStudentSelect(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    <option value="">Choose a student...</option>
                    {students.map((st) => (
                      <option key={st.student_id} value={st.student_id}>
                        {st.full_name} ({st.usn})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Issuing Institution
                  </label>
                  <select
                    required
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    {institutions.map((inst) => (
                      <option key={inst.institution_id} value={inst.institution_id}>
                        {inst.institution_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Certificate Type
                  </label>
                  <select
                    required
                    value={certificateType}
                    onChange={(e) => setCertificateType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    {types.map((t) => (
                      <option key={t.type_id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date of Issue
                  </label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm tabular-nums focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Certificate Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Bachelor of Technology in Computer Science — First Class"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Course Name
                  </label>
                  <input
                    type="text"
                    required
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="B.Tech in Computer Science"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Computer Science & Engineering"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    required
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2025-2026"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Issuing Authority / Signatory
                  </label>
                  <input
                    type="text"
                    required
                    value={issuingAuthority}
                    onChange={(e) => setIssuingAuthority(e.target.value)}
                    placeholder="Dr. Eleanor Vance, Registrar"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              {mode === 'upload' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Attach Existing Certificate PDF (will be stamped with QR & SHA-256 hashed)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  />
                </div>
              )}

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isDemo}
                  onChange={(e) => setIsDemo(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span>
                  Mark as Demonstration Credential (adds &ldquo;DEMO — NOT AN OFFICIAL CREDENTIAL&rdquo; banner)
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {submitting
                    ? 'Generating Signed PDF & Computing SHA-256...'
                    : mode === 'generate'
                      ? 'Generate Certificate'
                      : 'Stamp, Hash & Store Uploaded PDF'}
                </span>
              </button>
            </form>
          )}
        </section>

        {/* Live Output & Download Panel */}
        <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          {!issuedResult ? (
            <div className="py-10 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-navy-800">
                <FilePlus2 className="h-6 w-6" />
              </div>
              <h2 className="font-display text-base font-bold text-navy-900">
                Cryptographic Issuance Pipeline
              </h2>
              <ol className="text-xs text-slate-600 text-left max-w-sm mx-auto space-y-2 pt-2">
                <li>1. Generates a cryptographically random unique Certificate ID.</li>
                <li>2. Creates a live verification QR code pointing to this portal.</li>
                <li>3. Embeds the QR code and institutional seal inside the PDF.</li>
                <li>4. Computes the SHA-256 digest of the finalized PDF bytes.</li>
                <li>5. Persists the PDF and registry record in protected storage.</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display text-sm font-bold text-emerald-950">
                    Certificate Issued & Stored
                  </h2>
                  <p className="text-xs text-emerald-800 mt-0.5 font-mono">
                    {issuedResult.certificateId}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 p-4">
                <img
                  src={issuedResult.qrDataUrl}
                  alt={`QR Code for ${issuedResult.certificateId}`}
                  className="w-40 h-40 object-contain bg-white p-2 rounded-lg border border-slate-200"
                />
              </div>

              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Recipient</dt>
                  <dd className="font-semibold text-navy-900 text-right">
                    {issuedResult.studentName} ({issuedResult.usn})
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Title</dt>
                  <dd className="font-medium text-slate-900 text-right">{issuedResult.title}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 mb-1">Finalized PDF SHA-256 Hash</dt>
                  <dd className="font-mono text-[11px] break-all bg-slate-50 border border-slate-200 rounded p-2 text-slate-700">
                    {issuedResult.pdfHash}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => downloadCertificatePdf(issuedResult.certificateId)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
                >
                  <Download className="h-4 w-4" />
                  <span>Download PDF</span>
                </button>
                <Link
                  to={`/verify/${encodeURIComponent(issuedResult.certificateId)}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4 text-teal-600" />
                  <span>Verify Live</span>
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
