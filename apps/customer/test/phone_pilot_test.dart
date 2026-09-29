import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cargox_customer/main.dart';
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
  testWidgets('phone pilot customer opens without localhost traffic', (tester) async {
    if (!PipPipBrand.phonePilot) return; // Test again with phone build dart-define.
    final api = CountingDemo();
    await tester.pumpWidget(MaterialApp(
      theme: cargoxTheme(), home: CustomerHome(api: api),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Check online pilot'), findsOneWidget);
    expect(api.calls, 0);
    expect(tester.takeException(), isNull);
  });
}
