import crypto from 'node:crypto';
import fs from 'node:fs';
import type { Request, Response } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import {
  type AuthenticatedRequest,
  hashIp,
  hashPassword,
  isEnvAdminConfigured,
  needsInitialAdminSetup,
  requireAuth,
  requireRole,
  signSessionToken,
  verifyEnvAdminCredentials,
  verifyPassword,
  writeAuditLog,
} from './auth.ts';
import { db, newId, nowIso, resolveSafeStoragePath, runInTransaction } from './db.ts';
import { seedDemonstrationData } from './demoSeeder.ts';
import {
  buildPublicVerifyUrl,
  createCertificatePdf,
  generateCertificateId,
  stampUploadedPdf,
} from './pdfGenerator.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification requests. Please wait a minute before trying again.' },
});

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again in a few minutes.' },
});

function getBaseUrl(req: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== 'MY_APP_URL' && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, '');
  }
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:3000').split(',')[0].trim();
  return `${proto}://${host}`;
}

function maskHash(hash: string): string {
  if (hash.length <= 24) return hash;
  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
}

// Validation Schemas
const bootstrapAdminSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(150),
  password: z.string().min(8).max(128),
  loadDemoData: z.boolean().optional(),
  demoStudentPassword: z.string().min(8).max(128).optional().or(z.literal('')),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(150),
  password: z.string().min(1).max(128),
  expectedRole: z.enum(['ADMIN', 'STUDENT']),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

const resetRequestSchema = z.object({
  email: z.string().trim().email().max(150),
});

const studentSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  usn: z
    .string()
    .trim()
    .min(3, 'USN is required')
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'USN may only contain letters, numbers, hyphens, and underscores'),
  email: z.string().trim().email('Valid email is required').max(150),
  department: z.string().trim().min(2, 'Department is required').max(100),
  course: z.string().trim().min(2, 'Course is required').max(120),
  academicYear: z.string().trim().min(4, 'Academic year is required').max(20),
  graduationYear: z.coerce.number().int().min(1980).max(2100),
  portalPassword: z.string().min(8).max(128).optional().or(z.literal('')),
});

const updateStudentSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  usn: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/),
  email: z.string().trim().email().max(150),
  department: z.string().trim().min(2).max(100),
  course: z.string().trim().min(2).max(120),
  academicYear: z.string().trim().min(4).max(20),
  graduationYear: z.coerce.number().int().min(1980).max(2100),
});

const setStudentPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const issueCertificateSchema = z.object({
  studentId: z.string().trim().min(3).max(80),
  institutionId: z.string().trim().min(3).max(80),
  certificateType: z.string().trim().min(2).max(80),
  title: z.string().trim().min(3, 'Certificate title is required').max(180),
  courseName: z.string().trim().min(2, 'Course name is required').max(140),
  department: z.string().trim().min(2, 'Department is required').max(100),
  academicYear: z.string().trim().min(4).max(20),
  issueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format'),
  issuingAuthority: z.string().trim().min(2, 'Issuing authority is required').max(120),
  isDemo: z.boolean().optional(),
});

const revokeSchema = z.object({
  reason: z.string().trim().min(3, 'Please provide a revocation reason').max(300),
});

const certTypeSchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(5).max(240),
});

export function createApiRouter(): express.Router {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'certitrust-api' });
  });

  // ==========================================
  // Authentication & Onboarding
  // ==========================================

  router.get('/auth/admin-status', (_req, res) => {
    const demoRow = db
      .prepare(`SELECT COUNT(*) as cnt FROM certificates WHERE is_demo = 1`)
      .get() as { cnt: number };

    res.json({
      needsInitialSetup: needsInitialAdminSetup(),
      envAdminConfigured: isEnvAdminConfigured(),
      demoSeeded: demoRow.cnt > 0,
    });
  });

  router.post('/auth/admin-bootstrap', authLimiter, async (req, res) => {
    if (isEnvAdminConfigured()) {
      res.status(409).json({
        error: 'Administrator credentials are configured via environment secrets.',
      });
      return;
    }

    const parsed = bootstrapAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid setup data' });
      return;
    }

    const { fullName, email, password, loadDemoData, demoStudentPassword } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    let createdAdmin: { userId: string; email: string; fullName: string; role: 'ADMIN' };
    try {
      createdAdmin = runInTransaction(() => {
        const countRow = db
          .prepare(`SELECT COUNT(*) as cnt FROM users WHERE role = 'ADMIN'`)
          .get() as { cnt: number };
        if (countRow.cnt > 0) {
          throw new Error('ALREADY_BOOTSTRAPPED');
        }

        const existingEmail = db
          .prepare(`SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)`)
          .get(normalizedEmail);
        if (existingEmail) {
          throw new Error('EMAIL_IN_USE');
        }

        const userId = newId('usr');
        const now = nowIso();
        db.prepare(
          `INSERT INTO users (user_id, email, full_name, password_hash, role, created_at)
           VALUES (?, ?, ?, ?, 'ADMIN', ?)`,
        ).run(userId, normalizedEmail, fullName, hashPassword(password), now);

        writeAuditLog(
          { userId, email: normalizedEmail },
          'ADMIN_ONBOARDED',
          userId,
          'Initial administrator account claimed during first-run setup.',
        );

        return { userId, email: normalizedEmail, fullName, role: 'ADMIN' as const };
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_BOOTSTRAPPED') {
        res.status(409).json({ error: 'An administrator account already exists. Please log in.' });
        return;
      }
      if (err instanceof Error && err.message === 'EMAIL_IN_USE') {
        res.status(409).json({ error: 'This email address is already registered.' });
        return;
      }
      throw err;
    }

    if (loadDemoData) {
      await seedDemonstrationData(
        { userId: createdAdmin.userId, email: createdAdmin.email },
        getBaseUrl(req),
        demoStudentPassword || undefined,
      );
    }

    const token = signSessionToken(createdAdmin);
    res.status(201).json({ token, user: createdAdmin });
  });

  router.post('/auth/login', authLimiter, (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please provide a valid email and password.' });
      return;
    }

    const { email, password, expectedRole } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    if (expectedRole === 'ADMIN') {
      const envAdmin = verifyEnvAdminCredentials(normalizedEmail, password);
      if (envAdmin) {
        const token = signSessionToken(envAdmin);
        res.json({ token, user: envAdmin });
        return;
      }
    }

    const row = db
      .prepare(
        `SELECT user_id, email, full_name, password_hash, role
         FROM users WHERE LOWER(email) = LOWER(?)`,
      )
      .get(normalizedEmail) as
      | {
          user_id: string;
          email: string;
          full_name: string;
          password_hash: string;
          role: 'ADMIN' | 'STUDENT';
        }
      | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid email address or password.' });
      return;
    }

    if (row.role !== expectedRole) {
      res.status(403).json({
        error:
          expectedRole === 'ADMIN'
            ? 'This account does not have administrator privileges.'
            : 'Please use the Administrator Login portal for admin accounts.',
      });
      return;
    }

    const user = {
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
    };
    const token = signSessionToken(user);
    res.json({ token, user });
  });

  router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  router.post('/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid password payload' });
      return;
    }

    const userRow = db
      .prepare(`SELECT user_id, password_hash FROM users WHERE user_id = ?`)
      .get(req.user!.userId) as { user_id: string; password_hash: string } | undefined;

    if (!userRow || !verifyPassword(parsed.data.currentPassword, userRow.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    db.prepare(
      `UPDATE users SET password_hash = ?, password_reset_requested = 0 WHERE user_id = ?`,
    ).run(hashPassword(parsed.data.newPassword), req.user!.userId);

    writeAuditLog(
      req.user!,
      'PASSWORD_CHANGED',
      req.user!.userId,
      'User updated account password.',
    );

    res.json({ message: 'Password updated successfully.' });
  });

  router.post('/auth/request-reset', authLimiter, (req, res) => {
    const parsed = resetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const userRow = db
      .prepare(`SELECT user_id, role FROM users WHERE LOWER(email) = LOWER(?)`)
      .get(normalizedEmail) as { user_id: string; role: string } | undefined;

    if (userRow && userRow.role === 'STUDENT') {
      db.prepare(
        `UPDATE users SET password_reset_requested = 1, password_reset_requested_at = ? WHERE user_id = ?`,
      ).run(nowIso(), userRow.user_id);
    }

    // Always return generic acknowledgement to prevent account enumeration
    res.json({
      message:
        'If a registered student account matches this email, your password reset request has been flagged for your institutional administrator.',
    });
  });

  // ==========================================
  // Public Verification Endpoints
  // ==========================================

  router.get('/public/institutions', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT institution_id, institution_name, verification_authority, status, is_demo
         FROM institutions WHERE status = 'AUTHORIZED' ORDER BY is_demo ASC, institution_name ASC`,
      )
      .all();
    res.json({ institutions: rows });
  });

  router.get('/verify/:certificateId', verifyLimiter, (req, res) => {
    const certId = req.params.certificateId?.trim() || '';
    const sourceRaw = String(req.query.source || 'WEB').toUpperCase();
    const source = sourceRaw === 'QR_SCAN' ? 'QR_SCAN' : 'WEB';

    if (!/^[A-Za-z0-9_-]{4,64}$/.test(certId)) {
      res.status(400).json({
        status: 'INVALID_FORMAT',
        error: 'Certificate ID format is invalid. Expected alphanumeric characters and hyphens.',
      });
      return;
    }

    const record = db
      .prepare(
        `SELECT
           c.certificate_id,
           c.certificate_type,
           c.title,
           c.course_name,
           c.department,
           c.academic_year,
           c.issue_date,
           c.issuing_authority,
           c.pdf_hash,
           c.status,
           c.revocation_reason,
           c.revoked_at,
           c.is_demo,
           s.full_name as student_name,
           i.institution_name,
           i.verification_authority,
           i.status as institution_status
         FROM certificates c
         JOIN students s ON s.student_id = c.student_id
         JOIN institutions i ON i.institution_id = c.institution_id
         WHERE UPPER(c.certificate_id) = UPPER(?)`,
      )
      .get(certId) as
      | {
          certificate_id: string;
          certificate_type: string;
          title: string;
          course_name: string;
          department: string;
          academic_year: string;
          issue_date: string;
          issuing_authority: string;
          pdf_hash: string;
          status: 'ACTIVE' | 'REVOKED';
          revocation_reason: string | null;
          revoked_at: string | null;
          is_demo: number;
          student_name: string;
          institution_name: string;
          verification_authority: string;
          institution_status: 'AUTHORIZED' | 'SUSPENDED';
        }
      | undefined;

    const ipHash = hashIp(req.ip);
    const verifiedAt = nowIso();

    if (!record) {
      db.prepare(
        `INSERT INTO verification_logs (log_id, certificate_id, result, source, verifier_ip_hash, verified_at)
         VALUES (?, ?, 'NOT_FOUND', ?, ?, ?)`,
      ).run(newId('log'), certId, source, ipHash, verifiedAt);

      res.status(404).json({
        status: 'NOT_FOUND',
        certificateId: certId,
        verifiedAt,
        message: 'No matching credential was found in the authorized institutional registry.',
      });
      return;
    }

    if (record.institution_status !== 'AUTHORIZED') {
      db.prepare(
        `INSERT INTO verification_logs (log_id, certificate_id, result, source, verifier_ip_hash, verified_at)
         VALUES (?, ?, 'UNAUTHORIZED_INSTITUTION', ?, ?, ?)`,
      ).run(newId('log'), record.certificate_id, source, ipHash, verifiedAt);

      res.json({
        status: 'UNAUTHORIZED_INSTITUTION',
        certificateId: record.certificate_id,
        institutionName: record.institution_name,
        verifiedAt,
        message: 'The issuing institution is not currently authorized in the CertiTrust registry.',
      });
      return;
    }

    if (record.status === 'REVOKED') {
      db.prepare(
        `INSERT INTO verification_logs (log_id, certificate_id, result, source, verifier_ip_hash, verified_at)
         VALUES (?, ?, 'REVOKED', ?, ?, ?)`,
      ).run(newId('log'), record.certificate_id, source, ipHash, verifiedAt);

      res.json({
        status: 'REVOKED',
        certificateId: record.certificate_id,
        certificateType: record.certificate_type,
        title: record.title,
        institutionName: record.institution_name,
        verificationAuthority: record.verification_authority,
        issueDate: record.issue_date,
        revokedAt: record.revoked_at,
        revocationReason: record.revocation_reason || 'Revoked by the issuing academic registrar.',
        isDemo: Boolean(record.is_demo),
        verifiedAt,
      });
      return;
    }

    db.prepare(
      `INSERT INTO verification_logs (log_id, certificate_id, result, source, verifier_ip_hash, verified_at)
       VALUES (?, ?, 'VALID', ?, ?, ?)`,
    ).run(newId('log'), record.certificate_id, source, ipHash, verifiedAt);

    // Privacy-safe disclosure: never return student email, USN, or internal IDs publicly
    res.json({
      status: 'VALID',
      certificateId: record.certificate_id,
      studentName: record.student_name,
      department: record.department,
      courseName: record.course_name,
      academicYear: record.academic_year,
      certificateType: record.certificate_type,
      title: record.title,
      institutionName: record.institution_name,
      verificationAuthority: record.verification_authority,
      issuingAuthority: record.issuing_authority,
      issueDate: record.issue_date,
      pdfHashFingerprint: maskHash(record.pdf_hash),
      isDemo: Boolean(record.is_demo),
      verifiedAt,
    });
  });

  router.post(
    '/verify/file-check',
    verifyLimiter,
    upload.single('file'),
    (req, res) => {
      if (!req.file) {
        res.status(400).json({ error: 'Please select a PDF certificate file to verify.' });
        return;
      }

      if (req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        res.status(400).json({ error: 'Uploaded file is not a valid PDF document.' });
        return;
      }

      const uploadedHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const ipHash = hashIp(req.ip);
      const verifiedAt = nowIso();

      const record = db
        .prepare(
          `SELECT
             c.certificate_id,
             c.certificate_type,
             c.title,
             c.course_name,
             c.department,
             c.academic_year,
             c.issue_date,
             c.issuing_authority,
             c.pdf_hash,
             c.status,
             c.revocation_reason,
             c.revoked_at,
             c.is_demo,
             s.full_name as student_name,
             i.institution_name,
             i.verification_authority,
             i.status as institution_status
           FROM certificates c
           JOIN students s ON s.student_id = c.student_id
           JOIN institutions i ON i.institution_id = c.institution_id
           WHERE c.pdf_hash = ?`,
        )
        .get(uploadedHash) as
        | {
            certificate_id: string;
            certificate_type: string;
            title: string;
            course_name: string;
            department: string;
            academic_year: string;
            issue_date: string;
            issuing_authority: string;
            pdf_hash: string;
            status: 'ACTIVE' | 'REVOKED';
            revocation_reason: string | null;
            revoked_at: string | null;
            is_demo: number;
            student_name: string;
            institution_name: string;
            verification_authority: string;
            institution_status: 'AUTHORIZED' | 'SUSPENDED';
          }
        | undefined;

      if (!record) {
        db.prepare(
          `INSERT INTO verification_logs (log_id, certificate_id, result, source, verifier_ip_hash, verified_at)
           VALUES (?, ?, 'HASH_MISMATCH', 'FILE_HASH_CHECK', ?, ?)`,
        ).run(newId('log'), `SHA256:${uploadedHash.slice(0, 12)}`, ipHash, verifiedAt);

        res.status(404).json({
          status: 'NOT_FOUND',
          uploadedHash,
          verifiedAt,
          message:
            'No authorized institutional record matches this PDF file SHA-256 fingerprint. The file may have been altered or was not issued through CertiTrust.',
        });
        return;
      }

      if (record.institution_status !== 'AUTHORIZED') {
        db.prepare(
          `INSERT INTO verification_logs (log_id, certificate_id, result, source, verifier_ip_hash, verified_at)
           VALUES (?, ?, 'UNAUTHORIZED_INSTITUTION', 'FILE_HASH_CHECK', ?, ?)`,
        ).run(newId('log'), record.certificate_id, ipHash, verifiedAt);

        res.json({
          status: 'UNAUTHORIZED_INSTITUTION',
          certificateId: record.certificate_id,
          institutionName: record.institution_name,
          verifiedAt,
          message: 'Issuing institution is not currently authorized.',
        });
        return;
      }

      if (record.status === 'REVOKED') {
        db.prepare(
          `INSERT INTO verification_logs (log_id, certificate_id, result, source, verifier_ip_hash, verified_at)
           VALUES (?, ?, 'REVOKED', 'FILE_HASH_CHECK', ?, ?)`,
        ).run(newId('log'), record.certificate_id, ipHash, verifiedAt);

        res.json({
          status: 'REVOKED',
          certificateId: record.certificate_id,
          certificateType: record.certificate_type,
          title: record.title,
          institutionName: record.institution_name,
          verificationAuthority: record.verification_authority,
          issueDate: record.issue_date,
          revokedAt: record.revoked_at,
          revocationReason: record.revocation_reason || 'Revoked by issuing registrar.',
          isDemo: Boolean(record.is_demo),
          verifiedAt,
        });
        return;
      }

      db.prepare(
        `INSERT INTO verification_logs (log_id, certificate_id, result, source, verifier_ip_hash, verified_at)
         VALUES (?, ?, 'VALID', 'FILE_HASH_CHECK', ?, ?)`,
      ).run(newId('log'), record.certificate_id, ipHash, verifiedAt);

      res.json({
        status: 'VALID',
        certificateId: record.certificate_id,
        studentName: record.student_name,
        department: record.department,
        courseName: record.course_name,
        academicYear: record.academic_year,
        certificateType: record.certificate_type,
        title: record.title,
        institutionName: record.institution_name,
        verificationAuthority: record.verification_authority,
        issuingAuthority: record.issuing_authority,
        issueDate: record.issue_date,
        pdfHashFingerprint: maskHash(record.pdf_hash),
        isDemo: Boolean(record.is_demo),
        verifiedAt,
      });
    },
  );

  // ==========================================
  // Administrator Endpoints
  // ==========================================

  router.get(
    '/admin/dashboard',
    requireAuth,
    requireRole('ADMIN'),
    (_req: AuthenticatedRequest, res) => {
      const statsRow = db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM certificates) as total_certificates,
             (SELECT COUNT(*) FROM certificates WHERE status = 'ACTIVE') as active_certificates,
             (SELECT COUNT(*) FROM certificates WHERE status = 'REVOKED') as revoked_certificates,
             (SELECT COUNT(*) FROM students) as total_students,
             (SELECT COUNT(*) FROM verification_logs) as total_verifications`,
        )
        .get() as {
        total_certificates: number;
        active_certificates: number;
        revoked_certificates: number;
        total_students: number;
        total_verifications: number;
      };

      const recentCertificates = db
        .prepare(
          `SELECT
             c.certificate_id,
             c.certificate_type,
             c.title,
             c.issue_date,
             c.status,
             c.is_demo,
             c.created_at,
             s.full_name as student_name,
             s.usn
           FROM certificates c
           JOIN students s ON s.student_id = c.student_id
           ORDER BY c.created_at DESC
           LIMIT 6`,
        )
        .all();

      const recentVerifications = db
        .prepare(
          `SELECT log_id, certificate_id, result, source, verified_at
           FROM verification_logs
           ORDER BY verified_at DESC
           LIMIT 8`,
        )
        .all();

      const byType = db
        .prepare(
          `SELECT certificate_type as name, COUNT(*) as count
           FROM certificates
           GROUP BY certificate_type
           ORDER BY count DESC`,
        )
        .all();

      // Build 7-day activity time series from real DB logs & issuance timestamps
      const dayBuckets: { date: string; label: string; issued: number; verifications: number }[] =
        [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400 * 1000);
        const isoDate = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dayBuckets.push({ date: isoDate, label, issued: 0, verifications: 0 });
      }

      const issuedRows = db
        .prepare(
          `SELECT substr(created_at, 1, 10) as d, COUNT(*) as cnt
           FROM certificates
           GROUP BY d`,
        )
        .all() as { d: string; cnt: number }[];

      const verifRows = db
        .prepare(
          `SELECT substr(verified_at, 1, 10) as d, COUNT(*) as cnt
           FROM verification_logs
           GROUP BY d`,
        )
        .all() as { d: string; cnt: number }[];

      for (const bucket of dayBuckets) {
        const matchIss = issuedRows.find((r) => r.d === bucket.date);
        const matchVer = verifRows.find((r) => r.d === bucket.date);
        if (matchIss) bucket.issued = matchIss.cnt;
        if (matchVer) bucket.verifications = matchVer.cnt;
      }

      const demoRow = db
        .prepare(`SELECT COUNT(*) as cnt FROM certificates WHERE is_demo = 1`)
        .get() as { cnt: number };

      res.json({
        stats: {
          totalCertificates: statsRow.total_certificates,
          activeCertificates: statsRow.active_certificates,
          revokedCertificates: statsRow.revoked_certificates,
          totalStudents: statsRow.total_students,
          totalVerifications: statsRow.total_verifications,
        },
        demoSeeded: demoRow.cnt > 0,
        recentCertificates,
        recentVerifications,
        byType,
        activitySeries: dayBuckets,
      });
    },
  );

  router.post(
    '/admin/demo/seed',
    requireAuth,
    requireRole('ADMIN'),
    async (req: AuthenticatedRequest, res) => {
      const schema = z.object({
        demoStudentPassword: z.string().min(8).max(128).optional().or(z.literal('')),
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid password' });
        return;
      }
      const result = await seedDemonstrationData(
        req.user!,
        getBaseUrl(req),
        parsed.data.demoStudentPassword || undefined,
      );
      res.json({
        message: 'Demonstration records and signed PDFs loaded into database.',
        ...result,
      });
    },
  );

  router.get(
    '/admin/institutions',
    requireAuth,
    requireRole('ADMIN'),
    (_req: AuthenticatedRequest, res) => {
      const institutions = db
        .prepare(`SELECT * FROM institutions ORDER BY is_demo ASC, institution_name ASC`)
        .all();
      res.json({ institutions });
    },
  );

  router.get(
    '/admin/certificate-types',
    requireAuth,
    requireRole('ADMIN'),
    (_req: AuthenticatedRequest, res) => {
      const types = db
        .prepare(`SELECT * FROM certificate_types ORDER BY name ASC`)
        .all();
      res.json({ types });
    },
  );

  router.post(
    '/admin/certificate-types',
    requireAuth,
    requireRole('ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const parsed = certTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid type' });
        return;
      }
      const existing = db
        .prepare(`SELECT type_id FROM certificate_types WHERE LOWER(name) = LOWER(?)`)
        .get(parsed.data.name);
      if (existing) {
        res.status(409).json({ error: 'A certificate type with this name already exists.' });
        return;
      }
      const typeId = newId('type');
      db.prepare(
        `INSERT INTO certificate_types (type_id, name, description, is_active, created_at)
         VALUES (?, ?, ?, 1, ?)`,
      ).run(typeId, parsed.data.name, parsed.data.description, nowIso());

      writeAuditLog(req.user!, 'CERT_TYPE_CREATED', typeId, `Added type: ${parsed.data.name}`);
      res.status(201).json({ typeId });
    },
  );

  router.patch(
    '/admin/certificate-types/:typeId',
    requireAuth,
    requireRole('ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const schema = z.object({ isActive: z.boolean() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid status payload' });
        return;
      }
      const resUpdate = db
        .prepare(`UPDATE certificate_types SET is_active = ? WHERE type_id = ?`)
        .run(parsed.data.isActive ? 1 : 0, req.params.typeId);
      if (resUpdate.changes === 0) {
        res.status(404).json({ error: 'Certificate type not found' });
        return;
      }
      res.json({ updated: true });
    },
  );

  // Student Directory & Registration
  router.get(
    '/admin/students',
    requireAuth,
    requireRole('ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const q = String(req.query.q || '').trim().toLowerCase();
      const rows = db
        .prepare(
          `SELECT
             s.*,
             u.password_reset_requested,
             u.password_reset_requested_at,
             (SELECT COUNT(*) FROM certificates c WHERE c.student_id = s.student_id) as certificate_count
           FROM students s
           LEFT JOIN users u ON u.user_id = s.owner_user_id
           ORDER BY s.created_at DESC`,
        )
        .all() as Array<Record<string, unknown>>;

      const filtered = q
        ? rows.filter(
            (r) =>
              String(r.full_name).toLowerCase().includes(q) ||
              String(r.usn).toLowerCase().includes(q) ||
              String(r.email).toLowerCase().includes(q) ||
              String(r.department).toLowerCase().includes(q),
          )
        : rows;

      res.json({ students: filtered });
    },
  );

  router.post(
    '/admin/students',
    requireAuth,
    requireRole('ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const parsed = studentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid student data' });
        return;
      }
      const data = parsed.data;
      const normalizedEmail = data.email.toLowerCase();
      const normalizedUsn = data.usn.toUpperCase();

      const dupUsn = db
        .prepare(`SELECT student_id FROM students WHERE UPPER(usn) = UPPER(?)`)
        .get(normalizedUsn);
      if (dupUsn) {
        res.status(409).json({ error: `A student with USN ${normalizedUsn} is already registered.` });
        return;
      }

      const dupEmail = db
        .prepare(`SELECT student_id FROM students WHERE LOWER(email) = LOWER(?)`)
        .get(normalizedEmail);
      if (dupEmail) {
        res.status(409).json({ error: `A student with email ${normalizedEmail} is already registered.` });
        return;
      }

      const student = runInTransaction(() => {
        const now = nowIso();
        let ownerUserId: string | null = null;

        const existingUser = db
          .prepare(`SELECT user_id, role FROM users WHERE LOWER(email) = LOWER(?)`)
          .get(normalizedEmail) as { user_id: string; role: string } | undefined;

        if (existingUser) {
          if (existingUser.role === 'ADMIN') {
            throw new Error('EMAIL_IS_ADMIN');
          }
          ownerUserId = existingUser.user_id;
        } else if (data.portalPassword && data.portalPassword.length >= 8) {
          ownerUserId = newId('usr');
          db.prepare(
            `INSERT INTO users (user_id, email, full_name, password_hash, role, created_at)
             VALUES (?, ?, ?, ?, 'STUDENT', ?)`,
          ).run(ownerUserId, normalizedEmail, data.fullName, hashPassword(data.portalPassword), now);
        }

        const studentId = newId('stu');
        db.prepare(
          `INSERT INTO students
           (student_id, full_name, usn, email, department, course, academic_year, graduation_year, owner_user_id, is_demo, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        ).run(
          studentId,
          data.fullName,
          normalizedUsn,
          normalizedEmail,
          data.department,
          data.course,
          data.academicYear,
          data.graduationYear,
          ownerUserId,
          now,
        );

        writeAuditLog(
          req.user!,
          'STUDENT_REGISTERED',
          studentId,
          `Registered student ${data.fullName} (${normalizedUsn})`,
        );

        return db
          .prepare(`SELECT * FROM students WHERE student_id = ?`)
          .get(studentId);
      });

      res.status(201).json({ student });
    },
  );

  router.patch(
    '/admin/students/:studentId',
    requireAuth,
    requireRole('ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const parsed = updateStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid student data' });
        return;
      }
      const data = parsed.data;
      const studentId = req.params.studentId;
      const normalizedEmail = data.email.toLowerCase();
      const normalizedUsn = data.usn.toUpperCase();

      const existing = db
        .prepare(`SELECT * FROM students WHERE student_id = ?`)
        .get(studentId) as { student_id: string; owner_user_id: string | null } | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Student not found' });
        return;
      }

      const dupUsn = db
        .prepare(`SELECT student_id FROM students WHERE UPPER(usn) = UPPER(?) AND student_id != ?`)
        .get(normalizedUsn, studentId);
      if (dupUsn) {
        res.status(409).json({ error: `USN ${normalizedUsn} belongs to another student.` });
        return;
      }

      const dupEmail = db
        .prepare(`SELECT student_id FROM students WHERE LOWER(email) = LOWER(?) AND student_id != ?`)
        .get(normalizedEmail, studentId);
      if (dupEmail) {
        res.status(409).json({ error: `Email ${normalizedEmail} belongs to another student.` });
        return;
      }

      runInTransaction(() => {
        db.prepare(
          `UPDATE students
           SET full_name = ?, usn = ?, email = ?, department = ?, course = ?, academic_year = ?, graduation_year = ?
           WHERE student_id = ?`,
        ).run(
          data.fullName,
          normalizedUsn,
          normalizedEmail,
          data.department,
          data.course,
          data.academicYear,
          data.graduationYear,
          studentId,
        );

        if (existing.owner_user_id) {
          db.prepare(`UPDATE users SET full_name = ?, email = ? WHERE user_id = ?`).run(
            data.fullName,
            normalizedEmail,
            existing.owner_user_id,
          );
        }

        writeAuditLog(
          req.user!,
          'STUDENT_UPDATED',
          studentId,
          `Updated student profile for ${data.fullName} (${normalizedUsn})`,
        );
      });

      const updated = db.prepare(`SELECT * FROM students WHERE student_id = ?`).get(studentId);
      res.json({ student: updated });
    },
  );

  router.post(
    '/admin/students/:studentId/set-password',
    requireAuth,
    requireRole('ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const parsed = setStudentPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid password' });
        return;
      }

      const student = db
        .prepare(`SELECT * FROM students WHERE student_id = ?`)
        .get(req.params.studentId) as
        | {
            student_id: string;
            full_name: string;
            email: string;
            owner_user_id: string | null;
          }
        | undefined;

      if (!student) {
        res.status(404).json({ error: 'Student not found' });
        return;
      }

      runInTransaction(() => {
        const hash = hashPassword(parsed.data.password);
        if (student.owner_user_id) {
          db.prepare(
            `UPDATE users SET password_hash = ?, password_reset_requested = 0 WHERE user_id = ?`,
          ).run(hash, student.owner_user_id);
        } else {
          const userId = newId('usr');
          db.prepare(
            `INSERT INTO users (user_id, email, full_name, password_hash, role, created_at)
             VALUES (?, ?, ?, ?, 'STUDENT', ?)`,
          ).run(userId, student.email, student.full_name, hash, nowIso());
          db.prepare(`UPDATE students SET owner_user_id = ? WHERE student_id = ?`).run(
            userId,
            student.student_id,
          );
        }

        writeAuditLog(
          req.user!,
          'STUDENT_PORTAL_CREDENTIALS_SET',
          student.student_id,
          `Configured portal credentials for ${student.email}`,
        );
      });

      res.json({ message: 'Student portal credentials updated.' });
    },
  );

  // Certificate Issuance (Generate PDF)
  router.post(
    '/admin/certificates/issue',
    requireAuth,
    requireRole('ADMIN'),
    async (req: AuthenticatedRequest, res) => {
      const parsed = issueCertificateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid certificate input' });
        return;
      }

      const data = parsed.data;
      const student = db
        .prepare(`SELECT * FROM students WHERE student_id = ?`)
        .get(data.studentId) as
        | {
            student_id: string;
            full_name: string;
            usn: string;
            department: string;
            course: string;
            academic_year: string;
            is_demo: number;
          }
        | undefined;

      if (!student) {
        res.status(404).json({ error: 'Selected student record does not exist.' });
        return;
      }

      const institution = db
        .prepare(`SELECT * FROM institutions WHERE institution_id = ? AND status = 'AUTHORIZED'`)
        .get(data.institutionId) as
        | {
            institution_id: string;
            institution_name: string;
            verification_authority: string;
            is_demo: number;
          }
        | undefined;

      if (!institution) {
        res.status(404).json({ error: 'Authorized institution not found.' });
        return;
      }

      const isDemo = Boolean(data.isDemo || student.is_demo || institution.is_demo);
      const certificateId = generateCertificateId(isDemo ? 'CT-DEMO' : 'CT');
      const verifyUrl = buildPublicVerifyUrl(getBaseUrl(req), certificateId);

      const pdfResult = await createCertificatePdf({
        certificateId,
        studentName: student.full_name,
        usn: student.usn,
        department: data.department,
        courseName: data.courseName,
        academicYear: data.academicYear,
        certificateType: data.certificateType,
        title: data.title,
        issueDate: data.issueDate,
        issuingAuthority: data.issuingAuthority,
        institutionName: institution.institution_name,
        verificationAuthority: institution.verification_authority,
        verifyUrl,
        isDemo,
      });

      const now = nowIso();
      runInTransaction(() => {
        db.prepare(
          `INSERT INTO certificates
           (certificate_id, student_id, institution_id, certificate_type, title, course_name, department,
            academic_year, issue_date, issuing_authority, pdf_storage_path, pdf_hash, qr_data_url, status,
            issued_by, is_demo, is_uploaded_pdf, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, 0, ?)`,
        ).run(
          certificateId,
          student.student_id,
          institution.institution_id,
          data.certificateType,
          data.title,
          data.courseName,
          data.department,
          data.academicYear,
          data.issueDate,
          data.issuingAuthority,
          pdfResult.pdfStoragePath,
          pdfResult.pdfHash,
          pdfResult.qrDataUrl,
          req.user!.userId,
          isDemo ? 1 : 0,
          now,
        );

        writeAuditLog(
          req.user!,
          'CERTIFICATE_ISSUED',
          certificateId,
          `Issued "${data.title}" (${data.certificateType}) to ${student.full_name} (${student.usn})`,
        );
      });

      res.status(201).json({
        certificate: {
          certificateId,
          studentId: student.student_id,
          studentName: student.full_name,
          usn: student.usn,
          institutionName: institution.institution_name,
          certificateType: data.certificateType,
          title: data.title,
          issueDate: data.issueDate,
          pdfHash: pdfResult.pdfHash,
          qrDataUrl: pdfResult.qrDataUrl,
          verifyUrl,
          status: 'ACTIVE',
          isDemo,
        },
      });
    },
  );

  // Certificate Issuance (Upload existing PDF & stamp QR + SHA-256)
  router.post(
    '/admin/certificates/upload',
    requireAuth,
    requireRole('ADMIN'),
    upload.single('pdf'),
    async (req: AuthenticatedRequest, res) => {
      if (!req.file) {
        res.status(400).json({ error: 'Please attach an existing PDF certificate file.' });
        return;
      }

      const parsed = issueCertificateSchema.safeParse({
        ...req.body,
        isDemo: req.body?.isDemo === 'true' || req.body?.isDemo === true,
      });
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid certificate input' });
        return;
      }

      const data = parsed.data;
      const student = db
        .prepare(`SELECT * FROM students WHERE student_id = ?`)
        .get(data.studentId) as
        | { student_id: string; full_name: string; usn: string; is_demo: number }
        | undefined;
      if (!student) {
        res.status(404).json({ error: 'Selected student record does not exist.' });
        return;
      }

      const institution = db
        .prepare(`SELECT * FROM institutions WHERE institution_id = ? AND status = 'AUTHORIZED'`)
        .get(data.institutionId) as
        | { institution_id: string; institution_name: string; is_demo: number }
        | undefined;
      if (!institution) {
        res.status(404).json({ error: 'Authorized institution not found.' });
        return;
      }

      const isDemo = Boolean(data.isDemo || student.is_demo || institution.is_demo);
      const certificateId = generateCertificateId(isDemo ? 'CT-DEMO' : 'CT');
      const verifyUrl = buildPublicVerifyUrl(getBaseUrl(req), certificateId);

      let pdfResult;
      try {
        pdfResult = await stampUploadedPdf(req.file.buffer, {
          certificateId,
          verifyUrl,
          issueDate: data.issueDate,
          isDemo,
        });
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Unable to process uploaded PDF file.',
        });
        return;
      }

      const now = nowIso();
      runInTransaction(() => {
        db.prepare(
          `INSERT INTO certificates
           (certificate_id, student_id, institution_id, certificate_type, title, course_name, department,
            academic_year, issue_date, issuing_authority, pdf_storage_path, pdf_hash, qr_data_url, status,
            issued_by, is_demo, is_uploaded_pdf, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, 1, ?)`,
        ).run(
          certificateId,
          student.student_id,
          institution.institution_id,
          data.certificateType,
          data.title,
          data.courseName,
          data.department,
          data.academicYear,
          data.issueDate,
          data.issuingAuthority,
          pdfResult.pdfStoragePath,
          pdfResult.pdfHash,
          pdfResult.qrDataUrl,
          req.user!.userId,
          isDemo ? 1 : 0,
          now,
        );

        writeAuditLog(
          req.user!,
          'CERTIFICATE_UPLOADED',
          certificateId,
          `Uploaded & signed PDF "${data.title}" for ${student.full_name} (${student.usn})`,
        );
      });

      res.status(201).json({
        certificate: {
          certificateId,
          studentId: student.student_id,
          studentName: student.full_name,
          usn: student.usn,
          institutionName: institution.institution_name,
          certificateType: data.certificateType,
          title: data.title,
          issueDate: data.issueDate,
          pdfHash: pdfResult.pdfHash,
          qrDataUrl: pdfResult.qrDataUrl,
          verifyUrl,
          status: 'ACTIVE',
          isDemo,
        },
      });
    },
  );

  // Certificate Management (Search, Filter, Pagination)
  router.get(
    '/admin/certificates',
    requireAuth,
    requireRole('ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const q = String(req.query.q || '').trim().toLowerCase();
      const statusFilter = String(req.query.status || 'ALL').toUpperCase();
      const typeFilter = String(req.query.type || 'ALL');
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(50, Math.max(5, Number(req.query.limit || 10)));

      const allRows = db
        .prepare(
          `SELECT
             c.*,
             s.full_name as student_name,
             s.usn,
             s.email as student_email,
             i.institution_name
           FROM certificates c
           JOIN students s ON s.student_id = c.student_id
           JOIN institutions i ON i.institution_id = c.institution_id
           ORDER BY c.created_at DESC`,
        )
        .all() as Array<Record<string, unknown>>;

      const filtered = allRows.filter((row) => {
        if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
        if (typeFilter !== 'ALL' && row.certificate_type !== typeFilter) return false;
        if (q) {
          const match =
            String(row.certificate_id).toLowerCase().includes(q) ||
            String(row.student_name).toLowerCase().includes(q) ||
            String(row.usn).toLowerCase().includes(q) ||
            String(row.title).toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const items = filtered.slice((safePage - 1) * limit, safePage * limit);

      res.json({
        certificates: items,
        pagination: {
          page: safePage,
          limit,
          total,
          totalPages,
        },
      });
    },
  );

  router.post(
    '/admin/certificates/:certificateId/revoke',
    requireAuth,
    requireRole('ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const parsed = revokeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Revocation reason required' });
        return;
      }

      const certId = req.params.certificateId;
      const existing = db
        .prepare(`SELECT certificate_id, status, title FROM certificates WHERE certificate_id = ?`)
        .get(certId) as { certificate_id: string; status: string; title: string } | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Certificate not found' });
        return;
      }
      if (existing.status === 'REVOKED') {
        res.status(409).json({ error: 'Certificate is already revoked.' });
        return;
      }

      const revokedAt = nowIso();
      runInTransaction(() => {
        db.prepare(
          `UPDATE certificates
           SET status = 'REVOKED', revocation_reason = ?, revoked_at = ?
           WHERE certificate_id = ?`,
        ).run(parsed.data.reason, revokedAt, certId);

        writeAuditLog(
          req.user!,
          'CERTIFICATE_REVOKED',
          certId,
          `Revoked "${existing.title}": ${parsed.data.reason}`,
        );
      });

      res.json({
        certificateId: certId,
        status: 'REVOKED',
        revokedAt,
        revocationReason: parsed.data.reason,
      });
    },
  );

  // Verification History & Audit Logs
  router.get(
    '/admin/verifications',
    requireAuth,
    requireRole('ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const resultFilter = String(req.query.result || 'ALL').toUpperCase();
      const q = String(req.query.q || '').trim().toLowerCase();

      const logs = db
        .prepare(
          `SELECT log_id, certificate_id, result, source, verifier_ip_hash, verified_at
           FROM verification_logs
           ORDER BY verified_at DESC
           LIMIT 250`,
        )
        .all() as Array<Record<string, unknown>>;

      const filteredLogs = logs.filter((l) => {
        if (resultFilter !== 'ALL' && l.result !== resultFilter) return false;
        if (q && !String(l.certificate_id).toLowerCase().includes(q)) return false;
        return true;
      });

      const auditLogs = db
        .prepare(
          `SELECT audit_id, actor_email, action, target_id, details, created_at
           FROM audit_logs
           ORDER BY created_at DESC
           LIMIT 100`,
        )
        .all();

      res.json({
        verificationLogs: filteredLogs,
        auditLogs,
      });
    },
  );

  // ==========================================
  // Student Dashboard Endpoints (Strict Ownership)
  // ==========================================

  router.get(
    '/student/me',
    requireAuth,
    requireRole('STUDENT'),
    (req: AuthenticatedRequest, res) => {
      const student = db
        .prepare(`SELECT * FROM students WHERE owner_user_id = ?`)
        .get(req.user!.userId) as Record<string, unknown> | undefined;

      if (!student) {
        res.status(404).json({ error: 'Student academic profile is not linked to this account.' });
        return;
      }

      const certificates = db
        .prepare(
          `SELECT
             c.*,
             i.institution_name,
             i.verification_authority
           FROM certificates c
           JOIN institutions i ON i.institution_id = c.institution_id
           WHERE c.student_id = ?
           ORDER BY c.issue_date DESC, c.created_at DESC`,
        )
        .all(String(student.student_id));

      res.json({
        student,
        certificates,
      });
    },
  );

  // ==========================================
  // Authenticated Certificate Access & PDF Download
  // ==========================================

  router.get('/certificates/:certificateId', requireAuth, (req: AuthenticatedRequest, res) => {
    const cert = db
      .prepare(
        `SELECT
           c.*,
           s.full_name as student_name,
           s.usn,
           s.email as student_email,
           s.owner_user_id,
           i.institution_name,
           i.verification_authority
         FROM certificates c
         JOIN students s ON s.student_id = c.student_id
         JOIN institutions i ON i.institution_id = c.institution_id
         WHERE c.certificate_id = ?`,
      )
      .get(req.params.certificateId) as Record<string, unknown> | undefined;

    if (!cert) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    if (req.user!.role === 'STUDENT' && cert.owner_user_id !== req.user!.userId) {
      res.status(403).json({ error: 'You may only access your own certificate records.' });
      return;
    }

    res.json({
      certificate: cert,
      verifyUrl: buildPublicVerifyUrl(getBaseUrl(req), String(cert.certificate_id)),
    });
  });

  router.get('/certificates/:certificateId/download', requireAuth, (req: AuthenticatedRequest, res) => {
    const cert = db
      .prepare(
        `SELECT
           c.certificate_id,
           c.pdf_storage_path,
           s.owner_user_id
         FROM certificates c
         JOIN students s ON s.student_id = c.student_id
         WHERE c.certificate_id = ?`,
      )
      .get(req.params.certificateId) as
      | { certificate_id: string; pdf_storage_path: string; owner_user_id: string | null }
      | undefined;

    if (!cert) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    if (req.user!.role === 'STUDENT' && cert.owner_user_id !== req.user!.userId) {
      res.status(403).json({ error: 'You are not authorized to download this certificate.' });
      return;
    }

    let safePath: string;
    try {
      safePath = resolveSafeStoragePath(cert.pdf_storage_path);
    } catch {
      res.status(400).json({ error: 'Invalid certificate file path' });
      return;
    }

    if (!fs.existsSync(safePath)) {
      res.status(404).json({ error: 'Certificate PDF file not found in protected storage.' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="CertiTrust-${cert.certificate_id}.pdf"`,
    );
    fs.createReadStream(safePath).pipe(res);
  });

  return router;
}
