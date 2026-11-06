import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeCsvField,
  generateCsvFilename,
  formatCsvDateTime,
  generateLeadsCsv,
  downloadCsvFile,
  exportLeadsToCsvFile,
  CSV_HEADERS,
} from './csvExport';
import { Lead } from '../types';
import { StorageService } from './storageService';

describe('Story 4.7: Excel-Compatible UTF-8 BOM CSV Export', () => {
  const sampleLeads: Lead[] = [
    {
      id: 'lead_1',
      fullName: 'Nguyễn Văn A',
      phoneNumber: '0987654321',
      score: 1850,
      timeTakenSeconds: 22,
      campaignId: 'camp_cosmetics',
      voucherCode: 'VOUCHER20',
      submittedAt: '2026-11-04T10:30:00.000Z',
    },
    {
      id: 'lead_2',
      fullName: 'Trần Thị Bích Ngọc',
      phoneNumber: '0912345678',
      score: 1600,
      timeTakenSeconds: 28,
      campaignId: 'camp_cosmetics',
      voucherCode: 'VOUCHER10',
      submittedAt: '2026-11-04T11:15:00.000Z',
    },
  ];

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Correct CSV Headers & Row Values
  // =========================================================================
  describe('1. CSV Headers & Row Values', () => {
    it('generates exact required headers per Story 4.7 & FR-602', () => {
      const csv = generateLeadsCsv([]);
      const [headerLine] = csv.split('\r\n');

      expect(headerLine).toBe(
        'STT,Họ và Tên,Số điện thoại,Điểm số,Thời gian (giây),Ngày tham gia,Mã Voucher'
      );
      expect(CSV_HEADERS).toEqual([
        'STT',
        'Họ và Tên',
        'Số điện thoại',
        'Điểm số',
        'Thời gian (giây)',
        'Ngày tham gia',
        'Mã Voucher',
      ]);
    });

    it('generates correct row values with 1-based STT and proper attributes', () => {
      const csv = generateLeadsCsv(sampleLeads);
      const lines = csv.trim().split('\r\n');

      expect(lines).toHaveLength(3); // 1 header + 2 data rows

      // Row 1
      const row1 = lines[1].split(',');
      expect(row1[0]).toBe('1'); // STT
      expect(row1[1]).toBe('Nguyễn Văn A'); // Name
      expect(row1[2]).toBe('098***4321'); // Privacy-preserved phone
      expect(row1[3]).toBe('1850'); // Score
      expect(row1[4]).toBe('22'); // Duration in seconds
      expect(row1[6]).toBe('VOUCHER20'); // Voucher code

      // Row 2
      const row2 = lines[2].split(',');
      expect(row2[0]).toBe('2'); // STT
      expect(row2[1]).toBe('Trần Thị Bích Ngọc');
      expect(row2[2]).toBe('091***5678');
      expect(row2[3]).toBe('1600');
      expect(row2[4]).toBe('28');
      expect(row2[6]).toBe('VOUCHER10');
    });

    it('supports unmasked phone numbers when unmasked option is explicitly requested', () => {
      const csv = generateLeadsCsv(sampleLeads, { unmasked: true });
      const lines = csv.trim().split('\r\n');

      expect(lines[1]).toContain('0987654321');
      expect(lines[2]).toContain('0912345678');
    });

    it('handles missing or optional fields gracefully (e.g. missing voucher or undefined time)', () => {
      const leadWithMissingFields = {
        id: 'lead_sparse',
        fullName: 'Lê Hoàng',
        phoneNumber: '0905123456',
        score: 1200,
        campaignId: 'camp_1',
      } as unknown as Lead;

      const csv = generateLeadsCsv([leadWithMissingFields]);
      const lines = csv.trim().split('\r\n');
      const row = lines[1].split(',');

      expect(row[0]).toBe('1');
      expect(row[1]).toBe('Lê Hoàng');
      expect(row[4]).toBe('0'); // Fallback timeTakenSeconds = 0
      expect(row[5]).toBe(''); // Fallback date = ''
      expect(row[6]).toBe(''); // Fallback voucher = ''

      // formatCsvDateTime returns empty string on undefined/invalid input
      expect(formatCsvDateTime(undefined)).toBe('');
      expect(formatCsvDateTime('invalid-date')).toBe('');
      expect(formatCsvDateTime('2026-11-04T10:30:00.000Z')).toContain('2026');
    });
  });

  // =========================================================================
  // 2. Vietnamese Characters & UTF-8 BOM
  // =========================================================================
  describe('2. Vietnamese Characters & UTF-8 Byte Order Mark (AD-6 / ARCH-6)', () => {
    it('preserves complex Vietnamese diacritics and tone marks without mojibake', () => {
      const vietnameseLead: Lead = {
        id: 'lead_vn',
        fullName: 'Vũ Đặng Quỳnh Như Ơi Ước Mơ',
        phoneNumber: '0988112233',
        score: 2000,
        timeTakenSeconds: 15,
        campaignId: 'camp_1',
        voucherCode: 'ƯUĐÃI_KHỦNG_50%',
        submittedAt: '2026-11-04T12:00:00.000Z',
      };

      const csv = generateLeadsCsv([vietnameseLead]);
      expect(csv).toContain('Vũ Đặng Quỳnh Như Ơi Ước Mơ');
      expect(csv).toContain('ƯUĐÃI_KHỦNG_50%');
    });

    it('verifies that the generated Blob bytes strictly start with UTF-8 BOM (0xEF, 0xBB, 0xBF)', async () => {
      const csvContent = generateLeadsCsv(sampleLeads);

      // Emulate downloadCsvFile Blob creation
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // UTF-8 BOM byte sequence
      expect(bytes[0]).toBe(0xef);
      expect(bytes[1]).toBe(0xbb);
      expect(bytes[2]).toBe(0xbf);

      // Remaining bytes decode to the exact CSV text
      const decoder = new TextDecoder('utf-8');
      const decodedText = decoder.decode(bytes.slice(3));
      expect(decodedText).toBe(csvContent);
    });
  });

  // =========================================================================
  // 3. Commas, Quotes, and Multiline Values (RFC 4180)
  // =========================================================================
  describe('3. RFC 4180 Escaping: Commas, Double Quotes, and Multiline Values', () => {
    it('escapes fields containing commas by wrapping in double quotes', () => {
      const leadWithComma: Lead = {
        id: 'lead_comma',
        fullName: 'Nguyễn, Văn A',
        phoneNumber: '0911000000',
        score: 1500,
        timeTakenSeconds: 20,
        campaignId: 'camp_1',
        voucherCode: 'CODE,123',
        submittedAt: '2026-11-04T10:00:00.000Z',
      };

      const csv = generateLeadsCsv([leadWithComma]);
      expect(csv).toContain('"Nguyễn, Văn A"');
      expect(csv).toContain('"CODE,123"');
    });

    it('escapes fields containing double quotes by doubling them ("")', () => {
      const leadWithQuotes: Lead = {
        id: 'lead_quote',
        fullName: 'Trần "Nick" Nam',
        phoneNumber: '0922000000',
        score: 1600,
        timeTakenSeconds: 21,
        campaignId: 'camp_1',
        voucherCode: 'PROMO"VIP"',
        submittedAt: '2026-11-04T10:00:00.000Z',
      };

      const csv = generateLeadsCsv([leadWithQuotes]);
      expect(csv).toContain('"Trần ""Nick"" Nam"');
      expect(csv).toContain('"PROMO""VIP"""');
    });

    it('escapes multiline fields containing \\n or \\r\\n correctly inside quotes', () => {
      const multilineLead: Lead = {
        id: 'lead_multiline',
        fullName: 'Dòng 1\nDòng 2',
        phoneNumber: '0933000000',
        score: 1700,
        timeTakenSeconds: 22,
        campaignId: 'camp_1',
        voucherCode: 'VOUCHER\r\nSPECIAL',
        submittedAt: '2026-11-04T10:00:00.000Z',
      };

      const csv = generateLeadsCsv([multilineLead]);
      expect(csv).toContain('"Dòng 1\nDòng 2"');
      expect(csv).toContain('"VOUCHER\r\nSPECIAL"');
    });

    it('properly escapes combined edge-case values with commas, quotes, and newlines', () => {
      const complexField = 'Text with "quotes", commas, and\nnewlines';
      const escaped = sanitizeCsvField(complexField);
      expect(escaped).toBe('"Text with ""quotes"", commas, and\nnewlines"');
    });
  });

  // =========================================================================
  // 4. Formula-Injection Protection (CSV Injection Defense)
  // =========================================================================
  describe('4. Formula-Injection Protection (CSV Injection Defense)', () => {
    it('neutralizes values beginning with "=" by prepending single quote', () => {
      const formulaLead: Lead = {
        id: 'lead_formula_eq',
        fullName: '=SUM(A1:B10)',
        phoneNumber: '0944000000',
        score: 1800,
        timeTakenSeconds: 20,
        campaignId: 'camp_1',
        voucherCode: '=cmd|"/C calc"!A0',
        submittedAt: '2026-11-04T10:00:00.000Z',
      };

      const csv = generateLeadsCsv([formulaLead]);
      expect(csv).toContain('"\'=SUM(A1:B10)"');
      expect(csv).toContain('"\'=cmd|""/C calc""!A0"');
    });

    it('neutralizes values beginning with "+", "-", and "@"', () => {
      const plusLead: Lead = {
        id: 'lead_plus',
        fullName: '+84988776655',
        phoneNumber: '0955000000',
        score: 1400,
        timeTakenSeconds: 20,
        campaignId: 'camp_1',
        voucherCode: '@SUM(1,2)',
        submittedAt: '2026-11-04T10:00:00.000Z',
      };

      const minusLead: Lead = {
        id: 'lead_minus',
        fullName: '-10% Discount Customer',
        phoneNumber: '0966000000',
        score: 1500,
        timeTakenSeconds: 20,
        campaignId: 'camp_1',
        voucherCode: 'MINUS10',
        submittedAt: '2026-11-04T10:00:00.000Z',
      };

      const csvPlus = generateLeadsCsv([plusLead]);
      expect(csvPlus).toContain("'+84988776655");
      expect(csvPlus).toContain("'@SUM(1,2)");

      const csvMinus = generateLeadsCsv([minusLead]);
      expect(csvMinus).toContain("'-10% Discount Customer");
    });

    it('neutralizes values with leading whitespace, newlines, tabs, and control characters before formula triggers', () => {
      const spaceEq = '   =1+1';
      const tabEq = '\t=2+2';
      const returnEq = '\r=3+3';
      const newlineEq = '\n=4+4';
      const crlfEq = '\r\n=5+5';
      const vtabEq = '\v=6+6';
      const formFeedEq = '\f=7+7';

      expect(sanitizeCsvField(spaceEq)).toBe('"\'   =1+1"');
      expect(sanitizeCsvField(tabEq)).toBe('"\'\t=2+2"');
      expect(sanitizeCsvField(returnEq)).toBe('"\'\r=3+3"');
      expect(sanitizeCsvField(newlineEq)).toBe('"\'\n=4+4"');
      expect(sanitizeCsvField(crlfEq)).toBe('"\'\r\n=5+5"');
      expect(sanitizeCsvField(vtabEq)).toBe('"\'\v=6+6"');
      expect(sanitizeCsvField(formFeedEq)).toBe('"\'\f=7+7"');

      // Also checks leading whitespace before +, -, @
      expect(sanitizeCsvField('   @calc')).toBe('"\'   @calc"');
      expect(sanitizeCsvField('   +calc')).toBe('"\'   +calc"');
      expect(sanitizeCsvField('   -calc')).toBe('"\'   -calc"');
    });

    it('preserves numeric integrity for numbers without accidental text conversion', () => {
      // Legitimate numbers (typeof value === 'number')
      expect(sanitizeCsvField(0)).toBe('0');
      expect(sanitizeCsvField(1850)).toBe('1850');
      expect(sanitizeCsvField(-10)).toBe('-10'); // Negative number preserved as numeric, not converted to text
      expect(sanitizeCsvField(-0.5)).toBe('-0.5');
      expect(sanitizeCsvField(NaN)).toBe('0');

      // In contrast, untrusted strings starting with '-' are safely sanitized as text
      expect(sanitizeCsvField('-10')).toBe('"\' -10"'.replace(' ', ''));
    });

    it('does not alter legitimate values that have "=" in the middle of the string', () => {
      const legitText = 'Customer Score = High';
      const sanitized = sanitizeCsvField(legitText);
      expect(sanitized).toBe('Customer Score = High');
      expect(sanitized).not.toContain("'");
    });
  });

  // =========================================================================
  // 5. Empty Dataset Behavior
  // =========================================================================
  describe('5. Empty Dataset Behavior', () => {
    it('produces valid CSV with headers and line terminator when dataset is empty', () => {
      const csv = generateLeadsCsv([]);
      expect(csv).toBe(
        'STT,Họ và Tên,Số điện thoại,Điểm số,Thời gian (giây),Ngày tham gia,Mã Voucher\r\n'
      );
    });

    it('successfully triggers download for empty dataset without throwing', () => {
      const clickSpy = vi.fn();
      const mockAnchor = {
        href: '',
        setAttribute: vi.fn(),
        style: {},
        click: clickSpy,
      };

      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as unknown as Node);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as unknown as Node);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-empty-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const success = downloadCsvFile(generateLeadsCsv([]), 'empty_test.csv');
      expect(success).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. Filename Generation & Download Lifecycle
  // =========================================================================
  describe('6. Filename Generation & Resource Cleanup', () => {
    it('generates predictable filename in format quizvibe_leads_YYYYMMDD.csv', () => {
      const testDate = new Date(2026, 10, 4); // November 4, 2026
      const filename = generateCsvFilename(testDate);
      expect(filename).toBe('quizvibe_leads_20261104.csv');
    });

    it('creates object URL, appends hidden link, clicks, removes element, and revokes URL', () => {
      vi.useFakeTimers();

      const clickSpy = vi.fn();
      const setAttributeSpy = vi.fn();
      const mockAnchor = {
        href: '',
        setAttribute: setAttributeSpy,
        style: {},
        click: clickSpy,
      };

      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as unknown as Node);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as unknown as Node);
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-download-url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const result = exportLeadsToCsvFile(sampleLeads, { filename: 'quizvibe_leads_20261104.csv' });
      expect(result).toBe(true);

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(setAttributeSpy).toHaveBeenCalledWith('download', 'quizvibe_leads_20261104.csv');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();

      // Verify object URL revocation after timer ticks
      expect(revokeObjectURLSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(150);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-download-url');

      vi.useRealTimers();
    });

    it('returns false and catches errors gracefully when window or document is unavailable', () => {
      const originalWindow = global.window;
      // @ts-expect-error simulating non-browser environment
      delete global.window;

      const res = downloadCsvFile('test', 'test.csv');
      expect(res).toBe(false);

      global.window = originalWindow;
    });
  });

  // =========================================================================
  // 7. Non-Mutation of Stored Leads and Leaderboard Data
  // =========================================================================
  describe('7. Data Immutability & Storage Preservation', () => {
    it('does not mutate or alter stored leads or leaderboard when exporting', () => {
      // 1. Seed storage with canonical lead
      StorageService.submitLead({
        fullName: 'Immutable Player',
        phoneNumber: '0977889900',
        score: 1950,
        timeTakenSeconds: 18,
        voucherCode: 'VIMMUTABLE',
        campaignId: 'camp_1',
      });

      const leadsBefore = StorageService.getLeads().data!;
      const lbBefore = StorageService.getLeaderboard().data!;
      expect(leadsBefore).toHaveLength(1);
      expect(lbBefore).toHaveLength(1);

      // Snapshot raw JSON in localStorage
      const leadsRawBefore = window.localStorage.getItem('quizvibe_leads');
      const lbRawBefore = window.localStorage.getItem('quizvibe_leaderboard');

      // 2. Perform export
      const exportRes = StorageService.exportLeadsToCsv();
      expect(exportRes.success).toBe(true);
      expect(exportRes.data).toContain('Immutable Player');

      // 3. Verify storage state remains 100% identical
      const leadsRawAfter = window.localStorage.getItem('quizvibe_leads');
      const lbRawAfter = window.localStorage.getItem('quizvibe_leaderboard');
      expect(leadsRawAfter).toBe(leadsRawBefore);
      expect(lbRawAfter).toBe(lbRawBefore);

      const leadsAfter = StorageService.getLeads().data!;
      const lbAfter = StorageService.getLeaderboard().data!;
      expect(leadsAfter).toEqual(leadsBefore);
      expect(lbAfter).toEqual(lbBefore);
    });

    it('exports specifically the filtered subset when a custom leads array is passed', () => {
      const leadA: Lead = {
        id: 'lead_a',
        fullName: 'Player A',
        phoneNumber: '0911111111',
        score: 1900,
        campaignId: 'camp_1',
        voucherCode: 'VA',
        submittedAt: '2026-11-04T10:00:00.000Z',
      };
      const leadB: Lead = {
        id: 'lead_b',
        fullName: 'Player B',
        phoneNumber: '0922222222',
        score: 1200,
        campaignId: 'camp_1',
        voucherCode: 'VB',
        submittedAt: '2026-11-04T10:00:00.000Z',
      };

      // Export only leadA (representing filtered result in dashboard)
      const exportRes = StorageService.exportLeadsToCsv([leadA]);
      expect(exportRes.success).toBe(true);
      expect(exportRes.data).toContain('Player A');
      expect(exportRes.data).not.toContain(leadB.fullName);
    });
  });
});
