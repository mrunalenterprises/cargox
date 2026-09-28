import 'dart:convert';
import 'dart:io';

import 'package:cargox_demo/cargox_demo.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('rejects remote and credential-bearing demo origins', () {
    for (final url in [
      'https://example.com',
      'http://192.168.1.1:4173',
      'http://me:secret@localhost:4173',
    ]) {
      expect(() => LocalDemoApi(baseUrl: url), throwsArgumentError);
    }
  });
  test('real HTTP adapter encodes JSON and reports server errors', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));
    server.listen((request) async {
      final value = jsonDecode(await utf8.decoder.bind(request).join());
      request.response.statusCode = value['fail'] == true ? 400 : 200;
      request.response.write(
        jsonEncode(
          value['fail'] == true ? {'message': 'Service gated'} : value,
        ),
      );
      await request.response.close();
    });
    final api = LocalDemoApi(baseUrl: 'http://127.0.0.1:${server.port}');
    expect(await api.post('/api/quotes', {'service': 'auto'}), {
      'service': 'auto',
    });
    await expectLater(
      api.post('/api/quotes', {'fail': true}),
      throwsA(isA<DemoFailure>()),
    );
    await expectLater(
      api.get('http://example.com/api/rides'),
      throwsArgumentError,
    );
  });
}
