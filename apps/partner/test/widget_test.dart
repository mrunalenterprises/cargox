import 'package:cargox_partner/main.dart';
import 'package:cargox_demo/cargox_demo.dart';
import 'package:cargox_ui/cargox_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeApi implements DemoApi {
  String state = 'REQUESTED';
  bool reject = false;
  bool offline = false;
  int requests = 0;
  Map<String, dynamic> get ride => {
        'id': 'test-ride',
        'service': 'auto',
        'pickup': 'Home',
        'drop': 'Office',
        'state': state,
        'quote': {'farePaise': 13600}
      };
  @override
  Future<dynamic> get(String path) async {
    if (offline) {
      throw DemoFailure(
          demoConnectionMessage(Uri.parse('http://127.0.0.1:4174')));
    }
    return path.startsWith('/api/offers') ? [ride] : [];
  }
  @override
  Future<dynamic> post(String path, Map<String, Object?> body) async {
    requests++;
    if (reject) throw const DemoFailure('Partner no longer eligible');
    if (path.endsWith('/start') && body['code'] != '1234')
      throw const DemoFailure('Trip code incorrect');
    state = path.endsWith('/accept')
        ? 'ASSIGNED'
        : path.endsWith('/start')
            ? 'IN_PROGRESS'
            : 'COMPLETED';
    return ride;
  }
}

Widget app(Widget page) => MaterialApp(theme: cargoxTheme(), home: page);
Future<void> tapText(WidgetTester tester, String text) async {
  await tester.scrollUntilVisible(find.text(text), 300,
      scrollable: find.byType(Scrollable).first);
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.text(text));
  await tester.pumpAndSettle();
  await tester.tap(find.text(text));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
      'accept, invalid OTP, valid start and completion follow server states',
      (tester) async {
    final api = FakeApi();
    await tester.pumpWidget(app(PartnerHome(api: api)));
    await tester.pumpAndSettle();
    await tapText(tester, 'Accept demo offer');
    expect(find.text('ASSIGNED'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '0000');
    await tapText(tester, 'Verify & start');
    expect(find.text('Trip code incorrect'), findsWidgets);
    expect(find.text('ASSIGNED'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '1234');
    await tapText(tester, 'Verify & start');
    expect(find.text('IN_PROGRESS'), findsOneWidget);
    await tapText(tester, 'Complete demo trip');
    expect(find.text('COMPLETED'), findsOneWidget);
  });
  testWidgets('server rejection never becomes accepted trip', (tester) async {
    final api = FakeApi()..reject = true;
    await tester.pumpWidget(app(PartnerHome(api: api)));
    await tester.pumpAndSettle();
    await tapText(tester, 'Accept demo offer');
    expect(find.text('Partner no longer eligible'), findsWidgets);
    expect(find.text('Partner journey'), findsNothing);
  });
  testWidgets('online selfie stays launch-gated', (tester) async {
    await tester.pumpWidget(app(PartnerHome(api: FakeApi())));
    await tester.pumpAndSettle();
    await tapText(tester, 'Go-online selfie');
    expect(find.text('Coming soon'), findsOneWidget);
    expect(find.text('Fresh selfie & anti-replay'), findsOneWidget);
  });
  testWidgets('OTP accepts digits only and clears when the app is hidden',
      (tester) async {
    final api = FakeApi();
    await tester.pumpWidget(app(PartnerTrip(
        api: api,
        partner: 'demo-auto-01',
        initialRide: {...api.ride, 'state': 'ASSIGNED'})));
    await tester.enterText(find.byType(TextField), '12a34');
    await tester.pump();
    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.controller!.text, '1234');

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    expect(field.controller!.text, isEmpty);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(field.controller!.text, isEmpty);
  });
  testWidgets('offline mobile preview shows one clear status and allows navigation',
      (tester) async {
    final api = FakeApi()..offline = true;
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(app(PartnerHome(api: api)));
    await tester.pumpAndSettle();

    expect(find.text('Explore offline'), findsOneWidget);
    expect(
        find.text('No eligible offers. Create an Auto or Car request in the Customer app.'),
        findsNothing);
    expect(tester.takeException(), isNull);

    await tapText(tester, 'Scheduled workload');
    expect(find.text('Scheduled workload'), findsWidgets);
  });

}
