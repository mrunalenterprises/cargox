import 'package:cargox_partner/main.dart';
import 'package:cargox_ui/cargox_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('partner exposes local demo boundary', (tester) async {
    await tester.pumpWidget(MaterialApp(theme: cargoxTheme(), home: const PartnerHome()));
    await tester.pumpAndSettle();
    expect(find.text('CargoX Partner'), findsOneWidget);
    expect(find.text('Demo Partner'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
