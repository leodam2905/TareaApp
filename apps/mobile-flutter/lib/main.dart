import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import 'theme.dart';
import 'api.dart';
import 'flavor.dart';
import 'route_observer.dart';
import 'screens/disputes_screen.dart';
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
import 'screens/request_detail_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/booking_detail_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/edit_profile_screen.dart';
import 'screens/pro/pro_shell.dart';
import 'screens/pro/pro_edit_profile.dart';
import 'screens/pro/pro_edit_services.dart';
import 'screens/pro/pro_service_area.dart';
import 'screens/pro/pro_portfolio.dart';
import 'screens/pro/pro_certifications.dart';
import 'screens/pro/pro_ica.dart';
import 'screens/pro/pro_reviews.dart';
import 'screens/pro/pro_job_detail.dart';
import 'screens/pro/pro_payout_methods.dart';
import 'incoming_job.dart';
import 'push_service.dart';

// Shared entry point for both flavors. Sets up localization (EasyLocalization
// must wrap MaterialApp) then boots the app; push init stays non-blocking.
Future<void> bootstrap(Flavor flavor) async {
  appFlavor = flavor;
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();
  runApp(
    EasyLocalization(
      supportedLocales: const [Locale('en'), Locale('fr'), Locale('es'), Locale('ar')],
      path: 'assets/translations',
      fallbackLocale: const Locale('en'),
      useOnlyLangCode: true,
      child: const TareaApp(),
    ),
  );
  // Init push AFTER the first frame so a slow/failed Firebase init on any
  // platform can never block the UI from rendering (white screen).
  PushService.initFirebase().then((_) => PushService.registerToken());
}

void main() => bootstrap(Flavor.home);

final appRouter = GoRouter(
  initialLocation: '/',
  observers: [routeObserver],
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
    GoRoute(path: '/disputes', builder: (_, __) => const DisputesScreen()),
    GoRoute(path: '/request-detail', builder: (_, s) => RequestDetailScreen(request: (s.extra as Map?)?.cast<String, dynamic>() ?? const {})),
    GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
    GoRoute(path: '/chat', builder: (_, s) => ChatScreen(data: (s.extra as Map?)?.cast<String, dynamic>() ?? const {})),
    GoRoute(path: '/edit-profile', builder: (_, __) => const EditProfileScreen()),
    GoRoute(path: '/pro/edit-profile', builder: (_, __) => const ProEditProfile()),
    GoRoute(path: '/pro/services', builder: (_, __) => const ProEditServices()),
    GoRoute(path: '/pro/service-area', builder: (_, __) => const ProServiceArea()),
    GoRoute(path: '/pro/portfolio', builder: (_, __) => const ProPortfolio()),
    GoRoute(path: '/pro/certifications', builder: (_, __) => const ProCertifications()),
    GoRoute(path: '/pro/ica', builder: (_, __) => const ProIca()),
    GoRoute(path: '/pro/reviews', builder: (_, __) => const ProReviews()),
    GoRoute(path: '/pro/job-detail', builder: (_, s) => ProJobDetail(booking: (s.extra as Map?)?.cast<String, dynamic>() ?? const {})),
    GoRoute(path: '/pro/payout-methods', builder: (_, __) => const ProPayoutMethods()),
    GoRoute(
      path: '/pro/incoming',
      builder: (_, s) => IncomingJobScreen(data: (s.extra as Map?)?.cast<String, dynamic>() ?? const {}),
    ),
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
      // Re-key on locale so a language change fully rebuilds the routed pages
      // and flips text direction for Arabic — go_router otherwise caches pages
      // and the new language wouldn't show until you navigated.
      key: ValueKey(context.locale.toString()),
      title: 'Tarea',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: appRouter,
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      // Lock text to design size regardless of the phone's Text Size setting —
      // the same fix as the RN app, but native to Flutter (no scaling ever).
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.0)),
        child: child!,
      ),
    );
  }
}
