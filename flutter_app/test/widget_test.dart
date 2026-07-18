import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:lucy_app/main.dart';
import 'package:lucy_app/services/auth_provider.dart';

void main() {
  testWidgets('renders the LUCY login screen', (WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AuthProvider(),
        child: const LucyApp(),
      ),
    );

    expect(find.text('LUCY'), findsOneWidget);
    expect(find.text('Đăng nhập'), findsOneWidget);
  });
}
