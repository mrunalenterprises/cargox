import 'package:flutter/material.dart';
import 'package:cargox_ui/cargox_ui.dart';
import 'package:cargox_demo/cargox_demo.dart';
import 'main.dart' show ServicePreview;

class DailyServices extends StatelessWidget {
  const DailyServices({super.key, required this.api});
  final DemoApi api;
  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: 'Daily Services', children: [
        const Text('Make your everyday easier.',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
        for (final purpose in [
          'Office pickup/drop',
          'School',
          'College',
          'Tuition / Classes',
          'Other fixed route',
          'Outstation Daily Car'
        ])
          Card(
              child: ListTile(
                  title: Text(purpose),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    if (purpose == 'School' || purpose == 'Tuition / Classes') {
                      openCargoX(
                          context,
                          const GatePage(
                              title: 'Guardian-managed trips',
                              reason:
                                  'Child and school/class journeys are disabled until guardian, licensing and handoff policies are approved.',
                              items: [
                                'Verified guardian consent',
                                'Authorized adults',
                                'Extra driver & vehicle eligibility',
                                'Absence exception handling'
                              ]));
                    } else if (purpose == 'Outstation Daily Car') {
                      openCargoX(
                          context, const ServicePreview(service: 'outstation'));
                    } else {
                      openCargoX(context, PlanPage(api: api, purpose: purpose));
                    }
                  })),
      ]);
}

class PlanPage extends StatefulWidget {
  const PlanPage(
      {super.key,
      required this.api,
      this.monthly = false,
      this.purpose = 'Office pickup/drop'});
  final DemoApi api;
  final bool monthly;
  final String purpose;
  @override
  State<PlanPage> createState() => _PlanPageState();
}

class _PlanPageState extends State<PlanPage> {
  final form = GlobalKey<FormState>();
  final pickup = TextEditingController(text: 'Home'),
      drop = TextEditingController(text: 'Office'),
      km = TextEditingController(text: '8');
  final days = <int>{1, 2, 3, 4, 5};
  String service = 'auto', preferred = 'none';
  bool returns = true, pink = false, eligible = false, busy = false;
  DateTime start = DateTime.now().add(const Duration(days: 1));
  DateTime end = DateTime.now().add(const Duration(days: 28));
  TimeOfDay outbound = const TimeOfDay(hour: 8, minute: 30),
      inbound = const TimeOfDay(hour: 18, minute: 0);
  String? error;
  @override
  void dispose() {
    pickup.dispose();
    drop.dispose();
    km.dispose();
    super.dispose();
  }

  String clock(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  Future<void> preview() async {
    if (busy || !form.currentState!.validate()) return;
    if (days.isEmpty || end.isBefore(start) || (pink && !eligible)) {
      setState(() => error =
          'Choose weekdays, an end date after the start, and eligible passengers for Pink Rider Only.');
      return;
    }
    final payload = <String, Object?>{
      'service': service,
      'pickup': pickup.text.trim(),
      'drop': drop.text.trim(),
      'distanceKm': double.parse(km.text),
      'startDate': civilDate(start),
      'endDate': civilDate(end),
      'weekdays': days.toList()..sort(),
      'pickupTime': clock(outbound),
      'returnTime': returns ? clock(inbound) : null,
      'pinkOnly': pink,
      'allPassengersWomenVerified': eligible,
      'preferredPartnerId': preferred == 'none' ? null : preferred
    };
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = Map<String, dynamic>.from(
          await widget.api.post('/api/plans/quote', payload));
      if (!mounted) return;
      await openCargoX(
          context, PlanReview(api: widget.api, plan: result, payload: payload));
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => CargoXPage(
          title: widget.monthly ? 'Monthly Packs' : widget.purpose,
          children: [
            const DemoNotice(
                text:
                    'Fixed pickup & drop • Unpaid local preview. Each outbound and return is a separate journey leg.'),
            Form(
                key: form,
                child: Column(children: [
                  DropdownButtonFormField<String>(
                      initialValue: service,
                      decoration: const InputDecoration(labelText: 'Service'),
                      items: const [
                        DropdownMenuItem(value: 'auto', child: Text('Auto')),
                        DropdownMenuItem(value: 'car', child: Text('Car'))
                      ],
                      onChanged:
                          busy ? null : (v) => setState(() => service = v!)),
                  const SizedBox(height: 16),
                  TextFormField(
                      controller: pickup,
                      enabled: !busy,
                      decoration:
                          const InputDecoration(labelText: 'Fixed pickup'),
                      validator: (v) =>
                          v!.trim().isEmpty ? 'Enter pickup' : null),
                  const SizedBox(height: 16),
                  TextFormField(
                      controller: drop,
                      enabled: !busy,
                      decoration:
                          const InputDecoration(labelText: 'Fixed drop'),
                      validator: (v) =>
                          v!.trim().isEmpty ? 'Enter drop' : null),
                  const SizedBox(height: 16),
                  TextFormField(
                      controller: km,
                      enabled: !busy,
                      decoration: const InputDecoration(
                          labelText: 'Demo distance per leg (km)'),
                      keyboardType: TextInputType.number,
                      validator: (v) {
                        final n = double.tryParse(v ?? '');
                        return n == null || !n.isFinite || n <= 0 || n > 500
                            ? 'Enter 0–500 km, excluding zero'
                            : null;
                      }),
                ])),
            ListTile(
                title: Text('Starts: ${civilDate(start)}'),
                trailing: const Icon(Icons.calendar_today),
                onTap: busy
                    ? null
                    : () async {
                        final next = await showDatePicker(
                            context: context,
                            initialDate: start,
                            firstDate: DateTime.now(),
                            lastDate:
                                DateTime.now().add(const Duration(days: 365)));
                        if (next != null && mounted)
                          setState(() {
                            start = next;
                            if (end.isBefore(start))
                              end = start.add(const Duration(days: 27));
                          });
                      }),
            ListTile(
                title: Text('Ends: ${civilDate(end)}'),
                trailing: const Icon(Icons.calendar_today),
                onTap: busy
                    ? null
                    : () async {
                        final last = start.add(const Duration(days: 62));
                        final next = await showDatePicker(
                            context: context,
                            initialDate: end.isAfter(last) ? last : end,
                            firstDate: start,
                            lastDate: last);
                        if (next != null && mounted) setState(() => end = next);
                      }),
            Wrap(
                spacing: 6,
                children: List.generate(
                    7,
                    (i) => FilterChip(
                        label: Text([
                          'Mon',
                          'Tue',
                          'Wed',
                          'Thu',
                          'Fri',
                          'Sat',
                          'Sun'
                        ][i]),
                        selected: days.contains(i + 1),
                        onSelected: busy
                            ? null
                            : (v) => setState(() {
                                  v ? days.add(i + 1) : days.remove(i + 1);
                                })))),
            ListTile(
                title: Text('Pickup: ${clock(outbound)} • Asia/Kolkata'),
                onTap: busy
                    ? null
                    : () async {
                        final next = await showTimePicker(
                            context: context, initialTime: outbound);
                        if (next != null && mounted)
                          setState(() => outbound = next);
                      }),
            SwitchListTile(
                title: const Text('Pickup + Return'),
                value: returns,
                onChanged: busy ? null : (v) => setState(() => returns = v)),
            if (returns)
              ListTile(
                  title: Text('Independent return: ${clock(inbound)}'),
                  onTap: busy
                      ? null
                      : () async {
                          final next = await showTimePicker(
                              context: context, initialTime: inbound);
                          if (next != null && mounted)
                            setState(() => inbound = next);
                        }),
            DropdownButtonFormField<String>(
                initialValue: preferred,
                decoration: const InputDecoration(
                    labelText: 'Preferred demo partner (not guaranteed)'),
                items: const [
                  DropdownMenuItem(value: 'none', child: Text('No preference')),
                  DropdownMenuItem(
                      value: 'demo-auto-01', child: Text('Demo Auto/Car')),
                  DropdownMenuItem(
                      value: 'demo-pink-01', child: Text('Demo Pink Rider'))
                ],
                onChanged: busy ? null : (v) => setState(() => preferred = v!)),
            SwitchListTile(
                title: const Text('Pink Rider Only on every leg'),
                value: pink,
                onChanged: busy ? null : (v) => setState(() => pink = v)),
            SwitchListTile(
                title: const Text('Demo eligible women passenger party'),
                value: eligible,
                onChanged: busy ? null : (v) => setState(() => eligible = v)),
            const Text(
                'Passenger counts, intermediate stops and live plan sizes await approved vehicle-capacity and routing contracts. No child trips are supported.'),
            if (error != null) DemoNotice(text: error!),
            FilledButton(
                onPressed: busy ? null : preview,
                child: Text(busy ? 'Calculating…' : 'Preview unpaid calendar')),
          ]);
}

class PlanReview extends StatefulWidget {
  const PlanReview(
      {super.key, required this.api, required this.plan, this.payload});
  final DemoApi api;
  final Map<String, dynamic> plan;
  final Map<String, Object?>? payload;
  @override
  State<PlanReview> createState() => _PlanReviewState();
}

class _PlanReviewState extends State<PlanReview> {
  bool busy = false, saved = false, consent = false;
  String? message;
  Future<void> save() async {
    if (busy || saved || !consent || widget.payload == null) return;
    setState(() => busy = true);
    try {
      await widget.api.post('/api/plans/demo', widget.payload!);
      if (mounted)
        setState(() {
          saved = true;
          message =
              'Unpaid draft saved to My Monthly Packs. No journeys are dispatched.';
        });
    } catch (e) {
      if (mounted) setState(() => message = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final legs = widget.plan['legs'] as List;
    final pink =
        widget.payload?['pinkOnly'] ?? widget.plan['pinkOnly'] ?? false;
    return CargoXPage(title: 'Plan calendar', children: [
      Text('${widget.plan['pickup']} ↔ ${widget.plan['drop']}',
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
      Text(
          '${legs.length} journey legs • ${rupees(widget.plan['totalPaise'] as num)} illustrative total'),
      if (pink == true)
        const DemoNotice(
            text:
                'Pink Rider Only is saved on this draft. No replacement or dispatch is performed.'),
      const DemoNotice(
          text:
              'Unpaid preview. No entitlements purchased, automatic renewal, guaranteed partner or live assignment.'),
      const Text(
          'Before sale: approve holidays, pauses, no-shows, late changes, cancellations and refunds. Fixed-route changes require a new quote. Renewal must use explicit consent.'),
      if (widget.payload != null) ...[
        CheckboxListTile(
            title: const Text('Save only an unpaid demo draft'),
            value: consent,
            onChanged: busy || saved
                ? null
                : (v) => setState(() => consent = v ?? false)),
        FilledButton(
            onPressed: consent && !busy && !saved ? save : null,
            child: Text(saved ? 'Draft saved' : 'Save unpaid draft')),
      ],
      if (message != null) DemoNotice(text: message!),
      ...legs.map((leg) => Card(
          child: ListTile(
              leading: Icon(leg['leg'] == 'return'
                  ? Icons.keyboard_return
                  : Icons.arrow_outward),
              title: Text('${leg['date']} · ${leg['time']}'),
              subtitle:
                  Text('${leg['leg']} • Unassigned · No start code issued')))),
    ]);
  }
}

class PackLibrary extends StatefulWidget {
  const PackLibrary({super.key, required this.api});
  final DemoApi api;
  @override
  State<PackLibrary> createState() => _PackLibraryState();
}

class _PackLibraryState extends State<PackLibrary> {
  late Future<dynamic> plans = widget.api.get('/api/plans');
  @override
  Widget build(BuildContext context) =>
      CargoXPage(title: 'My Monthly Packs', children: [
        const DemoNotice(
            text:
                'All local unpaid fixtures, not a private authenticated account. Restarting the API clears them.'),
        OutlinedButton(
            onPressed: () =>
                setState(() => plans = widget.api.get('/api/plans')),
            child: const Text('Refresh drafts')),
        FutureBuilder<dynamic>(
            future: plans,
            builder: (context, snapshot) {
              if (snapshot.hasError)
                return DemoNotice(text: '${snapshot.error}');
              if (!snapshot.hasData)
                return const Center(child: CircularProgressIndicator());
              final list = snapshot.data as List;
              if (list.isEmpty)
                return const Text(
                    'No unpaid drafts yet. Create a Monthly Pack preview.');
              return Column(
                  children: list
                      .map((plan) => Card(
                          child: ListTile(
                              title:
                                  Text('${plan['pickup']} → ${plan['drop']}'),
                              subtitle: Text(
                                  '${plan['legs'].length} legs · DEMO_UNPAID'),
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () => openCargoX(
                                  context,
                                  PlanReview(
                                      api: widget.api,
                                      plan: Map<String, dynamic>.from(plan))))))
                      .toList());
            }),
      ]);
}
