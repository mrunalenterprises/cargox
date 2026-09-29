import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cargox_staging/cargox_staging.dart';
import 'package:cargox_ui/cargox_ui.dart';

class FixtureCatalog implements StagingCatalogReader {
  FixtureCatalog({this.fail = false, this.rows = const []});
  final bool fail;
  final List<PipPipStagingService> rows;
  @override
  Future<List<PipPipStagingService>> availableServices() async {
    if (fail) throw const StagingCatalogUnavailable();
    return rows;
  }
}

void main() {
  testWidgets('offline-safe pilot shows verified connection with no approved rides',
      (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(
      theme: cargoxTheme(),
      home: PipPipOnlinePage(catalog: FixtureCatalog()),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Staging connection successful'), findsOneWidget);
    expect(find.textContaining('No approved services'), findsOneWidget);
    expect(find.textContaining('No live ride request'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('pilot displays only actual approved rows from server',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: PipPipOnlinePage(
        forPartner: true,
        catalog: FixtureCatalog(rows: const [
          PipPipStagingService(
            city: 'Fixture City', timezone: 'Asia/Kolkata', service: 'auto',
          )
        ]),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('PIP PIP Partner Online'), findsOneWidget);
    expect(find.text('AUTO'), findsOneWidget);
    expect(find.textContaining('Fixture City'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('network failures cannot be mistaken for enabled service',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: PipPipOnlinePage(catalog: FixtureCatalog(fail: true)),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Online pilot unavailable'), findsOneWidget);
    expect(find.text('Staging connection successful'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
