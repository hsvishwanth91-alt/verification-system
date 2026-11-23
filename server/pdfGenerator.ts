import crypto from 'node:crypto';
import fs from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { resolveSafeStoragePath } from './db.ts';

export interface CertificatePdfPayload {
  certificateId: string;
  studentName: string;
  usn: string;
  department: string;
  courseName: string;
  academicYear: string;
  certificateType: string;
  title: string;
  issueDate: string;
  issuingAuthority: string;
  institutionName: string;
  verificationAuthority: string;
  verifyUrl: string;
  isDemo: boolean;
}

export interface GeneratedPdfResult {
  pdfStoragePath: string;
  pdfHash: string;
  qrDataUrl: string;
}

const NAVY = rgb(0.043, 0.122, 0.227); // #0B1F3A
const TEAL = rgb(0.051, 0.580, 0.533); // #0D9488
const SLATE_DARK = rgb(0.118, 0.161, 0.231);
const SLATE_MUTED = rgb(0.392, 0.455, 0.545);
const PARCHMENT = rgb(0.992, 0.992, 0.986);
const DEMO_RED = rgb(0.725, 0.110, 0.110);

export function generateCertificateId(prefix = 'CT'): string {
  const year = new Date().getUTCFullYear();
  const partA = crypto.randomBytes(3).toString('hex').toUpperCase();
  const partB = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${year}-${partA}-${partB}`;
}

export function buildPublicVerifyUrl(baseUrl: string, certificateId: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/verify/${encodeURIComponent(certificateId)}`;
}

export async function generateQrArtifacts(verifyUrl: string): Promise<{
  qrDataUrl: string;
  qrPngBuffer: Buffer;
}> {
  const options: QRCode.QRCodeToDataURLOptions = {
    width: 300,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0B1F3A',
      light: '#FFFFFF',
    },
  };
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, options);
  const qrPngBuffer = await QRCode.toBuffer(verifyUrl, {
    width: 300,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0B1F3A',
      light: '#FFFFFF',
    },
  });
  return { qrDataUrl, qrPngBuffer };
}

function centerX(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, pageWidth: number): number {
  const w = font.widthOfTextAtSize(text, size);
  return Math.max(40, (pageWidth - w) / 2);
}

function safeAscii(input: string): string {
  // Standard pdf-lib WinAnsi fonts handle Latin-1 cleanly; normalize smart quotes/dashes
  return input
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\xFF]/g, ' ');
}

export async function createCertificatePdf(
  payload: CertificatePdfPayload,
): Promise<GeneratedPdfResult> {
  const { qrDataUrl, qrPngBuffer } = await generateQrArtifacts(payload.verifyUrl);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${safeAscii(payload.title)} - ${payload.certificateId}`);
  pdfDoc.setAuthor(safeAscii(payload.institutionName));
  pdfDoc.setSubject(`Verified Academic Credential (${payload.certificateId})`);
  pdfDoc.setCreator('CertiTrust Digital Certificate Verification System');

  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const fontDisplay = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontSansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSans = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  // Archival background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: PARCHMENT,
  });

  // Outer institutional navy border
  page.drawRectangle({
    x: 24,
    y: 24,
    width: pageWidth - 48,
    height: pageHeight - 48,
    borderColor: NAVY,
    borderWidth: 2.5,
  });

  // Inner teal hairline border
  page.drawRectangle({
    x: 33,
    y: 33,
    width: pageWidth - 66,
    height: pageHeight - 66,
    borderColor: TEAL,
    borderWidth: 1,
  });

  // Corner geometric accents
  const corners = [
    [33, pageHeight - 33],
    [pageWidth - 33, pageHeight - 33],
    [33, 33],
    [pageWidth - 33, 33],
  ];
  for (const [cx, cy] of corners) {
    page.drawCircle({
      x: cx,
      y: cy,
      size: 4,
      color: NAVY,
    });
  }

  let cursorY = pageHeight - 76;

  // Demo Banner
  if (payload.isDemo) {
    const bannerText = 'DEMO — NOT AN OFFICIAL CREDENTIAL';
    const bw = 340;
    const bx = (pageWidth - bw) / 2;
    page.drawRectangle({
      x: bx,
      y: pageHeight - 62,
      width: bw,
      height: 20,
      color: rgb(0.996, 0.949, 0.949),
      borderColor: DEMO_RED,
      borderWidth: 1,
    });
    const textSafe = safeAscii(bannerText);
    page.drawText(textSafe, {
      x: centerX(textSafe, fontSansBold, 9.5, pageWidth),
      y: pageHeight - 55,
      size: 9.5,
      font: fontSansBold,
      color: DEMO_RED,
    });
    cursorY = pageHeight - 92;
  }

  // Institution Header
  const instName = safeAscii(payload.institutionName.toUpperCase());
  page.drawText(instName, {
    x: centerX(instName, fontSansBold, 16, pageWidth),
    y: cursorY,
    size: 16,
    font: fontSansBold,
    color: NAVY,
  });
  cursorY -= 18;

  const authText = safeAscii(payload.verificationAuthority);
  page.drawText(authText, {
    x: centerX(authText, fontSans, 10, pageWidth),
    y: cursorY,
    size: 10,
    font: fontSans,
    color: SLATE_MUTED,
  });
  cursorY -= 18;

  // Subtle divider
  page.drawLine({
    start: { x: 220, y: cursorY },
    end: { x: pageWidth - 220, y: cursorY },
    thickness: 0.75,
    color: TEAL,
  });
  cursorY -= 26;

  // Certificate Type Kicker
  const typeLabel = safeAscii(payload.certificateType.toUpperCase());
  page.drawText(typeLabel, {
    x: centerX(typeLabel, fontSansBold, 11, pageWidth),
    y: cursorY,
    size: 11,
    font: fontSansBold,
    color: TEAL,
  });
  cursorY -= 32;

  // Title
  const certTitle = safeAscii(payload.title);
  const titleSize = certTitle.length > 48 ? 19 : 23;
  page.drawText(certTitle, {
    x: centerX(certTitle, fontDisplay, titleSize, pageWidth),
    y: cursorY,
    size: titleSize,
    font: fontDisplay,
    color: NAVY,
  });
  cursorY -= 32;

  // Preamble
  const preamble = 'This is to officially certify that';
  page.drawText(preamble, {
    x: centerX(preamble, fontSerif, 13, pageWidth),
    y: cursorY,
    size: 13,
    font: fontSerif,
    color: SLATE_DARK,
  });
  cursorY -= 34;

  // Student Full Name
  const studentName = safeAscii(payload.studentName);
  page.drawText(studentName, {
    x: centerX(studentName, fontDisplay, 28, pageWidth),
    y: cursorY,
    size: 28,
    font: fontDisplay,
    color: NAVY,
  });
  cursorY -= 10;

  // Underline under name
  page.drawLine({
    start: { x: 250, y: cursorY },
    end: { x: pageWidth - 250, y: cursorY },
    thickness: 0.75,
    color: rgb(0.796, 0.835, 0.882),
  });
  cursorY -= 22;

  // Academic Details
  const usnLine = safeAscii(`University Seat Number (USN): ${payload.usn}`);
  page.drawText(usnLine, {
    x: centerX(usnLine, fontMono, 10.5, pageWidth),
    y: cursorY,
    size: 10.5,
    font: fontMono,
    color: SLATE_MUTED,
  });
  cursorY -= 24;

  const programLine = safeAscii(
    `has successfully fulfilled the academic requirements for ${payload.courseName}`,
  );
  page.drawText(programLine, {
    x: centerX(programLine, fontSerif, 12.5, pageWidth),
    y: cursorY,
    size: 12.5,
    font: fontSerif,
    color: SLATE_DARK,
  });
  cursorY -= 20;

  const deptLine = safeAscii(
    `Department of ${payload.department}  |  Academic Year ${payload.academicYear}`,
  );
  page.drawText(deptLine, {
    x: centerX(deptLine, fontSans, 11, pageWidth),
    y: cursorY,
    size: 11,
    font: fontSans,
    color: SLATE_MUTED,
  });

  // Bottom 3-Column Credential Footer (Seal | Signature | QR Code)
  const footerBaseY = 82;

  // Left: Vector Seal
  const sealX = 128;
  const sealY = footerBaseY + 38;
  page.drawCircle({
    x: sealX,
    y: sealY,
    size: 36,
    borderColor: NAVY,
    borderWidth: 2,
    color: rgb(0.953, 0.969, 0.988),
  });
  page.drawCircle({
    x: sealX,
    y: sealY,
    size: 30,
    borderColor: TEAL,
    borderWidth: 1,
  });
  page.drawText('CERTITRUST', {
    x: sealX - fontSansBold.widthOfTextAtSize('CERTITRUST', 7) / 2,
    y: sealY + 4,
    size: 7,
    font: fontSansBold,
    color: NAVY,
  });
  page.drawText('OFFICIAL SEAL', {
    x: sealX - fontSans.widthOfTextAtSize('OFFICIAL SEAL', 6.5) / 2,
    y: sealY - 7,
    size: 6.5,
    font: fontSans,
    color: TEAL,
  });

  // Center: Issuing Authority & Issue Date
  const sigCenterX = pageWidth / 2;
  page.drawLine({
    start: { x: sigCenterX - 110, y: footerBaseY + 40 },
    end: { x: sigCenterX + 110, y: footerBaseY + 40 },
    thickness: 1,
    color: NAVY,
  });
  const sigText = safeAscii(payload.issuingAuthority);
  page.drawText(sigText, {
    x: sigCenterX - fontSansBold.widthOfTextAtSize(sigText, 10.5) / 2,
    y: footerBaseY + 25,
    size: 10.5,
    font: fontSansBold,
    color: NAVY,
  });
  const dateLabel = safeAscii(`Issued on ${payload.issueDate}`);
  page.drawText(dateLabel, {
    x: sigCenterX - fontSans.widthOfTextAtSize(dateLabel, 9.5) / 2,
    y: footerBaseY + 11,
    size: 9.5,
    font: fontSans,
    color: SLATE_MUTED,
  });

  // Right: Embedded Scannable QR Code
  const qrImage = await pdfDoc.embedPng(qrPngBuffer);
  const qrSize = 78;
  const qrBoxX = pageWidth - 156;
  const qrBoxY = footerBaseY + 8;

  page.drawRectangle({
    x: qrBoxX - 5,
    y: qrBoxY - 5,
    width: qrSize + 10,
    height: qrSize + 10,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.796, 0.835, 0.882),
    borderWidth: 1,
  });

  page.drawImage(qrImage, {
    x: qrBoxX,
    y: qrBoxY,
    width: qrSize,
    height: qrSize,
  });

  const scanLabel = 'SCAN TO VERIFY';
  page.drawText(scanLabel, {
    x: qrBoxX + qrSize / 2 - fontSansBold.widthOfTextAtSize(scanLabel, 7) / 2,
    y: qrBoxY - 16,
    size: 7,
    font: fontSansBold,
    color: TEAL,
  });

  // Bottom Registry Line
  const registryLine = safeAscii(
    `Certificate ID: ${payload.certificateId}   |   Verify at: ${payload.verifyUrl}`,
  );
  page.drawText(registryLine, {
    x: centerX(registryLine, fontMono, 7.5, pageWidth),
    y: 44,
    size: 7.5,
    font: fontMono,
    color: SLATE_MUTED,
  });

  // Finalize PDF bytes FIRST, then calculate SHA-256 (avoids circular hashing!)
  const pdfBytes = await pdfDoc.save();
  const pdfHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');

  const fileName = `${payload.certificateId}.pdf`;
  const targetPath = resolveSafeStoragePath(fileName);
  fs.writeFileSync(targetPath, pdfBytes);

  return {
    pdfStoragePath: fileName,
    pdfHash,
    qrDataUrl,
  };
}

export async function stampUploadedPdf(
  uploadedBytes: Buffer,
  params: {
    certificateId: string;
    verifyUrl: string;
    issueDate: string;
    isDemo: boolean;
  },
): Promise<GeneratedPdfResult> {
  // Verify PDF magic header
  if (uploadedBytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Uploaded file is not a valid PDF document');
  }

  const pdfDoc = await PDFDocument.load(uploadedBytes);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error('Uploaded PDF contains no pages');
  }

  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();
  const { qrDataUrl, qrPngBuffer } = await generateQrArtifacts(params.verifyUrl);
  const qrImage = await pdfDoc.embedPng(qrPngBuffer);
  const fontSansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  if (params.isDemo) {
    firstPage.drawRectangle({
      x: 24,
      y: height - 34,
      width: Math.min(340, width - 48),
      height: 18,
      color: rgb(0.996, 0.949, 0.949),
      borderColor: DEMO_RED,
      borderWidth: 1,
    });
    firstPage.drawText('DEMO — NOT AN OFFICIAL CREDENTIAL', {
      x: 34,
      y: height - 28,
      size: 8.5,
      font: fontSansBold,
      color: DEMO_RED,
    });
  }

  // Stamp verification card in bottom-right corner
  const cardW = 195;
  const cardH = 74;
  const cardX = Math.max(16, width - cardW - 20);
  const cardY = 18;

  firstPage.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    color: rgb(1, 1, 1),
    borderColor: NAVY,
    borderWidth: 1.2,
  });

  firstPage.drawImage(qrImage, {
    x: cardX + 7,
    y: cardY + 7,
    width: 60,
    height: 60,
  });

  firstPage.drawText('CERTITRUST VERIFIED', {
    x: cardX + 74,
    y: cardY + 53,
    size: 8,
    font: fontSansBold,
    color: TEAL,
  });

  firstPage.drawText(safeAscii(params.certificateId), {
    x: cardX + 74,
    y: cardY + 38,
    size: 7.5,
    font: fontMono,
    color: NAVY,
  });

  firstPage.drawText(safeAscii(`Issued: ${params.issueDate}`), {
    x: cardX + 74,
    y: cardY + 25,
    size: 7.5,
    font: fontMono,
    color: SLATE_MUTED,
  });

  firstPage.drawText('Scan QR to check status', {
    x: cardX + 74,
    y: cardY + 13,
    size: 6.5,
    font: fontSansBold,
    color: SLATE_MUTED,
  });

  const finalBytes = await pdfDoc.save();
  const pdfHash = crypto.createHash('sha256').update(finalBytes).digest('hex');

  const fileName = `${params.certificateId}.pdf`;
  const targetPath = resolveSafeStoragePath(fileName);
  fs.writeFileSync(targetPath, finalBytes);

  return {
    pdfStoragePath: fileName,
    pdfHash,
    qrDataUrl,
  };
}
