// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import markdownHandler from './markdown.js';
import apiIndexHandler from './index.js';
import healthHandler from './health.js';
import { mockHttp } from './_lib/testing/httpMock.js';
import { CampaignService } from './_lib/campaigns/campaignService.js';

vi.mock('./_lib/campaigns/campaignService.js', () => {
  const MockService = vi.fn();
  MockService.prototype.getPublicBySlug = vi.fn();
  return {
    CampaignService: MockService,
  };
});

describe('Vercel Is Agentic Audit Remediation Verification', () => {
  const rootDir = process.cwd();

  // ---------------------------------------------------------------------------
  // 1. Initial HTML Content Without JavaScript Execution
  // ---------------------------------------------------------------------------
  describe('1. Initial HTML Response (Machine-Readable Without JS)', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    it('contains page title, canonical URL, and alternate markdown link', () => {
      expect(htmlContent).toContain('<title>QuizVibe AI — Minigame Quiz Thu Lead Fanpage</title>');
      expect(htmlContent).toContain('<link rel="canonical" href="https://quiz-vibe-ai.vercel.app/" />');
      expect(htmlContent).toContain('<link rel="alternate" type="text/markdown" href="/llms.txt" title="LLM Documentation" />');
    });

    it('contains rich machine-readable semantic content inside #root before React mounts', () => {
      expect(htmlContent).toContain('<div id="root">');
      // What QuizVibe AI is
      expect(htmlContent).toContain('Nền tảng Minigame Quiz Tương Tác Thu Lead &amp; Phân Phối Voucher với AI');
      expect(htmlContent).toContain('Biến Lượt Tương Tác Fanpage Thành Khách Hàng Tiềm Năng Bằng Minigame Trắc Nghiệm Thông Minh');
      // Target audience
      expect(htmlContent).toContain('doanh nghiệp, chủ cửa hàng, và các thương hiệu bán lẻ');
      // Capabilities
      expect(htmlContent).toContain('Tạo Câu Hỏi Bằng AI &amp; Kiểm Duyệt');
      expect(htmlContent).toContain('Trải Nghiệm Chơi Game Tactile 30s');
      expect(htmlContent).toContain('Thu Lead &amp; Đổi Mã Voucher');
      expect(htmlContent).toContain('Bảng Xếp Hạng Top 10 Minh Bạch');
      // How to participate & access
      expect(htmlContent).toContain('/quiz/active');
      expect(htmlContent).toContain('/admin/login');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Structured Data (JSON-LD) Validation
  // ---------------------------------------------------------------------------
  describe('2. Structured Data (JSON-LD) Validation', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    it('contains valid Schema.org SoftwareApplication JSON-LD', () => {
      const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(htmlContent);
      expect(match).not.toBeNull();
      const jsonLd = JSON.parse(match![1].trim());

      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('SoftwareApplication');
      expect(jsonLd.name).toBe('QuizVibe AI');
      expect(jsonLd.applicationCategory).toBe('BusinessApplication');
      expect(jsonLd.url).toBe('https://quiz-vibe-ai.vercel.app');
      expect(Array.isArray(jsonLd.featureList)).toBe(true);
      expect(jsonLd.featureList.length).toBeGreaterThanOrEqual(4);
      expect(jsonLd.offers).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Crawler Policies: robots.txt and sitemap.xml
  // ---------------------------------------------------------------------------
  describe('3. Crawler Policies (robots.txt and sitemap.xml)', () => {
    it('robots.txt allows public indexable paths, llms.txt, and disallows admin/api', () => {
      const robotsPath = path.join(rootDir, 'public', 'robots.txt');
      expect(fs.existsSync(robotsPath)).toBe(true);
      const robots = fs.readFileSync(robotsPath, 'utf-8');

      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Allow: /');
      expect(robots).toContain('Allow: /quiz/');
      expect(robots).toContain('Allow: /llms.txt');
      expect(robots).toContain('Allow: /sitemap.xml');
      expect(robots).toContain('Disallow: /admin');
      expect(robots).toContain('Disallow: /api/');
      expect(robots).toContain('Sitemap: https://quiz-vibe-ai.vercel.app/sitemap.xml');
    });

    it('sitemap.xml lists only public indexable URLs without admin or private APIs', () => {
      const sitemapPath = path.join(rootDir, 'public', 'sitemap.xml');
      expect(fs.existsSync(sitemapPath)).toBe(true);
      const sitemap = fs.readFileSync(sitemapPath, 'utf-8');

      expect(sitemap).toContain('https://quiz-vibe-ai.vercel.app/');
      expect(sitemap).toContain('https://quiz-vibe-ai.vercel.app/quiz/active');
      expect(sitemap).not.toContain('/admin');
      expect(sitemap).not.toContain('/api');
    });

    it('llms.txt and llms-full.txt exist and provide standard LLM agent documentation', () => {
      const llmsPath = path.join(rootDir, 'public', 'llms.txt');
      const llmsFullPath = path.join(rootDir, 'public', 'llms-full.txt');

      expect(fs.existsSync(llmsPath)).toBe(true);
      expect(fs.existsSync(llmsFullPath)).toBe(true);

      const llms = fs.readFileSync(llmsPath, 'utf-8');
      expect(llms).toContain('# QuizVibe AI');
      expect(llms).toContain('AI Question Generator');
      expect(llms).toContain('Speed Scoring Gameplay');

      const llmsFull = fs.readFileSync(llmsFullPath, 'utf-8');
      expect(llmsFull).toContain('Full System Documentation');
      expect(llmsFull).toContain('Public Endpoints');
    });

    it('404.html exists in public/ for genuine 404 responses on nonexistent routes', () => {
      const notFoundPath = path.join(rootDir, 'public', '404.html');
      expect(fs.existsSync(notFoundPath)).toBe(true);
      const notFound = fs.readFileSync(notFoundPath, 'utf-8');

      expect(notFound).toContain('404');
      expect(notFound).toContain('Trang Không Tồn Tại');
      expect(notFound).toContain('Quay Về Trang Chủ');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Markdown Content Negotiation (/api/markdown)
  // ---------------------------------------------------------------------------
  describe('4. Markdown Content Negotiation (/api/markdown)', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('returns 200 with text/markdown for root product overview', async () => {
      const { req, res } = mockHttp({ method: 'GET', query: {} });

      await markdownHandler(req, res);

      expect(res.status$()).toBe(200);
      expect(res.headers$()['Content-Type']).toContain('text/markdown');
      expect(res.headers$()['Vary']).toBe('Accept');
      expect(res.body$()).toContain('# QuizVibe AI');
      expect(res.body$()).toContain('What is QuizVibe AI?');
      expect(res.body$()).toContain('Core Capabilities');
    });

    it('returns 200 with markdown for a published campaign slug', async () => {
      vi.spyOn(CampaignService.prototype, 'getPublicBySlug').mockResolvedValueOnce({
        id: 'camp-123',
        slug: 'thu-thach-skincare',
        title: 'Thử Thách Skincare Rạng Rỡ',
        description: 'Chinh phục 5 câu đố vui nhận ngay mã voucher độc quyền!',
        industry: 'Mỹ phẩm & Chăm sóc da',
        isMock: false,
        questionCount: 5,
        questions: [],
        voucher: {
          discount: 'Giảm 25% cho đơn từ 200k',
          description: 'Áp dụng cho mọi sản phẩm serum',
          expiryDate: '15/12/2026',
          terms: 'Chỉ áp dụng một lần duy nhất',
        },
      });

      const { req, res } = mockHttp({ method: 'GET', query: { slug: 'thu-thach-skincare' } });

      await markdownHandler(req, res);

      expect(res.status$()).toBe(200);
      expect(res.headers$()['Content-Type']).toContain('text/markdown');
      expect(res.body$()).toContain('# Thử Thách Skincare Rạng Rỡ');
      expect(res.body$()).toContain('Mỹ phẩm & Chăm sóc da');
      expect(res.body$()).toContain('Giảm 25% cho đơn từ 200k');
      expect(res.body$()).toContain('https://quiz-vibe-ai.vercel.app/quiz/thu-thach-skincare');
    });

    it('returns genuine 404 with markdown for an unknown/unpublished campaign slug', async () => {
      vi.spyOn(CampaignService.prototype, 'getPublicBySlug').mockResolvedValueOnce(null);

      const { req, res } = mockHttp({ method: 'GET', query: { slug: 'nonexistent-campaign' } });

      await markdownHandler(req, res);

      expect(res.status$()).toBe(404);
      expect(res.headers$()['Content-Type']).toContain('text/markdown');
      expect(res.body$()).toContain('# 404 Not Found');
      expect(res.body$()).toContain('không tồn tại hoặc chưa được xuất bản');
    });

    it('rejects non-GET methods with 405 Method Not Allowed', async () => {
      const { req, res } = mockHttp({ method: 'POST', query: {} });

      await markdownHandler(req, res);

      expect(res.status$()).toBe(405);
      expect(res.headers$()['Allow']).toBe('GET');
      expect(res.body$()).toContain('405 Method Not Allowed');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. API Discovery Manifest (/api) and Health (/api/health)
  // ---------------------------------------------------------------------------
  describe('5. API Discovery Manifest & Health Endpoints', () => {
    it('GET /api returns machine-readable JSON catalog of all endpoints and security policies', async () => {
      const { req, res } = mockHttp({ method: 'GET' });

      await apiIndexHandler(req, res);

      expect(res.status$()).toBe(200);
      expect(res.headers$()['Content-Type']).toContain('application/json');
      const data = res.body$();

      expect(data.name).toBe('QuizVibe AI Public API');
      expect(data.status).toBe('healthy');
      expect(data.endpoints.public).toBeDefined();
      expect(data.endpoints.player_session_required).toBeDefined();
      expect(data.endpoints.admin_authenticated).toBeDefined();

      // Ensure public endpoints are accurately listed
      const publicPaths = data.endpoints.public.map((e: { path: string }) => e.path);
      expect(publicPaths).toContain('/api');
      expect(publicPaths).toContain('/api/health');
      expect(publicPaths).toContain('/api/markdown');
      expect(publicPaths).toContain('/api/public/campaign?slug=:slug');
      expect(publicPaths).toContain('/api/quiz/leaderboard?slug=:slug');
    });

    it('GET /api/health returns 200 OK with service status', async () => {
      const { req, res } = mockHttp({ method: 'GET' });

      await healthHandler(req, res);

      expect(res.status$()).toBe(200);
      const data = res.body$();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('quizvibe-ai');
      expect(data.timestamp).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Vercel Routing Configuration (vercel.json)
  // ---------------------------------------------------------------------------
  describe('6. Vercel Routing Configuration (vercel.json)', () => {
    const vercelConfigPath = path.join(rootDir, 'vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));

    it('includes markdown content-type headers for llms.txt and llms-full.txt', () => {
      const headers = vercelConfig.headers || [];
      const llmsHeader = headers.find((h: { source: string }) => h.source === '/llms.txt');
      expect(llmsHeader).toBeDefined();
      expect(llmsHeader.headers.find((k: { key: string }) => k.key === 'Content-Type')?.value).toContain('text/markdown');
    });

    it('routes requests with Accept: text/markdown to markdown endpoint or document', () => {
      const rewrites = vercelConfig.rewrites || [];
      const mdRoot = rewrites.find(
        (r: { source: string; has?: Array<{ key: string; value: string }> }) =>
          r.source === '/' && r.has?.some((h) => h.key === 'accept' && h.value.includes('text/markdown'))
      );
      expect(mdRoot).toBeDefined();
      expect(mdRoot.destination).toMatch(/^\/(api\/markdown|llms\.txt)$/);

      const mdQuiz = rewrites.find(
        (r: { source: string; has?: Array<{ key: string; value: string }> }) =>
          r.source === '/quiz/:slug' && r.has?.some((h) => h.key === 'accept' && h.value.includes('text/markdown'))
      );
      expect(mdQuiz).toBeDefined();
      expect(mdQuiz.destination).toMatch(/^\/(api\/markdown\?slug=:slug|llms\.txt)$/);
    });

    it('preserves Open Graph crawler rewrites for / and /quiz/:slug', () => {
      const rewrites = vercelConfig.rewrites || [];
      const ogRewrite = rewrites.find(
        (r: { source: string; destination: string }) => r.destination === '/api/og?slug=:slug'
      );
      expect(ogRewrite).toBeDefined();
    });

    it('rewrites only valid SPA application routes to /index.html and avoids universal catch-all soft 404s', () => {
      const rewrites = vercelConfig.rewrites || [];
      // Valid SPA routes
      expect(rewrites.some((r: { source: string; destination: string }) => r.source === '/quiz/:slug' && r.destination === '/index.html')).toBe(true);
      expect(rewrites.some((r: { source: string; destination: string }) => r.source === '/admin' && r.destination === '/index.html')).toBe(true);
      expect(rewrites.some((r: { source: string; destination: string }) => r.source === '/admin/:path*' && r.destination === '/index.html')).toBe(true);

      // Verify that the old universal catch-all /((?!...).*) is removed
      const universalCatchAll = rewrites.find((r: { source: string }) => r.source.includes('(?!assets'));
      expect(universalCatchAll).toBeUndefined();
    });
  });
});
