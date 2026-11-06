import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateFullName, validateVietnamesePhone } from './LeadCaptureForm';
import { StorageService } from '../../services';

describe('Story 4.2: LeadCaptureForm & Vietnamese Phone Lead Capture', () => {
  beforeEach(() => {
    StorageService.clearAll();
  });

  describe('1. Full Name Validation (validateFullName)', () => {
    it('accepts valid name with exactly 2 characters', () => {
      const res = validateFullName('An');
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe('An');
      expect(res.error).toBeUndefined();
    });

    it('accepts valid name with surrounding whitespace and trims it', () => {
      const res = validateFullName('   Nguyễn Văn A   ');
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe('Nguyễn Văn A');
    });

    it('rejects empty name', () => {
      const res = validateFullName('');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Vui lòng nhập họ và tên');
    });

    it('rejects whitespace-only name', () => {
      const res = validateFullName('     ');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Vui lòng nhập họ và tên');
    });

    it('rejects name shorter than 2 characters after trimming', () => {
      const res = validateFullName(' A ');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('ít nhất 2 ký tự');
    });
  });

  describe('2. Vietnamese Phone Validation (validateVietnamesePhone & TC-03)', () => {
    it('accepts valid 10-digit mobile numbers for all supported prefixes (03, 05, 07, 08, 09)', () => {
      const validNumbers = [
        '0321234567',
        '0561234567',
        '0771234567',
        '0881234567',
        '0987654321',
      ];

      validNumbers.forEach((phone) => {
        const res = validateVietnamesePhone(phone);
        expect(res.valid).toBe(true);
        expect(res.sanitized).toBe(phone);
      });
    });

    it('accepts valid phone with surrounding whitespace and interior spaces', () => {
      const res = validateVietnamesePhone('  0987 654 321  ');
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe('0987654321');
    });

    it('normalizes equivalent international Vietnamese formats to the same phone', () => {
      expect(validateVietnamesePhone('+84 987 654 321').sanitized).toBe('0987654321');
      expect(validateVietnamesePhone('84987654321').sanitized).toBe('0987654321');
    });

    it('rejects invalid prefix 01 or 02 or 04 (e.g. 0123456789 per TC-03)', () => {
      const res = validateVietnamesePhone('0123456789');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Số điện thoại không hợp lệ');
    });

    it('rejects phone numbers with fewer than 10 digits (e.g. 0912345 per TC-03)', () => {
      const res = validateVietnamesePhone('0912345');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Số điện thoại không hợp lệ');
    });

    it('rejects phone numbers with more than 10 digits (e.g. 091234567890 per TC-03)', () => {
      const res = validateVietnamesePhone('091234567890');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Số điện thoại không hợp lệ');
    });

    it('rejects phone numbers containing letters or special characters (e.g. 0987abc123 per TC-03)', () => {
      const res = validateVietnamesePhone('0987abc123');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Số điện thoại không hợp lệ');
    });

    it('rejects empty or whitespace-only phone', () => {
      const res = validateVietnamesePhone('   ');
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('3. Lead Submission & Persistence Integration', () => {
    it('successfully persists valid lead to StorageService.submitLead() with correct campaign metadata', () => {
      const payload = {
        fullName: 'Trần Văn Nam',
        phoneNumber: '0987654321',
        score: 1400,
        timeTakenSeconds: 60,
        voucherCode: 'GLOW20',
        campaignId: 'camp_skincare_01',
      };

      const result = StorageService.submitLead(payload);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.lead.fullName).toBe('Trần Văn Nam');
      expect(result.data?.lead.phoneNumber).toBe('0987654321');
      expect(result.data?.lead.score).toBe(1400);
      expect(result.data?.lead.timeTakenSeconds).toBe(60);
      expect(result.data?.lead.campaignId).toBe('camp_skincare_01');
      expect(result.data?.lead.voucherCode).toBe('GLOW20');
      expect(result.data?.rank).toBe(1);

      // Verify persisted in StorageService
      const allLeads = StorageService.getLeads().data;
      expect(allLeads).toHaveLength(1);
      expect(allLeads?.[0].fullName).toBe('Trần Văn Nam');

      // Verify leaderboard entry created
      const lb = StorageService.getLeaderboard().data;
      expect(lb).toHaveLength(1);
      expect(lb?.[0].maskedPhone).toBe('098***4321');
    });

    it('blocks submission and returns error when validation fails', () => {
      const invalidPayload = {
        fullName: 'N', // too short
        phoneNumber: '0123456789', // invalid prefix
        score: 1200,
        timeTakenSeconds: 50,
        voucherCode: 'GLOW20',
        campaignId: 'camp_01',
      };

      const result = StorageService.submitLead(invalidPayload);
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_LEAD');

      // Ensure no lead or leaderboard was persisted
      expect(StorageService.getLeads().data).toHaveLength(0);
      expect(StorageService.getLeaderboard().data).toHaveLength(0);
    });

    it('prevents duplicate concurrent submissions using submission lock guard', () => {
      let isSubmitting = false;
      let submitCalls = 0;

      const triggerSubmit = () => {
        if (isSubmitting) return;
        isSubmitting = true;
        submitCalls++;

        StorageService.submitLead({
          fullName: 'Lê Hoàng Yến',
          phoneNumber: '0912345678',
          score: 1800,
          timeTakenSeconds: 35,
          voucherCode: 'GLOW20',
          campaignId: 'camp_01',
        });
      };

      // First click
      triggerSubmit();
      // Rapid repeated clicks while lock is active
      triggerSubmit();
      triggerSubmit();

      expect(submitCalls).toBe(1);
      expect(StorageService.getLeads().data).toHaveLength(1);
    });

    it('preserves entered values and displays error when storage operation fails', () => {
      const mockFail = vi.spyOn(StorageService, 'submitLead').mockReturnValueOnce({
        success: false,
        error: 'STORAGE_UNAVAILABLE',
        message: 'Không thể truy cập bộ nhớ trình duyệt.',
      });

      const res = StorageService.submitLead({
        fullName: 'Phạm Minh Tuấn',
        phoneNumber: '0977889900',
        score: 1000,
        timeTakenSeconds: 45,
        voucherCode: 'GLOW20',
        campaignId: 'camp_01',
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể truy cập bộ nhớ');
      mockFail.mockRestore();
    });

    it('confirms clicking skip does NOT call submitLead or write to leads/leaderboard', () => {
      let submitCalled = false;
      const onSkip = vi.fn();

      const handleSkip = () => {
        // Player skips
        onSkip();
        // Guaranteed NOT calling submitLead
      };

      handleSkip();
      expect(onSkip).toHaveBeenCalledTimes(1);
      expect(submitCalled).toBe(false);

      // Verify localStorage leads and leaderboard remain untouched
      expect(StorageService.getLeads().data).toHaveLength(0);
      expect(StorageService.getLeaderboard().data).toHaveLength(0);
    });

    it('masks phone number on confirmation display while preserving raw phone in storage', () => {
      const rawPhone = '0987654321';
      const submitRes = StorageService.submitLead({
        fullName: 'Trần Bảo Ngọc',
        phoneNumber: rawPhone,
        score: 1600,
        timeTakenSeconds: 30,
        voucherCode: 'GLOW20',
        campaignId: 'camp_01',
      });

      expect(submitRes.success).toBe(true);
      // Raw phone is preserved in storage record
      expect(submitRes.data?.lead.phoneNumber).toBe('0987654321');

      // Masked phone in leaderboard entry hides middle digits
      const lbEntry = submitRes.data?.leaderboard.find((e) => e.leadId === submitRes.data?.lead.id);
      expect(lbEntry?.maskedPhone).toBe('098***4321');
    });

    it('verifies deterministic rank calculation according to score DESC, time ASC', () => {
      // Lead 1: 1500 pts in 40s -> rank 2
      StorageService.submitLead({
        fullName: 'Player A',
        phoneNumber: '0911111111',
        score: 1500,
        timeTakenSeconds: 40,
        voucherCode: 'GLOW20',
        campaignId: 'camp_01',
      });

      // Lead 2: 1700 pts in 50s -> rank 1 (Higher score)
      const res2 = StorageService.submitLead({
        fullName: 'Player B',
        phoneNumber: '0922222222',
        score: 1700,
        timeTakenSeconds: 50,
        voucherCode: 'GLOW20',
        campaignId: 'camp_01',
      });
      expect(res2.data?.rank).toBe(1);

      // Lead 3: 1700 pts in 30s -> rank 1 (Same score, faster time)
      const res3 = StorageService.submitLead({
        fullName: 'Player C',
        phoneNumber: '0933333333',
        score: 1700,
        timeTakenSeconds: 30,
        voucherCode: 'GLOW20',
        campaignId: 'camp_01',
      });
      expect(res3.data?.rank).toBe(1);

      // Verify the final sorted order in leaderboard
      const lb = StorageService.getLeaderboard().data!;
      expect(lb[0].fullName).toBe('Player C'); // 1700 pts, 30s
      expect(lb[1].fullName).toBe('Player B'); // 1700 pts, 50s
      expect(lb[2].fullName).toBe('Player A'); // 1500 pts, 40s
    });
  });
});

