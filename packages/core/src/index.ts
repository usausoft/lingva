import { LingvaClient } from './runtime';
import { assertLingvaTranslationKey, getLingvaTranslationKeyValidationError } from './translation-keys';
import {
  LINGVA_BUNDLE_SCHEMA_VERSION,
  LINGVA_MESSAGE_KINDS,
  LINGVA_SERIALIZATION_FORMATS,
  LINGVA_VALIDATION_FAIL_MODES,
  LINGVA_VALIDATION_ISSUE_CODES,
  LINGVA_VALIDATION_SEVERITIES,
  LINGVA_WORKFLOW_STATUSES,
  LINGVA_WORKFLOW_SUMMARY_STATUSES,
  type LingvaWorkflowStatus,
  type LingvaWorkflowSummaryStatus,
} from './constants';
export {
  LINGVA_BOOLEAN_STRINGS,
  LINGVA_BUNDLE_SCHEMA_VERSION,
  LINGVA_CACHE_DIRECTIVES,
  LINGVA_DELIVERY_CACHE_STRATEGIES,
  LINGVA_DELIVERY_MODES,
  LINGVA_DELIVERY_QUERY_PARAMS,
  LINGVA_DELIVERY_SOURCES,
  LINGVA_DEPLOYMENT_STAGES,
  LINGVA_HTTP_HEADERS,
  LINGVA_HTTP_METHODS,
  LINGVA_FRAMEWORKS,
  LINGVA_SETUP_TARGETS,
  LINGVA_LOCAL_USER_ACTIONS,
  LINGVA_LOCAL_USER_STATUSES,
  LINGVA_MEDIA_TYPES,
  LINGVA_MESSAGE_KINDS,
  LINGVA_OPERATION_STATUSES,
  LINGVA_RUNTIME_MODES,
  LINGVA_SERIALIZATION_FORMATS,
  LINGVA_VALIDATION_SEVERITIES,
  LINGVA_VALIDATION_FAIL_MODES,
  LINGVA_VALIDATION_ISSUE_CODES,
  LINGVA_WORKFLOW_STATUSES,
  LINGVA_WORKFLOW_SUMMARY_STATUSES,
} from './constants';
export type {
  LingvaDeliveryCacheStrategy,
  LingvaDeliveryMode,
  LingvaDeliverySource,
  LingvaDeploymentStage,
  LingvaFramework,
  LingvaSetupTarget,
  LingvaOperationStatus,
  LingvaLocalRuntimeMode,
  LingvaRuntimeMode,
  LingvaSerializationFormat,
  LingvaValidationSeverity,
  LingvaValidationIssueCode,
  LingvaWorkflowSummaryStatus,
} from './constants';
export {
  LINGVA_TRANSLATION_KEY_MAX_LENGTH,
  LINGVA_TRANSLATION_KEY_PATTERN_SOURCE,
  assertLingvaTranslationKey,
  getLingvaTranslationKeyValidationError,
  isLingvaTranslationKey,
} from './translation-keys';
export { LINGVA_HOSTED_CONTROL_PLANE_ACTIONS, isLingvaHostedControlPlaneAction } from './hosted-control-plane';
export type { LingvaHostedControlPlaneAction } from './hosted-control-plane';
export {
  LINGVA_ONBOARDING_PLAN_TIERS,
  LINGVA_ONBOARDING_ROLES,
  isLingvaOnboardingPlanTier,
  isLingvaOnboardingRole,
} from './onboarding';
export type { LingvaOnboardingPlanTier, LingvaOnboardingRole } from './onboarding';
export {
  LINGVA_HOSTED_API_KEY_ID_PATTERN,
  LINGVA_HOSTED_API_KEY_NAME_MAX_LENGTH,
  LINGVA_HOSTED_API_KEY_SCOPE,
  LINGVA_HOSTED_API_KEY_SCOPES,
  LINGVA_HOSTED_PROJECT_API_KEY_STATUSES,
  LINGVA_HOSTED_PROJECT_API_KEY_STATUS,
  LINGVA_HOSTED_ENVIRONMENT_KIND,
  LINGVA_HOSTED_ENVIRONMENT_ID_PATTERN,
  LINGVA_HOSTED_ENVIRONMENT_KINDS,
  LINGVA_HOSTED_PROJECT_AUDIT_ACTIONS,
  LINGVA_HOSTED_PROJECT_AUDIT_ACTION,
  LINGVA_HOSTED_PROJECT_AUDIT_ACTOR_ID_MAX_LENGTH,
  LINGVA_HOSTED_PROJECT_AUDIT_ID_PATTERN,
  LINGVA_HOSTED_PROJECT_AUDIT_SUMMARY_MAX_LENGTH,
  LINGVA_HOSTED_PROJECT_AUDIT_TARGET_ID_MAX_LENGTH,
  LINGVA_HOSTED_PROJECT_AUDIT_TARGET_TYPES,
  LINGVA_HOSTED_PROJECT_AUDIT_TARGET_TYPE,
  LINGVA_HOSTED_INVITE_EMAIL_MAX_LENGTH,
  LINGVA_HOSTED_INVITE_ID_PATTERN,
  LINGVA_HOSTED_INVITE_NOTE_MAX_LENGTH,
  LINGVA_HOSTED_INVITE_ROLE_MAX_LENGTH,
  LINGVA_HOSTED_INVITE_TOKEN_MAX_LENGTH,
  LINGVA_HOSTED_PROJECT_INVITE_STATUSES,
  LINGVA_HOSTED_PROJECT_INVITE_STATUS,
  LINGVA_HOSTED_ASSIGNABLE_PROJECT_MEMBER_ROLES,
  LINGVA_HOSTED_PROJECT_MEMBER_ROLE,
  LINGVA_HOSTED_PROJECT_MEMBER_ROLES,
  LINGVA_HOSTED_PROJECT_MEMBER_STATUS,
  LINGVA_HOSTED_PROJECT_MEMBER_STATUSES,
  LINGVA_HOSTED_PROJECT_MEMBER_USER_ID_MAX_LENGTH,
  LINGVA_HOSTED_PROJECT_ACTIONS,
  LINGVA_HOSTED_PROJECT_DEFAULT_ENVIRONMENTS,
  LINGVA_HOSTED_PROJECT_DESCRIPTION_MAX_LENGTH,
  LINGVA_HOSTED_PROJECT_ID_PATTERN,
  LINGVA_HOSTED_LOCALE_MAX_LENGTH,
  LINGVA_HOSTED_LOCALE_PATTERN,
  LINGVA_HOSTED_PROJECT_NAME_MAX_LENGTH,
  FREE_TIER_LIMITS,
  LINGVA_HOSTED_API_KEY_LIMITS,
  LINGVA_HOSTED_PROJECT_TIER,
  LINGVA_HOSTED_PROJECT_TIERS,
  LINGVA_HOSTED_CUSTOMER_ROLES,
  createLingvaHostedApiKeyPayload,
  createLingvaHostedApiKeyRevokePayload,
  createLingvaHostedProjectAuditEventPayload,
  createLingvaHostedEnvironmentPayload,
  createLingvaHostedInviteAcceptPayload,
  createLingvaHostedInvitePayload,
  createLingvaHostedInviteRevokePayload,
  createLingvaHostedProjectPayload,
  createLingvaHostedProjectDeletePayload,
  createLingvaHostedProjectAdminUpdatePayload,
  createLingvaHostedCustomerUpdatePayload,
  createLingvaHostedProjectMemberPayload,
  createLingvaHostedProjectMemberRevokePayload,
  createLingvaHostedProjectRecord,
  createLingvaHostedProjectUpdatePayload,
  isLingvaHostedEnvironmentKind,
  isLingvaHostedCustomerRole,
  isLingvaHostedProjectAction,
  isLingvaHostedProjectAuditAction,
  isLingvaHostedProjectAuditTargetType,
  isLingvaHostedProjectMemberRole,
  isLingvaHostedProjectMemberStatus,
  isLingvaHostedProjectTier,
  normalizeLingvaHostedApiKeyCreateInput,
  normalizeLingvaHostedApiKeyRevokeInput,
  normalizeLingvaHostedEnvironment,
  normalizeLingvaHostedInviteAcceptInput,
  normalizeLingvaHostedInviteCreateInput,
  normalizeLingvaHostedInviteRevokeInput,
  normalizeLingvaHostedProjectAuditEvent,
  normalizeLingvaHostedProjectAuditListInput,
  normalizeLingvaHostedProjectMemberRevokeInput,
  normalizeLingvaHostedProjectMemberUpsertInput,
  normalizeLingvaHostedProjectUpdateInput,
} from './hosted-projects';
export type {
  LingvaHostedApiKeyCreateInput,
  LingvaHostedApiKeyRevokeInput,
  LingvaHostedApiKeyScope,
  LingvaHostedDefaultEnvironment,
  LingvaHostedEnvironmentKind,
  LingvaHostedEnvironmentUpsertInput,
  LingvaHostedInviteAcceptInput,
  LingvaHostedInviteCreateInput,
  LingvaHostedInviteRevokeInput,
  LingvaHostedProjectApiKey,
  LingvaHostedProjectApiKeyStatus,
  LingvaHostedProjectAction,
  LingvaHostedProjectAuditAction,
  LingvaHostedProjectAuditEvent,
  LingvaHostedProjectAuditEventCreateInput,
  LingvaHostedProjectAuditListInput,
  LingvaHostedProjectAuditTargetType,
  LingvaHostedProjectCreateInput,
  LingvaHostedProjectAdminUpdateInput,
  LingvaHostedProjectDeleteInput,
  LingvaHostedCustomerRole,
  LingvaHostedCustomerUpdateInput,
  LingvaHostedProjectEnvironment,
  LingvaHostedProjectInvite,
  LingvaHostedProjectInviteStatus,
  LingvaHostedProjectMember,
  LingvaHostedProjectMemberRevokeInput,
  LingvaHostedProjectMemberRole,
  LingvaHostedProjectMemberStatus,
  LingvaHostedProjectMemberUpsertInput,
  LingvaHostedProjectRecord,
  LingvaHostedProjectTier,
  LingvaHostedProjectUpdateInput,
} from './hosted-projects';
export {
  LINGVA_HOSTED_ORGANIZATION_ACTIONS,
  LINGVA_HOSTED_ORGANIZATION_ROLE,
  LINGVA_HOSTED_ORGANIZATION_MEMBER_STATUS,
  LINGVA_HOSTED_ORGANIZATION_INVITE_STATUS,
  LINGVA_HOSTED_ORGANIZATION_SSO_MODE,
  LINGVA_HOSTED_ORGANIZATION_ID_PATTERN,
  LINGVA_HOSTED_ORGANIZATION_REQUEST_ID_PATTERN,
  LINGVA_HOSTED_ORGANIZATION_NAME_MAX_LENGTH,
  LINGVA_HOSTED_ORGANIZATION_INVITE_ID_PATTERN,
  LINGVA_HOSTED_ORGANIZATION_INVITE_DEFAULT_DAYS,
  LINGVA_HOSTED_ORGANIZATION_INVITE_MAX_DAYS,
  LINGVA_HOSTED_ORGANIZATION_INVITE_MAX_ASSIGNMENTS,
  createLingvaHostedOrganizationPayload,
  createLingvaHostedOrganizationInvitePayload,
  createLingvaHostedOrganizationInviteAcceptPayload,
  createLingvaHostedOrganizationInviteResendPayload,
  createLingvaHostedOrganizationInviteRevokePayload,
} from './hosted-organizations';
export type {
  LingvaHostedOrganizationRole,
  LingvaHostedOrganizationInviteRole,
  LingvaHostedOrganizationProjectRole,
  LingvaHostedOrganizationSsoMode,
  LingvaHostedOrganizationRecord,
  LingvaHostedOrganizationMembership,
  LingvaHostedOrganizationProjectGrant,
  LingvaHostedOrganizationInvite,
  LingvaHostedOrganizationInviteCreateInput,
  LingvaHostedOrganizationGroup,
  LingvaHostedOrganizationAccessSource,
  LingvaHostedOrganizationProjectAccess,
} from './hosted-organizations';
export {
  LINGVA_AUTH_RATE_LIMIT_DEFAULT_MAX_ATTEMPTS,
  LINGVA_AUTH_RATE_LIMIT_DEFAULT_WINDOW_SECONDS,
  LINGVA_AUTH_RATE_LIMIT_MAX_KEY_LENGTH,
  LINGVA_AUTH_RATE_LIMIT_MODES,
  createLingvaAuthRateLimitPayload,
  parseLingvaAuthRateLimitResponse,
} from './auth-rate-limit';
export type {
  LingvaAuthRateLimitMode,
  LingvaAuthRateLimitPayload,
  LingvaAuthRateLimitResponse,
} from './auth-rate-limit';
export {
  LINGVA_GUARDED_APPROVAL_ACTIONS,
  LINGVA_GUARDED_APPROVAL_REQUEST_MAX_BYTES,
  LINGVA_GUARDED_APPROVAL_RESPONSE_MAX_BYTES,
  createLingvaGuardedApprovalContextPayload,
  createLingvaGuardedApprovalPayload,
  parseLingvaGuardedApprovalContextResponse,
  parseLingvaGuardedApprovalResponse,
} from './guarded-approval';
export type {
  LingvaGuardedApprovalLocator,
  LingvaGuardedApprovalScope,
  LingvaGuardedApprovalCommand,
  LingvaGuardedApprovalContextPayload,
  LingvaGuardedApprovalPayload,
  LingvaGuardedApprovalOutcome,
  LingvaGuardedApprovalContext,
  LingvaGuardedApprovalContextResponse,
  LingvaGuardedApprovalResult,
  LingvaGuardedApprovalResponse,
} from './guarded-approval';
export {
  LINGVA_DEFAULT_AUTHORING_ENVIRONMENT,
  LINGVA_MAX_AUTHORING_VALUE_LENGTH,
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
export type {
  LingvaRemoteAuthoringAction,
  LingvaRemoteAuthoringDraftRecord,
  LingvaRemoteAuthoringDraftPayload,
  LingvaRemoteAuthoringDraftReviewStatus,
  LingvaRemoteAuthoringDraftResponse,
  LingvaRemoteAuthoringDraftStatus,
  LingvaRemoteAuthoringDraftsResponse,
  LingvaRemoteAuthoringPayloadOptions,
  LingvaTranslationKeyQuota,
  LingvaTranslationEditPayload,
} from './authoring';
import type {
  LingvaDictionary,
  LingvaFlatDictionary,
  LingvaConfig,
  LingvaKeyMetadata,
  LingvaMessage,
  LingvaMessageVariant,
  LingvaMessageVariants,
  LingvaProject,
  LingvaProjectBundle,
  LingvaProjectBundleFormatOptions,
  LingvaProjectBundleOptions,
  LingvaProjectDefinition,
  LingvaProjectHelpersModuleOptions,
  LingvaProjectManifest,
  LingvaProjectManifestFormatOptions,
  LingvaPublishArtifacts,
  LingvaPublishArtifactsFormatOptions,
  LingvaPublishArtifactsOptions,
  LingvaProjectTypeScriptModuleOptions,
  LingvaProjectValidationIssue,
  LingvaProjectValidationResult,
  LingvaResources,
  LingvaValidationFailOn,
  LingvaValidationReportOptions,
  LingvaWorkflowSummary,
  LingvaWorkflowSummaryFormatOptions,
  LocaleName,
  TranslationKey,
} from './contracts';

export { Lingva, LingvaClient } from './runtime';
export {
  createLingvaClientFromRuntimeConfig,
  createLingvaHttpLoader,
  createLingvaLocalLoader,
  DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE,
  defineLingvaConfig,
  resolveLingvaRuntimeConfig,
  resolveLingvaRuntimeSetup,
} from './delivery';
export type * from './contracts';

/**
 * Wraps raw resources so TypeScript preserves literal locale and key information.
 */
export function createLingvaResources<const Resources extends LingvaResources>(resources: Resources): Resources {
  return resources;
}

function isLingvaMessageVariant(value: unknown): value is LingvaMessageVariant {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.id === 'string' && record.id.trim().length > 0 && typeof record.text === 'string';
}

function isLingvaMessageVariants(value: unknown): value is LingvaMessageVariants {
  return Array.isArray(value) && value.every(isLingvaMessageVariant);
}

function flattenLingvaDictionary(dictionary: LingvaDictionary, prefix = ''): LingvaFlatDictionary {
  const output: LingvaFlatDictionary = {};

  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      output[path] = value;
      continue;
    }

    if (isLingvaMessageVariants(value)) {
      output[path] = value;
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(output, flattenLingvaDictionary(value, path));
    }
  }

  return output;
}

function collectContractIssues<Resources extends LingvaResources>(
  dictionary: LingvaDictionary,
  locale: LocaleName<Resources>,
  issues: Array<LingvaProjectValidationIssue<Resources>>,
  prefix = ''
): void {
  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0 || !isLingvaMessageVariants(value)) {
        issues.push({
          code: LINGVA_VALIDATION_ISSUE_CODES.invalidTranslationContract,
          severity: LINGVA_VALIDATION_SEVERITIES.error,
          key: path as TranslationKey<Resources>,
          locale,
          message: `Key "${path}" in locale "${locale}" must be a string or a non-empty variant array with { id, text } objects.`,
        });
      }

      continue;
    }

    if (value && typeof value === 'object') {
      collectContractIssues(value as LingvaDictionary, locale, issues, path);
      continue;
    }

    issues.push({
      code: LINGVA_VALIDATION_ISSUE_CODES.invalidTranslationContract,
      severity: LINGVA_VALIDATION_SEVERITIES.error,
      key: path as TranslationKey<Resources>,
      locale,
      message: `Key "${path}" in locale "${locale}" uses an unsupported translation leaf type.`,
    });
  }
}

function getMessageKind(
  value: LingvaMessage | undefined
): (typeof LINGVA_MESSAGE_KINDS)[keyof typeof LINGVA_MESSAGE_KINDS] {
  if (value === undefined) {
    return LINGVA_MESSAGE_KINDS.missing;
  }

  return typeof value === 'string' ? LINGVA_MESSAGE_KINDS.text : LINGVA_MESSAGE_KINDS.variants;
}

function extractInterpolationTokensFromLingvaMessage(message: LingvaMessage): string[] {
  if (typeof message === 'string') {
    return extractInterpolationTokensFromMessage(message);
  }

  const tokens = new Set<string>();

  for (const variant of message) {
    for (const token of extractInterpolationTokensFromMessage(variant.text)) {
      tokens.add(token);
    }
  }

  return Array.from(tokens).sort();
}

function selectLingvaMessageText(message: LingvaMessage): string {
  return typeof message === 'string' ? message : (message[0]?.text ?? '');
}

const VARIANT_CONTRACT_FIELDS = ['tone', 'mood', 'intonation', 'label', 'context'] as const satisfies ReadonlyArray<
  keyof LingvaMessageVariant
>;

function getVariantContractFieldValue(
  variant: LingvaMessageVariant,
  field: (typeof VARIANT_CONTRACT_FIELDS)[number]
): string | undefined {
  const value = variant[field];

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

const VARIANT_DRIFT_VALIDATION_CODES = new Set<LingvaProjectValidationIssue['code']>([
  'translation_contract_mismatch',
  'missing_locale_variant',
  'extra_locale_variant',
  'variant_metadata_mismatch',
]);

/**
 * Creates a project contract that packages resources, defaults, metadata, and
 * helper methods into one reusable unit for runtime, tooling, and code generation.
 */
export function defineLingvaProject<
  const Resources extends LingvaResources,
  const DefaultLocale extends LocaleName<Resources>,
  const FallbackLocale extends LocaleName<Resources> | undefined = undefined,
>(
  definition: LingvaProjectDefinition<Resources, DefaultLocale, FallbackLocale>
): LingvaProject<Resources, DefaultLocale, FallbackLocale> {
  return {
    ...definition,
    getKeyMetadata(key: TranslationKey<Resources>) {
      return definition.keyMetadata?.[key];
    },
    getKeyMetadataMap() {
      return definition.keyMetadata ?? {};
    },
    getConfig(
      overrides: Omit<LingvaConfig<Resources>, 'resources' | 'locale' | 'fallbackLocale'> & {
        locale?: LocaleName<Resources>;
        fallbackLocale?: LocaleName<Resources>;
      } = {}
    ) {
      return {
        apiKey: overrides.apiKey ?? definition.apiKey,
        apiUrl: overrides.apiUrl ?? definition.apiUrl,
        projectId: overrides.projectId ?? definition.projectId,
        environment: overrides.environment ?? definition.environment,
        locale: overrides.locale ?? definition.defaultLocale,
        fallbackLocale: overrides.fallbackLocale ?? definition.fallbackLocale,
        resources: definition.resources,
      };
    },
    createClient(
      overrides: Omit<LingvaConfig<Resources>, 'resources' | 'locale' | 'fallbackLocale'> & {
        locale?: LocaleName<Resources>;
        fallbackLocale?: LocaleName<Resources>;
      } = {}
    ) {
      return new LingvaClient<Resources>(this.getConfig(overrides));
    },
  };
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}

function requiresTranslator(status: LingvaWorkflowStatus | undefined): boolean {
  return (
    status === LINGVA_WORKFLOW_STATUSES.translated ||
    status === LINGVA_WORKFLOW_STATUSES.reviewed ||
    status === LINGVA_WORKFLOW_STATUSES.approved
  );
}

function requiresReviewer(status: LingvaWorkflowStatus | undefined): boolean {
  return status === LINGVA_WORKFLOW_STATUSES.reviewed || status === LINGVA_WORKFLOW_STATUSES.approved;
}

// Manifest generation needs runtime token extraction so that CLI/codegen output
// can work even when the original literal types are no longer available.
function extractInterpolationTokensFromMessage(message: string): string[] {
  const tokens = new Set<string>();
  const matches = message.matchAll(/\{\{\s*([\w.]+)\s*\}\}|\{([\w.]+)\}/g);

  for (const match of matches) {
    const token = match[1] ?? match[2];

    if (token) {
      tokens.add(token);
    }
  }

  return Array.from(tokens).sort();
}

function getProjectKeys<Resources extends LingvaResources>(
  project: LingvaProject<Resources>
): TranslationKey<Resources>[] {
  const keys = new Set<TranslationKey<Resources>>();

  for (const locale of Object.keys(project.resources) as LocaleName<Resources>[]) {
    const dictionary = flattenLingvaDictionary(project.resources[locale] as LingvaDictionary);

    for (const key of Object.keys(dictionary) as TranslationKey<Resources>[]) {
      keys.add(key);
    }
  }

  return Array.from(keys).sort();
}

function sortRecord(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortRecord);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortRecord(nestedValue)])
  );
}

type ProjectValidationIssue<Resources extends LingvaResources> = LingvaProjectValidationIssue<Resources>;

function collectVariantContractIssues<Resources extends LingvaResources>(
  key: TranslationKey<Resources>,
  locale: LocaleName<Resources>,
  defaultLocale: LocaleName<Resources>,
  defaultVariants: LingvaMessageVariants,
  localeVariants: LingvaMessageVariants
): ProjectValidationIssue<Resources>[] {
  const issues: ProjectValidationIssue<Resources>[] = [];
  const defaultVariantsById = new Map(defaultVariants.map((variant) => [variant.id, variant]));
  const localeVariantsById = new Map(localeVariants.map((variant) => [variant.id, variant]));

  for (const variant of defaultVariants) {
    const localeVariant = localeVariantsById.get(variant.id);

    if (!localeVariant) {
      issues.push({
        code: LINGVA_VALIDATION_ISSUE_CODES.missingLocaleVariant,
        severity: LINGVA_VALIDATION_SEVERITIES.info,
        key,
        locale,
        message: `Key "${key}" is missing variant "${variant.id}" in locale "${locale}".`,
      });
      continue;
    }

    for (const field of VARIANT_CONTRACT_FIELDS) {
      const defaultValue = getVariantContractFieldValue(variant, field);
      const localeValue = getVariantContractFieldValue(localeVariant, field);
      if (defaultValue !== localeValue) {
        issues.push({
          code: LINGVA_VALIDATION_ISSUE_CODES.variantMetadataMismatch,
          severity: LINGVA_VALIDATION_SEVERITIES.warning,
          key,
          locale,
          message: `Key "${key}" variant "${variant.id}" uses ${field}="${localeValue ?? ''}" in locale "${locale}", but default locale "${defaultLocale}" uses "${defaultValue ?? ''}".`,
        });
      }
    }
  }

  for (const variant of localeVariants) {
    if (!defaultVariantsById.has(variant.id)) {
      issues.push({
        code: LINGVA_VALIDATION_ISSUE_CODES.extraLocaleVariant,
        severity: LINGVA_VALIDATION_SEVERITIES.warning,
        key,
        locale,
        message: `Key "${key}" defines extra variant "${variant.id}" in locale "${locale}" that is not present in default locale "${defaultLocale}".`,
      });
    }
  }

  return issues;
}

function collectLocaleTranslationIssues<Resources extends LingvaResources>(
  key: TranslationKey<Resources>,
  locale: LocaleName<Resources>,
  defaultLocale: LocaleName<Resources>,
  defaultMessage: LingvaMessage | undefined,
  localeMessage: LingvaMessage | undefined
): ProjectValidationIssue<Resources>[] {
  if (defaultMessage === undefined || locale === defaultLocale) return [];
  if (localeMessage === undefined) {
    return [
      {
        code: LINGVA_VALIDATION_ISSUE_CODES.missingLocaleTranslation,
        severity: LINGVA_VALIDATION_SEVERITIES.info,
        key,
        locale,
        message: `Key "${key}" is missing in locale "${locale}" and will fall back to "${defaultLocale}".`,
      },
    ];
  }

  const defaultKind = getMessageKind(defaultMessage);
  const localeKind = getMessageKind(localeMessage);
  if (defaultKind !== localeKind) {
    return [
      {
        code: LINGVA_VALIDATION_ISSUE_CODES.translationContractMismatch,
        severity: LINGVA_VALIDATION_SEVERITIES.error,
        key,
        locale,
        message: `Key "${key}" must stay "${defaultKind}" in locale "${locale}" to match default locale "${defaultLocale}".`,
      },
    ];
  }

  return defaultKind === LINGVA_MESSAGE_KINDS.variants && localeKind === LINGVA_MESSAGE_KINDS.variants
    ? collectVariantContractIssues(
        key,
        locale,
        defaultLocale,
        defaultMessage as LingvaMessageVariants,
        localeMessage as LingvaMessageVariants
      )
    : [];
}

function collectKeyMetadataIssues<Resources extends LingvaResources>(
  key: TranslationKey<Resources>,
  metadata: LingvaKeyMetadata | undefined
): ProjectValidationIssue<Resources>[] {
  if (!metadata) {
    return [
      {
        code: LINGVA_VALIDATION_ISSUE_CODES.missingKeyMetadata,
        severity: LINGVA_VALIDATION_SEVERITIES.warning,
        key,
        message: `Key "${key}" does not have metadata yet.`,
      },
    ];
  }

  const candidates: Array<ProjectValidationIssue<Resources> | undefined> = [
    isBlank(metadata.description)
      ? {
          code: LINGVA_VALIDATION_ISSUE_CODES.missingKeyDescription,
          severity: LINGVA_VALIDATION_SEVERITIES.warning,
          key,
          message: `Key "${key}" is missing a metadata description.`,
        }
      : undefined,
    metadata.status === undefined
      ? {
          code: LINGVA_VALIDATION_ISSUE_CODES.missingWorkflowStatus,
          severity: LINGVA_VALIDATION_SEVERITIES.info,
          key,
          message: `Key "${key}" does not declare a translation workflow status yet.`,
        }
      : undefined,
    requiresTranslator(metadata.status) && isBlank(metadata.translator)
      ? {
          code: LINGVA_VALIDATION_ISSUE_CODES.translatedKeyMissingTranslator,
          severity: LINGVA_VALIDATION_SEVERITIES.warning,
          key,
          message: `Key "${key}" is marked as "${metadata.status}" but has no translator assigned.`,
        }
      : undefined,
    requiresReviewer(metadata.status) && isBlank(metadata.reviewer)
      ? {
          code: LINGVA_VALIDATION_ISSUE_CODES.reviewedKeyMissingReviewer,
          severity: LINGVA_VALIDATION_SEVERITIES.warning,
          key,
          message: `Key "${key}" is marked as "${metadata.status}" but has no reviewer assigned.`,
        }
      : undefined,
  ];
  const issues = candidates.filter((issue): issue is ProjectValidationIssue<Resources> => issue !== undefined);
  const inferredNamespace = String(key).split('.')[0];
  if (String(key).includes('.') && metadata.namespace !== undefined && metadata.namespace !== inferredNamespace) {
    issues.push({
      code: LINGVA_VALIDATION_ISSUE_CODES.namespaceMismatch,
      severity: LINGVA_VALIDATION_SEVERITIES.warning,
      key,
      message: `Key "${key}" uses namespace "${inferredNamespace}" but metadata declares "${metadata.namespace}".`,
    });
  }
  return issues;
}

/**
 * Validates translation completeness, metadata quality, and workflow annotations.
 */
export function validateLingvaProject<Resources extends LingvaResources>(
  project: LingvaProject<Resources>
): LingvaProjectValidationResult<Resources> {
  const issues: LingvaProjectValidationIssue<Resources>[] = [];
  const locales = Object.keys(project.resources) as LocaleName<Resources>[];
  const defaultLocale = project.defaultLocale;
  const metadata = project.getKeyMetadataMap();
  const flattenedDictionaries = Object.fromEntries(
    locales.map((locale) => {
      const dictionary = project.resources[locale] as LingvaDictionary;
      collectContractIssues(dictionary, locale, issues);

      return [locale, flattenLingvaDictionary(dictionary)];
    })
  ) as Record<LocaleName<Resources>, LingvaFlatDictionary>;

  for (const key of getProjectKeys(project)) {
    const defaultMessage = flattenedDictionaries[defaultLocale]?.[key];
    const keyValidationError = getLingvaTranslationKeyValidationError(String(key));

    if (keyValidationError) {
      issues.push({
        code: LINGVA_VALIDATION_ISSUE_CODES.invalidTranslationKey,
        severity: LINGVA_VALIDATION_SEVERITIES.error,
        key,
        message: keyValidationError,
      });
    }

    if (defaultMessage === undefined) {
      issues.push({
        code: LINGVA_VALIDATION_ISSUE_CODES.missingDefaultTranslation,
        severity: LINGVA_VALIDATION_SEVERITIES.error,
        key,
        locale: defaultLocale,
        message: `Key "${key}" is missing in the default locale "${defaultLocale}".`,
      });
    }

    /* Locale and metadata rules are independent collectors so adding one
       validation cannot change the control flow of another. */
    issues.push(
      ...locales.flatMap((locale) =>
        collectLocaleTranslationIssues(key, locale, defaultLocale, defaultMessage, flattenedDictionaries[locale]?.[key])
      )
    );
    issues.push(...collectKeyMetadataIssues(key, metadata[key]));
  }

  const errorCount = issues.filter((issue) => issue.severity === LINGVA_VALIDATION_SEVERITIES.error).length;
  const warningCount = issues.filter((issue) => issue.severity === LINGVA_VALIDATION_SEVERITIES.warning).length;
  const infoCount = issues.filter((issue) => issue.severity === LINGVA_VALIDATION_SEVERITIES.info).length;

  return {
    valid: errorCount === 0,
    issues,
    errorCount,
    warningCount,
    infoCount,
  };
}

/**
 * Summarizes translation workflow state from project metadata.
 */
export function createLingvaWorkflowSummary<Resources extends LingvaResources>(
  project: LingvaProject<Resources>
): LingvaWorkflowSummary {
  const entries: LingvaWorkflowSummary['entries'] = getProjectKeys(project).map((key) => {
    const metadata = project.getKeyMetadata(key);

    return {
      key,
      status: metadata?.status ?? LINGVA_WORKFLOW_SUMMARY_STATUSES.untracked,
      translator: metadata?.translator,
      reviewer: metadata?.reviewer,
    };
  });

  const statusCounts: Record<LingvaWorkflowSummaryStatus, number> = {
    [LINGVA_WORKFLOW_STATUSES.draft]: 0,
    [LINGVA_WORKFLOW_STATUSES.translated]: 0,
    [LINGVA_WORKFLOW_STATUSES.reviewed]: 0,
    [LINGVA_WORKFLOW_STATUSES.approved]: 0,
    [LINGVA_WORKFLOW_SUMMARY_STATUSES.untracked]: 0,
  };

  for (const entry of entries) {
    statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1;
  }

  return {
    totalKeys: entries.length,
    statusCounts,
    translatorPendingKeys: entries
      .filter(
        (entry) =>
          requiresTranslator(entry.status === LINGVA_WORKFLOW_SUMMARY_STATUSES.untracked ? undefined : entry.status) &&
          isBlank(entry.translator)
      )
      .map((entry) => entry.key),
    reviewerPendingKeys: entries
      .filter(
        (entry) =>
          requiresReviewer(entry.status === LINGVA_WORKFLOW_SUMMARY_STATUSES.untracked ? undefined : entry.status) &&
          isBlank(entry.reviewer)
      )
      .map((entry) => entry.key),
    approvalPendingKeys: entries
      .filter((entry) => entry.status === LINGVA_WORKFLOW_STATUSES.reviewed)
      .map((entry) => entry.key),
    approvedKeys: entries
      .filter((entry) => entry.status === LINGVA_WORKFLOW_STATUSES.approved)
      .map((entry) => entry.key),
    entries,
  };
}

/**
 * Builds a machine-readable manifest from a project definition.
 */
export function createLingvaProjectManifest<Resources extends LingvaResources>(
  project: LingvaProject<Resources>
): LingvaProjectManifest {
  const locales = Object.keys(project.resources).sort() as LocaleName<Resources>[];
  const keys = getProjectKeys(project);

  // The manifest is intentionally runtime-friendly so CLI/tooling can reuse the
  // same project contract without needing TypeScript compiler APIs.
  const entries = keys.map((key) => {
    const metadata = project.getKeyMetadata(key);
    const variables = new Set<string>();

    const translations = locales.map((locale) => {
      const dictionary = flattenLingvaDictionary(project.resources[locale] as LingvaDictionary);
      const value = dictionary?.[key];

      if (value !== undefined) {
        for (const token of extractInterpolationTokensFromLingvaMessage(value)) {
          variables.add(token);
        }
      }

      return {
        locale,
        value,
        missing: value === undefined,
        isDefaultLocale: locale === project.defaultLocale,
      };
    });

    return {
      key,
      namespace: metadata?.namespace ?? (String(key).includes('.') ? String(key).split('.')[0] : undefined),
      variables: Array.from(variables).sort(),
      metadata,
      translations,
    };
  });

  return {
    projectId: project.projectId,
    defaultLocale: project.defaultLocale,
    fallbackLocale: project.fallbackLocale,
    locales,
    keys,
    entries,
  };
}

interface ResolvedBundleMessage {
  fallback: boolean;
  sourceLocale: string;
  value: LingvaMessage;
}

function resolveBundleMessage(
  locale: string,
  defaultLocale: string,
  fallbackLocale: string | undefined,
  localeMessage: LingvaMessage | undefined,
  fallbackMessage: LingvaMessage | undefined,
  defaultMessage: LingvaMessage | undefined
): ResolvedBundleMessage | undefined {
  // Runtime fallback order is part of the public delivery contract. Keep the
  // configured fallback ahead of the default locale even when both exist.
  const candidates = [
    { sourceLocale: locale, value: localeMessage },
    { sourceLocale: fallbackLocale, value: fallbackMessage },
    { sourceLocale: defaultLocale, value: defaultMessage },
  ];
  const match = candidates.find(
    (candidate): candidate is { sourceLocale: string; value: LingvaMessage } =>
      candidate.sourceLocale !== undefined && candidate.value !== undefined
  );
  return match ? { ...match, fallback: match.sourceLocale !== locale } : undefined;
}

/**
 * Materializes a locale bundle from a project definition so local delivery,
 * hosted publish, and cache-friendly runtime flows can share one artifact
 * shape.
 */
export function createLingvaProjectBundle<Resources extends LingvaResources>(
  project: LingvaProject<Resources>,
  options: LingvaProjectBundleOptions
): LingvaProjectBundle {
  const locale = options.locale as LocaleName<Resources>;
  const defaultLocale = project.defaultLocale;
  const fallbackLocale = project.fallbackLocale;
  const entries: LingvaProjectBundle['entries'] = [];
  const messages: Record<string, string> = {};
  const variants: Record<string, LingvaMessageVariants> = {};
  const sources: Record<string, string> = {};
  const variables: Record<string, string[]> = {};
  const metadata = options.includeMetadata ? ({} as Record<string, LingvaKeyMetadata>) : undefined;
  const fallbackKeys: string[] = [];
  const localeDictionary = flattenLingvaDictionary(project.resources[locale] ?? {});
  const fallbackDictionary = fallbackLocale
    ? flattenLingvaDictionary(project.resources[fallbackLocale] ?? {})
    : undefined;
  const defaultDictionary = flattenLingvaDictionary(project.resources[defaultLocale] ?? {});

  for (const key of getProjectKeys(project)) {
    const resolved = resolveBundleMessage(
      locale,
      defaultLocale,
      fallbackLocale,
      localeDictionary[key],
      fallbackDictionary?.[key],
      defaultDictionary[key]
    );
    if (!resolved) {
      continue;
    }
    const { fallback, sourceLocale, value } = resolved;

    const keyMetadata = project.getKeyMetadata(key);
    const entryVariables = extractInterpolationTokensFromLingvaMessage(value);
    const resolvedValue = selectLingvaMessageText(value);

    messages[key] = resolvedValue;
    sources[key] = sourceLocale;
    variables[key] = entryVariables;

    if (fallback) {
      fallbackKeys.push(key);
    }

    if (Array.isArray(value)) {
      variants[key] = value;
    }

    if (metadata && keyMetadata) {
      metadata[key] = keyMetadata;
    }

    entries.push({
      key,
      value: resolvedValue,
      sourceLocale,
      fallback,
      variables: entryVariables,
      namespace: keyMetadata?.namespace ?? (String(key).includes('.') ? String(key).split('.')[0] : undefined),
      ...(Array.isArray(value) ? { variants: value } : {}),
    });
  }

  return {
    schemaVersion: LINGVA_BUNDLE_SCHEMA_VERSION,
    projectId: project.projectId,
    environment: project.environment,
    locale,
    defaultLocale,
    fallbackLocale,
    generatedAt: new Date().toISOString(),
    keyCount: entries.length,
    fallbackKeys,
    messages: sortRecord(messages) as Record<string, string>,
    ...(Object.keys(variants).length > 0
      ? {
          variants: sortRecord(variants) as Record<string, LingvaMessageVariants>,
        }
      : {}),
    sources: sortRecord(sources) as Record<string, string>,
    variables: sortRecord(variables) as Record<string, string[]>,
    ...(metadata ? { metadata: sortRecord(metadata) as Record<string, LingvaKeyMetadata> } : {}),
    entries,
  };
}

function toTypeScriptStringLiteral(value: string): string {
  return JSON.stringify(value);
}

function toTypeScriptObject(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatLingvaMessagePreview(message: LingvaMessage | undefined): string {
  if (message === undefined) {
    return '<missing>';
  }

  if (typeof message === 'string') {
    return message;
  }

  return message.map((variant) => `${variant.id}: ${variant.text}`).join(' | ');
}

export function formatLingvaProjectManifest(
  manifest: LingvaProjectManifest,
  options: LingvaProjectManifestFormatOptions = {}
): string {
  const format = options.format ?? LINGVA_SERIALIZATION_FORMATS.json;
  const includeSummary = options.includeSummary ?? true;

  if (format === LINGVA_SERIALIZATION_FORMATS.json) {
    return JSON.stringify(manifest, null, 2);
  }

  const lines: string[] = [];

  if (includeSummary) {
    lines.push(`Lingva manifest: ${manifest.entries.length} keys across ${manifest.locales.length} locales`);
  }

  for (const entry of manifest.entries) {
    const metaBits = [
      entry.namespace ? `namespace=${entry.namespace}` : undefined,
      entry.variables.length > 0 ? `variables=${entry.variables.join(',')}` : undefined,
    ].filter(Boolean);
    const metaSuffix = metaBits.length > 0 ? ` (${metaBits.join(' | ')})` : '';

    lines.push(`${entry.key}${metaSuffix}`);

    for (const translation of entry.translations) {
      const state = formatLingvaMessagePreview(translation.missing ? undefined : translation.value);
      const defaultMarker = translation.isDefaultLocale ? ' [default]' : '';
      lines.push(`  ${translation.locale}${defaultMarker}: ${state}`);
    }
  }

  return lines.join('\n');
}

/**
 * Formats locale bundles for inspection, CI artifacts, or future publish flows.
 */
export function formatLingvaProjectBundle(
  bundle: LingvaProjectBundle,
  options: LingvaProjectBundleFormatOptions = {}
): string {
  const format = options.format ?? LINGVA_SERIALIZATION_FORMATS.json;
  const includeSummary = options.includeSummary ?? true;

  if (format === LINGVA_SERIALIZATION_FORMATS.json) {
    return JSON.stringify(bundle, null, 2);
  }

  const lines: string[] = [];

  if (includeSummary) {
    lines.push(
      `Lingva bundle: locale=${bundle.locale}, keys=${bundle.keyCount}, fallbackKeys=${bundle.fallbackKeys.length}`
    );
  }

  for (const entry of bundle.entries) {
    const sourceSuffix = entry.fallback ? ` [from ${entry.sourceLocale} fallback]` : ` [from ${entry.sourceLocale}]`;
    lines.push(`${entry.key}${sourceSuffix}: ${entry.value}`);
  }

  return lines.join('\n');
}

/**
 * Builds a publish-ready artifact set consisting of one manifest and one bundle
 * per locale.
 */
export function createLingvaPublishArtifacts<Resources extends LingvaResources>(
  project: LingvaProject<Resources>,
  options: LingvaPublishArtifactsOptions = {}
): LingvaPublishArtifacts {
  getProjectKeys(project).forEach((key) => assertLingvaTranslationKey(String(key)));
  const availableLocales = Object.keys(project.resources).sort() as LocaleName<Resources>[];
  const requestedLocales = options.locales?.filter((locale) =>
    availableLocales.includes(locale as LocaleName<Resources>)
  );
  const locales = requestedLocales && requestedLocales.length > 0 ? requestedLocales : availableLocales;
  const generatedAt = new Date().toISOString();
  const fileNameTemplate = options.fileNameTemplate ?? '{locale}.bundle.json';
  const bundles = Object.fromEntries(
    locales.map((locale) => [
      locale,
      createLingvaProjectBundle(project, {
        locale,
        includeMetadata: options.includeMetadata,
      }),
    ])
  ) as Record<string, LingvaProjectBundle>;

  return {
    manifest: {
      projectId: project.projectId,
      environment: project.environment,
      defaultLocale: project.defaultLocale,
      fallbackLocale: project.fallbackLocale,
      generatedAt,
      locales,
      bundles: locales.map((locale) => {
        const bundle = bundles[locale];

        if (!bundle) {
          throw new Error(`Missing generated bundle for locale "${locale}".`);
        }

        return {
          locale,
          fileName: fileNameTemplate.replaceAll('{locale}', locale),
          keyCount: bundle.keyCount,
          fallbackKeyCount: bundle.fallbackKeys.length,
        };
      }),
    },
    bundles,
  };
}

/**
 * Formats publish artifacts for inspection, CI logs, or future hosted publish
 * workflows.
 */
export function formatLingvaPublishArtifacts(
  artifacts: LingvaPublishArtifacts,
  options: LingvaPublishArtifactsFormatOptions = {}
): string {
  const format = options.format ?? LINGVA_SERIALIZATION_FORMATS.json;
  const includeSummary = options.includeSummary ?? true;

  if (format === LINGVA_SERIALIZATION_FORMATS.json) {
    return JSON.stringify(artifacts, null, 2);
  }

  const lines: string[] = [];

  if (includeSummary) {
    lines.push(
      `Lingva publish artifacts: ${artifacts.manifest.locales.length} locale bundle(s) for ${artifacts.manifest.projectId ?? 'unnamed-project'}`
    );
  }

  for (const bundle of artifacts.manifest.bundles) {
    lines.push(`${bundle.locale} -> ${bundle.fileName} (${bundle.keyCount} keys, ${bundle.fallbackKeyCount} fallback)`);
  }

  return lines.join('\n');
}

export function formatLingvaWorkflowSummary(
  summary: LingvaWorkflowSummary,
  options: LingvaWorkflowSummaryFormatOptions = {}
): string {
  const format = options.format ?? LINGVA_SERIALIZATION_FORMATS.json;
  const includeSummary = options.includeSummary ?? true;

  if (format === LINGVA_SERIALIZATION_FORMATS.json) {
    return JSON.stringify(summary, null, 2);
  }

  const lines: string[] = [];

  if (includeSummary) {
    lines.push(`Lingva workflow: ${summary.totalKeys} key(s)`);
    lines.push(
      `Statuses: draft=${summary.statusCounts.draft}, translated=${summary.statusCounts.translated}, reviewed=${summary.statusCounts.reviewed}, approved=${summary.statusCounts.approved}, untracked=${summary.statusCounts.untracked}`
    );
  }

  if (summary.entries.length > 0) {
    lines.push('Keys:');

    for (const entry of summary.entries) {
      const metaBits = [
        `status=${entry.status}`,
        entry.translator ? `translator=${entry.translator}` : undefined,
        entry.reviewer ? `reviewer=${entry.reviewer}` : undefined,
      ].filter(Boolean);

      lines.push(`- ${entry.key} (${metaBits.join(' | ')})`);
    }
  }

  if (summary.translatorPendingKeys.length > 0) {
    lines.push('');
    lines.push('Translator pending:');
    lines.push(...summary.translatorPendingKeys.map((key) => `- ${key}`));
  }

  if (summary.reviewerPendingKeys.length > 0) {
    lines.push('');
    lines.push('Reviewer pending:');
    lines.push(...summary.reviewerPendingKeys.map((key) => `- ${key}`));
  }

  if (summary.approvalPendingKeys.length > 0) {
    lines.push('');
    lines.push('Approval pending:');
    lines.push(...summary.approvalPendingKeys.map((key) => `- ${key}`));
  }

  return lines.join('\n');
}

export function formatLingvaProjectTypeScriptModule(
  manifest: LingvaProjectManifest,
  options: LingvaProjectTypeScriptModuleOptions = {}
): string {
  const includeMetadata = options.includeMetadata ?? true;
  const includeSummaryComment = options.includeSummaryComment ?? true;
  const localeList = manifest.locales.map(toTypeScriptStringLiteral).join(', ');
  const keyList = manifest.keys.map(toTypeScriptStringLiteral).join(', ');
  const keyNamespaces = Object.fromEntries(manifest.entries.map((entry) => [entry.key, entry.namespace ?? null]));
  const keyVariables = Object.fromEntries(manifest.entries.map((entry) => [entry.key, entry.variables]));
  // Presence information is often enough for CI or build-time guards without
  // embedding every translation string into generated artifacts.
  const translationPresence = Object.fromEntries(
    manifest.entries.map((entry) => [
      entry.key,
      Object.fromEntries(entry.translations.map((translation) => [translation.locale, !translation.missing])),
    ])
  );
  const lines: string[] = [];

  if (includeSummaryComment) {
    lines.push(
      `// Generated by Lingva from ${manifest.keys.length} key(s) across ${manifest.locales.length} locale(s).`
    );
  }

  lines.push(`export const lingvaLocales = [${localeList}] as const;`);
  lines.push(`export const lingvaKeys = [${keyList}] as const;`);
  lines.push('');
  lines.push('export type LingvaLocale = typeof lingvaLocales[number];');
  lines.push('export type LingvaTranslationKey = typeof lingvaKeys[number];');
  lines.push('');
  lines.push(`export const lingvaKeyNamespaces = ${toTypeScriptObject(keyNamespaces)} as const;`);
  lines.push(`export const lingvaKeyVariables = ${toTypeScriptObject(keyVariables)} as const;`);
  lines.push(`export const lingvaTranslationPresence = ${toTypeScriptObject(translationPresence)} as const;`);

  if (includeMetadata) {
    const keyMetadata = Object.fromEntries(
      manifest.entries.filter((entry) => entry.metadata !== undefined).map((entry) => [entry.key, entry.metadata])
    );

    lines.push(`export const lingvaKeyMetadata = ${toTypeScriptObject(keyMetadata)} as const;`);
  }

  return lines.join('\n');
}

export function formatLingvaProjectHelpersModule(
  manifest: LingvaProjectManifest,
  options: LingvaProjectHelpersModuleOptions = {}
): string {
  const includeMetadata = options.includeMetadata ?? true;
  const includeSummaryComment = options.includeSummaryComment ?? true;
  const localeList = manifest.locales.map(toTypeScriptStringLiteral).join(', ');
  const keyList = manifest.keys.map(toTypeScriptStringLiteral).join(', ');
  const keyNamespaces = Object.fromEntries(manifest.entries.map((entry) => [entry.key, entry.namespace ?? null]));
  const keyVariables = Object.fromEntries(manifest.entries.map((entry) => [entry.key, entry.variables]));
  const translationPresence = Object.fromEntries(
    manifest.entries.map((entry) => [
      entry.key,
      Object.fromEntries(entry.translations.map((translation) => [translation.locale, !translation.missing])),
    ])
  );
  const lines: string[] = [];

  if (includeSummaryComment) {
    lines.push(
      `// Generated Lingva helpers for ${manifest.keys.length} key(s) across ${manifest.locales.length} locale(s).`
    );
  }

  lines.push(`const lingvaLocales = [${localeList}] as const;`);
  lines.push(`const lingvaKeys = [${keyList}] as const;`);
  lines.push(`const lingvaKeyNamespaces = ${toTypeScriptObject(keyNamespaces)} as const;`);
  lines.push(`const lingvaKeyVariables = ${toTypeScriptObject(keyVariables)} as const;`);
  lines.push(`const lingvaTranslationPresence = ${toTypeScriptObject(translationPresence)} as const;`);

  if (includeMetadata) {
    const keyMetadata = Object.fromEntries(
      manifest.entries.filter((entry) => entry.metadata !== undefined).map((entry) => [entry.key, entry.metadata])
    );

    lines.push(`const lingvaKeyMetadata = ${toTypeScriptObject(keyMetadata)} as const;`);
  }

  lines.push('');
  lines.push('export type LingvaLocale = typeof lingvaLocales[number];');
  lines.push('export type LingvaTranslationKey = typeof lingvaKeys[number];');
  lines.push('');
  lines.push('export function getLingvaLocales(): readonly LingvaLocale[] {');
  lines.push('  return lingvaLocales;');
  lines.push('}');
  lines.push('');
  lines.push('export function getLingvaKeys(): readonly LingvaTranslationKey[] {');
  lines.push('  return lingvaKeys;');
  lines.push('}');
  lines.push('');
  lines.push('export function isLingvaLocale(value: string): value is LingvaLocale {');
  lines.push('  return (lingvaLocales as readonly string[]).includes(value);');
  lines.push('}');
  lines.push('');
  lines.push('export function isLingvaKey(value: string): value is LingvaTranslationKey {');
  lines.push('  return (lingvaKeys as readonly string[]).includes(value);');
  lines.push('}');
  lines.push('');
  lines.push('export function getLingvaNamespace(key: LingvaTranslationKey): string | null {');
  lines.push('  return lingvaKeyNamespaces[key];');
  lines.push('}');
  lines.push('');
  lines.push('export function getLingvaVariables(key: LingvaTranslationKey): readonly string[] {');
  lines.push('  return lingvaKeyVariables[key];');
  lines.push('}');
  lines.push('');
  lines.push('export function hasLingvaTranslation(locale: LingvaLocale, key: LingvaTranslationKey): boolean {');
  lines.push('  return Boolean(lingvaTranslationPresence[key]?.[locale]);');
  lines.push('}');

  if (includeMetadata) {
    lines.push('');
    lines.push('export function getLingvaKeyMetadata(key: LingvaTranslationKey) {');
    lines.push('  return lingvaKeyMetadata[key];');
    lines.push('}');
  }

  return lines.join('\n');
}

export function formatLingvaValidationReport<Resources extends LingvaResources>(
  result: LingvaProjectValidationResult<Resources>,
  options: LingvaValidationReportOptions = {}
): string {
  const format = options.format ?? LINGVA_SERIALIZATION_FORMATS.text;
  const includeSummary = options.includeSummary ?? true;

  if (format === LINGVA_SERIALIZATION_FORMATS.json) {
    return JSON.stringify(result, null, 2);
  }

  const lines: string[] = [];

  if (includeSummary) {
    lines.push(
      `Lingva validation: ${result.valid ? 'passed' : 'failed'} (${result.errorCount} errors, ${result.warningCount} warnings, ${result.infoCount} info)`
    );
  }

  if (result.issues.length === 0) {
    lines.push('No validation issues found.');
    return lines.join('\n');
  }

  for (const issue of result.issues) {
    const locationParts = [issue.key, issue.locale].filter(Boolean);
    const location = locationParts.length > 0 ? ` [${locationParts.join(' | ')}]` : '';

    lines.push(`${issue.severity.toUpperCase()} ${issue.code}${location}: ${issue.message}`);
  }

  return lines.join('\n');
}

export function shouldFailLingvaValidation<Resources extends LingvaResources>(
  result: LingvaProjectValidationResult<Resources>,
  failOn: LingvaValidationFailOn = LINGVA_VALIDATION_SEVERITIES.error
): boolean {
  if (failOn === LINGVA_VALIDATION_FAIL_MODES.none) {
    return false;
  }

  if (failOn === LINGVA_VALIDATION_FAIL_MODES.variantDrift) {
    return result.issues.some((issue) => VARIANT_DRIFT_VALIDATION_CODES.has(issue.code));
  }

  if (failOn === LINGVA_VALIDATION_SEVERITIES.error) {
    return result.errorCount > 0;
  }

  if (failOn === LINGVA_VALIDATION_SEVERITIES.warning) {
    return result.errorCount > 0 || result.warningCount > 0;
  }

  return result.errorCount > 0 || result.warningCount > 0 || result.infoCount > 0;
}
