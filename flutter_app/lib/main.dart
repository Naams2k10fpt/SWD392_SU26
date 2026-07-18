import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucy_app/services/auth_provider.dart';
import 'package:lucy_app/screens/login_screen.dart';
import 'package:lucy_app/screens/register_screen.dart';
import 'package:lucy_app/screens/home_screen.dart';
import 'package:lucy_app/screens/room_screen.dart';
import 'package:lucy_app/screens/wallet_screen.dart';
import 'package:lucy_app/screens/gift_screen.dart';
import 'package:lucy_app/screens/podcast_screen.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => AuthProvider()..loadToken(),
      child: const LucyApp(),
    ),
  );
}

class LucyApp extends StatelessWidget {
  const LucyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LUCY',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF6C63FF),
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: const Color(0xFF6C63FF),
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      themeMode: ThemeMode.system,
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/home': (context) => const HomeScreen(),
        '/room': (context) => const RoomScreen(),
        '/wallet': (context) => const WalletScreen(),
        '/gift': (context) => const GiftScreen(),
        '/podcast': (context) => const PodcastScreen(),
      },
    );
  }
}
