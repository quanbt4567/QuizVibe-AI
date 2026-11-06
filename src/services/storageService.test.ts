import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService } from './storageService';
import { STORAGE_KEYS, CURRENT_SCHEMA_VERSION, Campaign, Lead } from '../types';
import { isValidVietnamesePhone, maskPhoneNumber } from './validators';

describe('StorageService & Schema Validation', () => {
  const sampleCampaign: Campaign = {
    id: 'campaign_cosmetics_01',
    title: 'Đố Vui Skincare Cùng GlowBeauty',
    description: 'Chinh phục 5 câu hỏi chăm sóc da nhận ngay voucher 20%',
    industry: 'Cosmetics',
    questions: [
      {
        id: 'q1',
        question: 'Thứ tự đúng của quy trình skincare ban đêm là gì?',
        options: [
          'Tẩy trang - Sữa rửa mặt - Toner - Serum - Khóa ẩm',
          'Sữa rửa mặt - Tẩy trang - Khóa ẩm - Serum',
          'Khóa ẩm - Tẩy trang - Serum - Sữa rửa mặt',
          'Toner - Tẩy trang - Sữa rửa mặt - Khóa ẩm',
        ],
        correctIndex: 0,
        explanation: 'Làm sạch kép trước rồi mới cấp ẩm theo độ lỏng đặc.',
      },
      {
        id: 'q2',
        question: 'Thành phần nào sau đây có công dụng phục hồi màng bảo vệ da?',
        options: ['B5 & Ceramide', 'Cồn khô', 'Hương liệu nhân tạo', 'Paraben đậm đặc'],
        correctIndex: 0,
      },
      {
        id: 'q3',
        question: 'Chỉ số SPF 50 chống được khoảng bao nhiêu % tia UVB?',
        options: ['98%', '50%', '70%', '100%'],
        correctIndex: 0,
      },
      {
        id: 'q4',
        question: 'Thời điểm bôi kem chống nắng tốt nhất trước khi ra ngoài?',
        options: ['15-20 phút', 'Ngay lúc ra ngoài', '1 tiếng', 'Không cần bôi'],
        correctIndex: 0,
      },
      {
        id: 'q5',
        question: 'Nên dùng Retinol vào buổi nào trong ngày?',
        options: ['Buổi tối', 'Buổi trưa nắng gắt', 'Bất kỳ lúc nào', 'Sáng sớm'],
        correctIndex: 0,
      },
    ],
    voucher: {
      code: 'GLOW20',
      discount: 'Giảm 20% cho đơn từ 299k',
      description: 'Áp dụng trên toàn hệ thống Fanpage GlowBeauty',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    // Clear storage before each test
    StorageService.clearAll();
    StorageService._setStorageAvailableForTest(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Normal Read/Write Operations', () => {
    it('saves and retrieves an active campaign successfully', () => {
      const saveRes = StorageService.saveCampaign(sampleCampaign);
      expect(saveRes.success).toBe(true);
      expect(saveRes.data?.id).toBe('campaign_cosmetics_01');

      const getRes = StorageService.getCampaign();
      expect(getRes.success).toBe(true);
      expect(getRes.data?.title).toBe('Đố Vui Skincare Cùng GlowBeauty');
      expect(getRes.data?.questions).toHaveLength(5);
    });

    it('saves and retrieves leads', () => {
      const sampleLead: Lead = {
        id: 'lead_test_1',
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0912345678',
        score: 1850,
        voucherCode: 'GLOW20',
        campaignId: 'campaign_cosmetics_01',
        submittedAt: new Date().toISOString(),
        timeTakenSeconds: 35,
      };

      const saveRes = StorageService.saveLead(sampleLead);
      expect(saveRes.success).toBe(true);

      const getRes = StorageService.getLeads();
      expect(getRes.success).toBe(true);
      expect(getRes.data).toHaveLength(1);
      expect(getRes.data![0].fullName).toBe('Nguyễn Văn A');
    });

    it('deletes a lead by id', () => {
      const lead1: Lead = {
        id: 'lead_1',
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0912345678',
        score: 1850,
        voucherCode: 'VIBE20',
        campaignId: 'c1',
        submittedAt: new Date().toISOString(),
      };
      const lead2: Lead = {
        id: 'lead_2',
        fullName: 'Trần Thị B',
        phoneNumber: '0987654321',
        score: 1900,
        voucherCode: 'VIBE20',
        campaignId: 'c1',
        submittedAt: new Date().toISOString(),
      };

      StorageService.saveLead(lead1);
      StorageService.saveLead(lead2);

      expect(StorageService.getLeads().data).toHaveLength(2);

      StorageService.deleteLead('lead_1');
      const remaining = StorageService.getLeads().data;
      expect(remaining).toHaveLength(1);
      expect(remaining![0].id).toBe('lead_2');
    });
  });

  describe('2. Malformed JSON Handling', () => {
    it('handles malformed JSON in active campaign without crashing', () => {
      window.localStorage.setItem(STORAGE_KEYS.ACTIVE_CAMPAIGN, '{"broken json');

      const res = StorageService.getCampaign();
      expect(res.success).toBe(false);
      expect(res.error).toBe('PARSE_ERROR');
      expect(res.data).toBeNull();
    });

    it('handles malformed JSON in leads without crashing and returns empty array', () => {
      window.localStorage.setItem(STORAGE_KEYS.LEADS, '{ not an array or json');

      const res = StorageService.getLeads();
      expect(res.success).toBe(false);
      expect(res.error).toBe('PARSE_ERROR');
      expect(res.data).toEqual([]);
    });

    it('handles malformed JSON in leaderboard without crashing and returns empty array', () => {
      window.localStorage.setItem(STORAGE_KEYS.LEADERBOARD, 'invalid json content');

      const res = StorageService.getLeaderboard();
      expect(res.success).toBe(false);
      expect(res.error).toBe('PARSE_ERROR');
      expect(res.data).toEqual([]);
    });
  });

  describe('3. Invalid Schemas Handling', () => {
    it('rejects campaign with fewer than 4 options in a question', () => {
      const invalidCampaign = {
        ...sampleCampaign,
        questions: [
          {
            id: 'q1',
            question: 'Câu hỏi lỗi?',
            options: ['Đáp án 1', 'Đáp án 2'], // Only 2 options, requires 4
            correctIndex: 0,
          },
        ],
      } as unknown as Campaign;

      const saveRes = StorageService.saveCampaign(invalidCampaign);
      expect(saveRes.success).toBe(false);
      expect(saveRes.error).toBe('VALIDATION_FAILED');
    });

    it('rejects campaign with negative or out-of-range correctIndex', () => {
      const invalidCampaign = {
        ...sampleCampaign,
        questions: [
          {
            id: 'q1',
            question: 'Câu hỏi lỗi index?',
            options: ['A', 'B', 'C', 'D'],
            correctIndex: 5, // Out of bounds (must be 0..3)
          },
        ],
      } as unknown as Campaign;

      const saveRes = StorageService.saveCampaign(invalidCampaign);
      expect(saveRes.success).toBe(false);
      expect(saveRes.error).toBe('VALIDATION_FAILED');
    });

    it('filters out corrupted items in leads array when reading', () => {
      const corruptedArray = [
        { id: 'valid_1', fullName: 'Hợp Lệ', phoneNumber: '0912345678', score: 1000, voucherCode: 'V1', campaignId: 'c', submittedAt: '2026-11-02' },
        { id: 'invalid_2', fullName: 'Thiếu SĐT', score: 500 }, // Corrupted
      ];
      window.localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(corruptedArray));

      const leadsRes = StorageService.getLeads();
      expect(leadsRes.success).toBe(true);
      expect(leadsRes.data).toHaveLength(1);
      expect(leadsRes.data![0].id).toBe('valid_1');
    });
  });

  describe('4. Schema Versioning & Migrations', () => {
    it('sets the current schema version when none exists', () => {
      StorageService.ensureSchemaVersion();
      const versionStr = window.localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION);
      expect(versionStr).toBe(String(CURRENT_SCHEMA_VERSION));
    });

    it('migrates an older schema version to current version', () => {
      window.localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, '0');
      StorageService.ensureSchemaVersion();
      const versionStr = window.localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION);
      expect(versionStr).toBe(String(CURRENT_SCHEMA_VERSION));
    });
  });

  describe('5. Quota Exceeded Defense', () => {
    it('catches QuotaExceededError and preserves data in memory without throwing', () => {
      const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        const quotaError = new Error('The quota has been exceeded.');
        quotaError.name = 'QuotaExceededError';
        throw quotaError;
      });

      const res = StorageService.saveCampaign(sampleCampaign);

      expect(res.success).toBe(false);
      expect(res.error).toBe('QUOTA_EXCEEDED');
      expect(res.isMemoryFallback).toBe(true);

      // Verify the campaign was preserved in memory fallback
      const inMemoryVal = StorageService.getMemoryStoreValue(STORAGE_KEYS.ACTIVE_CAMPAIGN);
      expect(inMemoryVal).toBeDefined();
      expect(JSON.parse(inMemoryVal!).id).toBe(sampleCampaign.id);

      setItemSpy.mockRestore();
    });
  });

  describe('6. Unavailable Storage Handling (Private Mode / Restricted)', () => {
    it('transparently falls back to in-memory store when storage is unavailable', () => {
      StorageService._setStorageAvailableForTest(false);

      const saveRes = StorageService.saveCampaign(sampleCampaign);
      expect(saveRes.success).toBe(true);
      expect(saveRes.isMemoryFallback).toBe(true);

      const getRes = StorageService.getCampaign();
      expect(getRes.success).toBe(true);
      expect(getRes.isMemoryFallback).toBe(true);
      expect(getRes.data?.id).toBe(sampleCampaign.id);
    });
  });

  describe('7. Gated Lead Submission Pipeline & Deterministic Leaderboard (AD-4)', () => {
    it('validates Vietnamese phone numbers correctly', () => {
      expect(isValidVietnamesePhone('0912345678')).toBe(true);
      expect(isValidVietnamesePhone('0381234567')).toBe(true);
      expect(isValidVietnamesePhone('0771234567')).toBe(true);
      expect(isValidVietnamesePhone('0561234567')).toBe(true);
      expect(isValidVietnamesePhone('0891234567')).toBe(true);

      // Invalid numbers
      expect(isValidVietnamesePhone('0123456789')).toBe(false); // Old 11-digit prefix
      expect(isValidVietnamesePhone('091234567')).toBe(false);  // 9 digits
      expect(isValidVietnamesePhone('09123456789')).toBe(false); // 11 digits
      expect(isValidVietnamesePhone('1234567890')).toBe(false); // No leading zero
      expect(isValidVietnamesePhone('abc09123456')).toBe(false);
    });

    it('masks phone number correctly for public display', () => {
      expect(maskPhoneNumber('0912345678')).toBe('091***5678');
      expect(maskPhoneNumber('0389998888')).toBe('038***8888');
    });

    it('rejects lead with invalid Vietnamese phone number and does not write to leaderboard', () => {
      const res = StorageService.submitLead({
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0123456789', // Invalid prefix
        score: 1800,
        timeTakenSeconds: 30,
        voucherCode: 'VIBE20',
        campaignId: 'c1',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('INVALID_LEAD');

      // Ensure leaderboard is still empty
      expect(StorageService.getLeaderboard().data).toHaveLength(0);
      expect(StorageService.getLeads().data).toHaveLength(0);
    });

    it('rejects lead with name shorter than 2 characters', () => {
      const res = StorageService.submitLead({
        fullName: 'A', // Too short
        phoneNumber: '0912345678',
        score: 1800,
        timeTakenSeconds: 30,
        voucherCode: 'VIBE20',
        campaignId: 'c1',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('INVALID_LEAD');
      expect(StorageService.getLeaderboard().data).toHaveLength(0);
    });

    it('submits valid lead and calculates deterministic Top 10 leaderboard (Score DESC, TimeTaken ASC)', () => {
      // Player 1: 1500 pts in 40s
      StorageService.submitLead({
        fullName: 'Người Chơi 1',
        phoneNumber: '0911111111',
        score: 1500,
        timeTakenSeconds: 40,
        voucherCode: 'VIBE20',
        campaignId: 'c1',
      });

      // Player 2: 1900 pts in 30s (Higher score -> Rank 1)
      StorageService.submitLead({
        fullName: 'Người Chơi 2',
        phoneNumber: '0922222222',
        score: 1900,
        timeTakenSeconds: 30,
        voucherCode: 'VIBE20',
        campaignId: 'c1',
      });

      // Player 3: 1900 pts in 25s (Same score, faster time -> Should overtake Player 2 as Rank 1)
      StorageService.submitLead({
        fullName: 'Người Chơi 3',
        phoneNumber: '0933333333',
        score: 1900,
        timeTakenSeconds: 25,
        voucherCode: 'VIBE20',
        campaignId: 'c1',
      });

      const lbRes = StorageService.getLeaderboard();
      expect(lbRes.success).toBe(true);
      const lb = lbRes.data!;

      expect(lb).toHaveLength(3);
      // Rank 1: Player 3 (1900 pts, 25s)
      expect(lb[0].fullName).toBe('Người Chơi 3');
      expect(lb[0].rank).toBe(1);
      expect(lb[0].maskedPhone).toBe('093***3333');

      // Rank 2: Player 2 (1900 pts, 30s)
      expect(lb[1].fullName).toBe('Người Chơi 2');
      expect(lb[1].rank).toBe(2);

      // Rank 3: Player 1 (1500 pts, 40s)
      expect(lb[2].fullName).toBe('Người Chơi 1');
      expect(lb[2].rank).toBe(3);
    });

    it('caps leaderboard at Top 10 entries', () => {
      // Submit 12 leads
      for (let i = 1; i <= 12; i++) {
        StorageService.submitLead({
          fullName: `Người Chơi ${i}`,
          phoneNumber: `09000000${i.toString().padStart(2, '0')}`,
          score: 1000 + i * 50,
          timeTakenSeconds: 30,
          voucherCode: 'VIBE20',
          campaignId: 'c1',
        });
      }

      const lb = StorageService.getLeaderboard().data!;
      expect(lb).toHaveLength(10);
      expect(lb[0].rank).toBe(1);
      expect(lb[9].rank).toBe(10);

      // All 12 leads are preserved in quizvibe_leads
      const allLeads = StorageService.getLeads().data!;
      expect(allLeads).toHaveLength(12);
    });
  });
});

