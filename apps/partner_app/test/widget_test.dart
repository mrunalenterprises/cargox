import 'package:flutter_test/flutter_test.dart';
import 'package:loadin_partner/main.dart';

void main() {
  testWidgets('renders LOADIN partner home', (tester) async {
    await tester.pumpWidget(const LoadinPartnerApp(configured: false));
    await tester.pump();

    expect(find.byType(LoadinPartnerLogo), findsOneWidget);
    expect(find.byType(PartnerHome), findsOneWidget);
    expect(find.text('Go Online'), findsOneWidget);
  });
}
