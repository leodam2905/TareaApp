// Captures App Store screenshots from the REAL app against the live API.
//
// Apple rejected 1.0.21 under Guideline 2.3.3 because the store screenshots no
// longer matched the app. They also noted splash and login screens "are
// generally not considered to show the app in use", so this skips those and
// captures the working product: an AI estimate, matched pros, jobs, spending.
//
//   flutter drive --driver test_driver/screenshots.dart \
//     --target integration_test/screenshots_test.dart -d <simulator-id>
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:tarea/main.dart' as app;
import 'package:tarea/flavor.dart';

/// pumpAndSettle throws if anything animates forever — a pulsing "searching"
/// indicator, a shimmer placeholder. Screens here legitimately have those, so
/// settle when we can and fall back to timed pumps when we cannot.
Future<void> rest(WidgetTester tester, {int seconds = 4}) async {
  try {
    await tester.pumpAndSettle(const Duration(milliseconds: 300));
  } catch (_) {}
  for (var i = 0; i < seconds * 2; i++) {
    await tester.pump(const Duration(milliseconds: 500));
  }
}

/// Hands off to the host to take the screenshot, and waits for it.
///
/// integration_test's own takeScreenshot is unusable here: on iOS it returns a
/// stale frame, and the driver callbacks do not run until the test finishes, so
/// every capture ended up showing the LAST screen. A marker file in the app's
/// own tmp directory is visible to the host through `simctl get_app_container`,
/// which gives a real handshake — the app holds still on the right screen until
/// the host confirms it has the pixels.
Future<void> _capture(WidgetTester tester, String name) async {
  final tmp = Directory.systemTemp;
  File('${tmp.path}/shot-$name').writeAsStringSync('1');
  final done = File('${tmp.path}/done-$name');
  for (var i = 0; i < 60; i++) {
    if (done.existsSync()) return;
    await tester.pump(const Duration(milliseconds: 250));
    await Future<void>.delayed(const Duration(milliseconds: 250));
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('capture store screenshots', (tester) async {
    await app.bootstrap(Flavor.home);
    await rest(tester, seconds: 6);

    // appRouter is a top-level in main.dart, so navigation needs no context —
    // which matters because the widget tree is not reliably queryable until
    // EasyLocalization and the splash hand over.
    app.appRouter.go('/login');
    await rest(tester, seconds: 3);

    final fields = find.byType(TextField);
    if (fields.evaluate().length >= 2) {
      await tester.enterText(fields.at(0), 'reviewer@taptarea.com');
      await rest(tester, seconds: 1);
      await tester.enterText(fields.at(1), 'Review123!');
      await rest(tester, seconds: 1);
      final filled = find.byType(FilledButton);
      final elevated = find.byType(ElevatedButton);
      if (filled.evaluate().isNotEmpty) {
        await tester.tap(filled.first, warnIfMissed: false);
      } else if (elevated.evaluate().isNotEmpty) {
        await tester.tap(elevated.first, warnIfMissed: false);
      }
      await rest(tester, seconds: 8);
    }

    for (final shot in const [
      ('01-home', '/home'),
      ('02-diagnose', '/diagnose'),
      ('03-instant-quote', '/instant-quote'),
      ('04-browse', '/browse'),
      ('05-my-jobs', '/requests'),
      ('06-spending', '/spending'),
      ('07-refer-earn', '/refer-earn'),
    ]) {
      app.appRouter.go(shot.$2);
      // Generous: these fetch from the live API, and a screenshot of a spinner
      // is worse than no screenshot at all.
      await rest(tester, seconds: 6);
      await _capture(tester, shot.$1);
    }
  });
}
