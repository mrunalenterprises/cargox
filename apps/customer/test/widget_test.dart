import 'package:cargox_customer/main.dart';
import 'package:cargox_ui/cargox_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('customer exposes service gates and daily entry', (tester) async {
    await tester.pumpWidget(MaterialApp(theme: cargoxTheme(), home: const CustomerHome()));
    expect(find.text('Bike'), findsOneWidget);
    expect(find.text('Auto'), findsOneWidget);
    expect(find.text('Coming soon'), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}
