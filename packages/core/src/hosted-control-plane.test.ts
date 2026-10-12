import { describe, expect, it } from 'vitest';
import { LINGVA_HOSTED_CONTROL_PLANE_ACTIONS, isLingvaHostedControlPlaneAction } from './hosted-control-plane';

describe('hosted control-plane contract', () => {
  it('exposes stable publish, invalidation, history, and rollback action constants', () => {
    expect(LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.publish).toBe('publish');
    expect(LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.invalidate).toBe('invalidate');
    expect(LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.listInvalidations).toBe('listInvalidations');
    expect(LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.listHistory).toBe('listHistory');
    expect(LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.listRollbacks).toBe('listRollbacks');
    expect(LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.rollback).toBe('rollback');
    expect(isLingvaHostedControlPlaneAction('publish')).toBe(true);
    expect(isLingvaHostedControlPlaneAction('listInvalidations')).toBe(true);
    expect(isLingvaHostedControlPlaneAction('listRollbacks')).toBe(true);
    expect(isLingvaHostedControlPlaneAction('rollback')).toBe(true);
    expect(isLingvaHostedControlPlaneAction('approve-draft')).toBe(false);
  });
});
