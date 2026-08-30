// Proves a pro can change their own rate, and that the sheet cannot hand back
// a rate that would break pricing.
//
// The rate is now the single input the whole price is built from — labour,
// extra time, the invoice — so a sheet that returns 0, a negative, or the
// user's typo silently misprices every job that follows. Cheaper to catch here
// than after a booking is charged.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:tarea/widgets/rate_sheet.dart';

Future<void> _pump(WidgetTester tester, Widget child) async {
  await tester.pumpWidget(
    EasyLocalization(
      supportedLocales: const [Locale('en')],
      path: 'assets/translations',
      fallbackLocale: const Locale('en'),
      useOnlyLangCode: true,
      child: Builder(
        builder: (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: child,
        ),
      ),
    ),
  );
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    // EasyLocalization reaches for shared_preferences, which has no
    // implementation in a widget test. Answer the channel so initialisation
    // gets past it — the sheet under test does not care what it returns.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/shared_preferences'),
      (call) async => call.method == 'getAll' ? <String, Object>{} : null,
    );
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('pre-fills, cancels clean, and refuses anything that is not a rate',
      (tester) async {
    RateEdit? result;
    num? startingRate = 95;
    String category = 'Electrical';

    // One widget tree for every path. A second pumpWidget re-initialises
    // EasyLocalization and races its asset load — a harness quirk, not
    // anything about the sheet.
    await _pump(
      tester,
      Scaffold(
        body: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              result = await showEditRateSheet(context,
                  categoryLabel: category, currentRate: startingRate);
            },
            child: const Text('open'),
          ),
        ),
      ),
    );

    // --- pre-filled, and cancelling changes nothing ---
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    // The category is named, so a pro editing one of several knows which.
    expect(find.text('Electrical'), findsOneWidget);
    // Pre-filled: nudging 95 to 105 should not mean retyping it.
    expect(find.widgetWithText(TextField, '95'), findsOneWidget);

    Navigator.of(tester.element(find.byType(TextField))).pop();
    await tester.pumpAndSettle();
    expect(result, isNull, reason: 'cancelling must not change the rate');

    // --- a pro who has never set a rate gets an empty box, not a zero ---
    startingRate = null;
    category = 'Plumbing';
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Plumbing'), findsOneWidget);
    expect(find.widgetWithText(TextField, '0'), findsNothing);

    // Zero must not save: a $0 rate is not a cheap pro, it is every future job
    // priced at the floor with no way to tell why.
    await tester.enterText(find.byType(TextField), '0');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(result, isNull, reason: 'zero is not a rate');

    // Neither must text.
    await tester.enterText(find.byType(TextField), 'abc');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(result, isNull, reason: 'unparseable input is not a rate');

    // A real rate comes back as a number the caller can PATCH.
    await tester.enterText(find.byType(TextField), '110');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(result?.hourlyRate, 110.0);
    // Defaults to an hour: the pro is choosing it, but a sane default matters
    // because most will not touch it.
    expect(result?.minimumMinutes, 60);
  });
}
