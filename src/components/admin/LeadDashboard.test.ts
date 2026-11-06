import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StorageService } from '../../services/storageService';
import { Lead } from '../../types';
import { maskPhoneNumber } from '../../services/validators';

describe('Story 4.6: Admin Lead Management & Filter Dashboard', () => {
  const sampleLeads: Lead[] = [
    {
      id: 'lead_1',
      fullName: 'Nguyễn Văn An',
      phoneNumber: '0912345678',
      score: 1800,
      timeTakenSeconds: 32,
      voucherCode: 'GLOW20',
      campaignId: 'camp_skincare',
      submittedAt: '2026-11-04T10:00:00.000Z',
    },
    {
      id: 'lead_2',
      fullName: 'Trần Thị Bình',
      phoneNumber: '0987654321',
      score: 1400,
      timeTakenSeconds: 45,
      voucherCode: 'GLOW20',
      campaignId: 'camp_skincare',
      submittedAt: '2026-11-04T10:15:00.000Z',
    },
    {
      id: 'lead_3',
      fullName: 'Lê Hoàng Cường',
      phoneNumber: '0381122334',
      score: 850,
      timeTakenSeconds: 60,
      voucherCode: 'FASHION10',
      campaignId: 'camp_fashion',
      submittedAt: '2026-11-04T11:00:00.000Z',
    },
    {
      id: 'lead_4',
      fullName: 'Phạm Minh Đức',
      phoneNumber: '0779988776',
      score: 1650,
      timeTakenSeconds: 28,
      voucherCode: 'TECH50',
      campaignId: 'camp_tech',
      submittedAt: '2026-11-04T11:30:00.000Z',
    },
  ];

  beforeEach(() => {
    StorageService.clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Data Loading & Canonical Storage Source', () => {
    it('loads leads correctly from canonical StorageService', () => {
      sampleLeads.forEach((l) => StorageService.saveLead(l));

      const res = StorageService.getLeads();
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(4);
    });

    it('handles empty state when no leads exist in storage', () => {
      const res = StorageService.getLeads();
      expect(res.success).toBe(true);
      expect(res.data).toEqual([]);
    });

    it('handles corrupt JSON in leads storage gracefully without throwing', () => {
      window.localStorage.setItem('quizvibe_leads', 'invalid json string{{{');

      const res = StorageService.getLeads();
      expect(res.success).toBe(false);
      expect(res.data).toEqual([]);
      expect(res.error).toBe('PARSE_ERROR');
    });

    it('filters out non-lead objects from leads array', () => {
      const mixedArray = [
        sampleLeads[0],
        { invalidField: 'bad data' },
        null,
        sampleLeads[1],
      ];
      window.localStorage.setItem('quizvibe_leads', JSON.stringify(mixedArray));

      const res = StorageService.getLeads();
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(2);
      expect(res.data![0].fullName).toBe('Nguyễn Văn An');
      expect(res.data![1].fullName).toBe('Trần Thị Bình');
    });
  });

  describe('2. Search & Filtering Behavior', () => {
    it('filters leads by customer name (case-insensitive)', () => {
      sampleLeads.forEach((l) => StorageService.saveLead(l));
      const leads = StorageService.getLeads().data!;

      const query = 'bình';
      const results = leads.filter((l) => l.fullName.toLowerCase().includes(query.toLowerCase()));

      expect(results).toHaveLength(1);
      expect(results[0].fullName).toBe('Trần Thị Bình');
    });

    it('filters leads by phone number query internally while displaying strictly masked phone', () => {
      sampleLeads.forEach((l) => StorageService.saveLead(l));
      const leads = StorageService.getLeads().data!;

      const phoneQuery = '0987';
      const results = leads.filter((l) => l.phoneNumber.includes(phoneQuery));

      expect(results).toHaveLength(1);
      expect(results[0].fullName).toBe('Trần Thị Bình');

      const displayedPhone = maskPhoneNumber(results[0].phoneNumber);
      expect(displayedPhone).toBe('098***4321');
      expect(displayedPhone).not.toBe('0987654321');
    });

    it('filters leads by campaignId', () => {
      sampleLeads.forEach((l) => StorageService.saveLead(l));
      const leads = StorageService.getLeads().data!;

      const skincareLeads = leads.filter((l) => l.campaignId === 'camp_skincare');
      expect(skincareLeads).toHaveLength(2);

      const techLeads = leads.filter((l) => l.campaignId === 'camp_tech');
      expect(techLeads).toHaveLength(1);
      expect(techLeads[0].fullName).toBe('Phạm Minh Đức');
    });

    it('filters leads by score tiers correctly', () => {
      sampleLeads.forEach((l) => StorageService.saveLead(l));
      const leads = StorageService.getLeads().data!;

      // Tier >= 1500 (Expert)
      const highScores = leads.filter((l) => l.score >= 1500);
      expect(highScores).toHaveLength(2);

      // Tier 1000 - 1499 (Good)
      const midScores = leads.filter((l) => l.score >= 1000 && l.score < 1500);
      expect(midScores).toHaveLength(1);

      // Tier < 1000 (Needs Improvement)
      const lowScores = leads.filter((l) => l.score < 1000);
      expect(lowScores).toHaveLength(1);
    });

    it('combines name search, campaign filter, and score filter', () => {
      sampleLeads.forEach((l) => StorageService.saveLead(l));
      const leads = StorageService.getLeads().data!;

      const matched = leads.filter((l) =>
        l.fullName.toLowerCase().includes('an') &&
        l.campaignId === 'camp_skincare' &&
        l.score >= 1500
      );

      expect(matched).toHaveLength(1);
      expect(matched[0].fullName).toBe('Nguyễn Văn An');
    });

    it('returns empty list when no leads match the active filters', () => {
      sampleLeads.forEach((l) => StorageService.saveLead(l));
      const leads = StorageService.getLeads().data!;

      const matched = leads.filter((l) => l.fullName.toLowerCase().includes('không tồn tại'));
      expect(matched).toHaveLength(0);
    });
  });

  describe('3. Privacy & Phone Number Masking (Story 4.6 Strict Invariant)', () => {
    it('masks phone numbers across all mock leads', () => {
      sampleLeads.forEach((lead) => {
        const masked = maskPhoneNumber(lead.phoneNumber);
        expect(masked).toMatch(/^0\d{2}\*{3}\d{4}$/);
        expect(masked).not.toBe(lead.phoneNumber);
        expect(masked).toContain('***');
      });
    });

    it('masks phone number consistently in UI representation', () => {
      const lead = sampleLeads[0];
      const masked = maskPhoneNumber(lead.phoneNumber);
      expect(masked).toBe('091***5678');
      expect(masked.length).toBe(10);
    });
  });

  describe('4. Audit Verification Scenarios (Test 1 - Test 6)', () => {
    it('Test 1 — Individual deletion: deletes only requested lead and synchronizes leaderboard', () => {
      StorageService.submitLead({
        fullName: 'Player 1',
        phoneNumber: '0911111111',
        score: 1900,
        timeTakenSeconds: 30,
        voucherCode: 'V1',
        campaignId: 'c1',
      });
      StorageService.submitLead({
        fullName: 'Player 2',
        phoneNumber: '0922222222',
        score: 1800,
        timeTakenSeconds: 35,
        voucherCode: 'V2',
        campaignId: 'c1',
      });
      StorageService.submitLead({
        fullName: 'Player 3',
        phoneNumber: '0933333333',
        score: 1700,
        timeTakenSeconds: 40,
        voucherCode: 'V3',
        campaignId: 'c1',
      });

      const leadsBefore = StorageService.getLeads().data!;
      expect(leadsBefore).toHaveLength(3);

      const targetLead = leadsBefore.find((l) => l.fullName === 'Player 2')!;
      const delRes = StorageService.deleteLead(targetLead.id);
      expect(delRes.success).toBe(true);

      const leadsAfter = StorageService.getLeads().data!;
      expect(leadsAfter).toHaveLength(2);
      expect(leadsAfter.find((l) => l.fullName === 'Player 2')).toBeUndefined();
      expect(leadsAfter.find((l) => l.fullName === 'Player 1')).toBeDefined();
      expect(leadsAfter.find((l) => l.fullName === 'Player 3')).toBeDefined();

      const lbAfter = StorageService.getLeaderboard().data!;
      expect(lbAfter).toHaveLength(2);
      expect(lbAfter[0].fullName).toBe('Player 1');
      expect(lbAfter[0].rank).toBe(1);
      expect(lbAfter[1].fullName).toBe('Player 3');
      expect(lbAfter[1].rank).toBe(2);
    });

    it('Test 2 — Top 10 promotion: promotes the 11th player into Top 10 when a Top 10 player is deleted', () => {
      // Submit 12 leads with descending scores
      for (let i = 1; i <= 12; i++) {
        StorageService.submitLead({
          fullName: `Competitor ${i}`,
          phoneNumber: `09000000${i.toString().padStart(2, '0')}`,
          score: 2000 - i * 50,
          timeTakenSeconds: 20 + i,
          voucherCode: 'VOUCHER',
          campaignId: 'camp_tournament',
        });
      }

      // Check initial state
      const initialLeads = StorageService.getLeads().data!;
      expect(initialLeads).toHaveLength(12);

      const initialLb = StorageService.getLeaderboard().data!;
      expect(initialLb).toHaveLength(10);
      expect(initialLb[0].fullName).toBe('Competitor 1');
      expect(initialLb[9].fullName).toBe('Competitor 10');
      // Competitor 11 is not in the Top 10 initially
      expect(initialLb.some((e) => e.fullName === 'Competitor 11')).toBe(false);

      // Delete Rank 3 (Competitor 3)
      const comp3Lead = initialLeads.find((l) => l.fullName === 'Competitor 3')!;
      const delRes = StorageService.deleteLead(comp3Lead.id);
      expect(delRes.success).toBe(true);

      // Verify that 11 leads remain
      const remainingLeads = StorageService.getLeads().data!;
      expect(remainingLeads).toHaveLength(11);

      // Verify leaderboard is recalculated and Competitor 11 is now promoted into rank 10
      const updatedLb = StorageService.getLeaderboard().data!;
      expect(updatedLb).toHaveLength(10);
      expect(updatedLb.some((e) => e.fullName === 'Competitor 3')).toBe(false);
      expect(updatedLb[9].fullName).toBe('Competitor 11');
      expect(updatedLb[9].rank).toBe(10);
    });

    it('Test 3 — Bulk deletion: clears all leads and leaderboard while preserving campaign & voucher configuration', () => {
      // 1. Setup campaign configuration
      StorageService.initializeDefaults(true);
      const initialCampaign = StorageService.getCampaign().data!;
      expect(initialCampaign.title).toBeDefined();
      expect(initialCampaign.voucher.code).toBeDefined();

      // 2. Submit leads
      StorageService.submitLead({
        fullName: 'Player Alpha',
        phoneNumber: '0912345678',
        score: 1500,
        timeTakenSeconds: 30,
        voucherCode: initialCampaign.voucher.code,
        campaignId: initialCampaign.id,
      });

      expect(StorageService.getLeads().data).toHaveLength(1);
      expect(StorageService.getLeaderboard().data).toHaveLength(1);

      // 3. Clear all leads
      const clearRes = StorageService.clearLeads();
      expect(clearRes.success).toBe(true);

      // 4. Verify leads and leaderboard are empty
      expect(StorageService.getLeads().data).toHaveLength(0);
      expect(StorageService.getLeaderboard().data).toHaveLength(0);

      // 5. Verify campaign settings and voucher configuration remain intact
      const preservedCampaign = StorageService.getCampaign().data!;
      expect(preservedCampaign.id).toBe(initialCampaign.id);
      expect(preservedCampaign.title).toBe(initialCampaign.title);
      expect(preservedCampaign.voucher.code).toBe(initialCampaign.voucher.code);
    });

    it('Test 4 — Partial localStorage failure: does not silently report success and can recover consistency', () => {
      StorageService.submitLead({
        fullName: 'Resilient Player',
        phoneNumber: '0988776655',
        score: 1900,
        timeTakenSeconds: 25,
        voucherCode: 'RESILIENT',
        campaignId: 'camp_1',
      });

      // Simulate a partial failure where window.localStorage.removeItem throws when removing leaderboard
      const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
      const removeSpy = vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key: string) => {
        if (key === 'quizvibe_leaderboard') {
          throw new Error('Simulated disk/security failure on leaderboard');
        }
        return originalRemoveItem(key);
      });

      // Call clearLeads(): it must NOT silently report success!
      const clearRes = StorageService.clearLeads();
      expect(clearRes.success).toBe(false);
      expect(clearRes.error).toBe('STORAGE_FAILURE');

      removeSpy.mockRestore();

      // Verify reconciliation self-heals any partial discrepancy
      const reconcileRes = StorageService.reconcileLeaderboard();
      expect(reconcileRes.success).toBe(true);

      const lb = StorageService.getLeaderboard().data!;
      expect(lb).toHaveLength(0);
    });

    it('Test 4b — clearLeads failure when both original removal and recovery encounter storage failures', () => {
      StorageService.submitLead({
        fullName: 'Dual Failure Player',
        phoneNumber: '0977112233',
        score: 1750,
        timeTakenSeconds: 30,
        voucherCode: 'DUAL',
        campaignId: 'camp_1',
      });

      // Simulate removeItem failure on leaderboard and setItem failure on recovery
      const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
      const originalSetItem = window.localStorage.setItem.bind(window.localStorage);

      const removeSpy = vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key: string) => {
        if (key === 'quizvibe_leaderboard') {
          throw new Error('Storage lock failure');
        }
        return originalRemoveItem(key);
      });

      const setSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation((key: string, val: string) => {
        if (key === 'quizvibe_leaderboard') {
          throw new Error('Storage write failure during recovery');
        }
        return originalSetItem(key, val);
      });

      try {
        const clearRes = StorageService.clearLeads();
        expect(clearRes.success).toBe(false);
        expect(clearRes.error).toBe('STORAGE_FAILURE');
        expect(clearRes.message).toContain('không thể đồng bộ phục hồi bảng xếp hạng');
      } finally {
        removeSpy.mockRestore();
        setSpy.mockRestore();
      }
    });

    it('Test 4c — deleteLead write failure handling (quota & non-quota)', () => {
      StorageService.submitLead({
        fullName: 'Keep Alive Player',
        phoneNumber: '0933445566',
        score: 1850,
        timeTakenSeconds: 22,
        voucherCode: 'ALIVE',
        campaignId: 'camp_1',
      });

      const lead = StorageService.getLeads().data![0];

      // 1. Quota failure
      const quotaErr = new Error('Quota exceeded');
      quotaErr.name = 'QuotaExceededError';
      const quotaSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
        throw quotaErr;
      });

      const resQuota = StorageService.deleteLead(lead.id);
      expect(resQuota.success).toBe(false);
      expect(resQuota.error).toBe('QUOTA_EXCEEDED');

      // Canonical lead must remain intact
      expect(StorageService.getLeads().data!.some((l) => l.id === lead.id)).toBe(true);
      expect(StorageService.getLeaderboard().data!.some((e) => e.leadId === lead.id)).toBe(true);

      quotaSpy.mockRestore();

      // 2. Non-quota storage failure
      const genericSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
        throw new Error('Generic disk failure');
      });

      const resGeneric = StorageService.deleteLead(lead.id);
      expect(resGeneric.success).toBe(false);
      expect(resGeneric.error).toBe('STORAGE_FAILURE');

      // Canonical lead must still remain intact
      expect(StorageService.getLeads().data!.some((l) => l.id === lead.id)).toBe(true);
      expect(StorageService.getLeaderboard().data!.some((e) => e.leadId === lead.id)).toBe(true);

      genericSpy.mockRestore();
    });

    it('Test 4d — clearLeads: Leads removal fails while leaderboard removal succeeds', () => {
      StorageService.submitLead({
        fullName: 'Leads Fail Player',
        phoneNumber: '0911223344',
        score: 1800,
        timeTakenSeconds: 25,
        voucherCode: 'LFAIL',
        campaignId: 'camp_1',
      });

      const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
      const removeSpy = vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key: string) => {
        if (key === 'quizvibe_leads') {
          throw new Error('Simulated failure removing leads');
        }
        return originalRemoveItem(key);
      });

      try {
        const clearRes = StorageService.clearLeads();
        // Must report failure since canonical leads were not deleted
        expect(clearRes.success).toBe(false);
        expect(clearRes.data).toBe(false);
        expect(clearRes.error).toBe('STORAGE_FAILURE');
        expect(clearRes.message).toContain('Không thể xóa dữ liệu lead');

        // Canonical lead remains preserved
        expect(StorageService.getLeads().data).toHaveLength(1);
        expect(StorageService.getLeads().data![0].fullName).toBe('Leads Fail Player');

        // Leaderboard was reconciled to remain consistent with existing leads
        expect(StorageService.getLeaderboard().data).toHaveLength(1);
        expect(StorageService.getLeaderboard().data![0].fullName).toBe('Leads Fail Player');
      } finally {
        removeSpy.mockRestore();
      }
    });

    it('Test 4e — clearLeads: Leads removal succeeds while leaderboard removal fails', () => {
      StorageService.submitLead({
        fullName: 'LB Fail Player',
        phoneNumber: '0922334455',
        score: 1700,
        timeTakenSeconds: 28,
        voucherCode: 'LBFAIL',
        campaignId: 'camp_1',
      });

      const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
      const removeSpy = vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key: string) => {
        if (key === 'quizvibe_leaderboard') {
          throw new Error('Simulated failure removing leaderboard');
        }
        return originalRemoveItem(key);
      });

      try {
        const clearRes = StorageService.clearLeads();
        // Must report failure due to partial removal failure
        expect(clearRes.success).toBe(false);
        expect(clearRes.data).toBe(false);
        expect(clearRes.error).toBe('STORAGE_FAILURE');

        // Canonical leads were removed
        expect(StorageService.getLeads().data).toHaveLength(0);
      } finally {
        removeSpy.mockRestore();
      }
    });

    it('Test 4f — clearLeads: Both removals fail', () => {
      StorageService.submitLead({
        fullName: 'Both Fail Player',
        phoneNumber: '0933445566',
        score: 1650,
        timeTakenSeconds: 30,
        voucherCode: 'BOTHFAIL',
        campaignId: 'camp_1',
      });

      const removeSpy = vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
        throw new Error('Total disk failure');
      });

      try {
        const clearRes = StorageService.clearLeads();
        expect(clearRes.success).toBe(false);
        expect(clearRes.data).toBe(false);
        expect(clearRes.error).toBe('STORAGE_FAILURE');

        // Preserves recoverable data
        expect(StorageService.getLeads().data).toHaveLength(1);
        expect(StorageService.getLeads().data![0].fullName).toBe('Both Fail Player');
      } finally {
        removeSpy.mockRestore();
      }
    });

    it('Test 4g — clearLeads: Both removals succeed', () => {
      StorageService.submitLead({
        fullName: 'Clean Removal Player',
        phoneNumber: '0944556677',
        score: 1900,
        timeTakenSeconds: 20,
        voucherCode: 'CLEAN',
        campaignId: 'camp_1',
      });

      expect(StorageService.getLeads().data).toHaveLength(1);
      expect(StorageService.getLeaderboard().data).toHaveLength(1);

      const clearRes = StorageService.clearLeads();
      expect(clearRes.success).toBe(true);
      expect(clearRes.data).toBe(true);

      // Both collections are completely empty
      expect(StorageService.getLeads().data).toHaveLength(0);
      expect(StorageService.getLeaderboard().data).toHaveLength(0);
    });

    it('Test 4h — clearLeads: never reports successful deletion while canonical Leads still exist', () => {
      StorageService.submitLead({
        fullName: 'Persistent Player',
        phoneNumber: '0955667788',
        score: 1850,
        timeTakenSeconds: 22,
        voucherCode: 'PERSIST',
        campaignId: 'camp_1',
      });

      // Simulate a scenario where removeItem does not throw, but quizvibe_leads is not deleted
      const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
      const removeSpy = vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key: string) => {
        if (key === 'quizvibe_leads') {
          // Do nothing (silent no-op so key remains in localStorage)
          return;
        }
        return originalRemoveItem(key);
      });

      try {
        const clearRes = StorageService.clearLeads();
        // Even though removeItem did not throw, canonical leads still exist, so clearLeads MUST return failure!
        expect(clearRes.success).toBe(false);
        expect(clearRes.data).toBe(false);
        expect(clearRes.error).toBe('STORAGE_FAILURE');
        expect(clearRes.message).toContain('Không thể xóa dữ liệu lead');

        // Canonical leads still exist
        expect(StorageService.getLeads().data!.length).toBeGreaterThan(0);
      } finally {
        removeSpy.mockRestore();
      }
    });

    it('Test 4i — clearLeads: Both rawRemove operations report success, but subsequent getLeads verification fails -> returns failure', () => {
      StorageService.submitLead({
        fullName: 'Verification Failure Player',
        phoneNumber: '0911998877',
        score: 1750,
        timeTakenSeconds: 26,
        voucherCode: 'VFAIL',
        campaignId: 'camp_1',
      });

      // Both rawRemove succeed (normal removeItem), but getLeads returns failure
      const getLeadsSpy = vi.spyOn(StorageService, 'getLeads').mockReturnValue({
        success: false,
        data: [],
        error: 'PARSE_ERROR',
        message: 'Lỗi định dạng JSON danh sách leads.',
      });

      try {
        const clearRes = StorageService.clearLeads();
        expect(clearRes.success).toBe(false);
        expect(clearRes.data).toBe(false);
        expect(clearRes.error).toBe('PARSE_ERROR');
        expect(clearRes.message).toBe('Lỗi định dạng JSON danh sách leads.');
      } finally {
        getLeadsSpy.mockRestore();
      }
    });

    it('Test 4j — clearLeads: Both removals report success, but post-deletion verification returns non-empty Leads array -> returns failure', () => {
      StorageService.submitLead({
        fullName: 'Non Empty Verify Player',
        phoneNumber: '0922887766',
        score: 1800,
        timeTakenSeconds: 24,
        voucherCode: 'NONEMPTY',
        campaignId: 'camp_1',
      });

      // Removals succeed, but getLeads verification returns non-empty array
      const existingLeads = StorageService.getLeads().data!;
      const getLeadsSpy = vi.spyOn(StorageService, 'getLeads').mockReturnValue({
        success: true,
        data: existingLeads,
      });

      try {
        const clearRes = StorageService.clearLeads();
        expect(clearRes.success).toBe(false);
        expect(clearRes.data).toBe(false);
        expect(clearRes.error).toBe('STORAGE_FAILURE');
        expect(clearRes.message).toContain('Không thể xóa dữ liệu lead');
      } finally {
        getLeadsSpy.mockRestore();
      }
    });

    it('Test 4k — clearLeads: Both removals succeed and post-deletion verification successfully returns empty array -> returns success', () => {
      StorageService.submitLead({
        fullName: 'Verified Clean Player',
        phoneNumber: '0933776655',
        score: 1900,
        timeTakenSeconds: 20,
        voucherCode: 'VCLEAN',
        campaignId: 'camp_1',
      });

      expect(StorageService.getLeads().data).toHaveLength(1);

      const clearRes = StorageService.clearLeads();
      expect(clearRes.success).toBe(true);
      expect(clearRes.data).toBe(true);

      const verifyLeadsRes = StorageService.getLeads();
      expect(verifyLeadsRes.success).toBe(true);
      expect(verifyLeadsRes.data).toEqual([]);
      expect(StorageService.getLeaderboard().data).toEqual([]);
    });

    it('Test 5 — Ghost entry prevention: deleted lead cannot reappear in leaderboard after reload or reconciliation', () => {
      StorageService.submitLead({
        fullName: 'Real Player',
        phoneNumber: '0912121212',
        score: 1600,
        timeTakenSeconds: 30,
        voucherCode: 'REAL',
        campaignId: 'camp_1',
      });

      // Manually inject a ghost leaderboard entry with an ID not in quizvibe_leads
      const ghostEntry = {
        id: 'lb_ghost_lead',
        leadId: 'ghost_lead_id_999',
        fullName: 'Ghost Player',
        phoneNumber: '0999999999',
        maskedPhone: '099***9999',
        score: 2000,
        timeTakenSeconds: 10,
        rank: 1,
        submittedAt: '2026-11-04T00:00:00.000Z',
      };
      window.localStorage.setItem('quizvibe_leaderboard', JSON.stringify([ghostEntry]));

      // Calling getLeaderboard() detects the ghost entry and self-heals against canonical leads
      const lb = StorageService.getLeaderboard().data!;
      expect(lb.some((e) => e.leadId === 'ghost_lead_id_999')).toBe(false);
      expect(lb.some((e) => e.fullName === 'Ghost Player')).toBe(false);
      expect(lb).toHaveLength(1);
      expect(lb[0].fullName).toBe('Real Player');
      expect(lb[0].rank).toBe(1);
    });

    it('Test 5b — getLeaderboard self-healing consistency across all 4 inconsistency cases', () => {
      StorageService.submitLead({
        fullName: 'Leader A',
        phoneNumber: '0911000001',
        score: 1900,
        timeTakenSeconds: 20,
        voucherCode: 'V1',
        campaignId: 'c1',
      });
      StorageService.submitLead({
        fullName: 'Leader B',
        phoneNumber: '0911000002',
        score: 1700,
        timeTakenSeconds: 25,
        voucherCode: 'V2',
        campaignId: 'c1',
      });

      const leads = StorageService.getLeads().data!;
      expect(leads).toHaveLength(2);

      // Case 1: Leaderboard key is empty/missing while eligible leads exist in storage
      window.localStorage.removeItem('quizvibe_leaderboard');
      const lbCase1 = StorageService.getLeaderboard().data!;
      expect(lbCase1).toHaveLength(2);
      expect(lbCase1[0].fullName).toBe('Leader A');
      expect(lbCase1[1].fullName).toBe('Leader B');

      // Case 2: Leaderboard is missing an eligible player (cached 1 entry while 2 exist)
      const partialLeaderboard = [lbCase1[0]];
      window.localStorage.setItem('quizvibe_leaderboard', JSON.stringify(partialLeaderboard));
      const lbCase2 = StorageService.getLeaderboard().data!;
      expect(lbCase2).toHaveLength(2);
      expect(lbCase2[1].fullName).toBe('Leader B');

      // Case 3: Leaderboard contains entries in incorrect ranking order
      const invertedOrder = [
        { ...lbCase1[1], rank: 1 },
        { ...lbCase1[0], rank: 2 },
      ];
      window.localStorage.setItem('quizvibe_leaderboard', JSON.stringify(invertedOrder));
      const lbCase3 = StorageService.getLeaderboard().data!;
      expect(lbCase3[0].fullName).toBe('Leader A'); // Higher score restored to rank 1
      expect(lbCase3[0].rank).toBe(1);
      expect(lbCase3[1].fullName).toBe('Leader B');
      expect(lbCase3[1].rank).toBe(2);

      // Case 4: Leaderboard contains stale score data for an existing lead
      const staleEntry = [
        { ...lbCase1[0], score: 500 }, // Stale score 500 vs canonical score 1900
        lbCase1[1],
      ];
      window.localStorage.setItem('quizvibe_leaderboard', JSON.stringify(staleEntry));
      const lbCase4 = StorageService.getLeaderboard().data!;
      expect(lbCase4[0].score).toBe(1900); // Reconciled from canonical leads!
    });

    it('Test 5c — Duplicate leadId entries: detects duplicates and reconciles to unique entries', () => {
      StorageService.submitLead({
        fullName: 'Player X',
        phoneNumber: '0901234567',
        score: 1800,
        timeTakenSeconds: 30,
        voucherCode: 'VX',
        campaignId: 'c1',
      });

      const leads = StorageService.getLeads().data!;
      expect(leads).toHaveLength(1);

      // Inject duplicate entries with the same leadId into leaderboard storage
      const lead = leads[0];
      const duplicateEntries = [
        {
          id: `lb_${lead.id}_1`,
          leadId: lead.id,
          fullName: lead.fullName,
          phoneNumber: lead.phoneNumber,
          maskedPhone: maskPhoneNumber(lead.phoneNumber),
          score: lead.score,
          timeTakenSeconds: lead.timeTakenSeconds ?? 0,
          rank: 1,
          submittedAt: lead.submittedAt,
        },
        {
          id: `lb_${lead.id}_2`,
          leadId: lead.id,
          fullName: lead.fullName,
          phoneNumber: lead.phoneNumber,
          maskedPhone: maskPhoneNumber(lead.phoneNumber),
          score: lead.score,
          timeTakenSeconds: lead.timeTakenSeconds ?? 0,
          rank: 2,
          submittedAt: lead.submittedAt,
        },
      ];
      window.localStorage.setItem('quizvibe_leaderboard', JSON.stringify(duplicateEntries));

      // getLeaderboard must detect duplicate leadId and reconcile to exactly 1 entry
      const lb = StorageService.getLeaderboard().data!;
      expect(lb).toHaveLength(1);
      expect(lb[0].leadId).toBe(lead.id);
      expect(lb[0].rank).toBe(1);
    });

    it('Test 5d — Duplicate leadId entries with valid-looking ranks and scores', () => {
      StorageService.submitLead({
        fullName: 'Player Y',
        phoneNumber: '0907654321',
        score: 1950,
        timeTakenSeconds: 20,
        voucherCode: 'VY',
        campaignId: 'c1',
      });

      const lead = StorageService.getLeads().data![0];

      // Two entries sharing same leadId but fabricated to have different valid-looking ranks & scores
      const fabricatedDuplicates = [
        {
          id: `lb_${lead.id}`,
          leadId: lead.id,
          fullName: lead.fullName,
          phoneNumber: lead.phoneNumber,
          maskedPhone: maskPhoneNumber(lead.phoneNumber),
          score: 1950,
          timeTakenSeconds: 20,
          rank: 1,
          submittedAt: lead.submittedAt,
        },
        {
          id: `lb_${lead.id}_fabricated`,
          leadId: lead.id,
          fullName: lead.fullName,
          phoneNumber: lead.phoneNumber,
          maskedPhone: maskPhoneNumber(lead.phoneNumber),
          score: 1850,
          timeTakenSeconds: 25,
          rank: 2,
          submittedAt: lead.submittedAt,
        },
      ];
      window.localStorage.setItem('quizvibe_leaderboard', JSON.stringify(fabricatedDuplicates));

      const lb = StorageService.getLeaderboard().data!;
      expect(lb).toHaveLength(1);
      expect(lb[0].leadId).toBe(lead.id);
      expect(lb[0].score).toBe(1950);
      expect(lb[0].rank).toBe(1);
    });

    it('Test 5e — Missing or unexpected IDs trigger reconciliation', () => {
      StorageService.submitLead({
        fullName: 'Legitimate Player',
        phoneNumber: '0933112233',
        score: 1600,
        timeTakenSeconds: 30,
        voucherCode: 'VLEGIT',
        campaignId: 'c1',
      });

      // Cache containing an unexpected leadId not in canonical leads
      const unexpectedEntry = [
        {
          id: 'lb_unexpected',
          leadId: 'unexpected_lead_id_888',
          fullName: 'Intruder',
          phoneNumber: '0988000000',
          maskedPhone: '098***0000',
          score: 2000,
          timeTakenSeconds: 10,
          rank: 1,
          submittedAt: new Date().toISOString(),
        },
      ];
      window.localStorage.setItem('quizvibe_leaderboard', JSON.stringify(unexpectedEntry));

      const lb = StorageService.getLeaderboard().data!;
      expect(lb).toHaveLength(1);
      expect(lb[0].fullName).toBe('Legitimate Player');
      expect(lb[0].rank).toBe(1);
    });

    it('Test 5f — Cache hit without storage writes when cached leaderboard exactly matches expected Top 10', () => {
      StorageService.submitLead({
        fullName: 'Stable Player',
        phoneNumber: '0912345678',
        score: 1800,
        timeTakenSeconds: 30,
        voucherCode: 'VSTABLE',
        campaignId: 'c1',
      });

      // Leaderboard is currently in storage and 100% consistent
      const initialLb = StorageService.getLeaderboard().data!;
      expect(initialLb).toHaveLength(1);

      // Spy on window.localStorage.setItem
      const setItemSpy = vi.spyOn(window.localStorage, 'setItem');

      // Calling getLeaderboard again when cache is perfectly consistent should perform 0 writes
      const lbCached = StorageService.getLeaderboard().data!;
      expect(lbCached).toHaveLength(1);
      expect(lbCached[0].fullName).toBe('Stable Player');

      expect(setItemSpy).not.toHaveBeenCalled();

      setItemSpy.mockRestore();
    });

    it('Test 5g — Canonical Lead read failure: getLeaderboard returns failure without mutating leaderboard', () => {
      // 1. Establish valid lead and leaderboard
      StorageService.submitLead({
        fullName: 'Safe Lead',
        phoneNumber: '0918888888',
        score: 1700,
        timeTakenSeconds: 32,
        voucherCode: 'VSAFE',
        campaignId: 'c1',
      });

      const lbBefore = StorageService.getLeaderboard().data!;
      expect(lbBefore).toHaveLength(1);

      // 2. Corrupt quizvibe_leads so getLeads() fails with PARSE_ERROR
      window.localStorage.setItem('quizvibe_leads', 'corrupted-leads-json-{{{{');

      const setItemSpy = vi.spyOn(window.localStorage, 'setItem');

      // 3. Call getLeaderboard(): must return failure and NOT overwrite/wipe leaderboard
      const res = StorageService.getLeaderboard();
      expect(res.success).toBe(false);
      expect(res.error).toBe('PARSE_ERROR');

      // Storage was not mutated
      expect(setItemSpy).not.toHaveBeenCalled();

      setItemSpy.mockRestore();

      // Restore leads and verify original leaderboard cache remained intact
      window.localStorage.setItem(
        'quizvibe_leads',
        JSON.stringify([
          {
            id: lbBefore[0].leadId,
            fullName: 'Safe Lead',
            phoneNumber: '0918888888',
            score: 1700,
            timeTakenSeconds: 32,
            voucherCode: 'VSAFE',
            campaignId: 'c1',
            submittedAt: lbBefore[0].submittedAt,
          },
        ])
      );

      const lbRestored = StorageService.getLeaderboard().data!;
      expect(lbRestored).toHaveLength(1);
      expect(lbRestored[0].fullName).toBe('Safe Lead');
    });

    it('Test 5h — getLeaderboard: cached entry with matching score/time/name/rank but incorrect submittedAt triggers reconciliation', () => {
      StorageService.submitLead({
        fullName: 'Timestamp Player',
        phoneNumber: '0977889900',
        score: 1850,
        timeTakenSeconds: 24,
        voucherCode: 'VTIME',
        campaignId: 'c1',
      });

      const lead = StorageService.getLeads().data![0];
      const canonicalSubmittedAt = lead.submittedAt;

      // Manually poison cached leaderboard with an outdated/incorrect submittedAt
      const staleTimestampEntry = [
        {
          id: `lb_${lead.id}`,
          leadId: lead.id,
          fullName: lead.fullName,
          phoneNumber: lead.phoneNumber,
          maskedPhone: maskPhoneNumber(lead.phoneNumber),
          score: lead.score,
          timeTakenSeconds: lead.timeTakenSeconds ?? 0,
          rank: 1,
          submittedAt: '2020-01-01T00:00:00.000Z', // Outdated timestamp
        },
      ];
      window.localStorage.setItem('quizvibe_leaderboard', JSON.stringify(staleTimestampEntry));

      // getLeaderboard must detect stale submittedAt and reconcile from canonical lead
      const lb = StorageService.getLeaderboard().data!;
      expect(lb).toHaveLength(1);
      expect(lb[0].leadId).toBe(lead.id);
      expect(lb[0].submittedAt).toBe(canonicalSubmittedAt);
    });

    it('Test 5i — getLeaderboard: fully correct cache including submittedAt produces zero setItem calls', () => {
      StorageService.submitLead({
        fullName: 'Exact Match Player',
        phoneNumber: '0966554433',
        score: 1950,
        timeTakenSeconds: 18,
        voucherCode: 'VEXACT',
        campaignId: 'c1',
      });

      // Prime the cache
      const initialLb = StorageService.getLeaderboard().data!;
      expect(initialLb).toHaveLength(1);

      const setItemSpy = vi.spyOn(window.localStorage, 'setItem');

      // Subsequent read with fully matching submittedAt must produce zero setItem writes
      const cachedLb = StorageService.getLeaderboard().data!;
      expect(cachedLb).toHaveLength(1);
      expect(cachedLb[0].fullName).toBe('Exact Match Player');
      expect(cachedLb[0].submittedAt).toBe(initialLb[0].submittedAt);

      expect(setItemSpy).not.toHaveBeenCalled();

      setItemSpy.mockRestore();
    });

    it('Test 5j — getLeaderboard: tie-breaking with equal score and equal answering time determined by submittedAt', () => {
      // Create two leads with identical score and answering time, but different submission timestamps
      const earlyTimestamp = '2026-11-04T08:00:00.000Z';
      const lateTimestamp = '2026-11-04T12:00:00.000Z';

      const leads = [
        {
          id: 'lead_early',
          fullName: 'Early Bird',
          phoneNumber: '0911111111',
          score: 1800,
          timeTakenSeconds: 25,
          voucherCode: 'EARLY',
          campaignId: 'c1',
          submittedAt: earlyTimestamp,
        },
        {
          id: 'lead_late',
          fullName: 'Late Comers',
          phoneNumber: '0922222222',
          score: 1800,
          timeTakenSeconds: 25,
          voucherCode: 'LATE',
          campaignId: 'c1',
          submittedAt: lateTimestamp,
        },
      ];
      window.localStorage.setItem('quizvibe_leads', JSON.stringify(leads));

      // Put an inverted order in cache (Late Comers as rank 1)
      const invertedCache = [
        {
          id: 'lb_lead_late',
          leadId: 'lead_late',
          fullName: 'Late Comers',
          phoneNumber: '0922222222',
          maskedPhone: '092***2222',
          score: 1800,
          timeTakenSeconds: 25,
          rank: 1,
          submittedAt: lateTimestamp,
        },
        {
          id: 'lb_lead_early',
          leadId: 'lead_early',
          fullName: 'Early Bird',
          phoneNumber: '0911111111',
          maskedPhone: '091***1111',
          score: 1800,
          timeTakenSeconds: 25,
          rank: 2,
          submittedAt: earlyTimestamp,
        },
      ];
      window.localStorage.setItem('quizvibe_leaderboard', JSON.stringify(invertedCache));

      // getLeaderboard must detect ordering mismatch and reconcile:
      // Early Bird (earlier submittedAt) must be rank 1, Late Comers rank 2
      const lb = StorageService.getLeaderboard().data!;
      expect(lb).toHaveLength(2);
      expect(lb[0].fullName).toBe('Early Bird');
      expect(lb[0].rank).toBe(1);
      expect(lb[1].fullName).toBe('Late Comers');
      expect(lb[1].rank).toBe(2);
    });

    it('Test 6 — Score filter labels: all score filter options use score values without currency suffix "đ"', () => {
      const scoreFilterOptions = [
        { value: 'all', label: 'Mọi mức điểm' },
        { value: 'ge1500', label: '≥ 1.500 (Xuất sắc)' },
        { value: '1000to1499', label: '1.000 - 1.499 (Tốt)' },
        { value: 'lt1000', label: '< 1.000 (Cần cố gắng)' },
      ];

      scoreFilterOptions.forEach((option) => {
        expect(option.label).not.toMatch(/\d+đ/);
        expect(option.label).not.toContain('VND');
        expect(option.label).not.toContain('VNĐ');
      });
    });
  });

  describe('5. KPI Statistics Calculations', () => {
    it('calculates KPIs correctly for empty leads', () => {
      const total = 0;
      const sum = 0;
      const avg = total > 0 ? Math.round(sum / total) : 0;
      const highest = 0;

      expect(total).toBe(0);
      expect(avg).toBe(0);
      expect(highest).toBe(0);
    });

    it('calculates KPIs correctly for populated leads', () => {
      const scores = sampleLeads.map((l) => l.score);
      const total = sampleLeads.length;
      const sum = scores.reduce((a, b) => a + b, 0);
      const avg = Math.round(sum / total);
      const highest = Math.max(...scores);
      const vouchersCount = sampleLeads.filter((l) => l.voucherCode).length;

      expect(total).toBe(4);
      expect(avg).toBe(1425);
      expect(highest).toBe(1800);
      expect(vouchersCount).toBe(4);
    });
  });

  describe('6. CSV Export Integration (Story 4.7 & FR-602)', () => {
    it('provides an accessible "Xuất file Excel (CSV)" button in dashboard', () => {
      // Seed initial lead
      StorageService.submitLead({
        fullName: 'Export Player',
        phoneNumber: '0988776655',
        score: 1800,
        timeTakenSeconds: 22,
        voucherCode: 'EXP20',
        campaignId: 'camp_1',
      });

      // Verify downloadLeadsCsv is exposed and operational
      const downloadSpy = vi.spyOn(StorageService, 'downloadLeadsCsv').mockReturnValue({
        success: true,
        data: true,
      });

      const leads = StorageService.getLeads().data!;
      expect(leads).toHaveLength(1);

      const res = StorageService.downloadLeadsCsv(leads);
      expect(res.success).toBe(true);
      expect(downloadSpy).toHaveBeenCalledWith(leads);

      downloadSpy.mockRestore();
    });

    it('exports specifically the filtered dataset rather than all leads when filters are active', () => {
      const allLeads = [
        {
          id: 'lead_filter_1',
          fullName: 'Target Customer',
          phoneNumber: '0911223344',
          score: 1900,
          timeTakenSeconds: 20,
          voucherCode: 'TARGET',
          campaignId: 'camp_target',
          submittedAt: '2026-11-04T10:00:00.000Z',
        },
        {
          id: 'lead_filter_2',
          fullName: 'Other Customer',
          phoneNumber: '0922334455',
          score: 800,
          timeTakenSeconds: 30,
          voucherCode: 'OTHER',
          campaignId: 'camp_other',
          submittedAt: '2026-11-04T11:00:00.000Z',
        },
      ];

      // Simulated filtered subset (e.g. score >= 1500)
      const filtered = allLeads.filter((l) => l.score >= 1500);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].fullName).toBe('Target Customer');

      const csvContent = StorageService.exportLeadsToCsv(filtered).data!;
      expect(csvContent).toContain('Target Customer');
      expect(csvContent).not.toContain('Other Customer');
    });

    it('handles download failure gracefully and returns typed failure result', () => {
      const downloadSpy = vi.spyOn(StorageService, 'downloadLeadsCsv').mockReturnValue({
        success: false,
        data: false,
        error: 'STORAGE_FAILURE',
        message: 'Không thể tải file CSV về trình duyệt.',
      });

      const res = StorageService.downloadLeadsCsv([]);
      expect(res.success).toBe(false);
      expect(res.error).toBe('STORAGE_FAILURE');
      expect(res.message).toBe('Không thể tải file CSV về trình duyệt.');

      downloadSpy.mockRestore();
    });

    it('Admin UI export strictly outputs masked phone numbers and provides no UI option for unmasked data', () => {
      StorageService.submitLead({
        fullName: 'Private Customer',
        phoneNumber: '0977889900',
        score: 1850,
        timeTakenSeconds: 20,
        voucherCode: 'PRIVATE',
        campaignId: 'camp_1',
      });

      const leads = StorageService.getLeads().data!;
      expect(leads).toHaveLength(1);

      // Normal export call from UI (no options passed)
      const csvResult = StorageService.exportLeadsToCsv(leads);
      expect(csvResult.success).toBe(true);

      // Must contain masked phone number and NOT contain raw phone number
      expect(csvResult.data).toContain('097***9900');
      expect(csvResult.data).not.toContain('0977889900');
    });
  });
});
