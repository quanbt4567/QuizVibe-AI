import { useState, useEffect, useCallback } from 'react';
import { Campaign } from '../types';

export type AdminRouteSection = 'overview' | 'campaigns' | 'leads' | 'vouchers';

export type MatchedAppRoute =
  | {
      kind: 'public-quiz';
      slug: string;
      isRootAlias: boolean;
      pathname: string;
    }
  | {
      kind: 'admin-login';
      pathname: string;
    }
  | {
      kind: 'admin';
      section: AdminRouteSection;
      pathname: string;
      /** Campaign workspace sub-views: /admin/campaigns/new and /admin/campaigns/:id/edit */
      view?: 'new' | 'edit';
      campaignId?: string;
    }
  | {
      kind: 'not-found';
      area: 'admin' | 'public';
      pathname: string;
    };

/**
 * Generates a deterministic URL-safe kebab-case slug from a Vietnamese campaign title.
 */
export function getCampaignSlug(campaign: Pick<Campaign, 'id' | 'title'> | null | undefined): string {
  if (!campaign) return 'active';
  const normalized = (campaign.title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length >= 3 ? normalized : campaign.id.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

/**
 * Resolves a campaign against a given public slug.
 * Matches if the slug is the root 'active' alias or exactly matches the campaign's generated slug.
 */
export function resolvePublicCampaignBySlug(
  slug: string,
  campaign: Campaign | null | undefined
): Campaign | null {
  if (!campaign) return null;
  const cleanSlug = (slug || '').trim().toLowerCase();
  if (!cleanSlug) return null;
  if (cleanSlug === 'active') return campaign;
  const campaignSlug = getCampaignSlug(campaign);
  if (campaignSlug === cleanSlug) return campaign;
  if (campaign.id && campaign.id.toLowerCase() === cleanSlug) return campaign;
  return null;
}

/**
 * Normalizes a raw URL pathname by stripping query/hash and trailing slashes.
 */
export function normalizePathname(rawPathname: string): string {
  const withoutQuery = (rawPathname || '/').split('?')[0].split('#')[0].trim();
  if (!withoutQuery || withoutQuery === '/') return '/';
  const cleaned = withoutQuery.replace(/\/+$/, '');
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

/**
 * Pure route matcher mapping URL pathnames to Admin or Public Player route descriptors.
 */
export function matchAppRoute(rawPathname: string): MatchedAppRoute {
  const pathname = normalizePathname(rawPathname);

  if (pathname === '/') {
    return {
      kind: 'public-quiz',
      slug: 'active',
      isRootAlias: true,
      pathname,
    };
  }

  if (pathname === '/admin/login') {
    return {
      kind: 'admin-login',
      pathname,
    };
  }

  if (pathname === '/admin') {
    return {
      kind: 'admin',
      section: 'overview',
      pathname,
    };
  }

  if (pathname === '/admin/campaigns') {
    return {
      kind: 'admin',
      section: 'campaigns',
      pathname,
    };
  }

  if (pathname === '/admin/campaigns/new') {
    return {
      kind: 'admin',
      section: 'campaigns',
      view: 'new',
      pathname,
    };
  }

  const editMatch = /^\/admin\/campaigns\/([0-9a-fA-F-]{36})\/edit$/.exec(pathname);
  if (editMatch) {
    return {
      kind: 'admin',
      section: 'campaigns',
      view: 'edit',
      campaignId: editMatch[1].toLowerCase(),
      pathname,
    };
  }

  if (pathname === '/admin/leads') {
    return {
      kind: 'admin',
      section: 'leads',
      pathname,
    };
  }

  if (pathname === '/admin/vouchers') {
    return {
      kind: 'admin',
      section: 'vouchers',
      pathname,
    };
  }

  if (pathname.startsWith('/admin/')) {
    return {
      kind: 'not-found',
      area: 'admin',
      pathname,
    };
  }

  // Match /quiz/:slug (single non-empty segment)
  const quizMatch = /^\/quiz\/([^/]+)$/.exec(pathname);
  if (quizMatch) {
    let decodedSlug = quizMatch[1];
    try {
      decodedSlug = decodeURIComponent(quizMatch[1]);
    } catch {
      decodedSlug = quizMatch[1];
    }
    const cleanSlug = decodedSlug.trim().toLowerCase();
    if (cleanSlug.length > 0) {
      return {
        kind: 'public-quiz',
        slug: cleanSlug,
        isRootAlias: false,
        pathname,
      };
    }
  }

  return {
    kind: 'not-found',
    area: 'public',
    pathname,
  };
}

/**
 * Lightweight History API router hook for React 19.
 * Supports direct URL entry, browser refresh, Back/Forward (`popstate`), and programmatic navigation.
 */
export function useAppRouter() {
  const [pathname, setPathname] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location) {
      return normalizePathname(window.location.pathname);
    }
    return '/';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setPathname(normalizePathname(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      const normalized = normalizePathname(to);
      if (typeof window !== 'undefined' && window.history) {
        if (options?.replace) {
          window.history.replaceState({}, '', normalized);
        } else {
          window.history.pushState({}, '', normalized);
        }
      }
      setPathname(normalized);
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    },
    []
  );

  const route = matchAppRoute(pathname);

  return {
    pathname,
    route,
    navigate,
  };
}

