import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cargox_ui/cargox_ui.dart';

void main() {
  test('PIP PIP design tokens preserve approved mint palette', () {
    expect(CargoXColors.primary, const Color(0xFF59BAA1));
    expect(CargoXColors.deep, const Color(0xFF0E885A));
  });
  test('PIP PIP product constants stay aligned', () {
    expect(PipPipBrand.name, 'PIP PIP');
    expect(PipPipBrand.company, 'Mrunal Technologies');
  });

  testWidgets('enabled glossy card responds to a tap', (tester) async {
    var presses = 0;
    await tester.pumpWidget(MaterialApp(
      theme: cargoxTheme(),
      home: Scaffold(
        body: Center(
            child: SizedBox(
                width: 190,
                child: CargoXServiceCard(
                  label: 'Auto',
                  subtitle: 'Demo available',
                  icon: Icons.electric_rickshaw,
                  onTap: () => presses++,
                ))),
      ),
    ));
    expect(find.text('Auto'), findsOneWidget);
    await tester.tap(find.text('Auto'));
    await tester.pumpAndSettle();
    expect(presses, 1);
  });

  testWidgets('Coming Soon card is disabled and does not dispatch',
      (tester) async {
    var presses = 0;
    await tester.pumpWidget(MaterialApp(
      theme: cargoxTheme(),
      home: Scaffold(
        body: Center(
            child: SizedBox(
                width: 190,
                child: CargoXServiceCard(
                  label: 'Bike',
                  subtitle: 'Coming soon',
                  enabled: false,
                  icon: Icons.two_wheeler,
                  onTap: () => presses++,
                ))),
      ),
    ));
    await tester.tap(find.text('Bike'), warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(presses, 0);
  });

  testWidgets('reduced motion still exposes card and supports selection',
      (tester) async {
    var presses = 0;
    await tester.pumpWidget(MaterialApp(
      theme: cargoxTheme(),
      home: MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: Scaffold(
          body: Center(
              child: SizedBox(
                  width: 190,
                  child: CargoXServiceCard(
                    label: 'Car',
                    subtitle: 'Demo available',
                    selected: true,
                    icon: Icons.local_taxi,
                    onTap: () => presses++,
                  ))),
        ),
      ),
    ));
    expect(find.text('Car'), findsOneWidget);
    await tester.tap(find.text('Car'));
    await tester.pumpAndSettle();
    expect(presses, 1);
  });
}
