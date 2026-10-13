import 'package:flutter_test/flutter_test.dart';
import 'package:loadin_customer/main.dart';

void main() {
  testWidgets('renders LOADIN customer home', (tester) async {
    await tester.pumpWidget(const LoadinCustomerApp(configured: false));
    await tester.pump();

    expect(find.byType(LoadinLogo), findsOneWidget);
    expect(find.text('Book Fast.\nTrack Live.\nMove Easy.'), findsOneWidget);
    expect(find.text('2-Wheeler Parcel'), findsOneWidget);
    expect(find.text('Loading Vehicle'), findsOneWidget);
  });
}
