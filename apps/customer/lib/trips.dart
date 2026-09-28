import 'package:flutter/material.dart';
import 'package:cargox_ui/cargox_ui.dart';
import 'package:cargox_demo/cargox_demo.dart';

class TripPage extends StatefulWidget {
  const TripPage({super.key, required this.api, required this.initialRide});
  final DemoApi api;
  final Map<String, dynamic> initialRide;
  @override
  State<TripPage> createState() => _TripPageState();
}

class _TripPageState extends State<TripPage> {
  late Map<String, dynamic> ride = widget.initialRide;
  bool busy = false;
  String? error, code;
  Future<void> refresh() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
      code = null;
    });
    try {
      final rides = await widget.api.get('/api/rides') as List;
      final next =
          rides.cast<Map>().where((r) => r['id'] == ride['id']).firstOrNull;
      if (next == null)
        throw const DemoFailure(
            'Ride no longer exists. The in-memory API may have restarted.');
      if (!mounted) return;
      setState(() => ride = Map<String, dynamic>.from(next));
      if (ride['state'] == 'ASSIGNED') {
        final result = await widget.api.get(
            '/api/demo/customer-code?rideId=${Uri.encodeQueryComponent(ride['id'] as String)}');
        if (mounted) setState(() => code = result['code'] as String);
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => CargoXPage(
          title: ride['state'] == 'COMPLETED' ? 'Demo receipt' : 'Your journey',
          children: [
            VehicleArt(
                kind: ride['service'] as String,
                pink: ride['pinkOnly'] == true),
            Semantics(
                liveRegion: true,
                child: Text('${ride['state']}',
                    style: const TextStyle(
                        fontSize: 28, fontWeight: FontWeight.bold))),
            Text('${ride['pickup']} → ${ride['drop']}',
                style: const TextStyle(fontSize: 22)),
            SelectableText('Reference: ${ride['id']}'),
            if (ride['scheduledAt'] != null)
              Text('Scheduled: ${ride['scheduledAt']} • Asia/Kolkata'),
            if (ride['pinkOnly'] == true)
              const DemoNotice(
                  text:
                      'Pink Rider Only preserved. If no eligible partner accepts, this stays unmatched. No automatic fallback.'),
            if (ride['state'] == 'REQUESTED')
              const Text(
                  'Awaiting acceptance in the Partner app. No availability or ETA is promised.'),
            if (ride['partnerId'] != null)
              Text('Fictional partner: ${ride['partnerId']}'),
            if (code != null) ...[
              const Text(
                  'Share this start code only with your assigned demo partner.'),
              SelectableText(code!,
                  style: const TextStyle(
                      fontSize: 42,
                      letterSpacing: 8,
                      fontWeight: FontWeight.bold)),
              const Text(
                  'Server validates expiry, attempts and partner assignment. This demo endpoint has no real authentication.'),
            ],
            if (ride['state'] == 'IN_PROGRESS')
              const DemoNotice(
                  text:
                      'Trip started by server-verified code. Live GPS, map tracking and ETA are not integrated.'),
            Text('Fare snapshot: ${rupees(ride['quote']['farePaise'] as num)}'),
            if (ride['state'] == 'COMPLETED')
              const DemoNotice(
                  text:
                      'Trip complete • Unpaid demo receipt. No payment or settlement took place.'),
            if (error != null) DemoNotice(text: error!),
            OutlinedButton.icon(
                onPressed: busy ? null : refresh,
                icon: const Icon(Icons.refresh),
                label: Text(busy ? 'Refreshing…' : 'Refresh trip status')),
            OutlinedButton(
                onPressed: () => openCargoX(
                    context,
                    const GatePage(
                        title: 'Share trip',
                        reason:
                            'Secure, consent-based expiring location links are not connected. No public link is created.',
                        items: ['Time-limited access', 'Revocable consent'])),
                child: const Text('Trip sharing')),
            OutlinedButton.icon(
                onPressed: () => openCargoX(context, const SafetyPage()),
                icon: const Icon(Icons.sos),
                label: const Text('Safety & SOS information')),
          ]);
}

class RideHistory extends StatefulWidget {
  const RideHistory({super.key, required this.api});
  final DemoApi api;
  @override
  State<RideHistory> createState() => _RideHistoryState();
}

class _RideHistoryState extends State<RideHistory> {
  late Future<dynamic> rides = widget.api.get('/api/rides');
  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: 'Ride history', children: [
        const DemoNotice(
            text:
                'Local fixture history • All demo rides are visible. No real customer identity or private account history.'),
        OutlinedButton(
            onPressed: () =>
                setState(() => rides = widget.api.get('/api/rides')),
            child: const Text('Refresh history')),
        FutureBuilder<dynamic>(
            future: rides,
            builder: (context, snapshot) {
              if (snapshot.hasError)
                return DemoNotice(text: '${snapshot.error}');
              if (!snapshot.hasData)
                return const Center(child: CircularProgressIndicator());
              final items = snapshot.data as List;
              if (items.isEmpty)
                return const Text('No rides yet. Start with Auto or Car.');
              return Column(
                  children: items.reversed
                      .map((r) => Card(
                          child: ListTile(
                              title: Text('${r['pickup']} → ${r['drop']}'),
                              subtitle: Text('${r['service']} · ${r['state']}'),
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () => openCargoX(
                                  context,
                                  TripPage(
                                      api: widget.api,
                                      initialRide:
                                          Map<String, dynamic>.from(r))))))
                      .toList());
            }),
      ]);
}

class SafetyPage extends StatelessWidget {
  const SafetyPage({super.key});
  @override
  Widget build(BuildContext context) =>
      const CargoXPage(title: 'Help & safety', children: [
        Icon(Icons.sos, size: 64, color: CargoXColors.pink),
        DemoNotice(
            text:
                'This demo cannot contact emergency services, dispatch help or send an incident report. No staffed response is connected.'),
        Text(
            'If you need urgent help, use your phone to contact local emergency services. Do not rely on this demo.'),
        Text(
            'Planned: customer and partner SOS, incident reporting, consent-based sharing and audited staff escalation. These remain disabled.'),
      ]);
}
