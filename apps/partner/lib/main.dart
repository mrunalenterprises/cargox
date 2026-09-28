import 'package:flutter/material.dart';
import 'package:cargox_ui/cargox_ui.dart';
import 'package:cargox_demo/cargox_demo.dart';

void main() => runApp(PartnerApp(api: LocalDemoApi()));

class PartnerApp extends StatelessWidget {
  const PartnerApp({super.key, required this.api});
  final DemoApi api;
  @override
  Widget build(BuildContext context) => MaterialApp(
      title: 'CargoX Partner · Local Demo',
      theme: cargoxTheme(),
      debugShowCheckedModeBanner: false,
      home: PartnerEntry(api: api));
}

class PartnerEntry extends StatelessWidget {
  const PartnerEntry({super.key, required this.api});
  final DemoApi api;
  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: 'CargoX Partner', children: [
        const VehicleArt(kind: 'auto'),
        const Text('A better shift starts here.',
            style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900)),
        const DemoNotice(
            text:
                'Demo sign-in • SMS OTP and live registration are not connected. Choose a fictional driver fixture to test rides.'),
        FilledButton(
            onPressed: () => replaceCargoX(context, PartnerHome(api: api)),
            child: const Text('Enter partner demo')),
        for (final role in [
          'Individual Driver / Rider',
          'Vehicle Owner',
          'Fleet Owner',
          'Company / Agency'
        ])
          Card(
              child: ListTile(
                  title: Text(role),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => openCargoX(
                      context,
                      GatePage(
                          title: role,
                          reason:
                              'Registration preview only. No identity or documents are uploaded.',
                          items: const [
                            'Identity & minimal registration',
                            'Licence, police verification & permits',
                            'Vehicle & insurance documents',
                            'Staff review',
                            'Admin final approval'
                          ])))),
      ]);
}

class PartnerHome extends StatefulWidget {
  const PartnerHome({super.key, required this.api});
  final DemoApi api;
  @override
  State<PartnerHome> createState() => _PartnerHomeState();
}

class _PartnerHomeState extends State<PartnerHome> {
  String partner = 'demo-auto-01';
  List<Map<String, dynamic>> offers = [], rides = [];
  bool busy = false;
  String? error;
  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final results = await Future.wait([
        widget.api
            .get('/api/offers?partnerId=${Uri.encodeQueryComponent(partner)}'),
        widget.api.get('/api/rides'),
      ]);
      if (mounted)
        setState(() {
          offers = (results[0] as List)
              .map((r) => Map<String, dynamic>.from(r))
              .toList();
          rides = (results[1] as List)
              .map((r) => Map<String, dynamic>.from(r))
              .where((r) => r['partnerId'] == partner)
              .toList();
        });
    } catch (e) {
      if (mounted) {
        setState(() => error = '$e');
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> accept(Map<String, dynamic> offer) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    Map<String, dynamic>? accepted;
    try {
      accepted = Map<String, dynamic>.from(await widget.api
          .post('/api/rides/${offer['id']}/accept', {'partnerId': partner}));
    } catch (e) {
      if (mounted) {
        setState(() => error = '$e');
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
    if (!mounted || accepted == null) return;
    await openCargoX(context,
        PartnerTrip(api: widget.api, partner: partner, initialRide: accepted));
    if (mounted) await refresh();
  }

  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: 'CargoX Partner', children: [
        const Text('Drive your day.',
            style: TextStyle(
                fontSize: 34,
                fontWeight: FontWeight.w900,
                color: CargoXColors.ink)),
        const VehicleArt(kind: 'auto'),
        const DemoNotice(),
        DropdownButtonFormField<String>(
            initialValue: partner,
            decoration: const InputDecoration(labelText: 'Demo Partner'),
            items: const [
              DropdownMenuItem(
                  value: 'demo-auto-01', child: Text('Demo Auto/Car')),
              DropdownMenuItem(
                  value: 'demo-pink-01', child: Text('Demo Pink · Women Only'))
            ],
            onChanged: busy
                ? null
                : (v) {
                    setState(() {
                      partner = v!;
                      offers = [];
                      rides = [];
                    });
                    refresh();
                  }),
        if (error != null) DemoNotice(text: error!),
        OutlinedButton.icon(
            onPressed: busy ? null : refresh,
            icon: const Icon(Icons.refresh),
            label: Text(busy ? 'Loading…' : 'Refresh eligible offers')),
        Text('Ride offers (${offers.length})',
            style: const TextStyle(fontSize: 23, fontWeight: FontWeight.bold)),
        if (!busy && offers.isEmpty)
          const Text(
              'No eligible offers. Create an Auto or Car request in the Customer app.'),
        for (final ride in offers)
          Card(
              child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                            '${ride['service'].toString().toUpperCase()} · ${rupees(ride['quote']['farePaise'] as num)}',
                            style: const TextStyle(
                                fontSize: 20, fontWeight: FontWeight.bold)),
                        Text('${ride['pickup']} → ${ride['drop']}'),
                        if (ride['scheduledAt'] != null)
                          Text(
                              'Scheduled: ${ride['scheduledAt']} • Asia/Kolkata'),
                        if (ride['pinkOnly'] == true)
                          const Text('Pink Rider ONLY',
                              style: TextStyle(color: CargoXColors.pink)),
                        const SizedBox(height: 12),
                        FilledButton(
                            onPressed: busy ? null : () => accept(ride),
                            child: const Text('Accept demo offer')),
                      ]))),
        for (final ride in rides.where((r) => r['state'] != 'COMPLETED'))
          Card(
              child: ListTile(
                  title: Text('${ride['pickup']} → ${ride['drop']}'),
                  subtitle: Text('${ride['state']}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () async {
                    await openCargoX(
                        context,
                        PartnerTrip(
                            api: widget.api,
                            partner: partner,
                            initialRide: ride));
                    if (mounted) refresh();
                  })),
        _link(
            context,
            'Scheduled workload',
            Icons.calendar_month,
            PartnerRecords(
                title: 'Scheduled workload',
                rides: rides.where((r) => r['mode'] != 'now').toList())),
        _link(context, 'Trip history & earnings', Icons.account_balance_wallet,
            PartnerRecords(title: 'Trip history & earnings', rides: rides)),
        _link(
            context,
            'Registration & review',
            Icons.fact_check,
            const GatePage(
                title: 'Registration & review',
                reason:
                    'Only seeded fixtures are approved in this demo. Real onboarding remains disabled.',
                items: [
                  'Documents & permits',
                  'Staff review',
                  'Admin final approval',
                  'Expiry rechecks'
                ])),
        _link(
            context,
            'Vehicle & service preferences',
            Icons.directions_car,
            const GatePage(
                title: 'Vehicle & service preferences',
                reason:
                    'Only fictional Auto/Car fixtures are configured. No live vehicle or fleet edits.',
                items: [
                  'Vehicle owner & fleet',
                  'City eligibility',
                  'Auto / Mini / Sedan / SUV'
                ])),
        _link(
            context,
            'Pink Rider opt-in',
            Icons.female,
            const GatePage(
                title: 'Pink Rider opt-in',
                reason:
                    'Live verified enrollment is not connected. The seeded Pink fixture uses Women Only. No preference can bypass server eligibility.',
                items: [
                  'Consented verification',
                  'Women Only',
                  'Women + Men where lawful'
                ])),
        _link(
            context,
            'Price settings',
            Icons.price_change,
            const GatePage(
                title: 'Price settings',
                reason:
                    'Self-rate changes are disabled until jurisdiction and Admin pricing rules are approved.',
                items: [
                  'Standard rate',
                  'Self-rate legal gate',
                  'Weekly change policy'
                ])),
        _link(
            context,
            'Go-online selfie',
            Icons.face,
            const GatePage(
                title: 'Go-online selfie',
                reason:
                    'Live go-online and camera access are disabled. Fixtures are pre-seeded online for local tests.',
                items: [
                  'Consented enrollment photo',
                  'Fresh selfie & anti-replay',
                  'Uncertain-match manual review'
                ])),
        _link(
            context,
            'Partner SOS',
            Icons.sos,
            const GatePage(
                title: 'Partner SOS',
                reason:
                    'This demo does not contact emergency services or a staffed response team. Use your phone to contact local emergency services if needed.')),
      ]);
  Widget _link(
          BuildContext context, String title, IconData icon, Widget page) =>
      Card(
          child: ListTile(
              leading: Icon(icon, color: CargoXColors.deep),
              title: Text(title),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => openCargoX(context, page)));
}

class PartnerTrip extends StatefulWidget {
  const PartnerTrip(
      {super.key,
      required this.api,
      required this.partner,
      required this.initialRide});
  final DemoApi api;
  final String partner;
  final Map<String, dynamic> initialRide;
  @override
  State<PartnerTrip> createState() => _PartnerTripState();
}

class _PartnerTripState extends State<PartnerTrip> {
  late Map<String, dynamic> ride = widget.initialRide;
  final code = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  Future<void> action(String operation) async {
    if (busy) return;
    if (operation == 'start' && !RegExp(r'^\d{4}$').hasMatch(code.text)) {
      setState(() => error = 'Enter the customer’s 4-digit code.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final next = await widget.api.post(
          '/api/rides/${ride['id']}/$operation', {
        'partnerId': widget.partner,
        if (operation == 'start') 'code': code.text
      });
      if (mounted)
        setState(() {
          ride = Map<String, dynamic>.from(next);
          code.clear();
        });
    } catch (e) {
      if (mounted) {
        setState(() => error = '$e');
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: 'Partner journey', children: [
        VehicleArt(kind: ride['service'] as String),
        Text('${ride['pickup']} → ${ride['drop']}',
            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
        Semantics(liveRegion: true, child: Text('${ride['state']}')),
        SelectableText('Ride: ${ride['id']}'),
        OutlinedButton(
            onPressed: () => openCargoX(
                context,
                const GatePage(
                    title: 'Navigation',
                    reason:
                        'Live maps and GPS are not connected. These are fictional stops.')),
            child: const Text('Route navigation')),
        if (ride['state'] == 'ASSIGNED') ...[
          const DemoNotice(
              text:
                  'Ask the Customer demo screen for its start code. The server rechecks eligibility, expiry and attempt limits.'),
          TextField(
              controller: code,
              enabled: !busy,
              maxLength: 4,
              keyboardType: TextInputType.number,
              decoration:
                  const InputDecoration(labelText: '4-digit customer code')),
          FilledButton(
              onPressed: busy ? null : () => action('start'),
              child: const Text('Verify & start')),
        ],
        if (ride['state'] == 'IN_PROGRESS')
          FilledButton(
              onPressed: busy ? null : () => action('finish'),
              child: const Text('Complete demo trip')),
        if (ride['state'] == 'COMPLETED')
          const DemoNotice(
              text: 'Completed • No payout or settlement is created.'),
        if (error != null) DemoNotice(text: error!),
      ]);
}

class PartnerRecords extends StatelessWidget {
  const PartnerRecords({super.key, required this.title, required this.rides});
  final String title;
  final List<Map<String, dynamic>> rides;
  @override
  Widget build(BuildContext context) => CargoXPage(title: title, children: [
        const DemoNotice(
            text:
                'Snapshot of this fictional partner’s rides. No live payouts, bank details or guaranteed future assignments.'),
        if (rides.isEmpty) const Text('No journeys in this view yet.'),
        for (final r in rides)
          Card(
              child: ListTile(
                  title: Text('${r['pickup']} → ${r['drop']}'),
                  subtitle: Text(
                      '${r['scheduledAt'] ?? 'Immediate'} · ${r['state']}\n${rupees(r['quote']['farePaise'] as num)} gross illustrative fare · Unpaid'))),
      ]);
}
