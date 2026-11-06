// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from './og.js';
import { CampaignService } from './_lib/campaigns/index.js';

vi.mock('./_lib/campaigns/index.js', () => {
  return {
    CampaignService: vi.fn(),
  };
});

describe('Crawler Open Graph Generator /api/og', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const createMockReqRes = (method = 'GET', query: Record<string, any> = {}) => {
    const req = {
      method,
      query,
    };
    let statusCode = 200;
    let sentBody: string = '';
    const headers: Record<string, string> = {};

    const res = {
      setHeader: (key: string, val: string) => {
        headers[key.toLowerCase()] = val;
      },
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      send: (body: string) => {
        sentBody = body;
        return res;
      },
      _getStatusCode: () => statusCode,
      _getSentBody: () => sentBody,
      _getHeaders: () => headers,
    };

    return { req, res };
  };

  it('rejects non-GET HTTP methods with HTTP 405', async () => {
    const { req, res } = createMockReqRes('POST');
    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(res._getHeaders()['allow']).toBe('GET');
  });

  it('returns default Open Graph HTML when no slug is provided', async () => {
    const { req, res } = createMockReqRes('GET', {});
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getHeaders()['content-type']).toContain('text/html');
    expect(res._getHeaders()['cache-control']).toBe('public, max-age=60, s-maxage=300');

    const html = res._getSentBody();
    expect(html).toContain('<meta property="og:site_name" content="QuizVibe AI" />');
    expect(html).toContain('og-image.png');
    expect(html).toContain('<meta property="og:type" content="website" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it('returns customized Open Graph tags when campaign exists for the slug', async () => {
    const mockGetPublicBySlug = vi.fn().mockResolvedValue({
      id: 'c123',
      title: 'Đại Chiến Âm Nhạc 2026',
      description: 'Thử tài am hiểu V-pop nhận voucher 50%!',
      slug: 'dai-chien-am-nhac-2026',
    });
    (CampaignService as any).mockImplementation(function (this: any) {
      this.getPublicBySlug = mockGetPublicBySlug;
      return this;
    });

    const { req, res } = createMockReqRes('GET', { slug: 'dai-chien-am-nhac-2026' });
    await handler(req, res);

    expect(mockGetPublicBySlug).toHaveBeenCalledWith('dai-chien-am-nhac-2026');
    expect(res._getStatusCode()).toBe(200);

    const html = res._getSentBody();
    expect(html).toContain('Đại Chiến Âm Nhạc 2026');
    expect(html).toContain('Thử tài am hiểu V-pop nhận voucher 50%!');
    expect(html).toContain('https://quiz-vibe-ai.vercel.app/quiz/dai-chien-am-nhac-2026');
    expect(html).toContain('https://quiz-vibe-ai.vercel.app/og-image.png');
  });

  it('escapes special characters to prevent HTML/XSS injection in metadata', async () => {
    const maliciousTitle = 'Test "><script>alert(1)</script>';
    const mockGetPublicBySlug = vi.fn().mockResolvedValue({
      id: 'c123',
      title: maliciousTitle,
      description: 'Description with "quotes" and <tags>',
      slug: 'malicious-slug',
    });
    (CampaignService as any).mockImplementation(function (this: any) {
      this.getPublicBySlug = mockGetPublicBySlug;
      return this;
    });

    const { req, res } = createMockReqRes('GET', { slug: 'malicious-slug' });
    await handler(req, res);

    const html = res._getSentBody();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('falls back gracefully to default metadata if campaign lookup throws error', async () => {
    (CampaignService as any).mockImplementation(function (this: any) {
      this.getPublicBySlug = vi.fn().mockRejectedValue(new Error('Database unavailable'));
      return this;
    });

    const { req, res } = createMockReqRes('GET', { slug: 'error-slug' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const html = res._getSentBody();
    expect(html).toContain('QuizVibe AI');
  });
});
