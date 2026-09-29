import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// Read-only, public service-catalog client. This is NOT ride-booking transport.
/// A missing/invalid config never silently falls back to the local demo.
abstract class StagingCatalogReader {
  Future<List<PipPipStagingService>> availableServices();
}

class PipPipStagingCatalog implements StagingCatalogReader {
  PipPipStagingCatalog({
    String? projectUrl,
    String? publishableKey,
    HttpClient Function()? clientFactory,
  })  : _url = Uri.parse(projectUrl ??
            const String.fromEnvironment('PIPPIP_STAGING_URL')),
        _key = publishableKey ??
            const String.fromEnvironment('PIPPIP_STAGING_PUBLISHABLE_KEY'),
        _clients = clientFactory ?? HttpClient.new {
    if (_url.scheme != 'https' ||
        _url.host != 'ifnpbeozmbdofyczbvme.supabase.co' ||
        _url.userInfo.isNotEmpty ||
        _url.port != 443 ||
        _url.path.isNotEmpty && _url.path != '/' ||
        _url.hasQuery ||
        _url.hasFragment) {
      throw StateError('Approved PIP PIP HTTPS staging URL is required.');
    }
    if (!_key.startsWith('sb_publishable_') ||
        !RegExp(r'^sb_publishable_[A-Za-z0-9_-]+$').hasMatch(_key)) {
      throw StateError('A public Supabase publishable key is required.');
    }
  }

  final Uri _url;
  final String _key;
  final HttpClient Function() _clients;

  /// Anonymous, filtered by RLS + invoker view; disabled services never appear.
  Future<List<PipPipStagingService>> availableServices() async {
    final url = _url.resolve('/rest/v1/mobile_city_catalog?select=city,timezone,service');
    final client = _clients()..connectionTimeout = const Duration(seconds: 5);
    try {
      return await (() async {
        final request = await client.getUrl(url);
        request.headers.set('apikey', _key);
        request.headers.set('Accept', 'application/json');
        final response = await request.close();
        final body = await utf8.decoder.bind(response).join();
        if (response.statusCode != 200) throw const StagingCatalogUnavailable();
        final decoded = jsonDecode(body);
        if (decoded is! List) throw const StagingCatalogUnavailable();
        return decoded.map((item) {
          if (item is! Map ||
              item['city'] is! String ||
              item['timezone'] is! String ||
              item['service'] is! String) {
            throw const StagingCatalogUnavailable();
          }
          return PipPipStagingService(
            city: item['city'] as String,
            timezone: item['timezone'] as String,
            service: item['service'] as String,
          );
        }).toList(growable: false);
      })().timeout(const Duration(seconds: 9));
    } on StagingCatalogUnavailable {
      rethrow;
    } on Object {
      throw const StagingCatalogUnavailable();
    } finally {
      client.close(force: true);
    }
  }
}

class PipPipStagingService {
  const PipPipStagingService({
    required this.city,
    required this.timezone,
    required this.service,
  });
  final String city;
  final String timezone;
  final String service;
}

class StagingCatalogUnavailable implements Exception {
  const StagingCatalogUnavailable();
  @override
  String toString() => 'Unable to load the approved online pilot catalog.';
}
