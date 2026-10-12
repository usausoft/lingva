# `@lingva/angular`

Angular dependency-injection and signal bindings for the Lingva localization
runtime.

```bash
pnpm add @lingva/angular
pnpm add --save-dev @lingva/cli
pnpm lingva init --mode local --no-auth --sdk angular
```

Use `provideLingvaAngular` for browser applications and
`createLingvaAngularServer` for request-scoped server rendering. The package
supports local generated resources and hosted bundle delivery.

[Read the Angular guide](https://docs.lingva.dev/installation/angular).
