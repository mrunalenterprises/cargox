import 'package:flutter/material.dart';
import 'vehicle_art.dart';
export 'vehicle_art.dart';

/// Product-facing names shared by every Flutter surface.
///
/// The surrounding `cargox_*` symbols remain stable technical identifiers so
/// package imports, Android builds, and existing integrations continue to work.
abstract final class PipPipBrand {
  static const name = 'PIP PIP';
  static const company = 'Mrunal Technologies';
  static const customerApp = 'PIP PIP Customer';
  static const partnerApp = 'PIP PIP Partner';
  static const localDemo = 'Local Demo';
}

class CargoXColors {
  static const primary = Color(0xFF59BAA1);
  static const softMint = Color(0xFFB4DACF);
  static const aqua = Color(0xFF5AC0A5);
  static const deep = Color(0xFF0E885A);
  static const ink = Color(0xFF163E32);
  static const offWhite = Color(0xFFECEDED);
  static const pink = Color(0xFFA92C64);
}

bool reducedMotion(BuildContext context) {
  final media = MediaQuery.maybeOf(context);
  return (media?.disableAnimations ?? false) ||
      (media?.accessibleNavigation ?? false);
}

Future<T?> openCargoX<T>(BuildContext context, Widget page) =>
    Navigator.of(context).push<T>(cargoXRoute<T>(context, page));

Future<T?> replaceCargoX<T>(BuildContext context, Widget page) =>
    Navigator.of(context)
        .pushReplacement<T, void>(cargoXRoute<T>(context, page));

PageRouteBuilder<T> cargoXRoute<T>(BuildContext context, Widget page) =>
    PageRouteBuilder<T>(
      transitionDuration: reducedMotion(context)
          ? Duration.zero
          : const Duration(milliseconds: 210),
      reverseTransitionDuration: reducedMotion(context)
          ? Duration.zero
          : const Duration(milliseconds: 170),
      pageBuilder: (_, animation, secondaryAnimation) => page,
      transitionsBuilder: (_, animation, secondaryAnimation, child) =>
          FadeTransition(
              opacity: animation,
              child: SlideTransition(
                  position: animation.drive(
                      Tween(begin: const Offset(.025, 0), end: Offset.zero)),
                  child: child)),
    );

ThemeData cargoxTheme() => ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xFFF3F8F5),
      colorScheme: ColorScheme.fromSeed(
          seedColor: CargoXColors.primary,
          primary: const Color(0xFF08734B),
          secondary: CargoXColors.pink,
          surface: Colors.white),
      appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFF3F8F5),
          foregroundColor: CargoXColors.ink),
      filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
              minimumSize: const Size(48, 52),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)))),
      outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(minimumSize: const Size(48, 48))),
      inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.all(16),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16))),
    );

class CargoXServiceCard extends StatefulWidget {
  const CargoXServiceCard(
      {super.key,
      required this.label,
      required this.subtitle,
      required this.icon,
      required this.onTap,
      this.enabled = true,
      this.selected = false,
      this.pink = false,
      this.vehicle});
  final String label, subtitle;
  final String? vehicle;
  final IconData icon;
  final VoidCallback onTap;
  final bool enabled, selected, pink;
  @override
  State<CargoXServiceCard> createState() => _CargoXServiceCardState();
}

class _CargoXServiceCardState extends State<CargoXServiceCard> {
  bool pressing = false;
  @override
  Widget build(BuildContext context) {
    final reduced = reducedMotion(context);
    final accent = widget.pink ? CargoXColors.pink : CargoXColors.deep;
    return _RevealCard(
        child: Semantics(
      button: true,
      enabled: widget.enabled,
      selected: widget.selected,
      child: AnimatedScale(
        duration: reduced ? Duration.zero : const Duration(milliseconds: 170),
        curve: Curves.easeOutBack,
        scale: pressing ? .98 : 1,
        child: DecoratedBox(
          decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                    color: accent.withValues(alpha: .10),
                    blurRadius: 16,
                    offset: const Offset(0, 6))
              ]),
          child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(20),
            clipBehavior: Clip.antiAlias,
            child: Ink(
              decoration: BoxDecoration(
                  gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: widget.pink
                          ? [Colors.white, const Color(0xFFFFE7F1)]
                          : [
                              Colors.white,
                              widget.selected
                                  ? CargoXColors.softMint
                                  : const Color(0xFFE0F0E9)
                            ]),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: widget.selected ? accent : const Color(0xFFCBDED5),
                      width: widget.selected ? 2 : 1)),
              child: InkWell(
                onTap: widget.enabled ? widget.onTap : null,
                onHighlightChanged: (value) => setState(() => pressing = value),
                child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (widget.vehicle != null)
                            Align(
                                alignment: Alignment.centerRight,
                                child: VehicleArt(
                                    kind: widget.vehicle!, pink: widget.pink))
                          else
                            Padding(
                                padding: const EdgeInsets.only(bottom: 16),
                                child:
                                    Icon(widget.icon, color: accent, size: 36)),
                          Text(widget.label,
                              style: const TextStyle(
                                  fontSize: 19,
                                  fontWeight: FontWeight.w800,
                                  color: CargoXColors.ink)),
                          const SizedBox(height: 6),
                          Text(widget.subtitle,
                              style: const TextStyle(
                                  fontSize: 13, color: Color(0xFF385F51))),
                        ])),
              ),
            ),
          ),
        ),
      ),
    ));
  }
}

class CargoXPage extends StatelessWidget {
  const CargoXPage(
      {super.key, required this.title, required this.children, this.actions});
  final String title;
  final List<Widget> children;
  final List<Widget>? actions;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(title), actions: actions),
        body: SafeArea(
            child: Center(
                child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 760),
                    child: ListView.separated(
                        padding: const EdgeInsets.all(20),
                        itemCount: children.length,
                        separatorBuilder: (_, index) =>
                            const SizedBox(height: 16),
                        itemBuilder: (_, i) => children[i])))),
      );
}

class DemoNotice extends StatelessWidget {
  const DemoNotice(
      {super.key,
      this.text = 'LOCAL DEMO • No live rides, identity checks or payments.'});
  final String text;
  @override
  Widget build(BuildContext context) => Semantics(
      liveRegion: true,
      child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
              color: const Color(0xFFE3EEE7),
              borderRadius: BorderRadius.circular(14)),
          child: Text(text, style: const TextStyle(color: CargoXColors.ink))));
}

class GatePage extends StatelessWidget {
  const GatePage(
      {super.key,
      required this.title,
      required this.reason,
      this.items = const []});
  final String title, reason;
  final List<String> items;
  @override
  Widget build(BuildContext context) => CargoXPage(title: title, children: [
        const Icon(Icons.shield_outlined, size: 64, color: CargoXColors.deep),
        const Text('Coming soon',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
        DemoNotice(text: reason),
        ...items.map((item) => Card(
            child: ListTile(
                title: Text(item), trailing: const Icon(Icons.lock_outline)))),
        const Text(
            'This preview does not activate service or collect personal information.'),
      ]);
}

class _RevealCard extends StatelessWidget {
  const _RevealCard({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    if (reducedMotion(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 220),
      child: child,
      builder: (context, progress, content) => Stack(children: [
        content!,
        if (progress < 1)
          Positioned.fill(
              child: IgnorePointer(
                  child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: CustomPaint(painter: _Shine(progress)),
          ))),
      ]),
    );
  }
}

class _Shine extends CustomPainter {
  const _Shine(this.progress);
  final double progress;
  @override
  void paint(Canvas canvas, Size size) {
    final x = (size.width + 120) * progress - 120;
    final rect = Rect.fromLTWH(x, 0, 90, size.height);
    canvas.drawRect(
        rect,
        Paint()
          ..shader = const LinearGradient(colors: [
            Color(0x00FFFFFF),
            Color(0x40FFFFFF),
            Color(0x00FFFFFF),
          ]).createShader(rect));
  }

  @override
  bool shouldRepaint(_Shine oldDelegate) => oldDelegate.progress != progress;
}

 
/// Compact, readable first-screen hero shared by the two Android previews.
/// Artwork is a lightweight *vector illustration*, not a claimed 3D model.
class PipPipHero extends StatelessWidget {
  const PipPipHero({
    super.key,
    required this.headline,
    required this.vehicle,
    this.eyebrow = 'PIP PIP · YOUR CITY, YOUR WAY',
    this.description = 'A better journey starts here.',
    this.pink = false,
  });
  final String headline, eyebrow, description, vehicle;
  final bool pink;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 510 &&
              MediaQuery.textScalerOf(context).scale(18) <= 25;
          final accent = pink ? CargoXColors.pink : CargoXColors.ink;
          final illustration = ExcludeSemantics(
            child: SizedBox(
              width: wide ? 260 : 134,
              height: wide ? 142 : 80,
              child: FittedBox(
                fit: BoxFit.contain,
                child: VehicleArt(kind: vehicle, pink: pink),
              ),
            ),
          );
          final copy = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(eyebrow,
                  style: TextStyle(
                      color: accent,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5)),
              const SizedBox(height: 12),
              Text(headline,
                  style: TextStyle(
                      color: CargoXColors.ink,
                      fontSize: wide ? 32 : 27,
                      height: 1.1,
                      fontWeight: FontWeight.w900)),
              const SizedBox(height: 10),
              Text(description,
                  style: const TextStyle(
                      color: Color(0xFF365D50),
                      fontSize: 13,
                      height: 1.35,
                      fontWeight: FontWeight.w500)),
            ],
          );
          return Semantics(
            container: true,
            label: '$headline. $description',
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                    color: pink
                        ? const Color(0xFFF1C6D6)
                        : const Color(0xFFC6E5DA)),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: pink
                      ? [const Color(0xFFFFF5FA), const Color(0xFFFFDFED)]
                      : [const Color(0xFFF3FFF9), const Color(0xFFBDEADD)],
                ),
                boxShadow: [
                  BoxShadow(
                      color: accent.withValues(alpha: .07),
                      offset: const Offset(0, 9),
                      blurRadius: 24),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: wide
                    ? Row(
                        children: [
                          Expanded(child: copy),
                          const SizedBox(width: 10),
                          illustration,
                        ],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Align(
                              alignment: Alignment.centerRight,
                              child: illustration),
                          const SizedBox(height: 4),
                          copy,
                        ],
                      ),
              ),
            ),
          );
        },
      );
}

/// One concise, non-alarming offline state rather than duplicate error banners.
/// This does not claim an unauthenticated local API works over mobile Internet.
class PipPipOfflineNotice extends StatelessWidget {
  const PipPipOfflineNotice({super.key, this.details});
  final String? details;

  @override
  Widget build(BuildContext context) => Semantics(
        liveRegion: true,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF8E8),
            border: Border.all(color: const Color(0xFFE6D7AD)),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.wifi_off_rounded,
                  color: Color(0xFF725B2C)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Explore offline',
                        style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: CargoXColors.ink)),
                    const SizedBox(height: 4),
                    const Text(
                        'You can view the app without a cable. Demo ride offers need a connected development server; live booking is not yet available.',
                        style: TextStyle(
                            color: CargoXColors.ink, height: 1.4)),
                    if (details != null) ...[
                      const SizedBox(height: 6),
                      Text(details!,
                          style: const TextStyle(
                              fontSize: 12, color: Color(0xFF675A41))),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      );
