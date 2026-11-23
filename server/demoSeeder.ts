import { hashPassword, writeAuditLog } from './auth.ts';
import { db, newId, nowIso } from './db.ts';
import { buildPublicVerifyUrl, createCertificatePdf } from './pdfGenerator.ts';

export async function seedDemonstrationData(
  actor: { userId: string; email: string },
  baseUrl: string,
  demoStudentPassword?: string,
): Promise<{
  studentsSeeded: number;
  certificatesSeeded: number;
  logsSeeded: number;
}> {
  const existingDemoCerts = db
    .prepare(`SELECT COUNT(*) as cnt FROM certificates WHERE is_demo = 1`)
    .get() as { cnt: number };

  if (existingDemoCerts.cnt > 0) {
    return { studentsSeeded: 0, certificatesSeeded: 0, logsSeeded: 0 };
  }

  const now = nowIso();
  const sampleStudents = [
    {
      studentId: 'stu_demo_001',
      fullName: 'Aarav Nair',
      usn: 'DEMO-2026-CS001',
      email: 'aarav.nair.demo@sterling-eval.edu',
      department: 'Computer Science & Engineering',
      course: 'B.Tech in Computer Science & Engineering',
      academicYear: '2025-2026',
      graduationYear: 2026,
    },
    {
      studentId: 'stu_demo_002',
      fullName: 'Elena Rostova',
      usn: 'DEMO-2026-EC014',
      email: 'elena.rostova.demo@sterling-eval.edu',
      department: 'Electronics & Communication',
      course: 'B.Tech in Embedded Systems & VLSI',
      academicYear: '2025-2026',
      graduationYear: 2026,
    },
    {
      studentId: 'stu_demo_003',
      fullName: 'Marcus Vance',
      usn: 'DEMO-2026-ME008',
      email: 'marcus.vance.demo@sterling-eval.edu',
      department: 'Mechanical Engineering',
      course: 'B.Tech in Robotics & Automation',
      academicYear: '2025-2026',
      graduationYear: 2026,
    },
  ];

  let studentsSeeded = 0;
  for (const s of sampleStudents) {
    let ownerUserId: string | null = null;
    if (demoStudentPassword && demoStudentPassword.length >= 8) {
      const existingUser = db
        .prepare(`SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)`)
        .get(s.email) as { user_id: string } | undefined;
      if (existingUser) {
        ownerUserId = existingUser.user_id;
      } else {
        ownerUserId = newId('usr');
        db.prepare(
          `INSERT INTO users (user_id, email, full_name, password_hash, role, created_at)
           VALUES (?, ?, ?, ?, 'STUDENT', ?)`,
        ).run(ownerUserId, s.email, s.fullName, hashPassword(demoStudentPassword), now);
      }
    }

    const res = db
      .prepare(
        `INSERT OR IGNORE INTO students
         (student_id, full_name, usn, email, department, course, academic_year, graduation_year, owner_user_id, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .run(
        s.studentId,
        s.fullName,
        s.usn,
        s.email,
        s.department,
        s.course,
        s.academicYear,
        s.graduationYear,
        ownerUserId,
        now,
      );
    if (res.changes > 0) studentsSeeded += 1;
  }

  const demoCertSpecs = [
    {
      certificateId: 'CT-DEMO-2026-A101',
      student: sampleStudents[0],
      certificateType: 'Degree Certificate',
      title: 'Bachelor of Technology — First Class with Distinction',
      issueDate: '2026-05-18',
      issuingAuthority: 'Dr. H. Mercer, Academic Registrar',
      status: 'ACTIVE' as const,
      revocationReason: null,
      revokedAt: null,
    },
    {
      certificateId: 'CT-DEMO-2026-B202',
      student: sampleStudents[1],
      certificateType: 'Course Completion Certificate',
      title: 'Applied Cryptography & Network Security Honors Track',
      issueDate: '2026-04-12',
      issuingAuthority: 'Prof. S. Lin, Dean of Engineering',
      status: 'ACTIVE' as const,
      revocationReason: null,
      revokedAt: null,
    },
    {
      certificateId: 'CT-DEMO-2026-R303',
      student: sampleStudents[2],
      certificateType: 'Internship Certificate',
      title: 'Autonomous Systems Industrial Practicum (Revoked Demo)',
      issueDate: '2026-02-20',
      issuingAuthority: 'Dr. H. Mercer, Academic Registrar',
      status: 'REVOKED' as const,
      revocationReason: 'Demo revocation test record: superseded by corrected transcript.',
      revokedAt: now,
    },
  ];

  let certificatesSeeded = 0;
  for (const spec of demoCertSpecs) {
    const verifyUrl = buildPublicVerifyUrl(baseUrl, spec.certificateId);
    const pdfResult = await createCertificatePdf({
      certificateId: spec.certificateId,
      studentName: spec.student.fullName,
      usn: spec.student.usn,
      department: spec.student.department,
      courseName: spec.student.course,
      academicYear: spec.student.academicYear,
      certificateType: spec.certificateType,
      title: spec.title,
      issueDate: spec.issueDate,
      issuingAuthority: spec.issuingAuthority,
      institutionName: 'Sterling Institute of Technology (Demo Evaluation)',
      verificationAuthority: 'Office of Academic Credentials — Demo Sandbox',
      verifyUrl,
      isDemo: true,
    });

    const insertRes = db
      .prepare(
        `INSERT OR IGNORE INTO certificates
         (certificate_id, student_id, institution_id, certificate_type, title, course_name, department, academic_year,
          issue_date, issuing_authority, pdf_storage_path, pdf_hash, qr_data_url, status, revocation_reason,
          issued_by, is_demo, is_uploaded_pdf, created_at, revoked_at)
         VALUES (?, ?, 'inst_demo_sterling', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      )
      .run(
        spec.certificateId,
        spec.student.studentId,
        spec.certificateType,
        spec.title,
        spec.student.course,
        spec.student.department,
        spec.student.academicYear,
        spec.issueDate,
        spec.issuingAuthority,
        pdfResult.pdfStoragePath,
        pdfResult.pdfHash,
        pdfResult.qrDataUrl,
        spec.status,
        spec.revocationReason,
        actor.userId,
        now,
        spec.revokedAt,
      );
    if (insertRes.changes > 0) certificatesSeeded += 1;
  }

  // Seed realistic recent verification logs over past 6 days
  const sampleLogs = [
    { certId: 'CT-DEMO-2026-A101', result: 'VALID', source: 'QR_SCAN', daysAgo: 5 },
    { certId: 'CT-DEMO-2026-A101', result: 'VALID', source: 'WEB', daysAgo: 4 },
    { certId: 'CT-DEMO-2026-B202', result: 'VALID', source: 'QR_SCAN', daysAgo: 3 },
    { certId: 'CT-DEMO-9999-FAKE', result: 'NOT_FOUND', source: 'WEB', daysAgo: 3 },
    { certId: 'CT-DEMO-2026-R303', result: 'REVOKED', source: 'QR_SCAN', daysAgo: 2 },
    { certId: 'CT-DEMO-2026-A101', result: 'VALID', source: 'FILE_HASH_CHECK', daysAgo: 1 },
    { certId: 'CT-DEMO-2026-B202', result: 'VALID', source: 'WEB', daysAgo: 0 },
  ];

  let logsSeeded = 0;
  const insertLog = db.prepare(
    `INSERT INTO verification_logs (log_id, certificate_id, result, source, verifier_ip_hash, verified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const log of sampleLogs) {
    const dt = new Date(Date.now() - log.daysAgo * 86400 * 1000).toISOString();
    insertLog.run(newId('log'), log.certId, log.result, log.source, 'demo_evaluator', dt);
    logsSeeded += 1;
  }

  writeAuditLog(
    actor,
    'DEMO_DATA_SEEDED',
    null,
    `Seeded ${studentsSeeded} demo students, ${certificatesSeeded} demo PDFs, and ${logsSeeded} verification logs.`,
  );

  return { studentsSeeded, certificatesSeeded, logsSeeded };
}
