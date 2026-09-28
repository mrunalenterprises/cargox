import 'dart:async';
import 'dart:convert';
import 'dart:io';

abstract class DemoApi {
  Future<dynamic> get(String path);
  Future<dynamic> post(String path, Map<String, Object?> body);
}

/// No credentials, location or personal documents belong in this demo adapter.
class LocalDemoApi implements DemoApi {
  LocalDemoApi({String? baseUrl})
      : base = Uri.parse(
          baseUrl ??
              const String.fromEnvironment(
                'CARGOX_DEMO_API',
                defaultValue: 'http://127.0.0.1:4173',
              ),
        ) {
    if (base.scheme != 'http' ||
        !['127.0.0.1', 'localhost', '10.0.2.2'].contains(base.host) ||
        base.userInfo.isNotEmpty ||
        base.hasQuery ||
        base.hasFragment ||
        (base.path.isNotEmpty && base.path != '/')) {
      throw ArgumentError(
        'Demo API must use a loopback HTTP origin or Android emulator host.',
      );
    }
  }
  final Uri base;
  @override
  Future<dynamic> get(String path) => _request(path, null);
  @override
  Future<dynamic> post(String path, Map<String, Object?> body) =>
      _request(path, body);
  Future<dynamic> _request(String path, Map<String, Object?>? body) async {
    final uri = base.resolve(path);
    if (uri.origin != base.origin || !uri.path.startsWith('/api/')) {
      throw ArgumentError('Only local /api/ paths are allowed.');
    }
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 5);
    try {
      return await (() async {
        final request = await client.openUrl(
          body == null ? 'GET' : 'POST',
          uri,
        );
        if (body != null) {
          request.headers.contentType = ContentType.json;
          request.write(jsonEncode(body));
        }
        final reply = await request.close();
        final result = jsonDecode(await utf8.decoder.bind(reply).join());
        if (reply.statusCode >= 400) {
          throw DemoFailure(
            result is Map ? '${result['message']}' : 'Request failed',
          );
        }
        return result;
      })()
          .timeout(const Duration(seconds: 10));
    } on SocketException {
      throw const DemoFailure(
        'Local API unavailable. Start npm run dev:demo and use adb reverse tcp:4173 tcp:4173 on Android.',
      );
    } on TimeoutException {
      throw const DemoFailure(
        'Local API timed out. Refresh status before retrying a booking to avoid duplicates.',
      );
    } on FormatException {
      throw const DemoFailure('Local API returned an invalid response.');
    } finally {
      client.close(force: true);
    }
  }
}

class DemoFailure implements Exception {
  const DemoFailure(this.message);
  final String message;
  @override
  String toString() => message;
}

String rupees(num paise) => 'INR ${(paise / 100).toStringAsFixed(2)}';
String civilDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
