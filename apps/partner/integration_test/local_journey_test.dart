import 'package:cargox_partner/main.dart';
import 'package:cargox_demo/cargox_demo.dart';
import 'package:cargox_ui/cargox_ui.dart';
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
  testWidgets('Android Partner accepts and starts only with server OTP',
      (tester) async {
    final api = LocalDemoApi(
        baseUrl: const String.fromEnvironment('CARGOX_DEMO_API',
            defaultValue: 'http://127.0.0.1:4174'));
    final ride = await api.post('/api/rides', {
      'service': 'car',
      'pickup': 'Android fixture home',
      'drop': 'Android fixture office',
      'distanceKm': 8
    });
    await tester.pumpWidget(
        MaterialApp(theme: cargoxTheme(), home: PartnerHome(api: api)));
    await tester.pumpAndSettle();
    await tap(tester, 'Accept demo offer');
    expect(find.text('ASSIGNED'), findsOneWidget);
    final code = await api.get('/api/demo/customer-code?rideId=${ride['id']}');
    await tester.enterText(find.byType(TextField), code['code'] as String);
    await tap(tester, 'Verify & start');
    expect(find.text('IN_PROGRESS'), findsOneWidget);
    await tap(tester, 'Complete demo trip');
    expect(find.text('COMPLETED'), findsOneWidget);
  });
}
