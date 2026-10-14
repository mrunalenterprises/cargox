import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'main.dart' as app;

const _url = String.fromEnvironment('LOADIN_SUPABASE_URL');
const _key = String.fromEnvironment('LOADIN_SUPABASE_PUBLISHABLE_KEY');
const _orange = Color(0xFFFF7A00);
const _navy = Color(0xFF0D1D3B);
const _bg = Color(0xFFF4F7FB);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: _url, publishableKey: _key);
  runApp(const LoadinPartnerQaApp());
}

class LoadinPartnerQaApp extends StatelessWidget {
  const LoadinPartnerQaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'LOADIN Partner QA',
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: _bg,
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
        ),
      ),
      home: const _QaGate(),
    );
  }
}

class _QaGate extends StatelessWidget {
  const _QaGate();

  @override
  Widget build(BuildContext context) {
    final auth = Supabase.instance.client.auth;
    return StreamBuilder<AuthState>(
      stream: auth.onAuthStateChange,
      builder: (context, snapshot) {
        if (auth.currentSession != null) return const app.PartnerShell();
        return const _QaLogin();
      },
    );
  }
}

class _QaLogin extends StatefulWidget {
  const _QaLogin();

  @override
  State<_QaLogin> createState() => _QaLoginState();
}

class _QaLoginState extends State<_QaLogin> {
  final pin = TextEditingController();
  bool busy = false;
  String? error;

  Future<void> login() async {
    final value = pin.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(value)) {
      setState(() => error = 'Enter the 6-digit QA PIN.');
      return;
    }

    setState(() {
      busy = true;
      error = null;
    });

    try {
      final response = await Supabase.instance.client.functions.invoke(
        'loadin-qa-login',
        body: {'role': 'PARTNER', 'pin': value},
      );
      final data = Map<String, dynamic>.from(response.data as Map);
      if (data['error'] != null) throw Exception(data['error']);
      final session = Map<String, dynamic>.from(data['session'] as Map);
      final refreshToken = '${session['refresh_token'] ?? ''}';
      final accessToken = '${session['access_token'] ?? ''}';
      if (refreshToken.isEmpty || accessToken.isEmpty) {
        throw Exception('QA session was not returned');
      }
      await Supabase.instance.client.auth.setSession(
        refreshToken,
        accessToken: accessToken,
      );
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    pin.dispose();
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
                  const Text(
                    'LOADIN PARTNER',
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      color: _navy,
                      letterSpacing: -1,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Partner Live QA',
                    style: TextStyle(
                      fontSize: 32,
                      height: 1.05,
                      fontWeight: FontWeight.w900,
                      color: _navy,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'SMS is disabled for QA. The fixed QA PIN signs in a dedicated verified test partner with live dispatch readiness.',
                    style: TextStyle(color: Color(0xFF66758A), height: 1.5),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: pin,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    maxLength: 6,
                    decoration: const InputDecoration(
                      labelText: '6-digit QA PIN',
                      prefixIcon: Icon(Icons.lock_outline),
                      counterText: '',
                    ),
                    onSubmitted: (_) => busy ? null : login(),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 8),
                    Text(error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: busy ? null : login,
                    style: FilledButton.styleFrom(
                      backgroundColor: _orange,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      busy ? 'Signing in…' : 'Continue Live QA',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'QA build only • Production OTP flow remains unchanged.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11, color: Color(0xFF7B8798)),
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
