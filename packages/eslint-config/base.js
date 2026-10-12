import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';

const behaviorDiscriminants = new Set([
  'action',
  'currentUserRole',
  'deliveryMode',
  'kind',
  'method',
  'mode',
  'permission',
  'role',
  'source',
  'stage',
  'status',
  'tier',
]);

function getPropertyName(node) {
  if (!node) return undefined;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  return undefined;
}

function isNamedContractDefinition(node) {
  let current = node.parent;

  while (current) {
    if (current.type === 'VariableDeclarator' && current.id?.type === 'Identifier') {
      return /^[A-Z][A-Z0-9_]+$/u.test(current.id.name);
    }

    if (['Program', 'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(current.type)) {
      return false;
    }

    current = current.parent;
  }

  return false;
}

function isTrackedDiscriminant(node) {
  if (node?.type === 'Identifier') return behaviorDiscriminants.has(node.name);
  return node?.type === 'MemberExpression' && behaviorDiscriminants.has(getPropertyName(node.property));
}

const noMagicBehaviorStringsRule = {
  meta: {
    docs: {
      description: 'Require named contracts for behavior-selecting string literals',
    },
    messages: {
      unnamed: "Replace the '{{value}}' behavior literal with a named contract constant.",
    },
    schema: [],
    type: 'suggestion',
  },
  create(context) {
    const reportLiteral = (node) => {
      if (typeof node.value !== 'string' || node.value.length === 0 || isNamedContractDefinition(node)) return;
      context.report({
        node,
        messageId: 'unnamed',
        data: { value: node.value },
      });
    };

    return {
      AssignmentExpression(node) {
        if (isTrackedDiscriminant(node.left) && node.right.type === 'Literal') reportLiteral(node.right);
      },
      BinaryExpression(node) {
        if (!['===', '!==', '==', '!='].includes(node.operator)) return;
        if (isTrackedDiscriminant(node.left) && node.right.type === 'Literal') reportLiteral(node.right);
        if (isTrackedDiscriminant(node.right) && node.left.type === 'Literal') reportLiteral(node.left);
      },
      Property(node) {
        if (behaviorDiscriminants.has(getPropertyName(node.key)) && node.value.type === 'Literal') {
          reportLiteral(node.value);
        }
      },
    };
  },
};

const nonCopyJsxElements = new Set(['code', 'pre']);

function isInsideNonCopyJsxElement(node) {
  let current = node.parent;

  while (current) {
    if (current.type === 'JSXElement') {
      const name = current.openingElement?.name;
      if (name?.type === 'JSXIdentifier' && nonCopyJsxElements.has(name.name)) return true;
    }
    current = current.parent;
  }

  return false;
}

function containsTranslatableText(value) {
  const normalized = String(value).replace(/\s+/gu, ' ').trim();
  return /\p{L}/u.test(normalized) && normalized !== 'Lingva';
}

const noHardcodedJsxCopyRule = {
  meta: {
    docs: { description: 'Require translation resources for user-visible JSX copy' },
    messages: { hardcoded: 'Move user-visible copy to the translation resources.' },
    schema: [],
    type: 'problem',
  },
  create(context) {
    const report = (node, value) => {
      if (containsTranslatableText(value) && !isInsideNonCopyJsxElement(node)) {
        context.report({ node, messageId: 'hardcoded' });
      }
    };

    return {
      JSXAttribute(node) {
        const translatedAttributes = new Set(['alt', 'aria-label', 'placeholder', 'title']);
        if (
          node.name?.type === 'JSXIdentifier' &&
          translatedAttributes.has(node.name.name) &&
          node.value?.type === 'Literal'
        ) {
          report(node.value, node.value.value);
        }
      },
      JSXExpressionContainer(node) {
        if (node.expression?.type === 'Literal' && typeof node.expression.value === 'string') {
          report(node.expression, node.expression.value);
        }
      },
      JSXText(node) {
        report(node, node.value);
      },
    };
  },
};

const lingvaConventionsPlugin = {
  rules: {
    'no-hardcoded-jsx-copy': noHardcodedJsxCopyRule,
    'no-magic-behavior-strings': noMagicBehaviorStringsRule,
  },
};

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
    plugins: {
      'lingva-conventions': lingvaConventionsPlugin,
      turbo: turboPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // Keep the type-aware rules focused on defects that TypeScript itself
      // cannot reliably report. Runtime payload validation remains explicit at
      // API boundaries instead of treating every external value as a lint error.
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: false,
          fixStyle: 'inline-type-imports',
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-array-delete': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          // React intentionally accepts event callbacks whose return value is
          // ignored. Effects and ordinary callbacks remain fully checked.
          checksVoidReturn: { attributes: false },
        },
      ],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      '@typescript-eslint/no-unsafe-unary-minus': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'error',
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/unbound-method': 'error',
      curly: ['error', 'multi-line', 'consistent'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'lingva-conventions/no-magic-behavior-strings': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'no-nested-ternary': 'error',
      'no-param-reassign': ['error', { props: false }],
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'turbo/no-undeclared-env-vars': 'error',
    },
  },
  {
    files: ['**/*.{cjs,js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
  {
    // Tests intentionally repeat wire values as independent compatibility
    // assertions and frequently use deliberately loose mocks. They still receive
    // the complete syntax-aware ruleset, while production code receives the
    // type-aware rules that depend on each package's build tsconfig.
    files: ['**/*.test.*', '**/*.spec.*', '**/fixtures/**'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      'lingva-conventions/no-magic-behavior-strings': 'off',
    },
  },
  {
    // Tool configuration files are intentionally outside package build
    // tsconfigs. Lint their syntax without creating parallel compiler projects.
    files: ['**/*.config.{ts,tsx}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
  // Keep this last so ESLint owns correctness and Prettier owns presentation.
  eslintConfigPrettier,
  {
    ignores: [
      'dist/**',
      '.next/**',
      '**/.docusaurus/**',
      '**/.lingva/generated/**',
      '**/.lingva/local-remote/**',
      '**/.turbo/**',
      '**/.vercel/**',
      '**/build/**',
      '**/cdk.out/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
];
