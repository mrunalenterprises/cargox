import 'package:flutter/material.dart';

class CargoXColors {
  static const primary = Color(0xFF59BAA1);
  static const softMint = Color(0xFFB4DACF);
  static const aqua = Color(0xFF5AC0A5);
  static const deep = Color(0xFF0E885A);
  static const offWhite = Color(0xFFECEDED);
  static const pink = Color(0xFFC94782);
}

ThemeData cargoxTheme() => ThemeData(
  useMaterial3: true,
  scaffoldBackgroundColor: const Color(0xFFF4FAF8),
  colorScheme: ColorScheme.fromSeed(
    seedColor: CargoXColors.primary,
    primary: CargoXColors.deep,
    secondary: CargoXColors.aqua,
    surface: Colors.white,
    brightness: Brightness.light,
  ),
  appBarTheme: const AppBarTheme(backgroundColor: Color(0xFFF4FAF8)),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 15),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
  ),
);

class CargoXServiceCard extends StatefulWidget {
  const CargoXServiceCard({
    super.key,
    required this.label,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    this.enabled = true,
    this.selected = false,
    this.pink = false,
  });
  final String label, subtitle;
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
    final reduced = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final accent = widget.pink ? CargoXColors.pink : CargoXColors.deep;
    return Semantics(
      button: true,
      enabled: widget.enabled,
      label: widget.label + '. ' + widget.subtitle + '. ' +
          (widget.enabled ? 'Available in demo' : 'Coming soon'),
      selected: widget.selected,
      child: Opacity(
        opacity: widget.enabled ? 1.0 : 0.54,
        child: AnimatedScale(
          duration: reduced ? Duration.zero : const Duration(milliseconds: 170),
          curve: Curves.easeOutCubic,
          scale: pressing && widget.enabled ? 0.975 : 1.0,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: widget.enabled ? (_) => setState(() => pressing = true) : null,
            onTapCancel: widget.enabled ? () => setState(() => pressing = false) : null,
            onTapUp: widget.enabled ? (_) => setState(() => pressing = false) : null,
            onTap: widget.enabled ? widget.onTap : null,
            child: AnimatedContainer(
              duration: reduced ? Duration.zero : const Duration(milliseconds: 205),
              curve: Curves.easeOutCubic,
              constraints: const BoxConstraints(minHeight: 155),
              padding: const EdgeInsets.all(17),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: widget.pink
                      ? [Colors.white, const Color(0xFFFFE9F3)]
                      : widget.selected
                          ? [Colors.white, const Color(0xFFB4E9D8)]
                          : [Colors.white, const Color(0xFFE1F6EC)],
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color: widget.selected ? accent : const Color(0xFFD6EDE2),
                    width: widget.selected ? 2 : 1),
                boxShadow: [
                  BoxShadow(color: CargoXColors.deep.withOpacity(.12),
                      blurRadius: widget.selected ? 22 : 14,
                      offset: const Offset(0, 7))
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Align(alignment: Alignment.centerRight,
                      child: Icon(widget.icon, size: 44, color: accent)),
                  const SizedBox(height: 16),
                  Text(widget.label, style: const TextStyle(fontSize: 19,
                      fontWeight: FontWeight.w800, letterSpacing: -.5)),
                  const SizedBox(height: 3),
                  Text(widget.subtitle, style: const TextStyle(fontSize: 12,
                      color: Color(0xFF628477))),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
