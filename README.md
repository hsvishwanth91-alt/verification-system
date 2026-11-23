# CertiTrust — Digital Certificate Verification System

CertiTrust is a full-stack web platform for educational institutions to issue, manage, download, and cryptographically verify academic certificates.

## Architecture & Technology Choices

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, React Router, Recharts, Lucide React, `jsQR` (camera + image QR scanning).
- **Backend:** Express.js (`server.ts`) running with Vite middleware in development and static `dist/` serving in production.
- **Persistent Database:** Node.js built-in SQLite (`node:sqlite` / `DatabaseSync`) stored at `data/certitrust.db` with WAL mode, foreign keys, and indexed tables (`users`, `institutions`, `certificate_types`, `students`, `certificates`, `verification_logs`, `audit_logs`). *(Used in place of external Firebase Admin / Storage services because starter preview environments do not expose server-side IAM credentials for Firebase Admin SDK or Firebase Storage; SQLite + confined local storage delivers full server-side RBAC, PDF integrity storage, and atomic transactions out of the box.)*
- **PDF & QR Pipeline:** `pdf-lib` generates landscape archival PDFs (or stamps existing uploaded PDFs) with an embedded scannable QR code (`qrcode`) pointing to `/verify/:certificateId`. SHA-256 digests are calculated strictly **after** the finalized PDF bytes are produced.
- **Security Controls:**
  - `scrypt` per-user salted password hashing with `crypto.timingSafeEqual`
  - HMAC-SHA256 Bearer session tokens stored in React memory (never `localStorage`)
  - Role-based authorization (`ADMIN` vs `STUDENT`) enforced on every protected API endpoint
  - Rate-limited public verification (`/api/verify/*`) and auth endpoints
  - Path-confined certificate PDF storage (`data/certificates/`)
  - Privacy-safe public lookup (discloses only institutional validity and credential facts, hiding student email/USN)

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (optional — copy `.env.example` to `.env` if setting `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `APP_URL`).
   - If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are unset, visit `/admin/login` on first launch to complete **Initial Administrator Onboarding** directly in the UI.
3. Start development server on port 3000:
   ```bash
   npm run dev
   ```

## Demonstration Mode

During first-run Administrator Onboarding (or from the Administrator Dashboard), select **Load Demo Data** to populate:
- 3 watermarked demonstration students (`DEMO-2026-CS001`, `DEMO-2026-EC014`, `DEMO-2026-ME008`)
- 3 signed demonstration PDFs on disk (`CT-DEMO-2026-A101` Active, `CT-DEMO-2026-B202` Active, `CT-DEMO-2026-R303` Revoked) — each clearly stamped `DEMO — NOT AN OFFICIAL CREDENTIAL`
- Sample verification history records

## Production Build & Deployment

```bash
npm run build
NODE_ENV=production npm start
```
Ensure `APP_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (and optionally `DATABASE_PATH` mounted on persistent storage) are set in your deployment environment secrets.
