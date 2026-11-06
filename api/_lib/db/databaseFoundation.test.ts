// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  assertServerRuntime,
  ServerOnlyModuleError,
  SupabaseConfigError,
  validateSupabaseServerEnv,
  createSupabaseServerClient,
  getSupabaseServerClient,
  resetSupabaseServerClientCache,
  QuizVibeDatabaseRepository,
  DatabaseOperationError,
  slugifyCampaignTitle,
  maskVietnamesePhone,
  isValidVietnamesePhoneServer,
  buildExplicitLocalStorageMigrationBundle,
} from './index.js';

const VALID_TEST_ENV = {
  SUPABASE_URL: 'https://quizvibe-demo-ref.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role_test_secret_key_123456',
};

describe('Phase 1: Backend Foundation & Supabase PostgreSQL Database', () => {
  beforeEach(() => {
    resetSupabaseServerClientCache();
  });

  describe('1. Versioned SQL Migration & Relational Schema Integrity', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20261105000001_initial_quizvibe_schema.sql'
    );

    it('contains the versioned SQL migration file with all 5 required tables', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf-8');

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.campaigns');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.campaign_questions');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.vouchers');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.quiz_sessions');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.leads');
    });

    it('enforces UUID primary keys, foreign keys, campaign states, and Row Level Security on all 5 tables', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');

      // Campaign states: draft, published, archived
      expect(sql).toContain("status IN ('draft', 'published', 'archived')");

      // Foreign key relationships
      expect(sql).toContain('REFERENCES public.campaigns(id) ON DELETE CASCADE');
      expect(sql).toContain('REFERENCES public.campaigns(id) ON DELETE RESTRICT');
      expect(sql).toContain('REFERENCES public.quiz_sessions(id) ON DELETE SET NULL');

      // Leaderboard composite index matching canonical sort (score DESC, time_taken_seconds ASC, submitted_at ASC)
      expect(sql).toContain(
        'ON public.leads (campaign_id, score DESC, time_taken_seconds ASC, submitted_at ASC)'
      );

      // Row Level Security enabled on all 5 tables
      expect(sql).toContain('ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE public.campaign_questions ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;');
    });
  });

  describe('2. Server-Only Runtime Boundary & Client-Bundle Secret Protection', () => {
    it('throws ServerOnlyModuleError when assertServerRuntime detects a browser window object', () => {
      expect(() => assertServerRuntime({ window: {} })).toThrowError(ServerOnlyModuleError);
      try {
        assertServerRuntime({ window: {} });
      } catch (err) {
        expect(err).toBeInstanceOf(ServerOnlyModuleError);
        expect((err as ServerOnlyModuleError).code).toBe('SERVER_ONLY_VIOLATION');
      }
    });

    it('blocks createSupabaseServerClient if globalThis.window is defined (simulated browser runtime)', () => {
      const globalRef = globalThis as Record<string, unknown>;
      globalRef.window = {};
      try {
        expect(() => createSupabaseServerClient(VALID_TEST_ENV)).toThrowError(ServerOnlyModuleError);
      } finally {
        delete globalRef.window;
      }
    });

    it('rejects VITE_SUPABASE_SERVICE_ROLE_KEY to prevent accidental client bundle exposure', () => {
      expect(() =>
        validateSupabaseServerEnv({
          ...VALID_TEST_ENV,
          VITE_SUPABASE_SERVICE_ROLE_KEY: 'exposed_secret_in_vite',
        })
      ).toThrowError(SupabaseConfigError);

      try {
        validateSupabaseServerEnv({
          ...VALID_TEST_ENV,
          VITE_SUPABASE_SERVICE_ROLE_KEY: 'exposed_secret_in_vite',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(SupabaseConfigError);
        expect((err as SupabaseConfigError).code).toBe('CLIENT_EXPOSURE_DETECTED');
      }
    });
  });

  describe('3. Supabase Environment Configuration Validation', () => {
    it('fails clearly with SUPABASE_CONFIG_MISSING when SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      try {
        validateSupabaseServerEnv({});
        expect.fail('Should have thrown SupabaseConfigError');
      } catch (err) {
        expect(err).toBeInstanceOf(SupabaseConfigError);
        const configErr = err as SupabaseConfigError;
        expect(configErr.code).toBe('SUPABASE_CONFIG_MISSING');
        expect(configErr.missingVars).toEqual(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
      }
    });

    it('fails clearly with SUPABASE_CONFIG_INVALID when SUPABASE_URL is malformed or uses non-https protocol', () => {
      expect(() =>
        validateSupabaseServerEnv({
          SUPABASE_URL: 'not-a-valid-url',
          SUPABASE_SERVICE_ROLE_KEY: VALID_TEST_ENV.SUPABASE_SERVICE_ROLE_KEY,
        })
      ).toThrowError(SupabaseConfigError);

      expect(() =>
        validateSupabaseServerEnv({
          SUPABASE_URL: 'http://remote-insecure-host.example.com',
          SUPABASE_SERVICE_ROLE_KEY: VALID_TEST_ENV.SUPABASE_SERVICE_ROLE_KEY,
        })
      ).toThrowError(SupabaseConfigError);
    });

    it('fails clearly with SUPABASE_CONFIG_INVALID when SUPABASE_SERVICE_ROLE_KEY is a short placeholder', () => {
      expect(() =>
        validateSupabaseServerEnv({
          SUPABASE_URL: VALID_TEST_ENV.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key',
        })
      ).toThrowError(SupabaseConfigError);
    });

    it('initializes server Supabase client cleanly when valid credentials are provided', () => {
      const client1 = getSupabaseServerClient(VALID_TEST_ENV);
      const client2 = getSupabaseServerClient(VALID_TEST_ENV);
      expect(client1).toBeDefined();
      expect(typeof client1.from).toBe('function');
      expect(client1).toBe(client2);
    });
  });

  describe('4. Server-Side Domain Helpers & Repository Operations', () => {
    it('normalizes Vietnamese titles into URL-safe slugs via slugifyCampaignTitle', () => {
      expect(slugifyCampaignTitle('Thử Thách Chăm Da Rạng Rỡ Cùng GlowBeauty')).toBe(
        'thu-thach-cham-da-rang-ro-cung-glowbeauty'
      );
      expect(slugifyCampaignTitle('Đố Vui Ẩm Thực & Đồ Uống', '2026')).toBe(
        'do-vui-am-thuc-do-uong-2026'
      );
    });

    it('validates and masks 10-digit Vietnamese phone numbers on the server', () => {
      expect(isValidVietnamesePhoneServer('0987654321')).toBe(true);
      expect(isValidVietnamesePhoneServer('0123456789')).toBe(false);
      expect(maskVietnamesePhone('0987654321')).toBe('098***4321');
      expect(() => maskVietnamesePhone('invalid')).toThrowError(DatabaseOperationError);
    });

    it('enforces 5-question invariant and server-side phone validation in QuizVibeDatabaseRepository', async () => {
      const mockClient = {
        from: vi.fn(),
      } as unknown as ReturnType<typeof createSupabaseServerClient>;

      const repo = new QuizVibeDatabaseRepository(mockClient);

      await expect(
        repo.createCampaignWithDetails({
          campaign: {
            slug: 'test-campaign',
            title: 'Test Campaign',
            industry: 'Cosmetics',
          },
          questions: [], // invalid: fewer than 5 questions
          voucher: {
            code: 'VIBE20',
            discount: '20%',
          },
        })
      ).rejects.toThrowError(/exactly 5 questions/);

      await expect(
        repo.createLeadForCampaign({
          campaign_id: '00000000-0000-0000-0000-000000000001',
          full_name: 'Nguyễn Văn A',
          phone_number: '0111222333', // invalid prefix
          score: 1200,
          time_taken_seconds: 30,
          voucher_code: 'VIBE20',
        })
      ).rejects.toThrowError(DatabaseOperationError);
    });

    it('queries published campaigns by slug and formats public leaderboard ranks without raw phone_number', async () => {
      const mockLeaderboardData = [
        {
          id: 'lead-uuid-1',
          campaign_id: 'camp-uuid-1',
          full_name: 'Nguyễn Minh Quân',
          masked_phone: '098***4321',
          score: 1900,
          time_taken_seconds: 22,
          submitted_at: '2026-11-05T00:00:00.000Z',
        },
        {
          id: 'lead-uuid-2',
          campaign_id: 'camp-uuid-1',
          full_name: 'Trần Bảo Ngọc',
          masked_phone: '091***5678',
          score: 1650,
          time_taken_seconds: 35,
          submitted_at: '2026-11-05T00:01:00.000Z',
        },
      ];

      const mockLimit = vi.fn().mockResolvedValue({ data: mockLeaderboardData, error: null });
      const mockOrder3 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockOrder2 = vi.fn().mockReturnValue({ order: mockOrder3 });
      const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      const mockClient = {
        from: vi.fn().mockReturnValue({ select: mockSelect }),
      } as unknown as ReturnType<typeof createSupabaseServerClient>;

      const repo = new QuizVibeDatabaseRepository(mockClient);
      const leaderboard = await repo.getCampaignLeaderboard('camp-uuid-1', 10);

      expect(mockSelect).toHaveBeenCalledWith(
        'id, campaign_id, full_name, masked_phone, score, time_taken_seconds, submitted_at'
      );
      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].masked_phone).toBe('098***4321');
      expect('phone_number' in leaderboard[0]).toBe(false);
      expect(leaderboard[1].rank).toBe(2);
    });
  });

  describe('5. Safe Explicit LocalStorage Migration Helper (Step 4 Privacy Guard)', () => {
    const sampleLegacyCampaign = {
      id: 'preset_cosmetics_01',
      title: 'Thử Thách Chăm Da Rạng Rỡ Cùng GlowBeauty',
      description: 'Mô tả chiến dịch',
      industry: 'Cosmetics',
      questions: [0, 1, 2, 3, 4].map((i) => ({
        id: `q_${i}`,
        question: `Câu hỏi số ${i + 1} là gì?`,
        options: ['A', 'B', 'C', 'D'] as [string, string, string, string],
        correctIndex: 0,
      })),
      voucher: {
        code: 'VIBE20',
        discount: 'Giảm 20%',
        description: 'Áp dụng toàn shop',
      },
      isMock: true,
    };

    const sampleLegacyLeads = [
      {
        id: 'lead_1',
        fullName: 'Nguyễn Minh Quân',
        phoneNumber: '0987654321',
        score: 1800,
        timeTakenSeconds: 25,
        voucherCode: 'VIBE20',
        campaignId: 'preset_cosmetics_01',
        submittedAt: '2026-11-05T00:00:00.000Z',
      },
    ];

    it('excludes personal lead records by default unless includePersonalLeads is explicitly true', () => {
      const defaultBundle = buildExplicitLocalStorageMigrationBundle(
        sampleLegacyCampaign,
        sampleLegacyLeads
      );
      expect(defaultBundle.campaignDetails.campaign.slug).toBe(
        'thu-thach-cham-da-rang-ro-cung-glowbeauty'
      );
      expect(defaultBundle.campaignDetails.campaign.status).toBe('draft');
      expect(defaultBundle.leadsToMigrate).toEqual([]);

      const explicitOptInBundle = buildExplicitLocalStorageMigrationBundle(
        sampleLegacyCampaign,
        sampleLegacyLeads,
        { targetStatus: 'published', includePersonalLeads: true }
      );
      expect(explicitOptInBundle.campaignDetails.campaign.status).toBe('published');
      expect(explicitOptInBundle.leadsToMigrate).toHaveLength(1);
      expect(explicitOptInBundle.leadsToMigrate[0].phone_number).toBe('0987654321');
    });
  });
});

