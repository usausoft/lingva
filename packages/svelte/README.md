# `@lingva/svelte`

Typed Svelte stores backed by the Lingva localization runtime.

```bash
pnpm add @lingva/svelte
pnpm add --save-dev @lingva/cli
pnpm lingva init --mode local --no-auth --sdk svelte
```

Use `createLingvaSvelte` in browser applications and
`createLingvaSvelteServer` inside request-scoped SvelteKit server loads. The
package supports local generated resources and hosted bundle delivery.

[Read the Svelte guide](https://docs.lingva.dev/installation/svelte).
