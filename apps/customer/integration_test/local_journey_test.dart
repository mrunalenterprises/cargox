import 'package:cargox_customer/main.dart';
import 'package:cargox_demo/cargox_demo.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

Future<void> tap(WidgetTester tester, String text) async {
  await tester.scrollUntilVisible(find.text(text), 260,
      scrollable: find.byType(Scrollable).first);
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.text(text));
  await tester.pumpAndSettle();
  await tester.tap(find.text(text));
  await tester.pumpAndSettle();
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('Android Customer completes a real local HTTP journey',
      (tester) async {
    final api = LocalDemoApi(
        baseUrl: const String.fromEnvironment('CARGOX_DEMO_API',
            defaultValue: 'http://127.0.0.1:4174'));
    final before =
        (await api.get('/api/rides') as List).map((r) => r['id']).toSet();
    await tester.pumpWidget(CustomerApp(api: api));
    for (final text in [
      'Continue in English',
      'Continue as demo customer',
      'Use manual pickup',
      'Explore PIP PIP',
      'Auto',
      'View fare quote',
      'Continue to demo confirmation',
      'I understand this creates only a fictional local ride request.',
      'Request demo ride'
    ]) {
      await tap(tester, text);
    }
    expect(find.text('REQUESTED'), findsOneWidget);
    final rides = await api.get('/api/rides') as List;
    final ride = rides.singleWhere((r) => !before.contains(r['id']));
    await api
        .post('/api/rides/${ride['id']}/accept', {'partnerId': 'demo-auto-01'});
    await tap(tester, 'Refresh trip status');
    final code = await api.get('/api/demo/customer-code?rideId=${ride['id']}');
    expect(find.text(code['code'] as String), findsOneWidget);
    await api.post('/api/rides/${ride['id']}/start',
        {'partnerId': 'demo-auto-01', 'code': code['code']});
    await api
        .post('/api/rides/${ride['id']}/finish', {'partnerId': 'demo-auto-01'});
    await tap(tester, 'Refresh trip status');
    expect(find.text('Demo receipt'), findsOneWidget);
    expect(find.text('COMPLETED'), findsOneWidget);
  });
}
