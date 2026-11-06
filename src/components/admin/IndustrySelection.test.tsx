import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { IndustrySelect } from './IndustrySelect';
import {
  PREDEFINED_INDUSTRIES,
  CUSTOM_INDUSTRY_OPTION,
  ALL_INDUSTRY_OPTIONS,
  INDUSTRY_PLACEHOLDER,
} from '../../constants/industries';
import { validateManualQuizForm } from '../../services/validators';
import { StorageService } from '../../services/storageService';
import { Campaign, Question, VoucherConfig } from '../../types';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const validQuestions: Question[] = [0, 1, 2, 3, 4].map((i) => ({
  id: `q_${i + 1}`,
  question: `Nội dung câu hỏi số ${i + 1} kiểm thử ngành hàng?`,
  options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'] as [
    string,
    string,
    string,
    string,
  ],
  correctIndex: 0,
  explanation: `Giải thích cho câu hỏi ${i + 1}.`,
}));

const validVoucher: VoucherConfig = {
  code: 'DISCOUNT20',
  discount: 'Giảm 20% cho toàn bộ sản phẩm',
  description: 'Voucher áp dụng sau khi hoàn thành minigame',
  expiryDate: '30 ngày',
  terms: 'Áp dụng tại tất cả chi nhánh',
};

describe('Industry Selection & Custom Categories Comprehensive Test Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    StorageService.clearAll();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('Scenario 1: Predefined Industries & Options Catalog', () => {
    it('contains all 13 required predefined categories and the "Khác / Tự nhập" option', () => {
      expect(PREDEFINED_INDUSTRIES).toHaveLength(13);
      expect(PREDEFINED_INDUSTRIES).toContain('Mỹ phẩm & Chăm sóc da');
      expect(PREDEFINED_INDUSTRIES).toContain('Thời trang & Phụ kiện');
      expect(PREDEFINED_INDUSTRIES).toContain('Công nghệ & Phụ kiện');
      expect(PREDEFINED_INDUSTRIES).toContain('Ẩm thực & Đồ uống (F&B)');
      expect(PREDEFINED_INDUSTRIES).toContain('Giáo dục & Đào tạo');
      expect(PREDEFINED_INDUSTRIES).toContain('Du lịch & Khách sạn');
      expect(PREDEFINED_INDUSTRIES).toContain('Sức khỏe & Thể thao');
      expect(PREDEFINED_INDUSTRIES).toContain('Giải trí & Game');
      expect(PREDEFINED_INDUSTRIES).toContain('Nhà cửa & Đời sống');
      expect(PREDEFINED_INDUSTRIES).toContain('Thú cưng');
      expect(PREDEFINED_INDUSTRIES).toContain('Sách & Văn phòng phẩm');
      expect(PREDEFINED_INDUSTRIES).toContain('Bất động sản');
      expect(PREDEFINED_INDUSTRIES).toContain('Dịch vụ & Làm đẹp');

      expect(ALL_INDUSTRY_OPTIONS).toHaveLength(14);
      expect(ALL_INDUSTRY_OPTIONS[13]).toBe(CUSTOM_INDUSTRY_OPTION);
    });

    it('renders select with predefined industry and does not show custom input by default', () => {
      act(() => {
        root.render(
          <IndustrySelect
            value="Mỹ phẩm & Chăm sóc da"
            onChange={() => {}}
          />
        );
      });

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.value).toBe('Mỹ phẩm & Chăm sóc da');

      const customInput = container.querySelector('input');
      expect(customInput).toBeNull();
    });

    it('validates a campaign authored with a predefined industry', () => {
      const formResult = validateManualQuizForm({
        title: 'Chiến dịch Mỹ phẩm Mùa hè',
        industry: 'Mỹ phẩm & Chăm sóc da',
        questions: validQuestions,
        voucher: validVoucher,
      });

      expect(formResult.valid).toBe(true);
      expect(formResult.fieldErrors['industry']).toBeUndefined();
    });
  });

  describe('Scenario 2 & 3: Custom Industries (e.g., "Đồ chơi trẻ em", "Nông sản sạch")', () => {
    it('renders custom input when initial value is a custom industry like "Đồ chơi trẻ em"', () => {
      act(() => {
        root.render(
          <IndustrySelect
            value="Đồ chơi trẻ em"
            onChange={() => {}}
          />
        );
      });

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe(CUSTOM_INDUSTRY_OPTION);

      const customInput = container.querySelector('input') as HTMLInputElement;
      expect(customInput).not.toBeNull();
      expect(customInput.value).toBe('Đồ chơi trẻ em');
      expect(customInput.placeholder).toBe(INDUSTRY_PLACEHOLDER);
    });

    it('renders custom input when initial value is "Nông sản sạch"', () => {
      act(() => {
        root.render(
          <IndustrySelect
            value="Nông sản sạch"
            onChange={() => {}}
          />
        );
      });

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe(CUSTOM_INDUSTRY_OPTION);

      const customInput = container.querySelector('input') as HTMLInputElement;
      expect(customInput).not.toBeNull();
      expect(customInput.value).toBe('Nông sản sạch');
    });

    it('validates campaigns created with custom industries', () => {
      const res1 = validateManualQuizForm({
        title: 'Khám phá thế giới đồ chơi',
        industry: 'Đồ chơi trẻ em',
        questions: validQuestions,
        voucher: validVoucher,
      });
      expect(res1.valid).toBe(true);
      expect(res1.fieldErrors['industry']).toBeUndefined();

      const res2 = validateManualQuizForm({
        title: 'Tuần lễ nông sản Việt',
        industry: 'Nông sản sạch',
        questions: validQuestions,
        voucher: validVoucher,
      });
      expect(res2.valid).toBe(true);
      expect(res2.fieldErrors['industry']).toBeUndefined();
    });
  });

  describe('Scenario 4: Attempt to submit empty custom industry', () => {
    it('blocks submission when custom industry is empty string', () => {
      const formResult = validateManualQuizForm({
        title: 'Chiến dịch Test',
        industry: '',
        questions: validQuestions,
        voucher: validVoucher,
      });

      expect(formResult.valid).toBe(false);
      expect(formResult.fieldErrors['industry']).toBe('Vui lòng chọn hoặc nhập ngành hàng.');
    });

    it('blocks submission when custom industry is whitespace only', () => {
      const formResult = validateManualQuizForm({
        title: 'Chiến dịch Test',
        industry: '     ',
        questions: validQuestions,
        voucher: validVoucher,
      });

      expect(formResult.valid).toBe(false);
      expect(formResult.fieldErrors['industry']).toBe('Vui lòng chọn hoặc nhập ngành hàng.');
    });

    it('blocks submission when custom industry exceeds 100 characters', () => {
      const longIndustry = 'A'.repeat(101);
      const formResult = validateManualQuizForm({
        title: 'Chiến dịch Test',
        industry: longIndustry,
        questions: validQuestions,
        voucher: validVoucher,
      });

      expect(formResult.valid).toBe(false);
      expect(formResult.fieldErrors['industry']).toBe('Ngành hàng tối đa 100 ký tự.');
    });
  });

  describe('Scenario 5: Switching from custom industry to predefined category', () => {
    it('does not submit or leak custom text when user switches from custom to a predefined category', () => {
      let currentVal = 'Nội thất cao cấp';
      const handleChange = vi.fn((newVal: string) => {
        currentVal = newVal;
      });

      act(() => {
        root.render(
          <IndustrySelect
            value={currentVal}
            onChange={handleChange}
          />
        );
      });

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe(CUSTOM_INDUSTRY_OPTION);

      // Switch to predefined "Giáo dục & Đào tạo"
      act(() => {
        select.value = 'Giáo dục & Đào tạo';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });

      expect(handleChange).toHaveBeenCalledWith('Giáo dục & Đào tạo');
      expect(currentVal).toBe('Giáo dục & Đào tạo');

      // Custom input must be hidden
      expect(container.querySelector('input')).toBeNull();

      // Switch back to "Khác / Tự nhập" -> should restore "Nội thất cao cấp"
      act(() => {
        select.value = CUSTOM_INDUSTRY_OPTION;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });

      expect(handleChange).toHaveBeenCalledWith('Nội thất cao cấp');
      const restoredInput = container.querySelector('input') as HTMLInputElement;
      expect(restoredInput).not.toBeNull();
      expect(restoredInput.value).toBe('Nội thất cao cấp');
    });
  });

  describe('Scenario 6 & 7: Editing existing campaigns', () => {
    it('editing a campaign with a predefined industry selects that predefined category', () => {
      const existingPredefinedCampaign: Campaign = {
        id: 'c_predefined',
        title: 'Thời trang Mùa thu',
        description: 'Mô tả',
        industry: 'Thời trang & Phụ kiện',
        questions: validQuestions,
        voucher: validVoucher,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAiGenerated: false,
        isMock: false,
      };

      StorageService.saveCampaign(existingPredefinedCampaign);
      const loaded = StorageService.getCampaign().data!;

      act(() => {
        root.render(
          <IndustrySelect
            value={loaded.industry}
            onChange={() => {}}
          />
        );
      });

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('Thời trang & Phụ kiện');
      expect(container.querySelector('input')).toBeNull();
    });

    it('editing a campaign with a custom industry selects "Khác / Tự nhập" and prepopulates the input', () => {
      const existingCustomCampaign: Campaign = {
        id: 'c_custom',
        title: 'Minigame Dịch Vụ Thú Y',
        description: 'Mô tả',
        industry: 'Dịch vụ chăm sóc thú cưng cao cấp',
        questions: validQuestions,
        voucher: validVoucher,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAiGenerated: false,
        isMock: false,
      };

      StorageService.saveCampaign(existingCustomCampaign);
      const loaded = StorageService.getCampaign().data!;

      act(() => {
        root.render(
          <IndustrySelect
            value={loaded.industry}
            onChange={() => {}}
          />
        );
      });

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe(CUSTOM_INDUSTRY_OPTION);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('Dịch vụ chăm sóc thú cưng cao cấp');
    });
  });

  describe('Scenario 8: Reloading and persistence verification', () => {
    it('preserves custom industry across campaign save and reload operations', () => {
      const customCampaign: Campaign = {
        id: 'c_persistence_test',
        title: 'Nông Sản Hữu Cơ Sạch',
        description: 'Trắc nghiệm hiểu biết nông sản',
        industry: 'Nông sản hữu cơ xuất khẩu',
        questions: validQuestions,
        voucher: validVoucher,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAiGenerated: false,
        isMock: false,
      };

      const saveRes = StorageService.saveCampaign(customCampaign);
      expect(saveRes.success).toBe(true);

      const reloadRes = StorageService.getCampaign();
      expect(reloadRes.success).toBe(true);
      expect(reloadRes.data?.industry).toBe('Nông sản hữu cơ xuất khẩu');
      expect(reloadRes.data?.title).toBe('Nông Sản Hữu Cơ Sạch');
    });
  });

  describe('Scenario 9: Client AI Generation with custom industries', () => {
    it('sends custom industry in client AI request payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          questions: [
            {
              question: 'Đồ chơi nào giúp phát triển tư duy cho trẻ 2 tuổi?',
              options: ['Xếp hình khối', 'Điện thoại', 'Tivi', 'Video game'],
              correctIndex: 0,
              explanation: 'Xếp hình khối kích thích vận động tinh và tư duy logic.',
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      const { generateQuizFromAI } = await import('../../services/aiService');
      const res = await generateQuizFromAI(
        'Phát triển tư duy cho bé',
        'Đồ chơi trẻ em',
        'Dễ'
      );

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.industry).toBe('Đồ chơi trẻ em');
      expect(callBody.topic).toBe('Phát triển tư duy cho bé');
      expect(callBody.difficulty).toBe('Dễ');
    });
  });

  describe('Scenario 10: Existing campaign functionality remains unaffected', () => {
    it('preserves existing presets and default initialization without regression', () => {
      const initRes = StorageService.initializeDefaults(true);
      expect(initRes.success).toBe(true);
      expect(initRes.data).toBeDefined();

      const campaign = StorageService.getCampaign().data!;
      expect(campaign.isMock).toBe(true);
      expect(campaign.questions).toHaveLength(5);

      // Offline preset retrieval
      const fashionPreset = StorageService.getPreset('fashion');
      expect(fashionPreset).toBeDefined();
      expect(fashionPreset?.industry).toBe('Fashion');

      const cosmeticsPreset = StorageService.getPreset('cosmetics');
      expect(cosmeticsPreset).toBeDefined();
      expect(cosmeticsPreset?.industry).toBe('Cosmetics');
    });
  });
});
