library lingva_flutter;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

abstract final class LingvaBundleContract {
  static const schemaVersion = 1;
}

abstract final class _BundleFields {
  static const defaultLocale = 'defaultLocale';
  static const environment = 'environment';
  static const fallbackKeys = 'fallbackKeys';
  static const fallbackLocale = 'fallbackLocale';
  static const generatedAt = 'generatedAt';
  static const keyCount = 'keyCount';
  static const locale = 'locale';
  static const messages = 'messages';
  static const projectId = 'projectId';
  static const schemaVersion = 'schemaVersion';
  static const sources = 'sources';
  static const variables = 'variables';
  static const variants = 'variants';
}

abstract final class _VariantFields {
  static const id = 'id';
  static const text = 'text';
  static const tone = 'tone';
  static const mood = 'mood';
  static const intonation = 'intonation';
  static const label = 'label';
  static const context = 'context';
}

enum _DeliveryPlaceholder {
  environment,
  locale,
  projectId,
  publishId;

  String get token => '{$name}';
}

final class InvalidLingvaDeliveryUri implements Exception {
  const InvalidLingvaDeliveryUri(this.value);

  final String value;

  @override
  String toString() => 'Invalid Lingva delivery URI: $value';
}

final class MissingLingvaDeliveryPlaceholder implements Exception {
  const MissingLingvaDeliveryPlaceholder(this.placeholder);

  final String placeholder;

  @override
  String toString() => 'Missing Lingva delivery placeholder value: $placeholder';
}

/// Resolves a Lingva delivery URL template without attaching credentials.
@immutable
final class LingvaDeliveryTarget {
  const LingvaDeliveryTarget({
    required this.uriTemplate,
    this.projectId,
    this.environment,
    this.publishId,
  });

  final String uriTemplate;
  final String? projectId;
  final String? environment;
  final String? publishId;

  Uri uri(String locale) {
    final values = {
      _DeliveryPlaceholder.environment: environment,
      _DeliveryPlaceholder.locale: locale,
      _DeliveryPlaceholder.projectId: projectId,
      _DeliveryPlaceholder.publishId: publishId,
    };
    final resolved = _DeliveryPlaceholder.values.fold(uriTemplate, (value, placeholder) {
      if (!value.contains(placeholder.token)) return value;
      final replacement = values[placeholder];
      if (replacement == null || replacement.isEmpty) {
        throw MissingLingvaDeliveryPlaceholder(placeholder.name);
      }
      return value.replaceAll(placeholder.token, replacement);
    });
    final uri = Uri.tryParse(resolved);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw InvalidLingvaDeliveryUri(resolved);
    }
    return uri;
  }
}

final class UnsupportedLingvaBundleSchema implements Exception {
  const UnsupportedLingvaBundleSchema(this.version);

  final int version;

  @override
  String toString() => 'Unsupported Lingva bundle schema: $version';
}

@immutable
final class LingvaMessageVariant {
  const LingvaMessageVariant({
    required this.id,
    required this.text,
    this.tone,
    this.mood,
    this.intonation,
    this.label,
    this.context,
  });

  factory LingvaMessageVariant.fromJson(Map<String, dynamic> json) => LingvaMessageVariant(
        id: json[_VariantFields.id] as String,
        text: json[_VariantFields.text] as String,
        tone: json[_VariantFields.tone] as String?,
        mood: json[_VariantFields.mood] as String?,
        intonation: json[_VariantFields.intonation] as String?,
        label: json[_VariantFields.label] as String?,
        context: json[_VariantFields.context] as String?,
      );

  final String id;
  final String text;
  final String? tone;
  final String? mood;
  final String? intonation;
  final String? label;
  final String? context;

  bool matches(Map<String, String> metadata) {
    final fields = {
      _VariantFields.id: id,
      _VariantFields.text: text,
      _VariantFields.tone: tone,
      _VariantFields.mood: mood,
      _VariantFields.intonation: intonation,
      _VariantFields.label: label,
      _VariantFields.context: context,
    };
    return metadata.entries.every((entry) => fields[entry.key] == entry.value);
  }
}

@immutable
final class LingvaVariantSelector {
  const LingvaVariantSelector.id(String id)
      : id = id,
        metadata = null;

  const LingvaVariantSelector.metadata(Map<String, String> metadata)
      : id = null,
        metadata = metadata;

  final String? id;
  final Map<String, String>? metadata;
}

@immutable
final class LingvaBundle {
  const LingvaBundle({
    required this.schemaVersion,
    required this.projectId,
    required this.environment,
    required this.locale,
    required this.defaultLocale,
    required this.fallbackLocale,
    required this.generatedAt,
    required this.keyCount,
    required this.fallbackKeys,
    required this.messages,
    required this.sources,
    required this.variables,
    required this.variants,
  });

  factory LingvaBundle.decode(String payload) {
    final value = jsonDecode(payload);
    if (value is! Map<String, dynamic>) {
      throw const FormatException('Lingva bundle must be a JSON object.');
    }
    return LingvaBundle.fromJson(value);
  }

  factory LingvaBundle.fromJson(Map<String, dynamic> json) {
    final version = json[_BundleFields.schemaVersion] as int;
    if (version != LingvaBundleContract.schemaVersion) {
      throw UnsupportedLingvaBundleSchema(version);
    }

    return LingvaBundle(
      schemaVersion: version,
      projectId: json[_BundleFields.projectId] as String?,
      environment: json[_BundleFields.environment] as String?,
      locale: json[_BundleFields.locale] as String,
      defaultLocale: json[_BundleFields.defaultLocale] as String,
      fallbackLocale: json[_BundleFields.fallbackLocale] as String?,
      generatedAt: json[_BundleFields.generatedAt] as String,
      keyCount: json[_BundleFields.keyCount] as int,
      fallbackKeys: _stringList(json[_BundleFields.fallbackKeys]),
      messages: _stringMap(json[_BundleFields.messages]),
      sources: _stringMap(json[_BundleFields.sources]),
      variables: _variablesMap(json[_BundleFields.variables]),
      variants: _variantsMap(json[_BundleFields.variants]),
    );
  }

  final int schemaVersion;
  final String? projectId;
  final String? environment;
  final String locale;
  final String defaultLocale;
  final String? fallbackLocale;
  final String generatedAt;
  final int keyCount;
  final List<String> fallbackKeys;
  final Map<String, String> messages;
  final Map<String, String> sources;
  final Map<String, List<String>> variables;
  final Map<String, List<LingvaMessageVariant>> variants;

  String translate(
    String key, {
    Map<String, String> values = const {},
    String? fallback,
    LingvaVariantSelector? variant,
  }) {
    var message = messages[key];
    if (message == null) return fallback ?? key;

    final candidates = variants[key];
    if (candidates != null && candidates.isNotEmpty) {
      LingvaMessageVariant? selected;
      if (variant?.id != null) {
        selected = candidates.firstWhere(
          (candidate) => candidate.id == variant!.id,
          orElse: () => candidates.first,
        );
      } else if (variant?.metadata != null) {
        selected = candidates.firstWhere(
          (candidate) => candidate.matches(variant!.metadata!),
          orElse: () => candidates.first,
        );
      }
      message = (selected ?? candidates.first).text;
    }

    return variables[key]?.fold<String>(
          message,
          (resolved, variable) => values[variable] == null
              ? resolved
              : resolved.replaceAll('{$variable}', values[variable]!),
        ) ??
        message;
  }

  static List<String> _stringList(Object? value) =>
      List<String>.unmodifiable((value! as List<dynamic>).cast<String>());

  static Map<String, String> _stringMap(Object? value) =>
      Map<String, String>.unmodifiable((value! as Map<String, dynamic>).cast<String, String>());

  static Map<String, List<String>> _variablesMap(Object? value) => Map<String, List<String>>.unmodifiable(
        (value! as Map<String, dynamic>).map(
          (key, variables) => MapEntry(key, _stringList(variables)),
        ),
      );

  static Map<String, List<LingvaMessageVariant>> _variantsMap(Object? value) {
    if (value == null) return const {};
    return Map<String, List<LingvaMessageVariant>>.unmodifiable(
      (value as Map<String, dynamic>).map(
        (key, variants) => MapEntry(
          key,
          List<LingvaMessageVariant>.unmodifiable(
            (variants as List<dynamic>).map(
              (variant) => LingvaMessageVariant.fromJson(variant as Map<String, dynamic>),
            ),
          ),
        ),
      ),
    );
  }
}

/// Owns the last valid bundle and notifies widgets only after a successful load.
final class LingvaBundleController extends ChangeNotifier {
  LingvaBundleController({LingvaBundle? initialBundle}) : _bundle = initialBundle;

  LingvaBundle? get bundle => _bundle;
  LingvaBundle? _bundle;

  LingvaBundle load(String payload) {
    final candidate = LingvaBundle.decode(payload);
    _bundle = candidate;
    notifyListeners();
    return candidate;
  }

  Future<LingvaBundle> loadAsset(String assetName, {AssetBundle? assetBundle}) async {
    final payload = await (assetBundle ?? rootBundle).loadString(assetName);
    return load(payload);
  }

  Future<LingvaBundle> refresh(Uri uri, {AssetBundle? networkBundle}) async {
    final source = networkBundle ?? NetworkAssetBundle(uri);
    final ByteData bytes = await source.load(uri.toString());
    return load(utf8.decode(bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes)));
  }

  String translate(
    String key, {
    Map<String, String> values = const {},
    String? fallback,
    LingvaVariantSelector? variant,
  }) =>
      _bundle?.translate(key, values: values, fallback: fallback, variant: variant) ?? fallback ?? key;
}
