import 'dart:async';

import 'package:app_links/app_links.dart';

import 'main.dart' show appRouter;

/// Routes links that arrive from outside the app.
///
/// TWO SHAPES ARRIVE HERE, AND THEY ARE NOT THE SAME
///
/// 1. Our own scheme — `tarea://app/...`, `tareapro://app/...`. Stripe will not
///    redirect to a custom scheme, so payout onboarding and checkout return
///    through `/stripe/return` on the website, which forwards to one of these.
///    The path after the fixed `app` host is already an in-app route.
///
/// 2. Universal / App Links — `https://taptarea.com/customer/bookings`. Every
///    notification email and SMS carries one of these (see notify.ts,
///    ctaForType), and with the AASA and assetlinks.json in place the OS hands
///    them to us instead of opening a browser. These are WEB paths, and the app
///    has no route by those names — passing one straight to go_router opens the
///    app on nothing, which is barely better than the browser. They are mapped
///    below.
class DeepLinks {
  static StreamSubscription<Uri>? _sub;

  static Future<void> start() async {
    final links = AppLinks();
    // A link that launched the app from cold arrives here, not on the stream.
    try {
      final initial = await links.getInitialLink();
      if (initial != null) _handle(initial);
    } catch (_) {
      // A malformed launch URI must not take the app down on startup.
    }
    _sub ??= links.uriLinkStream.listen(_handle, onError: (_) {});
  }

  static void _handle(Uri uri) {
    final route = uri.scheme == 'https' ? _fromWeb(uri) : _fromScheme(uri);
    if (route == null || route.isEmpty) return;
    appRouter.go(route);
  }

  /// `scheme://app/pro/payout-methods?stripe=connected` — the host is always a
  /// fixed "app", so the route go_router wants is just the path plus query.
  static String? _fromScheme(Uri uri) {
    final path = uri.path;
    if (path.isEmpty || path == '/') return null;
    final query = uri.query.isEmpty ? '' : '?${uri.query}';
    return '$path$query';
  }

  /// Maps a website path to the nearest app route.
  ///
  /// Deliberately conservative: anything unrecognised lands on the home shell
  /// rather than nowhere. Opening the app at the wrong tab is recoverable;
  /// opening it at a blank route is not.
  ///
  /// Screens that need a record fetch it themselves from an id in the query, so
  /// these routes only have to carry the id — booking-detail already works this
  /// way for the Stripe return.
  static String? _fromWeb(Uri uri) {
    final seg = uri.pathSegments;
    if (seg.isEmpty) return null;

    // /chat/<id>
    if (seg.first == 'chat') return '/home';

    if (seg.first == 'customer') {
      if (seg.length >= 3 && seg[1] == 'bookings') {
        // /customer/bookings/<id>[/review|/invoice]
        return '/booking-detail?bookingId=${seg[2]}';
      }
      if (seg.length >= 2 && seg[1] == 'requests') return '/requests';
      // /customer/bookings and anything else customer-side
      return '/home';
    }

    if (seg.first == 'handyman') {
      if (seg.length >= 2 && seg[1] == 'payout-methods') return '/pro/payout-methods';
      if (seg.length >= 2 && seg[1] == 'onboarding') return '/pro/background-check';
      // jobs, earnings, profile — all tabs of the pro shell.
      return '/pro-home';
    }

    return null;
  }
}
