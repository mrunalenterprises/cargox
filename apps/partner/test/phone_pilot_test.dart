import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cargox_partner/main.dart';
import 'package:cargox_demo/cargox_demo.dart';
import 'package:cargox_ui/cargox_ui.dart';

class CountingDemo implements DemoApi {
  int calls = 0;
  @override
  Future<dynamic> get(String path) async { calls++; throw StateError('No local service'); }
  @override
  Future<dynamic> post(String path, Map<String,Object?> body) async {
    calls++; throw StateError('No local service');
  }
}
void main() {
  testWidgets('phone pilot partner never polls unreachable local demo', (tester) async {
    if (!PipPipBrand.phonePilot) return; // Explicit phone pilot dart-define in CI.
    final api = CountingDemo();
    await tester.pumpWidget(MaterialApp(
      theme: cargoxTheme(), home: PartnerHome(api: api),
    ));
    await tester.pumpAndSettle();
    expect(api.calls, 0);
    expect(find.text('Check online pilot'), findsOneWidget);
    expect(find.textContaining('ONLINE PILOT'), findsOneWidget);
    expect(find.textContaining('Local API unavailable'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
