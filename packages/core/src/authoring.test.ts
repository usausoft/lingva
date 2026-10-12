import { describe, expect, it } from 'vitest';
import type { LingvaDictionary } from './contracts';
import {
  LINGVA_REMOTE_AUTHORING_ACTIONS,
  LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUSES,
  LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUS_VALUES,
  LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES,
  applyLingvaTranslationEdit,
  createLingvaRemoteAuthoringDraftPayload,
  isLingvaRemoteAuthoringDraftReviewStatus,
  isLingvaRemoteAuthoringDraftStatus,
  parseLingvaRemoteAuthoringDraftResponse,
  parseLingvaRemoteAuthoringDraftsResponse,
} from './authoring';

describe('applyLingvaTranslationEdit', () => {
  it('updates a plain string leaf without mutating the original dictionary', () => {
    const dictionary: LingvaDictionary = {
      hero: {
        badge: 'Guided onboarding',
      },
    };

    const updated = applyLingvaTranslationEdit(dictionary, {
      locale: 'en',
      key: 'hero.badge',
      value: 'Interactive localization',
    });

    expect(updated).toEqual({
      hero: {
        badge: 'Interactive localization',
      },
    });
    expect(dictionary).toEqual({
      hero: {
        badge: 'Guided onboarding',
      },
    });
  });

  it('updates a selected variant without changing sibling variants', () => {
    const dictionary: LingvaDictionary = {
      hero: {
        tagline: [
          {
            id: 'calm',
            text: 'Calm copy',
            tone: 'calm',
          },
          {
            id: 'bold',
            text: 'Bold copy',
            tone: 'bold',
          },
        ],
      },
    };

    const updated = applyLingvaTranslationEdit(dictionary, {
      locale: 'en',
      key: 'hero.tagline',
      value: 'Sharper bold copy',
      variantId: 'bold',
    });

    expect(updated).toEqual({
      hero: {
        tagline: [
          {
            id: 'calm',
            text: 'Calm copy',
            tone: 'calm',
          },
          {
            id: 'bold',
            text: 'Sharper bold copy',
            tone: 'bold',
          },
        ],
      },
    });
  });

  it('creates a new variant key and appends sibling variants', () => {
    const firstEdit = applyLingvaTranslationEdit(
      {},
      {
        locale: 'en',
        key: 'hero.cta',
        value: 'Start now',
        variantId: 'primary',
      }
    );
    const secondEdit = applyLingvaTranslationEdit(firstEdit, {
      locale: 'en',
      key: 'hero.cta',
      value: 'Maybe later',
      variantId: 'secondary',
    });

    expect(secondEdit).toEqual({
      hero: {
        cta: [
          { id: 'primary', text: 'Start now' },
          { id: 'secondary', text: 'Maybe later' },
        ],
      },
    });
  });

  it('fails loudly when editing a variant leaf without a variant id', () => {
    expect(() =>
      applyLingvaTranslationEdit(
        {
          hero: {
            tagline: [
              {
                id: 'bold',
                text: 'Bold copy',
              },
            ],
          },
        },
        {
          locale: 'en',
          key: 'hero.tagline',
          value: 'Updated',
        }
      )
    ).toThrow('Key "hero.tagline" requires a variant id.');
  });
});

describe('remote authoring draft contract', () => {
  it('exposes stable action and status constants for hosted authoring clients', () => {
    expect(LINGVA_REMOTE_AUTHORING_ACTIONS).toMatchObject({
      approveDraft: 'approve-draft',
      createDraft: 'create-draft',
      deleteKey: 'delete-key',
      listDrafts: 'list-drafts',
    });
    expect(LINGVA_REMOTE_AUTHORING_DRAFT_STATUSES.approved).toBe('approved');
    expect(LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUSES.all).toBe('all');
    expect(LINGVA_REMOTE_AUTHORING_DRAFT_REVIEW_STATUS_VALUES).toEqual(['draft', 'approved', 'all']);
    expect(isLingvaRemoteAuthoringDraftStatus('draft')).toBe(true);
    expect(isLingvaRemoteAuthoringDraftStatus('all')).toBe(false);
    expect(isLingvaRemoteAuthoringDraftReviewStatus('all')).toBe(true);
    expect(isLingvaRemoteAuthoringDraftReviewStatus('deleted')).toBe(false);
  });

  it('creates hosted draft payloads with normalized identity fields', () => {
    expect(
      createLingvaRemoteAuthoringDraftPayload(
        {
          locale: ' ru ',
          key: ' hero.title ',
          value: 'Новый заголовок',
          variantId: ' friendly ',
        },
        {
          authorId: ' translator@example.com ',
          environment: ' stage ',
          projectId: ' web-site ',
        }
      )
    ).toEqual({
      authorId: 'translator@example.com',
      environment: 'stage',
      key: 'hero.title',
      locale: 'ru',
      projectId: 'web-site',
      value: 'Новый заголовок',
      variantId: 'friendly',
    });
  });

  it('rejects invalid hosted draft payloads', () => {
    expect(() =>
      createLingvaRemoteAuthoringDraftPayload(
        {
          locale: 'ru',
          key: 'hero.title',
          value: 'Updated',
        },
        {}
      )
    ).toThrow(/projectId/);

    expect(() =>
      createLingvaRemoteAuthoringDraftPayload(
        {
          locale: 'ru',
          key: 'hero.title',
          value: 'x'.repeat(20_001),
        },
        { projectId: 'web-site' }
      )
    ).toThrow(/too large/);

    expect(() =>
      createLingvaRemoteAuthoringDraftPayload(
        {
          locale: 'ru',
          key: 'a'.repeat(201),
          value: 'Updated',
        },
        { projectId: 'web-site' }
      )
    ).toThrow(/at most 200 characters/u);
  });

  it('parses successful hosted draft responses', () => {
    expect(
      parseLingvaRemoteAuthoringDraftResponse({
        ok: true,
        draftId: 'draft_123',
      })
    ).toEqual({
      ok: true,
      draftId: 'draft_123',
    });
    expect(() => parseLingvaRemoteAuthoringDraftResponse({ ok: false })).toThrow(/ok: true/);
  });

  it('parses hosted draft list responses', () => {
    expect(
      parseLingvaRemoteAuthoringDraftsResponse({
        ok: true,
        nextToken: 'next-page',
        translationKeyQuota: { limit: 100, remaining: 58, used: 42 },
        drafts: [
          {
            projectId: 'web-site',
            environment: 'dev',
            draftId: 'draft_123',
            status: 'approved',
            locale: 'ru',
            key: 'hero.title',
            value: 'Новый заголовок',
            createdAt: '2026-04-27T08:00:00.000Z',
            approvedAt: '2026-04-27T08:05:00.000Z',
            approvedBy: 'reviewer@example.com',
          },
        ],
      })
    ).toEqual({
      ok: true,
      count: 1,
      nextToken: 'next-page',
      translationKeyQuota: { limit: 100, remaining: 58, used: 42 },
      drafts: [
        {
          projectId: 'web-site',
          environment: 'dev',
          draftId: 'draft_123',
          status: 'approved',
          locale: 'ru',
          key: 'hero.title',
          value: 'Новый заголовок',
          createdAt: '2026-04-27T08:00:00.000Z',
          approvedAt: '2026-04-27T08:05:00.000Z',
          approvedBy: 'reviewer@example.com',
        },
      ],
    });

    expect(() => parseLingvaRemoteAuthoringDraftsResponse({ ok: true })).toThrow(/drafts\[\]/);
  });
});
