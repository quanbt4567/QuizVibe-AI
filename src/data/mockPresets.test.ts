import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService } from '../services';
import {
  COSMETICS_DEFAULT_CAMPAIGN,
  FASHION_PRESET_CAMPAIGN,
  TECH_PRESET_CAMPAIGN,
  FNB_PRESET_CAMPAIGN,
  MOCK_PRESET_LIST,
} from './mockPresets';
import { isCampaign, isQuestion, isVoucherConfig } from '../services/validators';
import { MOCK_MODE_LABEL, Campaign } from '../types';

describe('Story 1.3: Default Campaign Bootstrapping & Industry Mock Presets', () => {
  beforeEach(() => {
    StorageService.clearAll();
    StorageService._setStorageAvailableForTest(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Schema & Content Conformance for All Presets', () => {
    const presets = [
      { name: 'Cosmetics', campaign: COSMETICS_DEFAULT_CAMPAIGN },
      { name: 'Fashion', campaign: FASHION_PRESET_CAMPAIGN },
      { name: 'Tech Gadgets', campaign: TECH_PRESET_CAMPAIGN },
      { name: 'Food & Beverage', campaign: FNB_PRESET_CAMPAIGN },
    ];

    presets.forEach(({ name, campaign }) => {
      it(`validates ${name} preset against strict Campaign schema`, () => {
        expect(isCampaign(campaign)).toBe(true);
        expect(isVoucherConfig(campaign.voucher)).toBe(true);
      });

      it(`ensures ${name} preset has exactly 5 questions with 4 options each and valid correctIndex`, () => {
        expect(campaign.questions).toHaveLength(5);

        campaign.questions.forEach((q) => {
          expect(isQuestion(q)).toBe(true);
          expect(q.options).toHaveLength(4);
          expect(q.options.every((opt) => opt.trim().length > 0)).toBe(true);
          expect(q.correctIndex).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex).toBeLessThanOrEqual(3);
          expect(q.id).toBeDefined();
          expect(q.question.trim().length).toBeGreaterThan(10);
        });
      });

      it(`verifies ${name} preset has explicit mock labeling for competition A3 transparency`, () => {
        expect(campaign.isMock).toBe(true);
        expect(campaign.isAiGenerated).toBe(false);
        expect(campaign.mockLabel).toBe('Bản demo vòng loại - Dữ liệu mô phỏng AI');
        expect(campaign.mockLabel).toBe(MOCK_MODE_LABEL);
      });

      it(`verifies ${name} preset contains non-empty voucher details`, () => {
        expect(campaign.voucher.code.trim().length).toBeGreaterThan(2);
        expect(campaign.voucher.discount.trim().length).toBeGreaterThan(2);
        expect(campaign.voucher.description.trim().length).toBeGreaterThan(5);
      });
    });

    it('contains all 4 approved presets in MOCK_PRESET_LIST', () => {
      expect(MOCK_PRESET_LIST).toHaveLength(4);
      const industries = MOCK_PRESET_LIST.map((p) => p.industry);
      expect(industries).toContain('Cosmetics');
      expect(industries).toContain('Fashion');
      expect(industries).toContain('Tech Gadgets');
      expect(industries).toContain('Food & Beverage');
    });
  });

  describe('2. Default Campaign Bootstrapping (StorageService.initializeDefaults)', () => {
    it('seeds the Cosmetics default campaign when storage is empty', () => {
      expect(StorageService.getCampaign().data).toBeNull();

      const initRes = StorageService.initializeDefaults();
      expect(initRes.success).toBe(true);
      expect(initRes.data).toBeDefined();
      expect(initRes.data?.id).toBe(COSMETICS_DEFAULT_CAMPAIGN.id);
      expect(initRes.data?.voucher.code).toBe('VIBE20');
      expect(initRes.data?.isMock).toBe(true);
      expect(initRes.data?.mockLabel).toBe('Bản demo vòng loại - Dữ liệu mô phỏng AI');

      // Verify persisted in storage
      const stored = StorageService.getCampaign();
      expect(stored.success).toBe(true);
      expect(stored.data?.id).toBe(COSMETICS_DEFAULT_CAMPAIGN.id);
    });

    it('does NOT overwrite an existing valid custom campaign upon initialization', () => {
      // 1. Merchant creates custom campaign
      const customCampaign: Campaign = {
        id: 'campaign_merchant_custom_99',
        title: 'Chiến Dịch Riêng Của Shop Hoàng Gia',
        description: 'Đố vui nhận quà vàng 9999',
        industry: 'Jewelry',
        questions: COSMETICS_DEFAULT_CAMPAIGN.questions,
        voucher: {
          code: 'GOLD99',
          discount: 'Giảm 50% đơn vàng',
          description: 'Áp dụng tại shop',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      StorageService.saveCampaign(customCampaign);

      // 2. Application boots again and calls initializeDefaults()
      const initRes = StorageService.initializeDefaults();
      expect(initRes.success).toBe(true);
      expect(initRes.data?.id).toBe('campaign_merchant_custom_99');
      expect(initRes.data?.title).toBe('Chiến Dịch Riêng Của Shop Hoàng Gia');

      // Verify custom campaign was not replaced
      const stored = StorageService.getCampaign();
      expect(stored.data?.id).toBe('campaign_merchant_custom_99');
      expect(stored.data?.voucher.code).toBe('GOLD99');
    });

    it('force re-seeds default campaign when forceReset = true', () => {
      // Set a custom campaign first
      StorageService.saveCampaign({
        ...COSMETICS_DEFAULT_CAMPAIGN,
        id: 'temporary_campaign',
        title: 'Chiến dịch tạm thời',
      });

      expect(StorageService.getCampaign().data?.id).toBe('temporary_campaign');

      // Force reset
      const resetRes = StorageService.initializeDefaults(true);
      expect(resetRes.success).toBe(true);
      expect(resetRes.data?.id).toBe(COSMETICS_DEFAULT_CAMPAIGN.id);
      expect(StorageService.getCampaign().data?.id).toBe(COSMETICS_DEFAULT_CAMPAIGN.id);
    });
  });

  describe('3. Applying Presets via StorageService.applyPreset', () => {
    it('applies Fashion preset', () => {
      const res = StorageService.applyPreset('fashion');
      expect(res.success).toBe(true);
      expect(res.data?.id).toBe(FASHION_PRESET_CAMPAIGN.id);
      expect(res.data?.industry).toBe('Fashion');
      expect(res.data?.voucher.code).toBe('FASHION50K');
    });

    it('applies Tech preset', () => {
      const res = StorageService.applyPreset('tech');
      expect(res.success).toBe(true);
      expect(res.data?.id).toBe(TECH_PRESET_CAMPAIGN.id);
      expect(res.data?.industry).toBe('Tech Gadgets');
      expect(res.data?.voucher.code).toBe('TECH100K');
    });

    it('applies Food & Beverage preset', () => {
      const res = StorageService.applyPreset('fnb');
      expect(res.success).toBe(true);
      expect(res.data?.id).toBe(FNB_PRESET_CAMPAIGN.id);
      expect(res.data?.industry).toBe('Food & Beverage');
      expect(res.data?.voucher.code).toBe('YUMMY25');
    });

    it('returns error when preset key does not exist', () => {
      const res = StorageService.applyPreset('non_existent_industry_xyz');
      expect(res.success).toBe(false);
      expect(res.error).toBe('NOT_FOUND');
    });
  });
});
