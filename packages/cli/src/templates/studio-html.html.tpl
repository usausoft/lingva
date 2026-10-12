<!doctype html>
<html lang="{{HTML_LANG}}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lingva Studio Preview</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe4;
        --surface: rgba(255, 252, 246, 0.92);
        --surface-strong: #fffdf8;
        --border: rgba(54, 46, 35, 0.14);
        --text: #241d15;
        --muted: #6f6255;
        --accent: #0f766e;
        --accent-soft: rgba(15, 118, 110, 0.12);
        --warning: #b45309;
        --warning-soft: rgba(180, 83, 9, 0.12);
        --shadow: 0 20px 60px rgba(36, 29, 21, 0.08);
        font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.08), transparent 32%),
          linear-gradient(180deg, #f8f3ea 0%, var(--bg) 100%);
        color: var(--text);
      }
      main {
        width: min(1160px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 40px 0 72px;
      }
      .hero, .panel {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 28px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(14px);
      }
      .hero {
        padding: 32px;
        margin-bottom: 24px;
      }
      .eyebrow {
        display: inline-flex;
        padding: 6px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 16px 0 12px;
        font-size: clamp(2rem, 4vw, 3.4rem);
        line-height: 0.95;
      }
      .hero p {
        margin: 0;
        max-width: 70ch;
        color: var(--muted);
        font-size: 1rem;
        line-height: 1.7;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-top: 28px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 22px;
      }
      .hero-note {
        margin-top: 18px !important;
        font-size: 0.92rem !important;
      }
      .summary-card {
        padding: 18px 20px;
        border-radius: 20px;
        background: var(--surface-strong);
        border: 1px solid var(--border);
      }
      .summary-card span {
        display: block;
        color: var(--muted);
        font-size: 0.85rem;
      }
      .summary-card strong {
        display: block;
        margin-top: 8px;
        font-size: 1.8rem;
      }
      .panel {
        padding: 28px;
      }
      .panel h2 {
        margin: 0 0 18px;
        font-size: 1.2rem;
      }
      .coverage-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
        margin-bottom: 28px;
      }
      .lingva-summary-card {
        padding: 18px;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: var(--surface-strong);
      }
      .lingva-summary-card h2 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .lingva-summary-card p {
        margin: 6px 0 0;
        color: var(--muted);
      }
      .lingva-tree {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .lingva-node-group + .lingva-node-group,
      .lingva-node-group + .lingva-node-leaf,
      .lingva-node-leaf + .lingva-node-group,
      .lingva-node-leaf + .lingva-node-leaf {
        margin-top: 16px;
      }
      details > summary {
        cursor: pointer;
        list-style: none;
        font-weight: 700;
      }
      details > summary::-webkit-details-marker { display: none; }
      .lingva-key {
        display: inline-flex;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(36, 29, 21, 0.05);
      }
      .lingva-message-card {
        padding: 18px;
        border-radius: 22px;
        border: 1px solid var(--border);
        background: var(--surface-strong);
      }
      .lingva-message-header {
        margin-bottom: 10px;
        color: var(--muted);
      }
      .lingva-message-default {
        margin-bottom: 16px;
        font-size: 1rem;
        line-height: 1.6;
      }
      .lingva-editor-label {
        display: block;
        margin-bottom: 8px;
        color: var(--muted);
        font-size: 0.82rem;
      }
      .lingva-editor-hint,
      .lingva-variant-meta {
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 500;
      }
      .lingva-variant-editor + .lingva-variant-editor {
        margin-top: 10px;
      }
      .lingva-variant-preview + .lingva-variant-preview {
        margin-top: 10px;
      }
      .lingva-editor {
        width: 100%;
        min-height: 110px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(15, 118, 110, 0.22);
        background: rgba(255, 255, 255, 0.92);
        color: var(--text);
        font: inherit;
        line-height: 1.55;
        resize: vertical;
      }
      .lingva-editor:focus {
        outline: 2px solid rgba(15, 118, 110, 0.18);
        border-color: var(--accent);
      }
      .lingva-locale-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
      }
      .lingva-locale-card {
        padding: 14px;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: #fff;
      }
      .lingva-locale-card.translated {
        background: rgba(15, 118, 110, 0.05);
      }
      .lingva-locale-card.source {
        background: rgba(15, 118, 110, 0.08);
      }
      .lingva-locale-card.missing {
        background: rgba(180, 83, 9, 0.06);
      }
      .lingva-locale-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }
      .lingva-locale-name {
        font-weight: 700;
      }
      .lingva-locale-status {
        font-size: 0.8rem;
        color: var(--muted);
      }
      .lingva-locale-card.missing .lingva-locale-status {
        color: var(--warning);
      }
      .lingva-locale-value {
        color: var(--muted);
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .lingva-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 10px 16px;
        border: 1px solid rgba(15, 118, 110, 0.16);
        border-radius: 999px;
        background: #fff;
        color: var(--text);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
      }
      .lingva-action:hover {
        transform: translateY(-1px);
        border-color: rgba(15, 118, 110, 0.32);
        background: rgba(15, 118, 110, 0.04);
      }
      @media (max-width: 720px) {
        main { width: min(100vw - 20px, 100%); padding: 20px 0 48px; }
        .hero, .panel { border-radius: 22px; padding: 20px; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <span class="eyebrow">Lingva Studio Preview</span>
        <h1>Local translation tree</h1>
        <p>Editable local preview for <code>{{CONFIG_FILE}}</code>. Update the default locale directly in this view, then export refreshed JSON files without touching your source code by hand.</p>
        <p class="hero-note">This slice is intentionally local-first: edit the source locale here, download the updated dictionary, and export synced locale files that preserve existing translations while filling missing keys with blanks.</p>
        <div class="summary">
          <article class="summary-card">
            <span>Default locale</span>
            <strong>{{DEFAULT_LOCALE}}</strong>
          </article>
          <article class="summary-card">
            <span>Configured locales</span>
            <strong>{{LOCALE_COUNT}}</strong>
          </article>
          <article class="summary-card">
            <span>Translation keys</span>
            <strong>{{TOTAL_KEYS}}</strong>
          </article>
        </div>
        <div class="actions">
          <button class="lingva-action" type="button" data-lingva-download-default="{{DEFAULT_LOCALE}}">Download {{DEFAULT_LOCALE}}.json</button>
          <button class="lingva-action" type="button" data-lingva-reset>Reset edits</button>
        </div>
      </section>
      <section class="panel">
        <h2>Coverage</h2>
        <div class="coverage-grid">{{COVERAGE_CARDS}}</div>
        <h2>Messages</h2>
        <ul class="lingva-tree">{{MESSAGE_TREE}}</ul>
      </section>
    </main>
    <script id="lingva-studio-data" type="application/json">{{STUDIO_DATA}}</script>
    <script>
      const studioData = JSON.parse(document.getElementById('lingva-studio-data').textContent);
      const defaultLocale = studioData.defaultLocale;

      function flattenNodes(nodes) {
        return nodes.flatMap((node) => node.children.length > 0 ? flattenNodes(node.children) : [node]);
      }

      function setValueByPath(target, path, value) {
        const segments = path.split('.');
        let current = target;

        for (let index = 0; index < segments.length; index += 1) {
          const segment = segments[index];

          if (index === segments.length - 1) {
            current[segment] = value;
            return;
          }

          current[segment] = current[segment] && typeof current[segment] === 'object' ? current[segment] : {};
          current = current[segment];
        }
      }

      function buildLeafValue(node) {
        if (typeof node.value === 'string' || node.value === undefined) {
          const input = document.querySelector('[data-lingva-path="' + node.path + '"]:not([data-lingva-variant-id])');
          return input ? input.value : (typeof node.value === 'string' ? node.value : '');
        }

        return node.value.map((variant) => {
          const input = document.querySelector('[data-lingva-path="' + node.path + '"][data-lingva-variant-id="' + variant.id + '"]');
          return {
            ...variant,
            text: input ? input.value : variant.text,
          };
        });
      }

      function buildDefaultLocaleDictionary() {
        const dictionary = {};
        const nodes = flattenNodes(studioData.tree);

        for (const node of nodes) {
          setValueByPath(dictionary, node.path, buildLeafValue(node));
        }

        return dictionary;
      }

      function buildSyncedLocaleDictionary(locale) {
        const dictionary = {};
        const nodes = flattenNodes(studioData.tree);

        for (const node of nodes) {
          const localeEntry = node.locales[locale];
          const value = locale === defaultLocale
            ? buildLeafValue(node)
            : (localeEntry && localeEntry.value !== undefined
                ? localeEntry.value
                : (Array.isArray(node.value)
                    ? node.value.map((variant) => ({ ...variant, text: '' }))
                    : ''));
          setValueByPath(dictionary, node.path, value);
        }

        return dictionary;
      }

      function downloadJson(fileName, payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      document.querySelectorAll('[data-lingva-download-default]').forEach((button) => {
        button.addEventListener('click', () => {
          downloadJson(defaultLocale + '.json', buildDefaultLocaleDictionary());
        });
      });

      document.querySelectorAll('[data-lingva-download-locale]').forEach((button) => {
        button.addEventListener('click', () => {
          const locale = button.getAttribute('data-lingva-download-locale');
          if (!locale) return;
          downloadJson(locale + '.json', buildSyncedLocaleDictionary(locale));
        });
      });

      document.querySelector('[data-lingva-reset]')?.addEventListener('click', () => {
        flattenNodes(studioData.tree).forEach((node) => {
          if (typeof node.value === 'string' || node.value === undefined) {
            const input = document.querySelector('[data-lingva-path="' + node.path + '"]:not([data-lingva-variant-id])');
            if (input) {
              input.value = node.value || '';
            }
            return;
          }

          node.value.forEach((variant) => {
            const input = document.querySelector('[data-lingva-path="' + node.path + '"][data-lingva-variant-id="' + variant.id + '"]');
            if (input) {
              input.value = variant.text || '';
            }
          });
        });
      });
    </script>
  </body>
</html>
