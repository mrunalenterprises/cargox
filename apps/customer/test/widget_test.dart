import 'package:cargox_customer/main.dart';
import 'package:cargox_customer/booking.dart';
import 'package:cargox_customer/plans.dart';
import 'package:cargox_customer/trips.dart';
import 'package:cargox_demo/cargox_demo.dart';
import 'package:cargox_ui/cargox_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeApi implements DemoApi {
  final calls = <(String, Map<String, Object?>)>[];
  bool fail = false;
  String state = 'ASSIGNED';
  Map<String, dynamic> get ride => {
        'id': 'test-ride',
        'state': state,
        'service': 'auto',
        'pickup': 'Home',
        'drop': 'Office',
        'pinkOnly': true,
        'partnerId': 'demo-pink-01',
        'quote': {'farePaise': 13600}
      };
  @override
  Future<dynamic> get(String path) async {
    if (fail) throw const DemoFailure('Offline for test');
    if (path.startsWith('/api/demo/customer-code')) return {'code': '0421'};
    if (path == '/api/rides') return [ride];
    return [];
  }

  @override
  Future<dynamic> post(String path, Map<String, Object?> body) async {
    calls.add((path, body));
    if (fail) throw const DemoFailure('Service gated by server');
    if (path == '/api/quotes')
      return {
        'farePaise': 13600,
        'platformCommissionPaise': 3400,
        'distanceKm': 8,
        'pricingVersion': 'DEMO-1',
        'note': 'Illustrative'
      };
    if (path == '/api/rides') return {...ride, 'state': 'REQUESTED'};
    return {
      'pickup': 'Home',
      'drop': 'Office',
      'totalPaise': 27200,
      'legs': [
        {'date': '2026-10-01', 'time': '09:00', 'leg': 'outbound'},
        {'date': '2026-10-01', 'time': '18:00', 'leg': 'return'}
      ]
    };
  }
}

Widget app(Widget page, {double scale = 1}) => MaterialApp(
    theme: cargoxTheme(),
    home: MediaQuery(
        data: MediaQueryData(
            disableAnimations: true, textScaler: TextScaler.linear(scale)),
        child: page));
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
  testWidgets('welcome walks language, demo login, permissions and city',
      (tester) async {
    await tester.pumpWidget(CustomerApp(api: FakeApi()));
    for (final text in [
      'Continue in English',
      'Continue as demo customer',
      'Use manual pickup',
      'Explore PIP PIP'
    ]) {
      await tapText(tester, text);
    }
    expect(find.text('Where to next?'), findsOneWidget);
  });
  testWidgets('all home entries navigate with legal gates', (tester) async {
    final cases = {
      'Bike': 'Coming soon',
      'Auto': 'Your route',
      'Car': 'Your route',
      'Outstation': 'One Way',
      'Shared Car': 'Coming soon',
      'Pink Rider': 'Your preference travels with you.',
      'Schedule Ride': 'Schedule Ride',
      'Daily Services': 'Make your everyday easier.',
      'Monthly Packs':
          'Fixed pickup & drop • Unpaid local preview. Each outbound and return is a separate journey leg.',
      'My Monthly Packs': 'No unpaid drafts yet. Create a Monthly Pack preview.'
    };
    for (final item in cases.entries) {
      await tester.pumpWidget(app(CustomerHome(api: FakeApi())));
      await tester.pumpAndSettle();
      await tapText(tester, item.key);
      expect(find.text(item.value), findsWidgets, reason: item.key);
      await tester.pumpWidget(const SizedBox());
    }
  });
  testWidgets('schedule reaches quote API and server error is surfaced',
      (tester) async {
    final api = FakeApi()..fail = true;
    await tester.pumpWidget(
        app(BookingPage(api: api, service: 'car', scheduled: true)));
    await tapText(tester, 'View fare quote');
    expect(api.calls.single.$2['mode'], 'schedule');
    expect(api.calls.single.$2['service'], 'car');
    expect(api.calls.single.$2['scheduledAt'],
        matches(RegExp(r'^\d{4}-\d{2}-\d{2}T09:00$')));
    expect(find.text('Service gated by server'), findsOneWidget);
  });
  testWidgets('Pink eligibility and explicit consent gate a single request',
      (tester) async {
    final api = FakeApi();
    await tester.pumpWidget(app(QuotePage(
        api: api,
        payload: const {
          'service': 'auto',
          'pickup': 'Home',
          'drop': 'Office',
          'distanceKm': 8,
          'mode': 'now'
        },
        quote: const {
          'farePaise': 13600,
          'platformCommissionPaise': 3400,
          'distanceKm': 8,
          'pricingVersion': 'DEMO-1',
          'note': 'Illustrative'
        },
        pink: true)));
    await tester.scrollUntilVisible(
        find.text('Continue to demo confirmation'), 300);
    expect(
        tester
            .widget<FilledButton>(find.widgetWithText(
                FilledButton, 'Continue to demo confirmation'))
            .onPressed,
        isNull);
    await tapText(tester, 'Demo eligible women passenger party');
    await tapText(tester, 'Continue to demo confirmation');
    expect(
        tester
            .widget<FilledButton>(
                find.widgetWithText(FilledButton, 'Request demo ride'))
            .onPressed,
        isNull);
    await tapText(tester,
        'I understand this creates only a fictional local ride request.');
    await tapText(tester, 'Request demo ride');
    expect(api.calls.where((c) => c.$1 == '/api/rides').length, 1);
    expect(api.calls.last.$2['pinkOnly'], true);
    expect(api.calls.last.$2['allPassengersWomenVerified'], true);
    expect(find.text('REQUESTED'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull);
  });
  testWidgets('refresh displays server OTP then clears it on completion',
      (tester) async {
    final api = FakeApi();
    await tester.pumpWidget(app(TripPage(api: api, initialRide: api.ride)));
    await tapText(tester, 'Refresh trip status');
    expect(find.text('0421'), findsOneWidget);
    api.state = 'COMPLETED';
    await tapText(tester, 'Refresh trip status');
    expect(find.text('Demo receipt'), findsOneWidget);
    expect(find.text('0421'), findsNothing);
  });
  testWidgets('plan review counts distinct legs and saves unpaid Pink draft',
      (tester) async {
    final api = FakeApi();
    await tester.pumpWidget(app(PlanReview(
        api: api,
        plan: await api.post('/fake', {}),
        payload: const {'pinkOnly': true})));
    expect(find.textContaining('2 journey legs'), findsOneWidget);
    await tapText(tester, 'Save only an unpaid demo draft');
    await tapText(tester, 'Save unpaid draft');
    expect(api.calls.last.$1, '/api/plans/demo');
    expect(api.calls.last.$2['pinkOnly'], true);
    expect(find.text('Draft saved'), findsOneWidget);
  });
  testWidgets('narrow home supports 2x text and reduced motion',
      (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(app(CustomerHome(api: FakeApi()), scale: 2));
    await tester.pumpAndSettle();
    await tapText(tester, 'Shared Car');
    expect(find.text('Coming soon'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('trip code hides on background and requires explicit refresh',
      (tester) async {
    final api = FakeApi();
    await tester.pumpWidget(app(TripPage(api: api, initialRide: api.ride)));
    await tapText(tester, 'Refresh trip status');
    expect(find.text('0421'), findsOneWidget);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    expect(find.text('0421'), findsNothing);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(find.text('0421'), findsNothing,
        reason: 'Do not silently reveal the code on resume');

    await tapText(tester, 'Refresh trip status');
    expect(find.text('0421'), findsOneWidget);
  });
}
