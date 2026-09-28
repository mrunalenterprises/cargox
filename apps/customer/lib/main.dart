import 'package:flutter/material.dart';
import 'package:cargox_ui/cargox_ui.dart';
import 'package:cargox_demo/cargox_demo.dart';
import 'booking.dart';
import 'plans.dart';
import 'trips.dart';

void main() => runApp(CustomerApp(api: LocalDemoApi()));

class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key, required this.api});
  final DemoApi api;
  @override
  Widget build(BuildContext context) => MaterialApp(
      title: '${PipPipBrand.customerApp} · ${PipPipBrand.localDemo}',
      theme: cargoxTheme(),
      debugShowCheckedModeBanner: false,
      home: WelcomePage(api: api));
}

class WelcomePage extends StatefulWidget {
  const WelcomePage({super.key, required this.api});
  final DemoApi api;
  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<WelcomePage> {
  String language = 'en';
  int step = 0;
  static const copy = {
    'en': ['Move beautifully.', 'Continue in English'],
    'hi': ['हर सफ़र, खूबसूरत।', 'हिन्दी में आगे बढ़ें'],
    'mr': ['प्रत्येक प्रवास सुंदर.', 'मराठीत पुढे चला'],
  };
  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: PipPipBrand.name, children: [
        const VehicleArt(kind: 'car'),
        Text(copy[language]![0],
            style: const TextStyle(
                fontSize: 36,
                fontWeight: FontWeight.w900,
                color: CargoXColors.ink)),
        const DemoNotice(),
        if (step == 0) ...[
          const Text(
              'Choose your language • Detailed demo screens currently use English fallback.'),
          DropdownButtonFormField<String>(
              initialValue: language,
              items: const [
                DropdownMenuItem(value: 'en', child: Text('English')),
                DropdownMenuItem(value: 'hi', child: Text('हिन्दी')),
                DropdownMenuItem(value: 'mr', child: Text('मराठी'))
              ],
              onChanged: (v) => setState(() => language = v!)),
          FilledButton(
              onPressed: () => setState(() => step = 1),
              child: Text(copy[language]![1])),
        ] else if (step == 1) ...[
          const Text('Demo sign-in',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
          const Text(
              'SMS OTP authentication is not connected. Continue as a fictional customer; no phone number is collected.'),
          FilledButton(
              onPressed: () => setState(() => step = 2),
              child: const Text('Continue as demo customer')),
        ] else if (step == 2) ...[
          const Text('Your location, your choice',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
          const Text(
              'The local demo uses manually entered stops. It does not request GPS, contacts or notification access.'),
          FilledButton(
              onPressed: () => setState(() => step = 3),
              child: const Text('Use manual pickup')),
        ] else ...[
          const Text('Choose your city',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
          const ListTile(
              leading: Icon(Icons.location_city),
              title: Text('Chhatrapati Sambhajinagar'),
              subtitle: Text('Auto & Car • fictional local pilot')),
          FilledButton(
              onPressed: () =>
                  replaceCargoX(context, CustomerHome(api: widget.api)),
              child: const Text('Explore PIP PIP')),
        ],
      ]);
}

class CustomerHome extends StatelessWidget {
  const CustomerHome({super.key, required this.api});
  final DemoApi api;
  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: PipPipBrand.name, actions: [
        IconButton(
            tooltip: 'Ride history',
            onPressed: () => openCargoX(context, RideHistory(api: api)),
            icon: const Icon(Icons.history)),
      ], children: [
        Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFFF5FFF9), CargoXColors.primary])),
            child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('YOUR CITY. YOUR WAY.',
                      style: TextStyle(
                          letterSpacing: 2,
                          fontWeight: FontWeight.w700,
                          color: CargoXColors.ink)),
                  SizedBox(height: 12),
                  Text('A little more joy\nin every journey.',
                      style: TextStyle(
                          fontSize: 32,
                          height: 1.1,
                          fontWeight: FontWeight.w900,
                          color: CargoXColors.ink)),
                  VehicleArt(kind: 'car'),
                  Text('Chhatrapati Sambhajinagar · Local demo'),
                ])),
        const Text('Where to next?',
            style: TextStyle(fontSize: 25, fontWeight: FontWeight.w800)),
        LayoutBuilder(builder: (context, constraints) {
          final oneColumn = constraints.maxWidth < 340 ||
              MediaQuery.textScalerOf(context).scale(16) > 22;
          final width = oneColumn
              ? constraints.maxWidth
              : (constraints.maxWidth - 14) / 2;
          return Wrap(spacing: 14, runSpacing: 14, children: [
            for (final item in [
              ('bike', 'Bike'),
              ('auto', 'Auto'),
              ('car', 'Car'),
              ('outstation', 'Outstation'),
              ('shared', 'Shared Car')
            ])
              SizedBox(
                  width: width,
                  child: CargoXServiceCard(
                      label: item.$2,
                      vehicle: item.$1,
                      subtitle: ['auto', 'car'].contains(item.$1)
                          ? 'Local demo · View quote'
                          : 'Coming soon · View details',
                      icon: Icons.directions_car,
                      onTap: () {
                        if (['auto', 'car'].contains(item.$1)) {
                          openCargoX(
                              context, BookingPage(api: api, service: item.$1));
                        } else {
                          openCargoX(context, ServicePreview(service: item.$1));
                        }
                      })),
          ]);
        }),
        CargoXServiceCard(
            label: 'Pink Rider',
            subtitle: 'Your preference. No silent substitution.',
            icon: Icons.female,
            pink: true,
            onTap: () => openCargoX(context, PinkIntro(api: api))),
        _shortcut(context, 'Schedule Ride', 'A time that works for you',
            Icons.schedule, BookingPage(api: api, scheduled: true)),
        _shortcut(
            context,
            'Daily Services',
            'Office, college & fixed-route commutes',
            Icons.repeat,
            DailyServices(api: api)),
        _shortcut(
            context,
            'Monthly Packs',
            'Fixed stops, separate journey legs',
            Icons.calendar_month,
            PlanPage(api: api, monthly: true)),
        _shortcut(
            context,
            'My Monthly Packs',
            'Unpaid drafts & journey calendar',
            Icons.event_note,
            PackLibrary(api: api)),
        _shortcut(
            context,
            'Guardian dashboard',
            'Child transport remains launch-gated',
            Icons.family_restroom,
            const GatePage(
                title: 'Guardian dashboard',
                reason:
                    'Child transport is disabled pending legal, licensing and operational approval.',
                items: [
                  'Guardian consent',
                  'Authorized pickup & drop adults',
                  'Restricted route access',
                  'Absent child/adult exception workflow'
                ])),
        _shortcut(context, 'Help & safety', 'Understand the local demo limits',
            Icons.help_outline, const SafetyPage()),
        const DemoNotice(),
      ]);
  Widget _shortcut(BuildContext context, String title, String subtitle,
          IconData icon, Widget page) =>
      Card(
          child: ListTile(
              contentPadding: const EdgeInsets.all(14),
              leading: Icon(icon, color: CargoXColors.deep),
              title: Text(title,
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text(subtitle),
              trailing: const Icon(Icons.arrow_forward),
              onTap: () => openCargoX(context, page)));
}

class ServicePreview extends StatelessWidget {
  const ServicePreview({super.key, required this.service});
  final String service;
  @override
  Widget build(BuildContext context) => service == 'outstation'
      ? CargoXPage(title: 'Outstation', children: [
          const VehicleArt(kind: 'car'),
          const DemoNotice(
              text:
                  'Coming soon. Intercity route and commercial permit approvals are not configured.'),
          for (final mode in ['One Way', 'Round Trip', 'Daily Intercity Car'])
            Card(
                child: ListTile(
                    title: Text(mode),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => openCargoX(
                        context,
                        GatePage(
                            title: mode,
                            reason:
                                'Outstation booking is disabled. No quote or payment is generated.',
                            items: const [
                              'Two-city route & optional return',
                              'Included kilometres & empty-return rules',
                              'Waiting, tolls, parking & taxes',
                              'Driver allowances & daily pack total'
                            ])))),
        ])
      : GatePage(
          title: service == 'bike' ? 'Bike' : 'Shared Car',
          reason: service == 'bike'
              ? 'Bike taxi service is disabled until city, vehicle and legal eligibility are approved.'
              : 'Shared Car is disabled until the regulated pooling model, route rules and passenger eligibility are approved.',
          items: service == 'bike'
              ? const ['City permits', 'Vehicle & partner approval']
              : const [
                  'Per-seat availability',
                  'Explicit passenger & guest-party checks',
                  'Women-only group eligibility',
                  'Licensed pooling model'
                ]);
}

class PinkIntro extends StatelessWidget {
  const PinkIntro({super.key, required this.api});
  final DemoApi api;
  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: 'Pink Rider', children: [
        const VehicleArt(kind: 'car', pink: true),
        const Text('Your preference travels with you.',
            style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: CargoXColors.pink)),
        const Text(
            'Pink Rider is a preference across eligible services. Only verified eligible, opted-in women partners can match. It does not guarantee safety.'),
        const DemoNotice(
            text:
                'Pink Rider Only never silently switches to another partner. If none is available, the request remains unmatched. Live identity and refund workflows are not connected.'),
        FilledButton(
            onPressed: () =>
                openCargoX(context, BookingPage(api: api, pink: true)),
            child: const Text('Explore Pink Rider demo')),
      ]);
}
