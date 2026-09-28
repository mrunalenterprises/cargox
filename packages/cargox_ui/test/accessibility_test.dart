import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cargox_ui/cargox_ui.dart';

void main() {
  testWidgets('vehicle card supports keyboard activation', (tester) async {
    var taps = 0;
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: CargoXServiceCard(
                label: 'Auto',
                subtitle: 'Local demo',
                vehicle: 'auto',
                icon: Icons.local_taxi,
                onTap: () => taps++))));
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();
    expect(taps, 1);
  });
  testWidgets('OS reduced motion removes card animation and route transition',
      (tester) async {
    late BuildContext pageContext;
    await tester.pumpWidget(MaterialApp(
        home: MediaQuery(
            data: const MediaQueryData(disableAnimations: true),
            child: Builder(builder: (context) {
              pageContext = context;
              return Scaffold(
                  body: CargoXServiceCard(
                      label: 'Car',
                      subtitle: 'Demo',
                      vehicle: 'car',
                      icon: Icons.local_taxi,
                      onTap: () {}));
            }))));
    expect(tester.widget<AnimatedScale>(find.byType(AnimatedScale)).duration,
        Duration.zero);
    openCargoX(pageContext, const Scaffold(body: Text('Next screen')));
    await tester.pumpAndSettle();
    final route =
        ModalRoute.of(tester.element(find.text('Next screen'))) as PageRoute;
    expect(route.transitionDuration, Duration.zero);
  });
  testWidgets('large text vehicle cards retain usable labels and hit target',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
        home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(2)),
            child: Scaffold(
                body: SingleChildScrollView(
                    child: SizedBox(
                        width: 320,
                        child: CargoXServiceCard(
                            label: 'Shared Car',
                            subtitle: 'Coming soon · View details',
                            vehicle: 'shared',
                            icon: Icons.groups,
                            onTap: () {})))))));
    expect(find.text('Shared Car'), findsOneWidget);
    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.byType(InkWell)).height, greaterThan(48));
  });
}
