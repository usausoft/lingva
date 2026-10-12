export const PUBLIC_PACKAGE_DIRECTORIES = Object.freeze([
  'packages/core',
  'packages/js',
  'packages/node',
  'packages/react',
  'packages/next',
  'packages/angular',
  'packages/vue',
  'packages/svelte',
  'packages/docusaurus',
  'packages/electron',
  'packages/cli',
]);

export const PUBLIC_PACKAGE_NAMES = Object.freeze(
  PUBLIC_PACKAGE_DIRECTORIES.map((directory) => `@lingva/${directory.slice('packages/'.length)}`)
);
