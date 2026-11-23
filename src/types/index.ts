export type UserRole = 'ADMIN' | 'STUDENT';

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface Institution {
  institution_id: string;
  institution_name: string;
  verification_authority: string;
  status: 'AUTHORIZED' | 'SUSPENDED';
  is_demo: number;
  created_at: string;
}

export interface CertificateType {
  type_id: string;
  name: string;
  description: string;
  is_active: number;
  created_at: string;
}

export interface StudentRecord {
  student_id: string;
  full_name: string;
  usn: string;
  email: string;
  department: string;
  course: string;
  academic_year: string;
  graduation_year: number;
  owner_user_id: string | null;
  is_demo: number;
  created_at: string;
  password_reset_requested?: number;
  password_reset_requested_at?: string | null;
  certificate_count?: number;
}

export interface CertificateRecord {
  certificate_id: string;
  student_id: string;
  institution_id: string;
  certificate_type: string;
  title: string;
  course_name: string;
  department: string;
  academic_year: string;
  issue_date: string;
  issuing_authority: string;
  pdf_storage_path: string;
  pdf_hash: string;
  qr_data_url: string;
  status: 'ACTIVE' | 'REVOKED';
  revocation_reason: string | null;
  issued_by: string;
  is_demo: number;
  is_uploaded_pdf: number;
  created_at: string;
  revoked_at: string | null;
  student_name?: string;
  usn?: string;
  student_email?: string;
  institution_name?: string;
  verification_authority?: string;
}

export interface VerificationResult {
  status: 'VALID' | 'REVOKED' | 'NOT_FOUND' | 'UNAUTHORIZED_INSTITUTION' | 'INVALID_FORMAT';
  certificateId?: string;
  studentName?: string;
  department?: string;
  courseName?: string;
  academicYear?: string;
  certificateType?: string;
  title?: string;
  institutionName?: string;
  verificationAuthority?: string;
  issuingAuthority?: string;
  issueDate?: string;
  pdfHashFingerprint?: string;
  uploadedHash?: string;
  revokedAt?: string | null;
  revocationReason?: string;
  isDemo?: boolean;
  verifiedAt?: string;
  message?: string;
  error?: string;
}

export interface VerificationLog {
  log_id: string;
  certificate_id: string;
  result: 'VALID' | 'REVOKED' | 'NOT_FOUND' | 'HASH_MISMATCH' | 'UNAUTHORIZED_INSTITUTION';
  source: 'WEB' | 'QR_SCAN' | 'FILE_HASH_CHECK';
  verifier_ip_hash: string;
  verified_at: string;
}

export interface AuditLog {
  audit_id: string;
  actor_email: string;
  action: string;
  target_id: string | null;
  details: string;
  created_at: string;
}

export interface DashboardResponse {
  stats: {
    totalCertificates: number;
    activeCertificates: number;
    revokedCertificates: number;
    totalStudents: number;
    totalVerifications: number;
  };
  demoSeeded: boolean;
  recentCertificates: CertificateRecord[];
  recentVerifications: VerificationLog[];
  byType: { name: string; count: number }[];
  activitySeries: { date: string; label: string; issued: number; verifications: number }[];
}
