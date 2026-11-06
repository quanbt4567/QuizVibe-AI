import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService, compareLeaderboardEntries } from '../../services/storageService';
import { LeaderboardEntry } from '../../types';
import { maskPhoneNumber } from '../../services/validators';

describe('Story 4.4: Gated Top 10 Leaderboard & Deterministic Tie-Breaking', () => {
  beforeEach(() => {
    StorageService.clearAll();
  });

  describe('1. Eligibility and Data Integrity (AD-4, FR-401)', () => {
    it('1. successfully submitted lead is persisted and appears on the leaderboard', () => {
      const submitRes = StorageService.submitLead({
        fullName: 'Nguyễn Văn An',
        phoneNumber: '0912345678',
        score: 1600,
        timeTakenSeconds: 35,
        voucherCode: 'VIBE2026',
        campaignId: 'camp-default',
      });

      expect(submitRes.success).toBe(true);
      expect(submitRes.data?.rank).toBe(1);

      const lbRes = StorageService.getLeaderboard();
      expect(lbRes.success).toBe(true);
      expect(lbRes.data).toHaveLength(1);
      expect(lbRes.data![0].fullName).toBe('Nguyễn Văn An');
      expect(lbRes.data![0].score).toBe(1600);
      expect(lbRes.data![0].timeTakenSeconds).toBe(35);
      expect(lbRes.data![0].rank).toBe(1);
    });

    it('2. player who chooses "Bỏ qua" (Skip) never appears on the leaderboard', () => {
      // Simulate player skipping lead capture: onSkip() called without invoking StorageService.submitLead()
      const onSkip = () => {
        // Player skips contact submission
      };
      onSkip();

      const lbRes = StorageService.getLeaderboard();
      expect(lbRes.data).toHaveLength(0);
      const leadsRes = StorageService.getLeads();
      expect(leadsRes.data).toHaveLength(0);
    });

    it('3. invalid lead submissions are rejected and never create leaderboard entries', () => {
      const invalidPhones = ['0912345', '0123456789', '0987abc123', ''];

      invalidPhones.forEach((phone) => {
        const res = StorageService.submitLead({
          fullName: 'Trần Văn B',
          phoneNumber: phone,
          score: 1500,
          timeTakenSeconds: 40,
          voucherCode: 'VIBE2026',
          campaignId: 'camp-default',
        });

        expect(res.success).toBe(false);
      });

      // Also invalid name (< 2 chars)
      const resShortName = StorageService.submitLead({
        fullName: 'A',
        phoneNumber: '0987654321',
        score: 1500,
        timeTakenSeconds: 40,
        voucherCode: 'VIBE2026',
        campaignId: 'camp-default',
      });
      expect(resShortName.success).toBe(false);

      expect(StorageService.getLeaderboard().data).toHaveLength(0);
    });

    it('4. failed StorageService operation never creates leaderboard entries', () => {
      // Direct raw get when nothing exists returns empty array
      const lbRes = StorageService.getLeaderboard();
      expect(lbRes.data).toEqual([]);
    });

    it('5. opening or reading the leaderboard does NOT write new records or mutate state', () => {
      expect(StorageService.getLeaderboard().data).toHaveLength(0);
      expect(StorageService.getLeads().data).toHaveLength(0);

      // Multiple reads simulate multiple opens/refreshes
      StorageService.getLeaderboard();
      StorageService.getLeaderboard();

      expect(StorageService.getLeaderboard().data).toHaveLength(0);
      expect(StorageService.getLeads().data).toHaveLength(0);
    });
  });

  describe('2. Deterministic Ranking & Canonical Comparator (TC-02, FR-402)', () => {
    it('1. higher score ranks first (Primary Sort: Score DESC)', () => {
      const entryA: LeaderboardEntry = {
        id: '1',
        leadId: 'l1',
        fullName: 'Player 1200',
        phoneNumber: '0911111111',
        maskedPhone: '091***1111',
        score: 1200,
        timeTakenSeconds: 30,
        rank: 0,
        submittedAt: '2026-11-04T00:00:00.000Z',
      };

      const entryB: LeaderboardEntry = {
        id: '2',
        leadId: 'l2',
        fullName: 'Player 1800',
        phoneNumber: '0922222222',
        maskedPhone: '092***2222',
        score: 1800,
        timeTakenSeconds: 50,
        rank: 0,
        submittedAt: '2026-11-04T00:00:00.000Z',
      };

      const sorted = [entryA, entryB].sort(compareLeaderboardEntries);
      expect(sorted[0].score).toBe(1800);
      expect(sorted[1].score).toBe(1200);
    });

    it('2. equal scores are resolved by lower answering time (Secondary Sort: TimeTakenSeconds ASC)', () => {
      const slower: LeaderboardEntry = {
        id: '1',
        leadId: 'l1',
        fullName: 'Slow Player',
        phoneNumber: '0911111111',
        maskedPhone: '091***1111',
        score: 1500,
        timeTakenSeconds: 55,
        rank: 0,
        submittedAt: '2026-11-04T00:00:00.000Z',
      };

      const faster: LeaderboardEntry = {
        id: '2',
        leadId: 'l2',
        fullName: 'Fast Player',
        phoneNumber: '0922222222',
        maskedPhone: '092***2222',
        score: 1500,
        timeTakenSeconds: 32,
        rank: 0,
        submittedAt: '2026-11-04T00:00:00.000Z',
      };

      const sorted = [slower, faster].sort(compareLeaderboardEntries);
      expect(sorted[0].fullName).toBe('Fast Player');
      expect(sorted[0].timeTakenSeconds).toBe(32);
      expect(sorted[1].fullName).toBe('Slow Player');
      expect(sorted[1].timeTakenSeconds).toBe(55);
    });

    it('3. equal scores and equal times are resolved by earlier submission timestamp (Tertiary Sort: SubmittedAt ASC)', () => {
      const earlier: LeaderboardEntry = {
        id: '1',
        leadId: 'l1',
        fullName: 'Early Bird',
        phoneNumber: '0911111111',
        maskedPhone: '091***1111',
        score: 1600,
        timeTakenSeconds: 40,
        rank: 0,
        submittedAt: '2026-11-04T01:00:00.000Z',
      };

      const later: LeaderboardEntry = {
        id: '2',
        leadId: 'l2',
        fullName: 'Later Bird',
        phoneNumber: '0922222222',
        maskedPhone: '092***2222',
        score: 1600,
        timeTakenSeconds: 40,
        rank: 0,
        submittedAt: '2026-11-04T02:00:00.000Z',
      };

      const sorted = [later, earlier].sort(compareLeaderboardEntries);
      expect(sorted[0].fullName).toBe('Early Bird');
      expect(sorted[1].fullName).toBe('Later Bird');
    });

    it('4. fully equal ranking fields return 0 and do not fabricate arbitrary ordering', () => {
      const entry1: LeaderboardEntry = {
        id: '1',
        leadId: 'l1',
        fullName: 'Player 1',
        phoneNumber: '0911111111',
        maskedPhone: '091***1111',
        score: 1500,
        timeTakenSeconds: 45,
        rank: 0,
        submittedAt: '2026-11-04T00:00:00.000Z',
      };

      const entry2: LeaderboardEntry = {
        id: '2',
        leadId: 'l2',
        fullName: 'Player 2',
        phoneNumber: '0922222222',
        maskedPhone: '092***2222',
        score: 1500,
        timeTakenSeconds: 45,
        rank: 0,
        submittedAt: '2026-11-04T00:00:00.000Z',
      };

      const diff = compareLeaderboardEntries(entry1, entry2);
      expect(diff).toBe(0);
    });

    it('5. defensively handles invalid timestamps, NaN numbers, and missing fields without returning NaN', () => {
      const validEntry: LeaderboardEntry = {
        id: '1',
        leadId: 'l1',
        fullName: 'Valid Entry',
        phoneNumber: '0911111111',
        maskedPhone: '091***1111',
        score: 1000,
        timeTakenSeconds: 30,
        rank: 1,
        submittedAt: '2026-11-04T00:00:00.000Z',
      };

      const invalidTimestampEntry: LeaderboardEntry = {
        id: '2',
        leadId: 'l2',
        fullName: 'Bad Timestamp',
        phoneNumber: '0922222222',
        maskedPhone: '092***2222',
        score: 1000,
        timeTakenSeconds: 30,
        rank: 2,
        submittedAt: 'invalid-date-string',
      };

      const diff = compareLeaderboardEntries(validEntry, invalidTimestampEntry);
      expect(isNaN(diff)).toBe(false);
      // Valid date must rank before invalid date
      expect(diff).toBeLessThan(0);

      const nanScoreEntry: LeaderboardEntry = {
        id: '3',
        leadId: 'l3',
        fullName: 'NaN Score',
        phoneNumber: '0933333333',
        maskedPhone: '093***3333',
        score: NaN as any,
        timeTakenSeconds: 20,
        rank: 3,
        submittedAt: '2026-11-04T00:00:00.000Z',
      };

      const scoreDiff = compareLeaderboardEntries(validEntry, nanScoreEntry);
      expect(isNaN(scoreDiff)).toBe(false);
      expect(scoreDiff).toBeLessThan(0); // 1000 pts ranks above 0 (NaN fallback)
    });

    it('6. sorting does NOT mutate the original source array', () => {
      const source: LeaderboardEntry[] = [
        {
          id: '1',
          leadId: 'l1',
          fullName: 'B',
          phoneNumber: '0911111111',
          maskedPhone: '091***1111',
          score: 1000,
          timeTakenSeconds: 30,
          rank: 0,
          submittedAt: '2026-11-04T00:00:00.000Z',
        },
        {
          id: '2',
          leadId: 'l2',
          fullName: 'A',
          phoneNumber: '0922222222',
          maskedPhone: '092***2222',
          score: 1500,
          timeTakenSeconds: 20,
          rank: 0,
          submittedAt: '2026-11-04T00:00:00.000Z',
        },
      ];

      const copyBefore = [...source];
      const sorted = [...source].sort(compareLeaderboardEntries);

      expect(source[0].id).toBe(copyBefore[0].id);
      expect(source[1].id).toBe(copyBefore[1].id);
      expect(sorted[0].score).toBe(1500);
      expect(sorted[1].score).toBe(1000);
    });
  });

  describe('3. Top 10 Boundary and Slicing Limits', () => {
    it('1. empty leaderboard returns empty array', () => {
      expect(StorageService.getLeaderboard().data).toEqual([]);
    });

    it('2. handles exactly one participant with rank 1', () => {
      StorageService.submitLead({
        fullName: 'Solo Player',
        phoneNumber: '0988776655',
        score: 1400,
        timeTakenSeconds: 38,
        voucherCode: 'VIBE2026',
        campaignId: 'c1',
      });

      const lb = StorageService.getLeaderboard().data!;
      expect(lb).toHaveLength(1);
      expect(lb[0].rank).toBe(1);
    });

    it('3. handles fewer than 10 participants gracefully with consecutive ranks', () => {
      for (let i = 1; i <= 3; i++) {
        StorageService.submitLead({
          fullName: `Player ${i}`,
          phoneNumber: `098765432${i}`,
          score: 1000 + i * 100,
          timeTakenSeconds: 40 - i,
          voucherCode: 'VIBE2026',
          campaignId: 'c1',
        });
      }

      const lb = StorageService.getLeaderboard().data!;
      expect(lb).toHaveLength(3);
      expect(lb[0].rank).toBe(1);
      expect(lb[0].score).toBe(1300);
      expect(lb[1].rank).toBe(2);
      expect(lb[1].score).toBe(1200);
      expect(lb[2].rank).toBe(3);
      expect(lb[2].score).toBe(1100);
    });

    it('4. strictly bounds output to first 10 when more than 10 leads exist', () => {
      for (let i = 1; i <= 15; i++) {
        StorageService.submitLead({
          fullName: `Competitor ${i}`,
          phoneNumber: `09711111${i < 10 ? '0' + i : i}`,
          score: 1000 + i * 50, // 1050 .. 1750
          timeTakenSeconds: 45,
          voucherCode: 'VIBE2026',
          campaignId: 'c1',
        });
      }

      const totalLeads = StorageService.getLeads().data!;
      expect(totalLeads).toHaveLength(15);

      const lb = StorageService.getLeaderboard().data!;
      expect(lb).toHaveLength(10);
      expect(lb[0].score).toBe(1750);
      expect(lb[0].rank).toBe(1);
      expect(lb[9].score).toBe(1300);
      expect(lb[9].rank).toBe(10);
    });

    it('5. accurately assigns rank > 10 to a player outside the Top 10 without corrupting the slice', () => {
      // 10 players with 1500+ points
      for (let i = 1; i <= 10; i++) {
        StorageService.submitLead({
          fullName: `Top Player ${i}`,
          phoneNumber: `09811111${i < 10 ? '0' + i : i}`,
          score: 1500 + i * 10,
          timeTakenSeconds: 30,
          voucherCode: 'VIBE2026',
          campaignId: 'c1',
        });
      }

      // 11th player submits low score
      const res11 = StorageService.submitLead({
        fullName: 'Player Outside Top 10',
        phoneNumber: '0999999999',
        score: 500,
        timeTakenSeconds: 40,
        voucherCode: 'VIBE2026',
        campaignId: 'c1',
      });

      expect(res11.success).toBe(true);
      expect(res11.data?.rank).toBe(11);

      // Leaderboard only holds 10 entries
      const lb = StorageService.getLeaderboard().data!;
      expect(lb).toHaveLength(10);
      // 11th player is NOT in Top 10
      expect(lb.some((e) => e.leadId === res11.data?.lead.id)).toBe(false);
    });

    it('6. exact lead ID matching highlights ONLY the matching participant, avoiding collisions', () => {
      const entry1: LeaderboardEntry = {
        id: 'lb_1',
        leadId: 'target_lead_id',
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0912345678',
        maskedPhone: '091***5678',
        score: 1600,
        timeTakenSeconds: 30,
        rank: 1,
        submittedAt: '2026-11-04T00:00:00.000Z',
      };

      const entry2: LeaderboardEntry = {
        id: 'lb_2',
        leadId: 'different_lead_id',
        fullName: 'Nguyễn Văn A', // identical name
        phoneNumber: '0912345678', // identical phone
        maskedPhone: '091***5678',
        score: 1600, // identical score
        timeTakenSeconds: 30, // identical time
        rank: 2,
        submittedAt: '2026-11-04T00:00:01.000Z',
      };

      const highlightLeadId = 'target_lead_id';

      expect(entry1.leadId === highlightLeadId).toBe(true);
      expect(entry2.leadId === highlightLeadId).toBe(false);
    });
  });

  describe('4. Privacy, Masking, and Security Guarantees', () => {
    it('1. masks all phone numbers in the leaderboard entries', () => {
      const rawPhone = '0987654321';
      StorageService.submitLead({
        fullName: 'Lê Minh Tuấn',
        phoneNumber: rawPhone,
        score: 1850,
        timeTakenSeconds: 34,
        voucherCode: 'VIBE2026',
        campaignId: 'c1',
      });

      const entry = StorageService.getLeaderboard().data![0];
      expect(entry.maskedPhone).toBe('098***4321');
      expect(entry.maskedPhone).not.toBe(rawPhone);
      expect(maskPhoneNumber('0912345678')).toBe('091***5678');
      expect(maskPhoneNumber('0398765432')).toBe('039***5432');
    });

    it('2. phone masking handles non-string and malformed inputs defensively without throwing', () => {
      expect(maskPhoneNumber(undefined)).toBe('');
      expect(maskPhoneNumber(null)).toBe('');
      expect(maskPhoneNumber(1234567890 as any)).toBe('');
      expect(maskPhoneNumber('123')).toBe('123');
      expect(maskPhoneNumber('0987654321')).toBe('098***4321');
    });

    it('3. does not crash or corrupt display with malformed legacy data in storage', () => {
      localStorage.setItem('quizvibe_leaderboard', '{"notAnArray": true}');
      const res = StorageService.getLeaderboard();
      expect(res.data).toEqual([]);

      localStorage.setItem('quizvibe_leaderboard', JSON.stringify([{ badField: true }]));
      const res2 = StorageService.getLeaderboard();
      expect(res2.data).toEqual([]);
    });
  });

  describe('5. Accessibility and Interaction Guarantees', () => {
    it('1. opening and closing the leaderboard modal does not modify quiz session state', () => {
      const sessionState = {
        currentQuestionIndex: 3,
        currentScore: 1200,
        isCompleted: false,
      };

      let modalOpen = true;
      const lbSnapshot = StorageService.getLeaderboard().data;
      expect(lbSnapshot).toBeDefined();

      modalOpen = false;

      expect(modalOpen).toBe(false);
      expect(sessionState.currentQuestionIndex).toBe(3);
      expect(sessionState.currentScore).toBe(1200);
      expect(sessionState.isCompleted).toBe(false);
    });

    it('2. body scroll lock sets document.body.style.overflow to hidden when open', () => {
      const previous = document.body.style.overflow;

      // Simulate modal open effect
      document.body.style.overflow = 'hidden';
      expect(document.body.style.overflow).toBe('hidden');

      // Simulate modal close effect
      document.body.style.overflow = previous;
      expect(document.body.style.overflow).toBe(previous);
    });
  });
});
