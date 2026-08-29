// Proves the materials sheet actually appears and returns what the pro typed.
//
// This should have existed before anyone was asked to pay for a live test. The
// refund path was exercised three times with real money and failed three times
// on the app side — twice because a second "mark work done" route skipped the
// sheet entirely, once because the build predated the fix. None of that needed
// a payment to catch.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:tarea/widgets/materials_sheet.dart';

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
  // EasyLocalization loads its asset asynchronously, so one settle is not
  // always enough for the child to be built.
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

  testWidgets('cancel returns null; finishing returns the amount typed',
      (tester) async {
    Map<String, dynamic>? result;

    // One widget tree for both paths. A second pumpWidget re-initialises
    // EasyLocalization and races its asset load, which is a harness quirk
    // rather than anything about the sheet.
    await _pump(
      tester,
      Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () async {
                result = await showMaterialsAtFinish(context, 20);
              },
              child: const Text('finish'),
            ),
          ),
        ),
      ),
    );

    // --- cancelling must abort, so a job is never finished half-reported ---
    await tester.tap(find.text('finish'));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsOneWidget,
        reason: 'the materials sheet did not open');
    expect(find.text('20.00'), findsOneWidget,
        reason: 'the estimate should be pre-filled');

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(result, isNull, reason: 'cancel must abort finishing the job');

    // --- and the amount typed must reach the caller: this drives the refund ---
    await tester.tap(find.text('finish'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '5');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Finish job'));
    await tester.pumpAndSettle();

    expect(result, isNotNull, reason: 'the sheet returned nothing');
    expect(result!['materialsActual'], 5,
        reason: 'the typed amount must reach the caller — this is the value '
            'that drives the refund');
  });
}
