import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), 'data');
const configuredDbPath = process.env.DATABASE_PATH?.trim();
const dbFilePath = configuredDbPath
  ? path.resolve(configuredDbPath)
  : path.join(DEFAULT_DATA_DIR, 'certitrust.db');

export const DATA_DIR = path.dirname(dbFilePath);
export const CERT_STORAGE_DIR = path.join(DATA_DIR, 'certificates');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(CERT_STORAGE_DIR, { recursive: true });

export const db = new DatabaseSync(dbFilePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'STUDENT')),
    password_reset_requested INTEGER NOT NULL DEFAULT 0,
    password_reset_requested_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS institutions (
    institution_id TEXT PRIMARY KEY,
    institution_name TEXT NOT NULL,
    verification_authority TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('AUTHORIZED', 'SUSPENDED')),
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS certificate_types (
    type_id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    usn TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    course TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    graduation_year INTEGER NOT NULL,
    owner_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS certificates (
    certificate_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
    institution_id TEXT NOT NULL REFERENCES institutions(institution_id) ON DELETE RESTRICT,
    certificate_type TEXT NOT NULL,
    title TEXT NOT NULL,
    course_name TEXT NOT NULL,
    department TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    issuing_authority TEXT NOT NULL,
    pdf_storage_path TEXT NOT NULL,
    pdf_hash TEXT NOT NULL,
    qr_data_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
    revocation_reason TEXT,
    issued_by TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    is_demo INTEGER NOT NULL DEFAULT 0,
    is_uploaded_pdf INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    revoked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS verification_logs (
    log_id TEXT PRIMARY KEY,
    certificate_id TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('VALID', 'REVOKED', 'NOT_FOUND', 'HASH_MISMATCH', 'UNAUTHORIZED_INSTITUTION')),
    source TEXT NOT NULL DEFAULT 'WEB' CHECK (source IN ('WEB', 'QR_SCAN', 'FILE_HASH_CHECK')),
    verifier_ip_hash TEXT NOT NULL,
    verified_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_students_usn ON students(usn);
  CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
  CREATE INDEX IF NOT EXISTS idx_students_owner ON students(owner_user_id);
  CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);
  CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
  CREATE INDEX IF NOT EXISTS idx_certificates_created ON certificates(created_at);
  CREATE INDEX IF NOT EXISTS idx_certificates_hash ON certificates(pdf_hash);
  CREATE INDEX IF NOT EXISTS idx_verification_logs_cert ON verification_logs(certificate_id);
  CREATE INDEX IF NOT EXISTS idx_verification_logs_time ON verification_logs(verified_at);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(created_at);
`);

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function runInTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function resolveSafeStoragePath(fileName: string): string {
  const safeName = path.basename(fileName);
  const resolved = path.resolve(CERT_STORAGE_DIR, safeName);
  if (!resolved.startsWith(CERT_STORAGE_DIR + path.sep)) {
    throw new Error('Invalid certificate storage path');
  }
  return resolved;
}

function seedCoreCatalog() {
  const now = nowIso();

  const insertInst = db.prepare(`
    INSERT OR IGNORE INTO institutions (institution_id, institution_name, verification_authority, status, is_demo, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertInst.run(
    'inst_meridian',
    'Meridian University',
    'Office of the University Registrar',
    'AUTHORIZED',
    0,
    now,
  );
  insertInst.run(
    'inst_demo_sterling',
    'Sterling Institute of Technology (Demo Evaluation)',
    'Office of Academic Credentials — Demo Sandbox',
    'AUTHORIZED',
    1,
    now,
  );

  const defaultTypes = [
    ['type_degree', 'Degree Certificate', 'Official conferral of undergraduate or graduate academic degree.'],
    ['type_course', 'Course Completion Certificate', 'Verification of successful completion of an accredited academic course or module.'],
    ['type_internship', 'Internship Certificate', 'Verified industrial or research internship completed under faculty supervision.'],
    ['type_workshop', 'Workshop Certificate', 'Attendance and practical assessment in a specialized technical workshop.'],
    ['type_achievement', 'Achievement Certificate', 'Merit distinction, dean list honor, or academic competition award.'],
    ['type_participation', 'Participation Certificate', 'Verified participation in university symposiums, hackathons, or seminars.'],
  ];

  const insertType = db.prepare(`
    INSERT OR IGNORE INTO certificate_types (type_id, name, description, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `);
  for (const [id, name, desc] of defaultTypes) {
    insertType.run(id, name, desc, now);
  }
}

seedCoreCatalog();
