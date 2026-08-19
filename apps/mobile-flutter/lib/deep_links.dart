import 'dart:async';

import 'package:app_links/app_links.dart';

import 'main.dart' show appRouter;

/// Routes incoming `tarea://app/...` and `tareapro://app/...` links.
///
/// Stripe will not redirect to a custom scheme, so payout onboarding returns
/// through `/stripe/return` on the website, which forwards here. Without this
/// the pro finished onboarding in the browser and was left on the web
/// dashboard with no way back into the app.
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

  /// `scheme://app/pro/payout-methods?stripe=connected` — the host is always a
  /// fixed "app", so the route go_router wants is just the path plus query.
  static void _handle(Uri uri) {
    final path = uri.path;
    if (path.isEmpty || path == '/') return;
    final query = uri.query.isEmpty ? '' : '?${uri.query}';
    appRouter.go('$path$query');
  }
}
