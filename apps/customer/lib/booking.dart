import 'package:flutter/material.dart';
import 'package:cargox_ui/cargox_ui.dart';
import 'package:cargox_demo/cargox_demo.dart';
import 'trips.dart';

class BookingPage extends StatefulWidget {
  const BookingPage(
      {super.key,
      required this.api,
      this.service = 'auto',
      this.scheduled = false,
      this.pink = false});
  final DemoApi api;
  final String service;
  final bool scheduled, pink;
  @override
  State<BookingPage> createState() => _BookingPageState();
}

class _BookingPageState extends State<BookingPage> {
  final form = GlobalKey<FormState>();
  final pickup = TextEditingController(text: 'Home');
  final drop = TextEditingController(text: 'Office');
  final km = TextEditingController(text: '8');
  late String service = widget.service;
  late bool scheduled = widget.scheduled;
  DateTime day = DateTime.now().add(const Duration(days: 1));
  TimeOfDay time = const TimeOfDay(hour: 9, minute: 0);
  bool busy = false;
  String? error;
  @override
  void dispose() {
    pickup.dispose();
    drop.dispose();
    km.dispose();
    super.dispose();
  }

  Future<void> quote() async {
    if (busy || !form.currentState!.validate()) return;
    final payload = <String, Object?>{
      'cityId': 'sambhajinagar',
      'service': service,
      'pickup': pickup.text.trim(),
      'drop': drop.text.trim(),
      'distanceKm': double.parse(km.text),
      'mode': scheduled ? 'schedule' : 'now',
      if (scheduled)
        'scheduledAt':
            '${civilDate(day)}T${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}',
    };
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = Map<String, dynamic>.from(
          await widget.api.post('/api/quotes', payload));
      if (!mounted) return;
      await openCargoX(
          context,
          QuotePage(
              api: widget.api,
              payload: payload,
              quote: result,
              pink: widget.pink));
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: scheduled ? 'Schedule Ride' : 'Your route', children: [
        VehicleArt(kind: service),
        const DemoNotice(
            text:
                'Manual demo stops • No live map or routed distance. Times use Asia/Kolkata.'),
        Form(
            key: form,
            child: Column(children: [
              DropdownButtonFormField<String>(
                  initialValue: service,
                  decoration: const InputDecoration(labelText: 'Service'),
                  items: const [
                    DropdownMenuItem(value: 'auto', child: Text('Auto')),
                    DropdownMenuItem(
                        value: 'car', child: Text('Car • Demo class'))
                  ],
                  onChanged: busy ? null : (v) => setState(() => service = v!)),
              const SizedBox(height: 16),
              TextFormField(
                  controller: pickup,
                  enabled: !busy,
                  decoration: const InputDecoration(labelText: 'Pickup'),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Enter a pickup' : null),
              const SizedBox(height: 16),
              TextFormField(
                  controller: drop,
                  enabled: !busy,
                  decoration: const InputDecoration(labelText: 'Destination'),
                  validator: (v) => v == null || v.trim().isEmpty
                      ? 'Enter a destination'
                      : null),
              const SizedBox(height: 16),
              TextFormField(
                  controller: km,
                  enabled: !busy,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Illustrative distance (km)'),
                  validator: (v) {
                    final distance = double.tryParse(v ?? '');
                    return distance == null ||
                            !distance.isFinite ||
                            distance <= 0 ||
                            distance > 500
                        ? 'Enter a distance above 0 and up to 500'
                        : null;
                  }),
            ])),
        SwitchListTile(
            title: const Text('Schedule for later'),
            value: scheduled,
            onChanged: busy ? null : (v) => setState(() => scheduled = v)),
        if (scheduled) ...[
          ListTile(
              title: Text('Date: ${civilDate(day)}'),
              trailing: const Icon(Icons.calendar_today),
              onTap: busy
                  ? null
                  : () async {
                      final picked = await showDatePicker(
                          context: context,
                          initialDate: day,
                          firstDate: DateTime.now(),
                          lastDate:
                              DateTime.now().add(const Duration(days: 90)));
                      if (picked != null && mounted)
                        setState(() => day = picked);
                    }),
          ListTile(
              title: Text('Pickup time: ${time.format(context)}'),
              trailing: const Icon(Icons.schedule),
              onTap: busy
                  ? null
                  : () async {
                      final picked = await showTimePicker(
                          context: context, initialTime: time);
                      if (picked != null && mounted)
                        setState(() => time = picked);
                    }),
        ],
        if (service == 'car')
          const Text(
              'Mini, Sedan and SUV await Admin configuration. This local API currently offers one illustrative Car rate.'),
        if (error != null) DemoNotice(text: error!),
        FilledButton(
            onPressed: busy ? null : quote,
            child: Text(busy ? 'Getting quote…' : 'View fare quote')),
      ]);
}

class QuotePage extends StatefulWidget {
  const QuotePage(
      {super.key,
      required this.api,
      required this.payload,
      required this.quote,
      this.pink = false});
  final DemoApi api;
  final Map<String, Object?> payload;
  final Map<String, dynamic> quote;
  final bool pink;
  @override
  State<QuotePage> createState() => _QuotePageState();
}

class _QuotePageState extends State<QuotePage> {
  late bool pink = widget.pink;
  bool eligible = false;
  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: 'Fare & preferences', children: [
        Text('${widget.payload['pickup']} → ${widget.payload['drop']}',
            style: const TextStyle(fontSize: 25, fontWeight: FontWeight.bold)),
        if (widget.payload['scheduledAt'] != null)
          Text('Scheduled: ${widget.payload['scheduledAt']} • Asia/Kolkata'),
        Text(rupees(widget.quote['farePaise'] as num),
            style: const TextStyle(
                fontSize: 40,
                fontWeight: FontWeight.w900,
                color: CargoXColors.ink)),
        Text(
            '${widget.quote['distanceKm']} input km • ${widget.quote['pricingVersion']}'),
        Text(
            'Platform allocation included: ${rupees(widget.quote['platformCommissionPaise'] as num)} (demo placeholder).'),
        Text('${widget.quote['note']}'),
        const DemoNotice(
            text:
                'No payment is collected. Taxes, tolls, cancellations and refunds are not integrated; this is not a payable fare.'),
        SwitchListTile(
            title: const Text('Pink Rider Only'),
            subtitle: const Text(
                'Only an eligible opted-in woman partner. Never silent substitution.'),
            value: pink,
            onChanged: (v) => setState(() => pink = v)),
        SwitchListTile(
            title: const Text('Demo eligible women passenger party'),
            subtitle: const Text(
                'Fictional test fixture only; not real identity verification.'),
            value: eligible,
            onChanged: (v) => setState(() => eligible = v)),
        if (pink && !eligible)
          const DemoNotice(
              text:
                  'Pink Rider Only requires the eligible demo passenger fixture.'),
        FilledButton(
            onPressed: pink && !eligible
                ? null
                : () => openCargoX(
                    context,
                    PaymentPreview(
                        api: widget.api,
                        payload: {
                          ...widget.payload,
                          'pinkOnly': pink,
                          'allPassengersWomenVerified': eligible
                        },
                        fare: widget.quote['farePaise'] as num)),
            child: const Text('Continue to demo confirmation')),
      ]);
}

class PaymentPreview extends StatefulWidget {
  const PaymentPreview(
      {super.key,
      required this.api,
      required this.payload,
      required this.fare});
  final DemoApi api;
  final Map<String, Object?> payload;
  final num fare;
  @override
  State<PaymentPreview> createState() => _PaymentPreviewState();
}

class _PaymentPreviewState extends State<PaymentPreview> {
  bool consent = false, busy = false, created = false;
  String? error;
  Future<void> request() async {
    if (busy || created || !consent) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final ride = Map<String, dynamic>.from(
          await widget.api.post('/api/rides', widget.payload));
      if (!mounted) return;
      setState(() => created = true);
      await openCargoX(context, TripPage(api: widget.api, initialRide: ride));
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: 'Demo confirmation', children: [
        const Icon(Icons.account_balance_wallet_outlined,
            color: CargoXColors.deep, size: 64),
        Text('Illustrative total: ${rupees(widget.fare)}',
            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
        const DemoNotice(
            text:
                'Payment disabled • No charge, refund or settlement is created. Live bookings require approved policies and a verified payment provider.'),
        CheckboxListTile(
            title: const Text(
                'I understand this creates only a fictional local ride request.'),
            value: consent,
            onChanged: busy || created
                ? null
                : (v) => setState(() => consent = v ?? false)),
        if (error != null) DemoNotice(text: error!),
        FilledButton(
            onPressed: consent && !busy && !created ? request : null,
            child: Text(created
                ? 'Request created — view it in History'
                : busy
                    ? 'Requesting…'
                    : 'Request demo ride')),
      ]);
}
