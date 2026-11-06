import { Lead } from '../types';
import { maskPhoneNumber } from './validators';

/**
 * Characters that trigger formula execution in Microsoft Excel, LibreOffice Calc, or Google Sheets.
 * When an untrusted cell begins with any of these characters (even after leading whitespace/tabs/returns),
 * spreadsheet applications may evaluate it as an executable formula or command.
 */
const FORMULA_TRIGGER_CHARS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Neutralizes formula injection (CSV Injection) and escapes strings according to RFC 4180.
 *
 * 1. Sanitizes formula triggers:
 *    Prepends a single quote (') if the trimmed string begins with '=', '+', '-', '@', '\t', or '\r'.
 * 2. RFC 4180 Escaping:
 *    If the field contains commas, double quotes, carriage returns, newlines, or leading/trailing whitespace,
 *    it is enclosed in double quotes with internal double quotes escaped as `""`.
 */
export function sanitizeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Numbers are strictly safe from formula injection in our schema (scores, durations, ranks)
  if (typeof value === 'number') {
    if (isNaN(value)) return '0';
    return String(value);
  }

  let str = String(value);

  // Check if string (or trimmed string) begins with a formula trigger
  const trimmed = str.trimStart();
  const startsWithTrigger =
    FORMULA_TRIGGER_CHARS.some((char) => str.startsWith(char)) ||
    FORMULA_TRIGGER_CHARS.some((char) => trimmed.startsWith(char));

  if (startsWithTrigger) {
    str = `'${str}`;
  }

  // RFC 4180 escaping: check if field needs double quote enclosure
  const needsQuotes =
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r') ||
    startsWithTrigger ||
    str.startsWith(' ') ||
    str.endsWith(' ');

  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generates a safe, predictable filename in the format `quizvibe_leads_{YYYYMMDD}.csv`
 * per Story 4.7 Acceptance Criteria.
 */
export function generateCsvFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `quizvibe_leads_${yyyy}${mm}${dd}.csv`;
}

/**
 * Formats ISO timestamp to Vietnamese localized date/time representation.
 */
export function formatCsvDateTime(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export interface CsvExportOptions {
  /**
   * If true, exports raw phone numbers.
   * If false or omitted (default), uses the privacy-preserving masked phone number (`maskPhoneNumber()`).
   */
  unmasked?: boolean;
}

/**
 * Standard CSV Header columns defined by Story 4.7 / FR-602 / PRD:
 * `STT, Họ và Tên, Số điện thoại, Điểm số, Thời gian (giây), Ngày tham gia, Mã Voucher`
 */
export const CSV_HEADERS = [
  'STT',
  'Họ và Tên',
  'Số điện thoại',
  'Điểm số',
  'Thời gian (giây)',
  'Ngày tham gia',
  'Mã Voucher',
];

/**
 * Converts an array of Lead objects into a valid RFC 4180 CSV string with Vietnamese headers.
 * Does not mutate input data.
 */
export function generateLeadsCsv(leads: Lead[], options: CsvExportOptions = {}): string {
  const headerLine = CSV_HEADERS.map(sanitizeCsvField).join(',');
  const lines: string[] = [headerLine];

  leads.forEach((lead, index) => {
    const stt = index + 1;
    const fullName = lead.fullName ?? '';
    const phone = options.unmasked
      ? lead.phoneNumber
      : maskPhoneNumber(lead.phoneNumber);
    const score = typeof lead.score === 'number' ? lead.score : 0;
    const timeTaken = typeof lead.timeTakenSeconds === 'number' ? lead.timeTakenSeconds : 0;
    const submittedAt = formatCsvDateTime(lead.submittedAt);
    const voucher = lead.voucherCode || '';

    const row = [
      sanitizeCsvField(stt),
      sanitizeCsvField(fullName),
      sanitizeCsvField(phone),
      sanitizeCsvField(score),
      sanitizeCsvField(timeTaken),
      sanitizeCsvField(submittedAt),
      sanitizeCsvField(voucher),
    ].join(',');

    lines.push(row);
  });

  return lines.join('\r\n') + '\r\n';
}

/**
 * Initiates browser download of CSV content with UTF-8 BOM (`\uFEFF`)
 * per Architectural Decision AD-6 (ARCH-6).
 * Handles resource cleanup (URL.revokeObjectURL) safely.
 */
export function downloadCsvFile(content: string, filename: string): boolean {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    // AD-6 (ARCH-6): Prepend UTF-8 BOM (\uFEFF) to prevent mojibake in Microsoft Excel
    const bom = '\uFEFF';
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Schedule cleanup of the object URL
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore cleanup errors
      }
    }, 100);

    return true;
  } catch (err) {
    console.error('[CsvExport] Failed to initiate CSV download:', err);
    return false;
  }
}

/**
 * End-to-end export helper: generates CSV from leads and triggers download.
 */
export function exportLeadsToCsvFile(
  leads: Lead[],
  options: CsvExportOptions & { filename?: string } = {}
): boolean {
  try {
    const csvContent = generateLeadsCsv(leads, options);
    const filename = options.filename || generateCsvFilename();
    return downloadCsvFile(csvContent, filename);
  } catch (err) {
    console.error('[CsvExport] Error in exportLeadsToCsvFile:', err);
    return false;
  }
}
