import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'theme.dart';
import 'api.dart';
import 'flavor.dart';
import 'screens/landing_screen.dart';
import 'screens/pro/pro_landing.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/verify_otp_screen.dart';
import 'screens/main_shell.dart';
import 'screens/browse_screen.dart';
import 'screens/post_job_screen.dart';
import 'screens/diagnose_screen.dart';
import 'screens/handyman_detail_screen.dart';
import 'screens/instant_quote_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/favorites_screen.dart';
import 'screens/spending_screen.dart';
import 'screens/refer_earn_screen.dart';
import 'screens/requests_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/booking_detail_screen.dart';
import 'screens/pro/pro_shell.dart';

void main() {
  appFlavor = Flavor.home;
  runApp(const TareaApp());
}

final _router = GoRouter(
  initialLocation: '/',
  redirect: (context, state) async {
    final loggedIn = (await Api.token()) != null;
    final loc = state.matchedLocation;
    if (loggedIn && (loc == '/' || loc == '/login' || loc == '/register')) return homeRoute;
    return null;
  },
  routes: [
    GoRoute(path: '/', builder: (_, __) => isPro ? const ProLanding() : const LandingScreen()),
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
    GoRoute(path: '/verify-otp', builder: (_, s) => VerifyOtpScreen(data: (s.extra as Map?)?.cast<String, dynamic>() ?? const {})),
    GoRoute(path: '/home', builder: (_, __) => const MainShell()),
    GoRoute(path: '/pro-home', builder: (_, __) => const ProShell()),
    GoRoute(path: '/browse', builder: (_, __) => const BrowseScreen()),
    GoRoute(path: '/post-job', builder: (_, s) => PostJobScreen(directed: (s.extra as Map?)?.cast<String, dynamic>())),
    GoRoute(path: '/diagnose', builder: (_, __) => const DiagnoseScreen()),
    GoRoute(path: '/instant-quote', builder: (_, __) => const InstantQuoteScreen()),
    GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
    GoRoute(path: '/favorites', builder: (_, __) => const FavoritesScreen()),
    GoRoute(path: '/spending', builder: (_, __) => const SpendingScreen()),
    GoRoute(path: '/refer-earn', builder: (_, __) => const ReferEarnScreen()),
    GoRoute(path: '/requests', builder: (_, __) => const RequestsScreen()),
    GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
    GoRoute(
      path: '/booking-detail',
      builder: (_, s) => BookingDetailScreen(booking: (s.extra as Map?)?.cast<String, dynamic>() ?? const {}),
    ),
    GoRoute(
      path: '/handyman-detail',
      builder: (_, s) => HandymanDetailScreen(pro: (s.extra as Map?)?.cast<String, dynamic>() ?? const {}),
    ),
  ],
);

class TareaApp extends StatelessWidget {
  const TareaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Tarea',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: _router,
      // Lock text to design size regardless of the phone's Text Size setting —
      // the same fix as the RN app, but native to Flutter (no scaling ever).
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.0)),
        child: child!,
      ),
    );
  }
}
