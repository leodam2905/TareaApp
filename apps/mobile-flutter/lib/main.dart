import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'theme.dart';
import 'api.dart';
import 'flavor.dart';
import 'deep_links.dart';
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
import 'screens/pro/pro_background_check.dart';
import 'screens/pro/pro_reviews.dart';
import 'screens/pro/pro_job_detail.dart';
import 'screens/pro/pro_payout_methods.dart';
import 'incoming_job.dart';
import 'push_service.dart';

// Shared entry point for both flavors. Sets up localization (EasyLocalization
// must wrap MaterialApp) then boots the app; push init stays non-blocking.
/// How long the launch screen stays up, for both apps.
///
/// It is a MINIMUM, not a sleep: the clock starts at launch and only the
/// remainder is waited out, so startup work counts towards the three seconds
/// rather than being added on top. On a slow device that finishes init in 2.5s
/// the splash holds 0.5s longer; on one that takes 4s it is already past and
/// nothing is added.
const _kSplashMinimum = Duration(seconds: 3);

Future<void> bootstrap(Flavor flavor) async {
  final launchedAt = DateTime.now();
  appFlavor = flavor;
  final binding = WidgetsFlutterBinding.ensureInitialized();
  // Without this the native splash is torn down the moment the first Flutter
  // frame renders, so it flashed for whatever startup happened to take.
  FlutterNativeSplash.preserve(widgetsBinding: binding);
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
  // Hold the launch screen out to the minimum, then hand over to the app.
  final remaining = _kSplashMinimum - DateTime.now().difference(launchedAt);
  if (remaining > Duration.zero) await Future.delayed(remaining);
  FlutterNativeSplash.remove();

  // Listen for deep links back from the browser (Stripe payout onboarding).
  DeepLinks.start();

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
    GoRoute(path: '/pro/background-check', builder: (_, __) => const ProBackgroundCheck()),
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

/// App-wide text size. 1.0 was the design size; everything reads one notch
/// larger at 1.12 without re-laying-out a single screen.
const double _kTextScale = 1.12;

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
      // Text is pinned to one size for everyone, so the phone's Text Size
      // setting can't blow the layouts apart (the same fix as the RN app). That
      // pin was 1.0, which read as small on a phone held at arm's length while
      // somebody is standing in a customer's kitchen — so the pin moved up
      // rather than editing hundreds of individual fontSize values, which would
      // drift apart the moment anyone added a screen.
      //
      // Raise this cautiously: every point of scale is a point of overflow risk
      // in tight rows, and Arabic and French already run longer than English.
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(_kTextScale)),
        child: child!,
      ),
    );
  }
}
