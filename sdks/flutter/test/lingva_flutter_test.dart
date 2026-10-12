import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:lingva_flutter/lingva_flutter.dart';

void main() {
  String fixture() => File('../fixtures/en.bundle.json').readAsStringSync();

  test('resolves hosted delivery uri', () {
    const target = LingvaDeliveryTarget(
      uriTemplate: 'https://delivery.example.test/{projectId}/{environment}/{publishId}/{locale}.bundle.json',
      projectId: 'demo',
      environment: 'production',
      publishId: 'latest',
    );

    expect(
      target.uri('ru').toString(),
      'https://delivery.example.test/demo/production/latest/ru.bundle.json',
    );
  });

  test('rejects an unresolved hosted delivery placeholder', () {
    const target = LingvaDeliveryTarget(
      uriTemplate: 'https://delivery.example.test/{projectId}/{locale}.bundle.json',
    );

    expect(() => target.uri('en'), throwsA(isA<MissingLingvaDeliveryPlaceholder>()));
  });

  test('decodes and translates the shared fixture', () {
    final bundle = LingvaBundle.decode(fixture());

    expect(bundle.projectId, 'native-demo');
    expect(bundle.translate('welcome.title', values: {'name': 'Yury'}), 'Welcome, Yury.');
    expect(
      bundle.translate(
        'welcome.title',
        values: {'name': 'Yury'},
        variant: const LingvaVariantSelector.id('bold'),
      ),
      'Ship it, Yury!',
    );
    expect(
      bundle.translate(
        'welcome.title',
        values: {'name': 'Yury'},
        variant: const LingvaVariantSelector.metadata({'tone': 'warm'}),
      ),
      'Welcome, Yury.',
    );
    expect(
      bundle.translate(
        'welcome.title',
        values: {'name': 'Yury'},
        variant: const LingvaVariantSelector.id('unknown'),
      ),
      'Welcome, Yury.',
    );
    expect(bundle.translate('missing.key'), 'missing.key');
  });

  test('preserves the last valid bundle after invalid input', () {
    final controller = LingvaBundleController();
    final valid = controller.load(fixture());

    expect(() => controller.load('{}'), throwsA(isA<Object>()));
    expect(controller.bundle, same(valid));
  });

  test('rejects unsupported schemas', () {
    final incompatible = fixture().replaceFirst('"schemaVersion": 1', '"schemaVersion": 2');

    expect(
      () => LingvaBundle.decode(incompatible),
      throwsA(isA<UnsupportedLingvaBundleSchema>()),
    );
  });
}
