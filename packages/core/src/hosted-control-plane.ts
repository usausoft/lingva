export const LINGVA_HOSTED_CONTROL_PLANE_ACTIONS = {
  invalidate: 'invalidate',
  listInvalidations: 'listInvalidations',
  listHistory: 'listHistory',
  listRollbacks: 'listRollbacks',
  publish: 'publish',
  rollback: 'rollback',
} as const;

export type LingvaHostedControlPlaneAction =
  (typeof LINGVA_HOSTED_CONTROL_PLANE_ACTIONS)[keyof typeof LINGVA_HOSTED_CONTROL_PLANE_ACTIONS];

export function isLingvaHostedControlPlaneAction(value: unknown): value is LingvaHostedControlPlaneAction {
  return (
    value === LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.invalidate ||
    value === LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.listInvalidations ||
    value === LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.listHistory ||
    value === LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.listRollbacks ||
    value === LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.publish ||
    value === LINGVA_HOSTED_CONTROL_PLANE_ACTIONS.rollback
  );
}
