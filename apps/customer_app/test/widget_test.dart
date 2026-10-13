import 'package:flutter_test/flutter_test.dart';
import 'package:loadin_customer/main.dart';

void main(){
  testWidgets('renders LOADIN customer hero',(tester)async{
    await tester.pumpWidget(const LoadinCustomerApp(configured:false));
    expect(find.text('LOADIN'),findsOneWidget);
    expect(find.textContaining('Book Fast.'),findsOneWidget);
    expect(find.text('2-Wheeler Parcel'),findsOneWidget);
  });
}
