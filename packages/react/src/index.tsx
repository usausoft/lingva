'use client';

import {
  createElement,
  createContext,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  createLingvaClientFromRuntimeConfig,
  LINGVA_DELIVERY_MODES,
  type LingvaClient,
  resolveLingvaRuntimeSetup,
  type LingvaMessage,
  type LingvaMessageVariant,
  type LingvaResources,
  type LocaleName,
  type TranslationKey,
  type TranslationOptions,
} from '@lingva/core';
import type {
  LingvaInlineTextEditorComponent,
  LingvaInlineTextEditorProps,
  LingvaContextValue,
  LingvaProviderConfigProps,
  LingvaProviderProps,
  LingvaProviderRuntimeProps,
  LingvaTextProps,
} from './contracts';
import { LINGVA_LOCALE_AVAILABILITY_STATUSES } from './contracts';

export type { LingvaContextValue, LingvaProviderProps, LingvaTextProps } from './contracts';

const LingvaContext = createContext<LingvaContextValue<LingvaResources> | null>(null);
let configuredLingvaReactInput:
  | {
      config: LingvaProviderConfigProps<LingvaResources>['config'];
      runtimeOptions?: LingvaProviderConfigProps<LingvaResources>['runtimeOptions'];
    }
  | undefined;

function isConfigProps<Resources extends LingvaResources>(
  props: LingvaProviderProps<Resources>
): props is LingvaProviderConfigProps<Resources> {
  return 'config' in props;
}

function isRuntimeProps<Resources extends LingvaResources>(
  props: LingvaProviderProps<Resources>
): props is LingvaProviderRuntimeProps<Resources> {
  return 'runtime' in props;
}

function isLingvaVariantArray(value: LingvaMessage | undefined): value is readonly LingvaMessageVariant[] {
  return Array.isArray(value);
}

function resolveEditableVariantId(
  rawMessage: LingvaMessage | undefined,
  variant: TranslationOptions['variant']
): string | undefined {
  if (!isLingvaVariantArray(rawMessage)) {
    return undefined;
  }

  if (typeof variant === 'string') {
    return rawMessage.find((entry) => entry.id === variant)?.id ?? rawMessage[0]?.id;
  }

  if (variant) {
    return (
      rawMessage.find((entry) =>
        Object.entries(variant).every(
          ([key, expected]) => expected === undefined || entry[key as keyof LingvaMessageVariant] === expected
        )
      )?.id ?? rawMessage[0]?.id
    );
  }

  return rawMessage[0]?.id;
}

function buildUpdatedRawMessage(
  rawMessage: LingvaMessage | undefined,
  nextValue: string,
  variantId?: string
): LingvaMessage {
  if (isLingvaVariantArray(rawMessage)) {
    if (!variantId) {
      return rawMessage;
    }

    return rawMessage.map((entry) => (entry.id === variantId ? { ...entry, text: nextValue } : entry));
  }

  return nextValue;
}

function clampPanelCoordinate(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveEditableTextPresentation(input: {
  className?: string;
  editorEnabled: boolean;
  isEditing: boolean;
  isHovered: boolean;
  isInspecting: boolean;
}): { className: string; style?: CSSProperties } {
  const active = input.isHovered || input.isInspecting || input.isEditing;
  const className = [
    input.className,
    input.editorEnabled ? 'lingva-editable-text' : undefined,
    input.editorEnabled && input.isHovered ? 'lingva-editable-text--hovered' : undefined,
    input.editorEnabled && input.isEditing ? 'lingva-editable-text--editing' : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  if (!input.editorEnabled) return { className };
  return {
    className,
    style: {
      outline: active ? '2px solid rgba(14, 165, 233, 0.5)' : 'none',
      outlineOffset: '4px',
      borderRadius: '0.5rem',
      transition: 'outline-color 160ms ease',
      cursor: input.isInspecting || input.isEditing ? 'text' : 'default',
      background: input.isInspecting && !input.isEditing ? 'rgba(14, 165, 233, 0.06)' : undefined,
    },
  };
}

function resolveEditableSpanStyle(isEditing: boolean, isInspecting: boolean): CSSProperties | undefined {
  const styles: Array<readonly [boolean, CSSProperties]> = [
    [
      isEditing,
      {
        background: 'rgba(14, 165, 233, 0.08)',
        borderRadius: '0.4rem',
        boxShadow: '0 0 0 2px rgba(14, 165, 233, 0.18)',
        paddingInline: '0.18rem',
      },
    ],
    [isInspecting, { borderRadius: '0.4rem', paddingInline: '0.18rem' }],
  ];
  return styles.find(([matches]) => matches)?.[1];
}

const INSPECTOR_STYLES = {
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  badge: {
    background: '#0f172a',
    borderRadius: '999px',
    color: '#fff',
    display: 'inline-flex',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.25rem 0.55rem',
  },
  button: {
    background: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: '0.5rem',
    color: '#0f172a',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 700,
    minHeight: '2.25rem',
    padding: '0.45rem 0.75rem',
  },
  coverage: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '0.6rem',
    padding: '0.45rem 0.65rem',
    textAlign: 'right',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.5rem',
    color: '#b91c1c',
    fontSize: '0.8rem',
    padding: '0.6rem 0.75rem',
  },
  field: { display: 'grid', gap: '0.35rem' },
  fields: { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))' },
  footer: {
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    justifyContent: 'flex-end',
    paddingTop: '0.9rem',
  },
  header: { display: 'flex', gap: '1rem', justifyContent: 'space-between' },
  input: {
    background: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: '0.5rem',
    color: '#0f172a',
    font: 'inherit',
    minHeight: '2.25rem',
    padding: '0.45rem 0.65rem',
    width: '100%',
  },
  label: { color: '#475569', fontSize: '0.72rem', fontWeight: 700 },
  layout: { color: '#0f172a', display: 'grid', fontFamily: 'system-ui, sans-serif', gap: '0.9rem' },
  muted: { color: '#64748b', fontSize: '0.72rem' },
  primaryButton: { background: '#0f172a', borderColor: '#0f172a', color: '#fff' },
  readOnly: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '0.5rem',
    color: '#92400e',
    fontSize: '0.75rem',
    padding: '0.6rem 0.75rem',
  },
  statusGrid: { display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  textarea: { minHeight: '8rem', resize: 'vertical' },
  title: { fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem', margin: '0.25rem 0 0' },
} satisfies Record<string, CSSProperties>;

function InspectorButton({
  children,
  disabled,
  primary = false,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...INSPECTOR_STYLES.button,
        ...(primary ? INSPECTOR_STYLES.primaryButton : undefined),
        ...(disabled ? { cursor: 'not-allowed', opacity: 0.55 } : undefined),
      }}
    >
      {children}
    </button>
  );
}

function DefaultInlineTextEditor<Resources extends LingvaResources = LingvaResources>({
  state,
  localeOptions,
  selectedLocale,
  onLocaleChange,
  variantOptions,
  selectedVariantId,
  onVariantChange,
  localeStatuses,
  value,
  saving,
  error,
  canOpenStudio,
  canSave,
  onCopyKey,
  onOpenStudio,
  onChange,
  onSave,
  onCancel,
}: LingvaInlineTextEditorProps<Resources>) {
  const presentCount = localeStatuses.filter(
    (entry) => entry.status === LINGVA_LOCALE_AVAILABILITY_STATUSES.present
  ).length;

  return (
    <div style={INSPECTOR_STYLES.layout}>
      <div style={INSPECTOR_STYLES.header}>
        <div>
          <div style={{ ...INSPECTOR_STYLES.label, color: '#0284c7', textTransform: 'uppercase' }}>
            Lingva Inspector
          </div>
          <h2 style={INSPECTOR_STYLES.title}>{String(state.key)}</h2>
          <div style={{ ...INSPECTOR_STYLES.actions, marginTop: '0.65rem' }}>
            <span style={INSPECTOR_STYLES.badge}>{String(state.locale)}</span>
            {state.variant ? (
              <span style={{ ...INSPECTOR_STYLES.badge, background: '#f1f5f9', color: '#334155' }}>
                {typeof state.variant === 'string' ? state.variant : JSON.stringify(state.variant)}
              </span>
            ) : null}
          </div>
        </div>
        <div style={INSPECTOR_STYLES.coverage}>
          <div style={INSPECTOR_STYLES.label}>Coverage</div>
          <strong>
            {presentCount}/{localeStatuses.length}
          </strong>
        </div>
      </div>
      <div style={INSPECTOR_STYLES.fields}>
        <label style={INSPECTOR_STYLES.field}>
          <span style={INSPECTOR_STYLES.label}>Locale</span>
          <select
            style={INSPECTOR_STYLES.input}
            value={String(selectedLocale)}
            onChange={(event) => onLocaleChange(event.target.value as LocaleName<Resources>)}
          >
            {localeOptions.map((locale) => (
              <option key={String(locale)} value={String(locale)}>
                {String(locale)}
              </option>
            ))}
          </select>
        </label>
        {variantOptions.length ? (
          <label style={INSPECTOR_STYLES.field}>
            <span style={INSPECTOR_STYLES.label}>Variant</span>
            <select
              style={INSPECTOR_STYLES.input}
              value={selectedVariantId ?? ''}
              onChange={(event) => onVariantChange(event.target.value || undefined)}
            >
              {variantOptions.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <label style={INSPECTOR_STYLES.field}>
        <span style={INSPECTOR_STYLES.label}>Translation value</span>
        <textarea
          style={{ ...INSPECTOR_STYLES.input, ...INSPECTOR_STYLES.textarea }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          spellCheck={false}
        />
      </label>
      <div>
        <div style={{ ...INSPECTOR_STYLES.label, marginBottom: '0.5rem' }}>Locale status</div>
        <div style={INSPECTOR_STYLES.statusGrid}>
          {localeStatuses.map((entry) => (
            <div
              key={String(entry.locale)}
              style={{
                alignItems: 'center',
                background: entry.status === LINGVA_LOCALE_AVAILABILITY_STATUSES.present ? '#ecfdf5' : '#fffbeb',
                border: `1px solid ${
                  entry.status === LINGVA_LOCALE_AVAILABILITY_STATUSES.present ? '#a7f3d0' : '#fde68a'
                }`,
                borderRadius: '0.5rem',
                color: entry.status === LINGVA_LOCALE_AVAILABILITY_STATUSES.present ? '#065f46' : '#92400e',
                display: 'flex',
                fontSize: '0.75rem',
                justifyContent: 'space-between',
                padding: '0.5rem 0.65rem',
              }}
            >
              <strong>{String(entry.locale)}</strong>
              <span>{entry.status}</span>
            </div>
          ))}
        </div>
      </div>
      {error ? <p style={INSPECTOR_STYLES.error}>{error}</p> : null}
      {!canSave ? (
        <p style={INSPECTOR_STYLES.readOnly}>Editing is currently read-only for this project configuration.</p>
      ) : null}
      <div style={INSPECTOR_STYLES.actions}>
        <InspectorButton onClick={onCopyKey}>Copy key</InspectorButton>
        {canOpenStudio ? <InspectorButton onClick={onOpenStudio}>Open studio</InspectorButton> : null}
      </div>
      <div style={INSPECTOR_STYLES.footer}>
        <InspectorButton onClick={onCancel} disabled={saving}>
          Cancel
        </InspectorButton>
        <InspectorButton primary onClick={onSave} disabled={saving || !canSave}>
          {saving ? 'Saving...' : 'Save'}
        </InspectorButton>
      </div>
    </div>
  );
}

/**
 * Registers a default Lingva React configuration so `LingvaProvider` can be
 * used without passing `config` or `runtime` explicitly in app code.
 */
export function configureLingvaReact<Resources extends LingvaResources = LingvaResources>(
  config: LingvaProviderConfigProps<Resources>['config'],
  runtimeOptions?: LingvaProviderConfigProps<Resources>['runtimeOptions']
) {
  configuredLingvaReactInput = {
    config: config as LingvaProviderConfigProps<LingvaResources>['config'],
    runtimeOptions: runtimeOptions as LingvaProviderConfigProps<LingvaResources>['runtimeOptions'],
  };
}

/**
 * Clears the default Lingva React configuration, mainly for tests.
 */
export function clearLingvaReactConfiguration() {
  configuredLingvaReactInput = undefined;
}

function resolveProviderInput<Resources extends LingvaResources>(
  props: LingvaProviderProps<Resources>
): {
  config: LingvaProviderConfigProps<Resources>['config'];
  runtimeOptions?: LingvaProviderConfigProps<Resources>['runtimeOptions'];
} {
  if (isConfigProps(props)) {
    return {
      config: props.config,
      runtimeOptions: props.runtimeOptions,
    };
  }

  if (isRuntimeProps(props)) {
    const resolved = resolveLingvaRuntimeSetup(props.runtime);

    return {
      config: resolved.config,
      runtimeOptions: resolved.loaderFactoryOptions,
    };
  }

  if (configuredLingvaReactInput) {
    return configuredLingvaReactInput as {
      config: LingvaProviderConfigProps<Resources>['config'];
      runtimeOptions?: LingvaProviderConfigProps<Resources>['runtimeOptions'];
    };
  }

  throw new Error('LingvaProvider requires config/runtime props or a registered default via configureLingvaReact().');
}

/**
 * Wires a Lingva runtime config into React context.
 */
export function LingvaProvider<Resources extends LingvaResources = LingvaResources>({
  ...props
}: LingvaProviderProps<Resources>) {
  const { locale: controlledLocale, onLocaleChange, editor, children } = props;
  const configInput = 'config' in props ? props.config : undefined;
  const runtimeOptionsInput = 'config' in props ? props.runtimeOptions : undefined;
  const runtimeInput = 'runtime' in props ? props.runtime : undefined;
  const resolvedInput = useMemo(
    () => resolveProviderInput(props),
    // props is a discriminated union; capture only the fields the resolver actually reads
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configInput, runtimeInput, runtimeOptionsInput]
  );
  const { config, runtimeOptions } = resolvedInput;
  const [locale, setInternalLocale] = useState<LocaleName<Resources>>(
    (controlledLocale ?? config.locale ?? config.project?.defaultLocale ?? 'en') as LocaleName<Resources>
  );
  const [deliveryState, setDeliveryState] = useState<{
    client?: LingvaClient<Resources>;
    error?: Error;
  }>({});

  const setLocale = useCallback(
    (nextLocale: LocaleName<Resources>) => {
      if (controlledLocale === undefined) {
        setInternalLocale(nextLocale);
      }

      onLocaleChange?.(nextLocale);
    },
    [controlledLocale, onLocaleChange]
  );

  const client = useMemo(() => {
    // The client is derived from config + active locale so hooks always read the
    // latest runtime state without duplicating translation logic in React.
    return createLingvaClientFromRuntimeConfig<Resources>(
      {
        ...config,
        locale: controlledLocale ?? locale,
      },
      runtimeOptions
    );
  }, [config, controlledLocale, locale, runtimeOptions]);

  const usesRemoteDelivery = config.delivery?.mode === LINGVA_DELIVERY_MODES.cdn;
  const deliveryLoading = usesRemoteDelivery && deliveryState.client !== client;
  const deliveryError = deliveryState.client === client ? deliveryState.error : undefined;

  useEffect(() => {
    if (!usesRemoteDelivery) {
      return;
    }

    const controller = new AbortController();
    const activeLocale = controlledLocale ?? locale;

    void client
      .preload([], activeLocale, { signal: controller.signal })
      .then(() => {
        if (!controller.signal.aborted) {
          setDeliveryState({ client });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDeliveryState({
            client,
            error: error instanceof Error ? error : new Error('Lingva remote delivery failed.'),
          });
        }
      });

    return () => controller.abort();
  }, [client, controlledLocale, locale, usesRemoteDelivery]);

  const mergedEditor = useMemo(() => {
    const configStudioUrl = config.editor?.studioUrl;

    return editor || config.editor
      ? {
          enabled: editor?.enabled ?? config.editor?.enabled,
          canSave: editor?.canSave ?? config.editor?.canSave ?? true,
          onSave: editor?.onSave,
          getStudioUrl: editor?.getStudioUrl ?? (configStudioUrl ? () => configStudioUrl : undefined),
        }
      : undefined;
  }, [config.editor, editor]);

  const value = useMemo<LingvaContextValue<Resources>>(() => {
    return {
      client,
      deliveryError,
      deliveryLoading,
      locale: controlledLocale ?? locale,
      setLocale,
      editor: mergedEditor,
      t: <Key extends TranslationKey<Resources>>(key: Key, options?: TranslationOptions<Resources, Key>) =>
        client.t(key, options),
      tSync: <Key extends TranslationKey<Resources>>(key: Key, options?: TranslationOptions<Resources, Key>) =>
        client.tSync(key, options),
    };
  }, [client, controlledLocale, deliveryError, deliveryLoading, locale, mergedEditor, setLocale]);

  return (
    <LingvaContext.Provider value={value as unknown as LingvaContextValue<LingvaResources>}>
      {children}
    </LingvaContext.Provider>
  );
}

function useLingvaContext<Resources extends LingvaResources = LingvaResources>(): LingvaContextValue<Resources> {
  const context = useContext(LingvaContext);

  if (!context) {
    throw new Error('LingvaProvider is missing in the React tree.');
  }

  return context as unknown as LingvaContextValue<Resources>;
}

/**
 * Returns the full Lingva React context value.
 */
export function useLingva<Resources extends LingvaResources = LingvaResources>(): LingvaContextValue<Resources> {
  return useLingvaContext<Resources>();
}

/**
 * Returns the most common translation-facing API for React components.
 */
export function useTranslation<Resources extends LingvaResources = LingvaResources>() {
  const { deliveryError, deliveryLoading, locale, setLocale, tSync } = useLingvaContext<Resources>();
  const t = useCallback(
    <Key extends TranslationKey<Resources>>(key: Key, options?: TranslationOptions<Resources, Key>) =>
      tSync(key, options),
    [tSync]
  );

  return {
    error: deliveryError,
    loading: deliveryLoading,
    locale,
    setLocale,
    t,
  };
}

/**
 * Returns only locale state to keep simple locale switchers lightweight.
 */
export function useLocale<Resources extends LingvaResources = LingvaResources>() {
  const { locale, setLocale } = useLingvaContext<Resources>();

  return {
    locale,
    setLocale,
  };
}

/**
 * Inline-rendered translation node that can optionally expose a dev-only
 * editor overlay. The `variant` prop chooses a specific message variant when
 * the underlying translation leaf is an array of variants.
 */
export function LingvaText<
  Resources extends LingvaResources = LingvaResources,
  Key extends TranslationKey<Resources> = TranslationKey<Resources>,
>({
  keyName,
  as = 'span',
  className,
  locale,
  fallback,
  defaultValue,
  variables,
  variant,
  editable = true,
}: LingvaTextProps<Resources, Key>) {
  const { client, locale: activeLocale, editor, tSync } = useLingvaContext<Resources>();
  const elementRef = useRef<HTMLElement | null>(null);
  const editableTextRef = useRef<HTMLSpanElement | null>(null);
  const editorPanelRef = useRef<HTMLDivElement | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [panelPosition, setPanelPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [, setRevision] = useState(0);

  const resolvedLocale = (locale ?? activeLocale) as LocaleName<Resources>;
  const translationOptions = useMemo(
    () =>
      ({
        locale,
        fallback,
        defaultValue,
        variables,
        variant,
      }) as TranslationOptions<Resources, Key>,
    [defaultValue, fallback, locale, variables, variant]
  );
  const content = tSync(keyName, translationOptions);
  const rawMessage = client.getMessage(keyName, {
    locale: resolvedLocale,
    fallback,
  });
  const variantId = resolveEditableVariantId(rawMessage, variant);
  const [inspectorLocale, setInspectorLocale] = useState<LocaleName<Resources>>(resolvedLocale);
  const [inspectorVariantId, setInspectorVariantId] = useState<string | undefined>(variantId);
  const editorEnabled = Boolean(editor?.enabled && editable);
  const canPersistEdits = Boolean(editor?.onSave) && (editor?.canSave ?? true);
  const EditorComponent = DefaultInlineTextEditor as LingvaInlineTextEditorComponent<Resources>;
  const canUsePortal = typeof document !== 'undefined';
  const showInspectorChrome = editorEnabled && (isHovered || isInspecting || isEditing);
  const inspectedLocale = inspectorLocale;
  const inspectedRawMessage = client.getMessage(keyName, {
    locale: inspectedLocale,
    fallback: false,
  });
  const variantOptions = Array.isArray(inspectedRawMessage)
    ? inspectedRawMessage.map((entry) => ({
        id: entry.id,
        label: entry.label ?? entry.tone ?? entry.mood ?? entry.intonation ?? entry.id,
      }))
    : [];
  const selectedVariantId =
    variantOptions.find((entry) => entry.id === inspectorVariantId)?.id ?? variantOptions[0]?.id;
  const localeOptions = client.getAvailableLocales();
  const localeStatuses = localeOptions.map((entryLocale) => ({
    locale: entryLocale,
    status:
      client.getMessage(keyName, { locale: entryLocale, fallback: false }) === undefined
        ? ('missing' as const)
        : ('present' as const),
  }));
  const studioUrl = editor?.getStudioUrl?.({
    key: keyName,
    locale: inspectedLocale,
    variantId: selectedVariantId,
  });
  const inspectedContent = tSync(keyName, {
    ...translationOptions,
    locale: inspectedLocale,
    fallback: false,
    variant: selectedVariantId,
  } as TranslationOptions<Resources, Key>);
  const activeEditLocale = isInspecting ? inspectedLocale : resolvedLocale;
  const activeEditVariantId = isInspecting ? selectedVariantId : variantId;
  const activeEditRawMessage = isInspecting ? inspectedRawMessage : rawMessage;

  const updateAnchorRect = useCallback(() => {
    if (!elementRef.current) {
      setAnchorRect(null);
      return;
    }

    setAnchorRect(elementRef.current.getBoundingClientRect());
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();

    hideTimeoutRef.current = setTimeout(() => {
      if (!isEditing && !isInspecting) {
        setIsHovered(false);
      }
    }, 180);
  }, [cancelHide, isEditing, isInspecting]);

  useEffect(() => {
    if (isEditing) {
      setDraft(content);
      setError(null);
    }
  }, [content, isEditing]);

  useEffect(() => {
    if (isInspecting && !isEditing) {
      setDraft(inspectedContent);
    }
  }, [inspectedContent, isEditing, isInspecting]);

  useEffect(() => {
    if (!isInspecting && !isEditing) {
      setInspectorLocale(resolvedLocale);
      setInspectorVariantId(variantId);
    }
  }, [isEditing, isInspecting, resolvedLocale, variantId]);

  useEffect(() => {
    if (!isEditing || !editableTextRef.current || !canUsePortal) {
      return;
    }

    editableTextRef.current.textContent = draft || content;
    editableTextRef.current.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editableTextRef.current);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    // This effect intentionally runs only when inline editing starts; running
    // on every draft change moves the caret and breaks natural text input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUsePortal, isEditing]);

  useEffect(() => {
    if (!(isInspecting || isEditing) || !canUsePortal) {
      return undefined;
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || isEditing) {
        return;
      }

      setIsInspecting(false);
      setPanelPosition(null);
      setError(null);
    }

    document.addEventListener('keydown', handleEscape as unknown as EventListener);
    return () => {
      document.removeEventListener('keydown', handleEscape as unknown as EventListener);
    };
  }, [canUsePortal, isEditing, isInspecting]);

  useEffect(() => () => cancelHide(), [cancelHide]);

  useEffect(() => {
    if (!showInspectorChrome || !canUsePortal) {
      return undefined;
    }

    updateAnchorRect();

    function handleViewportChange() {
      updateAnchorRect();
    }

    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [canUsePortal, showInspectorChrome, updateAnchorRect]);

  useEffect(() => {
    if (!(isInspecting || isEditing) || !anchorRect || !canUsePortal || panelPosition) {
      return;
    }

    setPanelPosition({
      top: Math.min(anchorRect.bottom + 12, Math.max(window.innerHeight - 380, 8)),
      left: Math.min(anchorRect.left, Math.max(window.innerWidth - 460, 8)),
    });
  }, [anchorRect, canUsePortal, isEditing, isInspecting, panelPosition]);

  useEffect(() => {
    if (!canUsePortal) {
      return undefined;
    }

    function handlePointerMove(event: PointerEvent) {
      if (!dragOffsetRef.current) {
        return;
      }

      setPanelPosition({
        left: clampPanelCoordinate(event.clientX - dragOffsetRef.current.x, 8, Math.max(window.innerWidth - 460, 8)),
        top: clampPanelCoordinate(event.clientY - dragOffsetRef.current.y, 8, Math.max(window.innerHeight - 260, 8)),
      });
    }

    function handlePointerUp() {
      dragOffsetRef.current = null;
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [canUsePortal]);

  const handleSave = useCallback(async () => {
    if (!editor?.onSave) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await editor.onSave({
        key: keyName,
        locale: activeEditLocale,
        value: draft,
        variantId: activeEditVariantId,
      });
      client.loadResources(activeEditLocale, {
        [keyName]: buildUpdatedRawMessage(activeEditRawMessage, draft, activeEditVariantId),
      } as Partial<Record<string, LingvaMessage>>);
      setRevision((value) => value + 1);
      setIsEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save translation.');
    } finally {
      setSaving(false);
    }
  }, [activeEditLocale, activeEditRawMessage, activeEditVariantId, client, draft, editor, keyName]);

  const openInspector = useCallback(() => {
    cancelHide();
    updateAnchorRect();
    setPanelPosition(null);
    setInspectorLocale(resolvedLocale);
    setInspectorVariantId(variantId);
    setIsInspecting(true);
  }, [cancelHide, resolvedLocale, updateAnchorRect, variantId]);

  const startInlineEdit = useCallback(() => {
    cancelHide();
    setDraft(content);
    updateAnchorRect();
    setInspectorLocale(resolvedLocale);
    setInspectorVariantId(variantId);
    setIsEditing(true);
  }, [cancelHide, content, resolvedLocale, updateAnchorRect, variantId]);

  const presentation = resolveEditableTextPresentation({
    className,
    editorEnabled,
    isEditing,
    isHovered,
    isInspecting,
  });

  const componentProps = {
    className: presentation.className,
    onPointerEnter: editorEnabled
      ? () => {
          cancelHide();
          setIsHovered(true);
          updateAnchorRect();
        }
      : undefined,
    onPointerLeave: editorEnabled
      ? () => {
          scheduleHide();
        }
      : undefined,
    onFocus: editorEnabled
      ? () => {
          cancelHide();
          setIsHovered(true);
          updateAnchorRect();
        }
      : undefined,
    onBlur: editorEnabled
      ? () => {
          scheduleHide();
        }
      : undefined,
    onDoubleClick: editorEnabled && canPersistEdits ? startInlineEdit : undefined,
    onContextMenu: editorEnabled
      ? (event: ReactMouseEvent) => {
          event.preventDefault();
          openInspector();
        }
      : undefined,
    onKeyDown: editorEnabled
      ? (event: KeyboardEvent) => {
          if (event.key === ' ' && !isEditing && canPersistEdits) {
            event.preventDefault();
            startInlineEdit();
            return;
          }

          if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
            event.preventDefault();
            cancelHide();
            setIsHovered(true);
            updateAnchorRect();
            const bounds = elementRef.current?.getBoundingClientRect();
            elementRef.current?.dispatchEvent(
              new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: bounds?.left ?? 24,
                clientY: bounds?.bottom ?? 24,
              })
            );
          }
        }
      : undefined,
    tabIndex: editorEnabled ? 0 : undefined,
    'aria-label': editorEnabled ? `Lingva editable text ${String(keyName)}` : undefined,
    ref: elementRef,
    style: presentation.style,
  };

  const editorPortal =
    editorEnabled && isInspecting && anchorRect && canUsePortal
      ? createPortal(
          <div
            ref={editorPanelRef}
            data-lingva-editor-layer
            className="lingva-editable-text__popover"
            onPointerEnter={() => {
              cancelHide();
              setIsHovered(true);
            }}
            onPointerLeave={() => {
              scheduleHide();
            }}
            style={{
              position: 'fixed',
              top: panelPosition?.top ?? Math.min(anchorRect.bottom + 12, Math.max(window.innerHeight - 380, 8)),
              left: panelPosition?.left ?? Math.min(anchorRect.left, Math.max(window.innerWidth - 460, 8)),
              zIndex: 80,
              width: 'min(28rem, calc(100vw - 1.5rem))',
              maxHeight: 'min(36rem, calc(100vh - 2rem))',
              overflow: 'auto',
              borderRadius: '0.9rem',
              border: '1px solid rgba(15, 23, 42, 0.12)',
              background: 'rgba(255, 255, 255, 0.98)',
              boxShadow: '0 18px 55px rgba(15, 23, 42, 0.18)',
              backdropFilter: 'blur(12px)',
              padding: '0',
            }}
          >
            <div
              onPointerDown={(event) => {
                const bounds = editorPanelRef.current?.getBoundingClientRect();
                if (!bounds) {
                  return;
                }

                dragOffsetRef.current = {
                  x: event.clientX - bounds.left,
                  y: event.clientY - bounds.top,
                };
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                padding: '0.7rem 0.8rem 0.7rem 1rem',
                borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                cursor: 'grab',
                userSelect: 'none',
                background: 'linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.82))',
              }}
            >
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#0f172a',
                }}
              >
                Lingva Inspector
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                }}
              >
                Drag to move
              </span>
              <button
                type="button"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={() => {
                  setIsEditing(false);
                  setIsInspecting(false);
                  setPanelPosition(null);
                  setError(null);
                }}
                style={{ ...INSPECTOR_STYLES.button, minHeight: '2rem', padding: '0.3rem 0.6rem' }}
              >
                Close
              </button>
            </div>
            <div style={{ padding: '1rem' }}>
              {createElement(EditorComponent, {
                state: {
                  key: keyName,
                  locale: inspectedLocale,
                  rawMessage: inspectedRawMessage,
                  variant: selectedVariantId,
                },
                localeOptions,
                selectedLocale: inspectedLocale,
                onLocaleChange: (nextLocale) => {
                  setInspectorLocale(nextLocale);
                },
                variantOptions,
                selectedVariantId,
                onVariantChange: (nextVariantId) => {
                  setInspectorVariantId(nextVariantId);
                },
                localeStatuses,
                value: draft,
                saving,
                error,
                canOpenStudio: Boolean(studioUrl),
                canSave: Boolean(editor?.onSave) && (editor?.canSave ?? true),
                onCopyKey: () => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    void navigator.clipboard.writeText(String(keyName));
                  }
                },
                onOpenStudio: () => {
                  if (studioUrl && typeof window !== 'undefined') {
                    window.open(studioUrl, '_blank', 'noopener,noreferrer');
                  }
                },
                onChange: setDraft,
                onSave: () => {
                  if (editor?.onSave && (editor?.canSave ?? true)) {
                    void handleSave();
                  }
                },
                onCancel: () => {
                  setIsEditing(false);
                  setIsInspecting(false);
                  setPanelPosition(null);
                  setDraft(inspectedContent);
                  setError(null);
                },
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  const textNode = createElement(
    as,
    componentProps,
    <span
      ref={editableTextRef}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onInput={
        isEditing
          ? (event) => {
              setDraft(event.currentTarget.textContent ?? '');
            }
          : undefined
      }
      onClick={
        editorEnabled
          ? (event) => {
              if (!isInspecting || !canPersistEdits) {
                return;
              }

              event.stopPropagation();
              cancelHide();
              setDraft(draft || inspectedContent);
              setIsEditing(true);
            }
          : undefined
      }
      onKeyDown={
        isEditing
          ? (event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                if (canPersistEdits) {
                  void handleSave();
                }
                return;
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                setDraft(content);
                setIsEditing(false);
                setError(null);
              }
            }
          : undefined
      }
      style={resolveEditableSpanStyle(isEditing, isInspecting)}
    >
      {isEditing ? undefined : content}
    </span>
  );

  return (
    <>
      {textNode}
      {editorPortal}
    </>
  );
}
