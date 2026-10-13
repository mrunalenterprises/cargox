import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const _supabaseUrl = String.fromEnvironment('LOADIN_SUPABASE_URL');
const _supabaseKey = String.fromEnvironment('LOADIN_SUPABASE_PUBLISHABLE_KEY');
const _orange = Color(0xFFFF7A00);
const _navy = Color(0xFF0D1D3B);
const _background = Color(0xFFF4F7FB);
const _green = Color(0xFF119C6B);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final configured = _supabaseUrl.isNotEmpty && _supabaseKey.isNotEmpty;
  if (configured) {
    await Supabase.initialize(url: _supabaseUrl, anonKey: _supabaseKey);
  }
  runApp(LoadinCustomerApp(configured: configured));
}

class LoadinCustomerApp extends StatelessWidget {
  const LoadinCustomerApp({super.key, required this.configured});
  final bool configured;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'LOADIN Customer',
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: _background,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _orange,
          primary: _orange,
          secondary: _navy,
          surface: Colors.white,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFFE5EAF0)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: _orange, width: 1.4),
          ),
        ),
      ),
      home: configured ? const _AuthGate() : const CustomerShell(demo: true),
    );
  }
}

class LoadinLogo extends StatelessWidget {
  const LoadinLogo({super.key, this.small = false});
  final bool small;

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: TextSpan(
        style: TextStyle(
          fontSize: small ? 22 : 28,
          fontWeight: FontWeight.w900,
          letterSpacing: -1,
          color: _navy,
        ),
        children: const [
          TextSpan(text: 'LOAD'),
          TextSpan(text: 'IN', style: TextStyle(color: _orange)),
        ],
      ),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final auth = Supabase.instance.client.auth;
    return StreamBuilder<AuthState>(
      stream: auth.onAuthStateChange,
      builder: (context, snapshot) {
        return auth.currentSession == null
            ? const OtpLoginScreen()
            : const CustomerShell();
      },
    );
  }
}

class OtpLoginScreen extends StatefulWidget {
  const OtpLoginScreen({super.key});

  @override
  State<OtpLoginScreen> createState() => _OtpLoginScreenState();
}

class _OtpLoginScreenState extends State<OtpLoginScreen> {
  final phoneController = TextEditingController(text: '+91');
  final otpController = TextEditingController();
  bool sent = false;
  bool busy = false;
  String? error;

  String _phone() {
    final raw = phoneController.text.trim();
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (raw.startsWith('+') && digits.length >= 10) return '+$digits';
    if (digits.length == 10) return '+91$digits';
    throw Exception('Enter a valid mobile number');
  }

  Future<void> _submit() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (!sent) {
        await Supabase.instance.client.auth.signInWithOtp(phone: _phone());
        if (mounted) setState(() => sent = true);
      } else {
        await Supabase.instance.client.auth.verifyOTP(
          phone: _phone(),
          token: otpController.text.trim(),
          type: OtpType.sms,
        );
        await Supabase.instance.client.rpc(
          'ensure_my_customer_profile',
          params: {
            'p_full_name': null,
            'p_mobile': _phone(),
            'p_city_code': 'CSN',
          },
        );
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    phoneController.dispose();
    otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(22),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const LoadinLogo(),
                  const SizedBox(height: 10),
                  const Text(
                    'Book Fast.\nTrack Live. Move Easy.',
                    style: TextStyle(
                      fontSize: 32,
                      height: 1.02,
                      fontWeight: FontWeight.w900,
                      color: _navy,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Use the same mobile number on web and app. Your LOADIN account and bookings stay synced.',
                    style: TextStyle(color: Color(0xFF66758A), height: 1.5),
                  ),
                  const SizedBox(height: 26),
                  TextField(
                    controller: phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Mobile number',
                      prefixIcon: Icon(Icons.phone_android),
                    ),
                  ),
                  if (sent) ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: otpController,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: const InputDecoration(
                        labelText: '6-digit OTP',
                        prefixIcon: Icon(Icons.lock_outline),
                        counterText: '',
                      ),
                    ),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 8),
                    Text(error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: busy ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: _orange,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      busy
                          ? 'Please wait…'
                          : sent
                              ? 'Verify & Continue'
                              : 'Send OTP',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ServiceOption {
  const ServiceOption(
    this.code,
    this.label,
    this.subtitle,
    this.icon,
    this.baseFare,
    this.vehicleClass,
  );

  final String code;
  final String label;
  final String subtitle;
  final IconData icon;
  final int baseFare;
  final String? vehicleClass;
}

const services = <ServiceOption>[
  ServiceOption(
    'PARCEL_2W',
    '2-Wheeler Parcel',
    'Documents & small parcels',
    Icons.two_wheeler,
    149,
    'BIKE',
  ),
  ServiceOption(
    'LOADING_VEHICLE',
    'Loading Vehicle',
    '3W, Tata Ace, Pickup & trucks',
    Icons.local_shipping_outlined,
    489,
    'TATA_ACE',
  ),
  ServiceOption(
    'HELPER',
    'Helper',
    'Loading, unloading & lifting',
    Icons.handyman_outlined,
    299,
    null,
  ),
  ServiceOption(
    'FULL_SHIFTING',
    'Full Shifting',
    'Pack, move & complete relocation',
    Icons.home_work_outlined,
    2199,
    null,
  ),
];

class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key, this.demo = false});
  final bool demo;

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      CustomerHome(demo: widget.demo),
      CustomerBookings(demo: widget.demo),
      CustomerAccount(demo: widget.demo),
    ];

    return Scaffold(
      appBar: AppBar(
        backgroundColor: _background,
        surfaceTintColor: Colors.transparent,
        title: const LoadinLogo(small: true),
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        indicatorColor: const Color(0xFFFFE6CF),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Bookings',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Account',
          ),
        ],
      ),
    );
  }
}

class CustomerHome extends StatelessWidget {
  const CustomerHome({super.key, required this.demo});
  final bool demo;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        _CustomerHero(demo: demo),
        const SizedBox(height: 18),
        const Text(
          'SERVICES',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.3,
            color: _orange,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'What do you need today?',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w900,
            color: _navy,
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: services.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.02,
          ),
          itemBuilder: (context, index) {
            final service = services[index];
            return InkWell(
              borderRadius: BorderRadius.circular(22),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => BookingScreen(
                    initial: service,
                    demo: demo,
                  ),
                ),
              ),
              child: Container(
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: const Color(0xFFE7ECF3)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x0D0D1D3B),
                      blurRadius: 22,
                      offset: Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF0E2),
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: Icon(service.icon, color: _orange),
                    ),
                    const Spacer(),
                    Text(
                      service.label,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        color: _navy,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      service.subtitle,
                      maxLines: 2,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF728095),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(17),
          decoration: BoxDecoration(
            color: _navy,
            borderRadius: BorderRadius.circular(22),
          ),
          child: const Row(
            children: [
              CircleAvatar(
                backgroundColor: _orange,
                child: Icon(Icons.verified_user_outlined, color: Colors.white),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'LOADIN Trip Promise',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Fare Lock • Verified Partner • Live Tracking • Pickup & Delivery OTP',
                      style: TextStyle(
                        color: Color(0xFFC7D2DF),
                        fontSize: 11,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CustomerHero extends StatelessWidget {
  const _CustomerHero({required this.demo});
  final bool demo;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 310,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF07172E), Color(0xFF0D3765), Color(0xFF17649B)],
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x330D1D3B),
            blurRadius: 32,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -58,
            bottom: -125,
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: _orange, width: 27),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                demo ? 'DEMO • CUSTOMER APP' : 'LIVE • CUSTOMER APP',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.4,
                  color: Color(0xFFFFBE7D),
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Book Fast.\nTrack Live.\nMove Easy.',
                style: TextStyle(
                  fontSize: 36,
                  height: .98,
                  letterSpacing: -1.6,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Parcel • Loading • Helper • Full Shifting',
                style: TextStyle(color: Color(0xFFD1DBE7), fontSize: 12),
              ),
              const Spacer(),
              const Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  _HeroPill('🔒 Fare Lock'),
                  _HeroPill('📍 Live Tracking'),
                  _HeroPill('✓ OTP Proof'),
                ],
              ),
            ],
          ),
          Positioned(
            right: 0,
            top: 28,
            child: Container(
              width: 105,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                boxShadow: const [
                  BoxShadow(color: Color(0x33000000), blurRadius: 20),
                ],
              ),
              child: const Column(
                children: [
                  Icon(Icons.route_rounded, color: _orange, size: 32),
                  SizedBox(height: 6),
                  Text(
                    'LIVE\nTRACKING',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: _navy,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    '2 min away',
                    style: TextStyle(fontSize: 9, color: Color(0xFF6D7A8D)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroPill extends StatelessWidget {
  const _HeroPill(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(.08),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white.withOpacity(.10)),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class BookingScreen extends StatefulWidget {
  const BookingScreen({
    super.key,
    required this.initial,
    required this.demo,
  });

  final ServiceOption initial;
  final bool demo;

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  late ServiceOption service = widget.initial;
  final goodsController = TextEditingController();
  final pickupController = TextEditingController(
    text: 'CIDCO, Chhatrapati Sambhaji Nagar',
  );
  final dropController = TextEditingController(text: 'Waluj MIDC');
  bool busy = false;
  String? error;

  @override
  void dispose() {
    goodsController.dispose();
    pickupController.dispose();
    dropController.dispose();
    super.dispose();
  }

  Future<void> _book() async {
    if (goodsController.text.trim().isEmpty ||
        pickupController.text.trim().isEmpty ||
        dropController.text.trim().isEmpty) {
      setState(() => error = 'Enter goods, pickup and drop.');
      return;
    }

    setState(() {
      busy = true;
      error = null;
    });

    try {
      if (!widget.demo) {
        final uid = Supabase.instance.client.auth.currentUser?.id;
        if (uid == null) throw Exception('Login required');

        await Supabase.instance.client.from('bookings').insert({
          'customer_id': uid,
          'city_code': 'CSN',
          'service_code': service.code,
          'status': 'SEARCHING',
          'booking_mode': 'NOW',
          'goods_description': goodsController.text.trim(),
          'pickup_address': pickupController.text.trim(),
          'drop_address': dropController.text.trim(),
          'vehicle_class': service.vehicleClass,
          'fare_locked': true,
          'locked_fare': service.baseFare,
          'customer_payment_mode': 'ONLINE',
        });
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.demo
                ? 'Demo booking created'
                : 'Booking created — searching verified partners',
          ),
          backgroundColor: _navy,
        ),
      );
      Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Book a LOADIN',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const Text(
            'Choose service',
            style: TextStyle(fontWeight: FontWeight.w900, color: _navy),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<ServiceOption>(
            initialValue: service,
            items: services
                .map(
                  (item) => DropdownMenuItem(
                    value: item,
                    child: Text(item.label),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() => service = value ?? service),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: goodsController,
            decoration: const InputDecoration(
              labelText: 'Goods / Item',
              prefixIcon: Icon(Icons.inventory_2_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: pickupController,
            decoration: const InputDecoration(
              labelText: 'Pickup',
              prefixIcon: Icon(Icons.radio_button_checked, color: _orange),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: dropController,
            decoration: const InputDecoration(
              labelText: 'Drop',
              prefixIcon: Icon(Icons.location_on_outlined, color: _navy),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _navy,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'FARE LOCK',
                      style: TextStyle(
                        color: Color(0xFFFFB66D),
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      'Protected before confirm',
                      style: TextStyle(color: Color(0xFFC7D2DF), fontSize: 11),
                    ),
                  ],
                ),
                Text(
                  '₹${service.baseFare}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 10),
            Text(error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: busy ? null : _book,
            style: FilledButton.styleFrom(
              backgroundColor: _orange,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            child: Text(
              busy ? 'Booking…' : 'Confirm Fare & Book',
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}

class CustomerBookings extends StatefulWidget {
  const CustomerBookings({super.key, required this.demo});
  final bool demo;

  @override
  State<CustomerBookings> createState() => _CustomerBookingsState();
}

class _CustomerBookingsState extends State<CustomerBookings> {
  Future<List<Map<String, dynamic>>> _load() async {
    if (widget.demo) {
      return [
        {
          'goods_description': 'Office material',
          'pickup_address': 'CIDCO',
          'drop_address': 'Waluj MIDC',
          'status': 'SEARCHING',
          'locked_fare': 489,
        },
      ];
    }

    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (uid == null) return [];

    final data = await Supabase.instance.client
        .from('bookings')
        .select()
        .eq('customer_id', uid)
        .order('created_at', ascending: false)
        .limit(50);
    return List<Map<String, dynamic>>.from(data);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _load(),
      builder: (context, snapshot) {
        final rows = snapshot.data ?? const <Map<String, dynamic>>[];
        return RefreshIndicator(
          onRefresh: () async => setState(() {}),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              const Text(
                'My Bookings',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: _navy,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Web and app bookings appear in the same account.',
                style: TextStyle(color: Color(0xFF74829A)),
              ),
              const SizedBox(height: 16),
              if (snapshot.connectionState == ConnectionState.waiting)
                const Center(child: CircularProgressIndicator()),
              if (snapshot.connectionState != ConnectionState.waiting &&
                  rows.isEmpty)
                const _EmptyCard('No bookings yet.'),
              ...rows.map(
                (booking) => Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE7ECF3)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF0E2),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.local_shipping_outlined,
                          color: _orange,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${booking['goods_description'] ?? 'LOADIN booking'}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                                color: _navy,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              '${booking['pickup_address'] ?? ''} → ${booking['drop_address'] ?? ''}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF74829A),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '₹${booking['locked_fare'] ?? 0} • ${booking['status'] ?? ''}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: _orange,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Center(
        child: Text(text, style: const TextStyle(color: Color(0xFF74829A))),
      ),
    );
  }
}

class CustomerAccount extends StatelessWidget {
  const CustomerAccount({super.key, required this.demo});
  final bool demo;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Account',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w900,
            color: _navy,
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Column(
            children: [
              _accountRow('Mode', demo ? 'Demo' : 'Live'),
              _accountRow('City', 'Chhatrapati Sambhaji Nagar'),
              _accountRow('Fare Lock', 'Enabled'),
              _accountRow('Trip Proof', 'Pickup + Delivery OTP'),
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (!demo)
          OutlinedButton.icon(
            onPressed: () => Supabase.instance.client.auth.signOut(),
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
          ),
      ],
    );
  }

  static Widget _accountRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF74829A))),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w900, color: _navy),
          ),
        ],
      ),
    );
  }
}
