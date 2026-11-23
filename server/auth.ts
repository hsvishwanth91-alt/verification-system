import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db, newId, nowIso } from './db.ts';

export type UserRole = 'ADMIN' | 'STUDENT';

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

const SESSION_SECRET =
  process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export function isEnvAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL?.trim() && process.env.ADMIN_PASSWORD?.trim());
}

export function needsInitialAdminSetup(): boolean {
  if (isEnvAdminConfigured()) return false;
  const row = db
    .prepare(`SELECT COUNT(*) as cnt FROM users WHERE role = 'ADMIN'`)
    .get() as { cnt: number };
  return row.cnt === 0;
}

export function verifyEnvAdminCredentials(email: string, password: string): AuthUser | null {
  const envEmail = process.env.ADMIN_EMAIL?.trim();
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (!envEmail || !envPass) return null;

  if (
    timingSafeStringEqual(email.trim().toLowerCase(), envEmail.toLowerCase()) &&
    timingSafeStringEqual(password, envPass)
  ) {
    const existing = db
      .prepare(`SELECT user_id, email, full_name, role FROM users WHERE LOWER(email) = LOWER(?)`)
      .get(envEmail) as
      | { user_id: string; email: string; full_name: string; role: UserRole }
      | undefined;

    if (existing) {
      return {
        userId: existing.user_id,
        email: existing.email,
        fullName: existing.full_name,
        role: 'ADMIN',
      };
    }

    const userId = newId('usr');
    db.prepare(
      `INSERT INTO users (user_id, email, full_name, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, 'ADMIN', ?)`,
    ).run(userId, envEmail.toLowerCase(), 'Primary Registrar Admin', hashPassword(envPass), nowIso());

    return {
      userId,
      email: envEmail.toLowerCase(),
      fullName: 'Primary Registrar Admin',
      role: 'ADMIN',
    };
  }
  return null;
}

export function signSessionToken(user: AuthUser): string {
  const payload = {
    userId: user.userId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): AuthUser | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      userId?: string;
      email?: string;
      fullName?: string;
      role?: UserRole;
      exp?: number;
    };
    if (!parsed.userId || !parsed.email || !parsed.role || !parsed.exp) return null;
    if (Date.now() > parsed.exp) return null;

    const dbUser = db
      .prepare(`SELECT user_id, email, full_name, role FROM users WHERE user_id = ?`)
      .get(parsed.userId) as
      | { user_id: string; email: string; full_name: string; role: UserRole }
      | undefined;

    if (!dbUser || dbUser.role !== parsed.role) return null;

    return {
      userId: dbUser.user_id,
      email: dbUser.email,
      fullName: dbUser.full_name,
      role: dbUser.role,
    };
  } catch {
    return null;
  }
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const user = verifySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }
  req.user = user;
  next();
}

export function requireRole(role: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ error: 'Insufficient permissions for this resource' });
      return;
    }
    next();
  };
}

export function writeAuditLog(
  actor: { userId: string; email: string },
  action: string,
  targetId: string | null,
  details: string,
) {
  db.prepare(
    `INSERT INTO audit_logs (audit_id, actor_user_id, actor_email, action, target_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(newId('aud'), actor.userId, actor.email, action, targetId, details, nowIso());
}

export function hashIp(ip: string | undefined): string {
  const raw = ip || 'unknown';
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}
