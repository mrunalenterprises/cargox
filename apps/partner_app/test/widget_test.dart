import 'package:flutter_test/flutter_test.dart';
import 'package:loadin_partner/main.dart';

void main(){
  testWidgets('renders LOADIN partner hero',(tester)async{
    await tester.pumpWidget(const LoadinPartnerApp(configured:false));
    expect(find.textContaining('LOADIN'),findsWidgets);
    expect(find.textContaining('Go Online.'),findsOneWidget);
    expect(find.text('Go Online'),findsOneWidget);
  });
}
