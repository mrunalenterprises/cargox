import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cargox_customer/main.dart';
import 'package:cargox_customer/booking.dart';
import 'package:cargox_ui/cargox_ui.dart';
import '../test/widget_test.dart' show FakeApi;

// Explicit optional Windows render task; not an automated golden assertion.
void main() {
  testWidgets('render original Customer UI for visual inspection',
      (tester) async {
    final fonts = Directory('${Platform.environment['WINDIR']}/Fonts');
    final font = File('${fonts.path}/segoeui.ttf');
    final loader = FontLoader('Roboto')
      ..addFont(Future.value(ByteData.sublistView(font.readAsBytesSync())));
    await tester.runAsync(() => loader.load());
    final icons = FontLoader('MaterialIcons')
      ..addFont(Future.value(ByteData.sublistView(
          File('build/unit_test_assets/fonts/MaterialIcons-Regular.otf')
              .readAsBytesSync())));
    await tester.runAsync(() => icons.load());
    tester.view.physicalSize = const Size(430, 932);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = FakeApi();
    for (final entry in <String, Widget>{
      'customer-home': CustomerHome(api: api),
      'customer-quote': QuotePage(
          api: api,
          payload: const {'service': 'car', 'pickup': 'Home', 'drop': 'Office'},
          quote: const {
            'farePaise': 19200,
            'platformCommissionPaise': 4800,
            'distanceKm': 8,
            'pricingVersion': 'DEMO-1',
            'note': 'Illustrative distance. No payment.'
          },
          pink: true),
    }.entries) {
      final key = GlobalKey();
      await tester.pumpWidget(RepaintBoundary(
          key: key,
          child: MaterialApp(
              theme: cargoxTheme(),
              debugShowCheckedModeBanner: false,
              home: entry.value)));
      await tester.pumpAndSettle();
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final image = await boundary.toImage(pixelRatio: 2);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        final out = File('../../.artifacts/${entry.key}.png');
        await out.parent.create(recursive: true);
        await out.writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    }
  });
}
