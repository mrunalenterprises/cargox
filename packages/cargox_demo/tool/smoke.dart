import 'package:cargox_demo/cargox_demo.dart';

// Run only against the isolated, fictional local fixture server.
Future<void> main(List<String> args) async {
  final api = LocalDemoApi(
      baseUrl: args.isEmpty ? 'http://127.0.0.1:4174' : args.single);
  void check(bool condition, String message) {
    if (!condition) throw StateError(message);
  }

  final health = await api.get('/api/health');
  check(
      health['mode'] == 'local-only-demo' &&
          health['readyForProduction'] == false,
      'Local demo required');
  for (final service in ['auto', 'car']) {
    final pink = service == 'car';
    final partner = pink ? 'demo-pink-01' : 'demo-auto-01';
    final payload = <String, Object?>{
      'service': service,
      'pickup': 'Smoke fixture home',
      'drop': 'Smoke fixture office',
      'distanceKm': 8,
      'mode': pink ? 'schedule' : 'now',
      'pinkOnly': pink,
      'allPassengersWomenVerified': pink,
      if (pink)
        'scheduledAt':
            '${civilDate(DateTime.now().add(const Duration(days: 1)))}T09:00'
    };
    final quote = await api.post('/api/quotes', payload);
    final ride = await api.post('/api/rides', payload);
    check(ride['quote']['farePaise'] == quote['farePaise'], 'Quote mismatch');
    final offers = await api.get('/api/offers?partnerId=$partner') as List;
    check(offers.any((r) => r['id'] == ride['id']), 'Eligible offer missing');
    if (pink) {
      final regular =
          await api.get('/api/offers?partnerId=demo-auto-01') as List;
      check(!regular.any((r) => r['id'] == ride['id']),
          'Pink preference leaked to regular partner');
    }
    final accepted = await api
        .post('/api/rides/${ride['id']}/accept', {'partnerId': partner});
    check(accepted['state'] == 'ASSIGNED', 'Not assigned');
    final code = await api.get('/api/demo/customer-code?rideId=${ride['id']}');
    final started = await api.post('/api/rides/${ride['id']}/start',
        {'partnerId': partner, 'code': code['code']});
    check(started['state'] == 'IN_PROGRESS', 'Start rejected');
    final complete = await api
        .post('/api/rides/${ride['id']}/finish', {'partnerId': partner});
    check(complete['state'] == 'COMPLETED', 'Completion rejected');
    final summary = await api.get('/api/admin');
    check(
        (summary['rides'] as List)
            .any((r) => r['id'] == ride['id'] && r['state'] == 'COMPLETED'),
        'Admin did not reflect completion');
    print(
        'PASS $service ${pink ? 'scheduled Pink' : 'immediate'}: quote -> offer -> accept -> OTP -> complete -> Admin');
  }
  final start = DateTime.now().add(const Duration(days: 1));
  final plan = await api.post('/api/plans/demo', {
    'service': 'car',
    'pickup': 'Smoke fixed home',
    'drop': 'Smoke fixed office',
    'distanceKm': 8,
    'startDate': civilDate(start),
    'endDate': civilDate(start.add(const Duration(days: 1))),
    'weekdays': [1, 2, 3, 4, 5, 6, 7],
    'pickupTime': '09:00',
    'returnTime': '18:00',
    'pinkOnly': true,
    'allPassengersWomenVerified': true
  });
  check(plan['state'] == 'DEMO_UNPAID' && (plan['legs'] as List).length == 4,
      'Unexpected plan state or legs');
  final plans = await api.get('/api/plans') as List;
  check(plans.any((p) => p['id'] == plan['id'] && p['pinkOnly'] == true),
      'Unpaid Pink draft missing');
  print(
      'PASS unpaid fixed-route Pink draft: 4 distinct legs, retained preference, listed calendar');
}
