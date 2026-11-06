// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { CampaignValidationCache } from './campaignCache.js';
import type { CachedQuestionValidation } from './campaignCache.js';

describe('CampaignValidationCache', () => {
  let nowTime: number;
  let cache: CampaignValidationCache;

  const sampleQuestions: CachedQuestionValidation[] = [
    {
      question_order: 0,
      question_text: 'Câu 1?',
      options: ['A', 'B', 'C', 'D'],
      correct_index: 0,
      explanation: 'Giải thích 1',
    },
    {
      question_order: 1,
      question_text: 'Câu 2?',
      options: ['A', 'B', 'C', 'D'],
      correct_index: 1,
      explanation: 'Giải thích 2',
    },
  ];

  beforeEach(() => {
    nowTime = 100000;
    cache = new CampaignValidationCache({
      ttlMs: 60000,
      now: () => nowTime,
    });
  });

  it('stores and retrieves validation data within TTL', () => {
    cache.setValidation('camp_1', {
      id: 'camp_1',
      status: 'published',
      questions: sampleQuestions,
    });

    const retrieved = cache.getValidation('camp_1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('camp_1');
    expect(retrieved?.status).toBe('published');
    expect(retrieved?.questions).toHaveLength(2);
    expect(retrieved?.questions[0].correct_index).toBe(0);
  });

  it('expires validation data after TTL elapses', () => {
    cache.setValidation('camp_1', {
      id: 'camp_1',
      status: 'published',
      questions: sampleQuestions,
    });

    // Advance time past TTL (60s = 60,000ms)
    nowTime += 60001;

    const retrieved = cache.getValidation('camp_1');
    expect(retrieved).toBeNull();
  });

  it('stores and retrieves pre-cached static questions', () => {
    cache.setQuestions('camp_2', sampleQuestions);

    const questions = cache.getQuestions('camp_2');
    expect(questions).not.toBeNull();
    expect(questions).toHaveLength(2);
    expect(questions?.[1].question_text).toBe('Câu 2?');
  });

  it('invalidates a specific campaign entry', () => {
    cache.setValidation('camp_1', {
      id: 'camp_1',
      status: 'published',
      questions: sampleQuestions,
    });
    cache.setQuestions('camp_1', sampleQuestions);
    cache.setValidation('camp_2', {
      id: 'camp_2',
      status: 'published',
      questions: sampleQuestions,
    });

    cache.invalidate('camp_1');

    expect(cache.getValidation('camp_1')).toBeNull();
    expect(cache.getQuestions('camp_1')).toBeNull();
    expect(cache.getValidation('camp_2')).not.toBeNull();
  });

  it('clears all cached entries', () => {
    cache.setValidation('camp_1', {
      id: 'camp_1',
      status: 'published',
      questions: sampleQuestions,
    });
    cache.setValidation('camp_2', {
      id: 'camp_2',
      status: 'published',
      questions: sampleQuestions,
    });

    cache.clear();

    expect(cache.validationSize).toBe(0);
    expect(cache.questionsSize).toBe(0);
  });

  it('evicts oldest entries when reaching max entries', () => {
    const smallCache = new CampaignValidationCache({
      ttlMs: 60000,
      now: () => nowTime,
    });

    // Inject 101 entries
    for (let i = 0; i < 101; i++) {
      smallCache.setValidation(`camp_${i}`, {
        id: `camp_${i}`,
        status: 'published',
        questions: sampleQuestions,
      });
    }

    // Oldest entry (camp_0) should be evicted
    expect(smallCache.validationSize).toBe(100);
    expect(smallCache.getValidation('camp_0')).toBeNull();
    expect(smallCache.getValidation('camp_100')).not.toBeNull();
  });
});
