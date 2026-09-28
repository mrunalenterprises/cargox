import 'package:flutter/material.dart';

/// Original lightweight vector artwork; no external assets or animation loops.
class VehicleArt extends StatelessWidget {
  const VehicleArt({super.key, required this.kind, this.pink = false});
  final String kind;
  final bool pink;
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: SizedBox(
            height: 90,
            width: 170,
            child: RepaintBoundary(
                child: CustomPaint(painter: _VehiclePainter(kind, pink)))),
      );
}

class _VehiclePainter extends CustomPainter {
  const _VehiclePainter(this.kind, this.pink);
  final String kind;
  final bool pink;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 180, size.height / 100);
    final body = pink ? const Color(0xFFB32B69) : const Color(0xFF14966E);
    final paint = Paint()..isAntiAlias = true;
    canvas.drawOval(const Rect.fromLTWH(20, 80, 145, 10),
        paint..color = const Color(0x183B7563));
    void wheel(double x) {
      canvas.drawCircle(
          Offset(x, 75), 13, paint..color = const Color(0xFF203C36));
      canvas.drawCircle(
          Offset(x, 75), 7, paint..color = const Color(0xFFD8EEE7));
      canvas.drawCircle(
          Offset(x, 75), 3, paint..color = const Color(0xFF527D6F));
    }

    if (kind == 'bike') {
      wheel(42);
      wheel(137);
      final frame = Path()
        ..moveTo(42, 74)
        ..lineTo(70, 48)
        ..lineTo(107, 65)
        ..lineTo(137, 74)
        ..moveTo(137, 74)
        ..lineTo(121, 33)
        ..lineTo(111, 29);
      canvas.drawPath(
          frame,
          paint
            ..color = body
            ..style = PaintingStyle.stroke
            ..strokeWidth = 7
            ..strokeCap = StrokeCap.round);
      paint.style = PaintingStyle.fill;
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              const Rect.fromLTWH(60, 38, 48, 13), const Radius.circular(6)),
          paint..color = const Color(0xFF173D31));
      canvas.drawOval(const Rect.fromLTWH(87, 46, 32, 17), paint..color = body);
      canvas.drawCircle(
          const Offset(124, 38), 5, paint..color = const Color(0xFFFFE5A4));
    } else if (kind == 'auto') {
      // Open passenger cabin and compact front fork distinguish the rickshaw.
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              const Rect.fromLTWH(34, 18, 92, 14), const Radius.circular(8)),
          paint..color = const Color(0xFF173F33));
      canvas.drawRect(const Rect.fromLTWH(37, 30, 7, 40),
          paint..color = const Color(0xFF295C49));
      canvas.drawPath(
          Path()
            ..moveTo(109, 29)
            ..lineTo(124, 31)
            ..lineTo(138, 56)
            ..lineTo(113, 54)
            ..close(),
          paint
            ..shader = const LinearGradient(
                    colors: [Color(0xFFE7FFF7), Color(0xFF7FBBA8)])
                .createShader(const Rect.fromLTWH(108, 29, 30, 26)));
      paint.shader = null;
      canvas.drawRect(const Rect.fromLTWH(109, 30, 6, 34),
          paint..color = const Color(0xFF173F33));
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              const Rect.fromLTWH(48, 48, 39, 9), const Radius.circular(4)),
          paint..color = const Color(0xFF255246));
      canvas.drawRect(const Rect.fromLTWH(48, 39, 8, 19), paint);
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              const Rect.fromLTWH(31, 60, 86, 18), const Radius.circular(7)),
          paint
            ..shader = LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [body, const Color(0xFF075942)])
                .createShader(const Rect.fromLTWH(31, 60, 86, 18)));
      paint.shader = null;
      canvas.drawPath(
          Path()
            ..moveTo(115, 52)
            ..lineTo(139, 53)
            ..quadraticBezierTo(151, 55, 152, 69)
            ..lineTo(134, 70)
            ..lineTo(115, 64)
            ..close(),
          paint..color = body);
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              const Rect.fromLTWH(32, 59, 75, 4), const Radius.circular(2)),
          paint..color = const Color(0xFFC5F1DE));
      canvas.drawRect(const Rect.fromLTWH(142, 57, 9, 6),
          paint..color = const Color(0xFFFFE5A4));
      canvas.drawLine(
          const Offset(129, 59),
          const Offset(137, 74),
          paint
            ..color = const Color(0xFF295C49)
            ..strokeWidth = 5);
      wheel(50);
      wheel(138);
    } else {
      final auto = kind == 'auto';
      final roof = Path()
        ..moveTo(40, 57)
        ..lineTo(auto ? 49 : 62, 26)
        ..quadraticBezierTo(53, 21, 75, 21)
        ..lineTo(113, 21)
        ..quadraticBezierTo(124, 22, 139, 54)
        ..close();
      canvas.drawPath(
          roof, paint..color = auto ? const Color(0xFF193F35) : body);
      canvas.drawPath(
          Path()
            ..moveTo(60, 49)
            ..lineTo(70, 28)
            ..lineTo(91, 28)
            ..lineTo(91, 49)
            ..close(),
          paint
            ..shader = const LinearGradient(
                    colors: [Color(0xFFE5FFF6), Color(0xFF7AB8AD)])
                .createShader(const Rect.fromLTWH(60, 28, 60, 22)));
      canvas.drawPath(
          Path()
            ..moveTo(97, 28)
            ..lineTo(113, 28)
            ..lineTo(128, 49)
            ..lineTo(97, 49)
            ..close(),
          paint);
      paint.shader = null;
      final shell = RRect.fromRectAndRadius(
          Rect.fromLTWH(auto ? 32 : 20, 49, auto ? 119 : 143, 29),
          const Radius.circular(10));
      canvas.drawRRect(
          shell,
          paint
            ..shader = LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [body, body, const Color(0xFF075942)])
                .createShader(const Rect.fromLTWH(20, 49, 145, 30)));
      paint.shader = null;
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              const Rect.fromLTWH(30, 52, 118, 4), const Radius.circular(3)),
          paint..color = const Color(0x70EFFFF8));
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              const Rect.fromLTWH(142, 59, 15, 7), const Radius.circular(3)),
          paint..color = const Color(0xFFFFF2C1));
      canvas.drawRect(const Rect.fromLTWH(23, 59, 6, 8),
          paint..color = const Color(0xFFEF8989));
      canvas.drawRect(const Rect.fromLTWH(102, 57, 10, 3),
          paint..color = const Color(0xFFC9F5E6));
      wheel(49);
      wheel(135);
      if (kind == 'shared') {
        canvas.drawCircle(
            const Offset(149, 23), 15, paint..color = const Color(0xFFDBEFE6));
        canvas.drawCircle(const Offset(145, 20), 4, paint..color = body);
        canvas.drawCircle(const Offset(154, 20), 4, paint);
        canvas.drawRRect(
            RRect.fromRectAndRadius(
                const Rect.fromLTWH(138, 25, 23, 7), const Radius.circular(4)),
            paint);
      }
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_VehiclePainter oldDelegate) =>
      oldDelegate.kind != kind || oldDelegate.pink != pink;
}
