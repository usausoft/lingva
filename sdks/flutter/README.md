# Lingva for Flutter (preview)

`lingva_flutter` provides a `ChangeNotifier`-based owner for local or hosted
Lingva bundles. A failed refresh leaves the last valid bundle available, and a
successful load notifies dependent widgets once.

`LingvaDeliveryTarget` resolves hosted bundle URL templates and
`LingvaBundleController.refresh` loads the resulting URI without attaching
credentials. Lingva hosted delivery therefore requires a customer-controlled
authenticated proxy; otherwise ship a packaged asset. Never embed a project
key in the application.

Variant selection matches the other Lingva runtimes. Unknown selectors fall
back to the first variant:

```dart
bundle.translate('welcome.title', variant: const LingvaVariantSelector.id('bold'));
bundle.translate(
  'welcome.title',
  variant: const LingvaVariantSelector.metadata({'tone': 'warm'}),
);
```

The package is intentionally marked `publish_to: none` while its API and
release policy are being verified in the native reference application.
