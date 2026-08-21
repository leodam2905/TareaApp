import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'theme.dart';
import 'api.dart';
import 'flavor.dart';
import 'payment_method.dart';
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
import 'screens/track_pro_screen.dart';
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
  // Stripe only needs the publishable key; the sheet is rendered by Stripe's
  // own SDK so card details never enter this app.
  Stripe.publishableKey = stripePublishableKey;
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
      // Also reachable by deep link after paying, which carries only an id in
      // the query string — the screen fetches the rest itself.
      builder: (_, s) => BookingDetailScreen(
        booking: (s.extra as Map?)?.cast<String, dynamic>() ??
            {
              if ((s.uri.queryParameters['bookingId'] ?? '').isNotEmpty)
                'id': s.uri.queryParameters['bookingId'],
            },
      ),
    ),
    GoRoute(
      path: '/track-pro',
      builder: (_, s) => TrackProScreen(booking: (s.extra as Map?)?.cast<String, dynamic>() ?? const {}),
    ),
    GoRoute(
      path: '/handyman-detail',
      builder: (_, s) => HandymanDetailScreen(pro: (s.extra as Map?)?.cast<String, dynamic>() ?? const {}),
    ),
  ],
);

/// App-wide text size, per platform.
///
/// 1.0 was the design size. Raising it to 1.12 (887f847, shipped in 1.0.16)
/// made everything read one notch larger "without re-laying-out a single
/// screen" — which held on Android and broke iOS, because the two are not
/// rendering the same typeface.
///
/// theme.dart asks for '.SF Pro Text'. That family exists only on iOS; Android
/// silently falls back to Roboto, which is narrower at the same size and
/// heavier weights. So the layouts were in practice validated against Roboto,
/// and the extra 12% pushed the wider SF Pro past the edge on iOS alone:
/// "Landscaping" broke mid-word, the tab bar wrapped "Messages" to two lines,
/// the stepper split "Schedule", and the completeness ring overflowed its
/// circle. Android showed none of it.
///
/// Each platform therefore keeps the value it is known good at: iOS shipped at
/// 1.0 from 1.0.3 through 1.0.15 without complaint, and Android is fine at
/// 1.12 today. Raising iOS needs the tight rows fixed first — auto_size_text
/// is already a dependency and is not yet used anywhere.
final double _kTextScale = Platform.isIOS ? 1.0 : 1.12;

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
      // Tapping outside a field dismisses the keyboard, everywhere.
      //
      // iOS has no back button, and TextInputType.number puts up a number pad
      // with no return or Done key — so a field like the Post a Job ZIP code
      // trapped the user completely: keyboard up, nothing to press, no way
      // forward. Android hid the bug because its back button always dismisses.
      // Eight screens use numeric keyboards, payout methods (routing and
      // account number) among them, so this belongs here once rather than
      // being remembered per screen.
      //
      // translucent, and unfocus only: taps still reach the widgets underneath,
      // so buttons and fields behave exactly as before.
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(_kTextScale)),
        child: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          child: child!,
        ),
      ),
    );
  }
}
