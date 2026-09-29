import 'package:flutter/material.dart';
import 'package:cargox_staging/cargox_staging.dart';

/// A real HTTPS, read-only staging connection, deliberately isolated from
/// fictional local rides. The pilot catalog cannot book or enable a service.
class PipPipOnlinePage extends StatefulWidget {
  const PipPipOnlinePage({super.key, this.catalog, this.forPartner = false});
  final StagingCatalogReader? catalog;
  final bool forPartner;
  @override
  State<PipPipOnlinePage> createState() => _PipPipOnlinePageState();
}

class _PipPipOnlinePageState extends State<PipPipOnlinePage> {
  bool loading = true;
  bool connected = false;
  List<PipPipStagingService> services = const [];
  int sequence = 0;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    final request = ++sequence;
    setState(() {
      loading = true;
      connected = false;
      services = const [];
    });
    try {
      // A missing build-time key is a visible error, never a demo fallback.
      final client = widget.catalog ?? PipPipStagingCatalog();
      final data = await client.availableServices();
      if (!mounted || request != sequence) return;
      setState(() {
        connected = true;
        services = data;
        loading = false;
      });
    } catch (_) {
      if (!mounted || request != sequence) return;
      setState(() {
        connected = false;
        services = const [];
        loading = false;
      });
    }
  }

  @override
  void dispose() {
    sequence++;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const ink = Color(0xFF163E32);
    const mint = Color(0xFF59BAA1);
    return Scaffold(
      appBar: AppBar(title: Text(
        widget.forPartner ? 'PIP PIP Partner Online' : 'PIP PIP Online',
      )),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFF1FFF9), Color(0xFFB7E6D7)],
                    ),
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('PIP PIP · ONLINE PILOT',
                        style: TextStyle(
                          color: ink, letterSpacing: 2,
                          fontWeight: FontWeight.w700, fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        widget.forPartner
                            ? 'Your next shift starts here.'
                            : 'Your city. Your journey.',
                        style: const TextStyle(
                          color: ink, fontSize: 29,
                          height: 1.13, fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Live connection test to the isolated Mumbai staging project.',
                        style: TextStyle(color: ink, fontSize: 14),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Semantics(
                  liveRegion: true,
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (loading) ...[
                            const Text('Connecting to online pilot…',
                              style: TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold,
                              )),
                            const SizedBox(height: 12),
                            const LinearProgressIndicator(color: mint),
                          ] else if (connected) ...[
                            const Row(
                              children: [
                                Icon(Icons.cloud_done_outlined, color: Color(0xFF08734B)),
                                SizedBox(width: 10),
                                Expanded(
                                  child: Text('Staging connection successful',
                                    style: TextStyle(
                                      fontSize: 17, fontWeight: FontWeight.bold,
                                    )),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            if (services.isEmpty)
                              const Text(
                                'No approved services have been enabled for this city. '
                                'Pilot registration, service approvals and booking remain pending.',
                              )
                            else ...[
                              const Text('Approved pilot service catalog:'),
                              for (final service in services)
                                ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  leading: const Icon(Icons.directions_car_outlined),
                                  title: Text(service.service.toUpperCase()),
                                  subtitle: Text(
                                    '${service.city} · ${service.timezone}',
                                  ),
                                ),
                            ],
                          ] else ...[
                            const Text('Online pilot unavailable',
                              style: TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold,
                              )),
                            const SizedBox(height: 8),
                            const Text(
                              'The staging catalog cannot be reached or has not '
                              'been configured in this build. You can still browse '
                              'the offline app preview.',
                            ),
                          ],
                          const SizedBox(height: 16),
                          OutlinedButton.icon(
                            onPressed: loading ? null : refresh,
                            icon: const Icon(Icons.refresh),
                            label: const Text('Refresh online status'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'TEST BUILD · Online catalog only. No live ride request, '
                  'driver activation, location sharing, SMS or payments.',
                  style: TextStyle(color: ink, height: 1.4),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
