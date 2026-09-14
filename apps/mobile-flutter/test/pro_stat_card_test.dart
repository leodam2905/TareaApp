import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tarea/widgets/pro_stat_card.dart';

/// The eye that hides a pro's earnings went missing on a real phone while the
/// code that draws it was demonstrably present and shipped. That can only be
/// layout: the card lays its artwork and its text in one Row, and the eye sits
/// at the end of an inner Row after the number. If either run of children
/// overflows, the card's ClipRRect swallows the eye silently -- no exception in
/// release, just a control that is not there.
///
/// So these pump the card at real phone widths and assert the eye is actually
/// on screen, not merely in the tree.
Widget _host(Widget child, {double width = 360}) => MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(width: width, child: child),
        ),
      ),
    );

ProStatCard _card({String value = r'$1,280', VoidCallback? onToggle}) => ProStatCard(
      index: 0,
      tint: const Color(0xFFEFFCF5),
      accent: const Color(0xFF16A34A),
      icon: Icons.attach_money,
      value: value,
      title: 'Earnings Overview',
      sub: r'$340 on the way to your bank',
      art: 'assets/images/pro-earned.png',
      masked: false,
      onToggleMask: onToggle ?? () {},
      onTap: () {},
    );

void main() {
  // No EasyLocalization.ensureInitialized(): it needs shared_preferences,
  // which has no implementation under flutter_test. The card calls .tr() only
  // for the eye's semantic label, and untranslated it returns the key -- which
  // is irrelevant to whether the icon is laid out.

  testWidgets('the eye is visible on a narrow phone', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_host(_card(), width: 320));
    await tester.pump();

    final eye = find.byIcon(Icons.visibility);
    expect(eye, findsOneWidget, reason: 'the eye must be in the tree');

    // In the tree is not the same as on screen: an overflowing Row leaves the
    // child laid out at zero width, or outside the clip.
    final box = tester.getRect(eye);
    expect(box.width, greaterThan(0), reason: 'the eye must have real width');
    expect(box.right, lessThanOrEqualTo(320 + 0.5),
        reason: 'the eye must not be pushed outside the card and clipped');
  });

  testWidgets('a long earnings figure does not push the eye out', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    // A pro with real volume. The number must shrink, not evict the control.
    await tester.pumpWidget(_host(_card(value: r'$128,450'), width: 320));
    await tester.pump();

    final eye = find.byIcon(Icons.visibility);
    expect(eye, findsOneWidget);
    expect(tester.getRect(eye).width, greaterThan(0));
  });

  testWidgets('cards without a toggle draw no eye', (tester) async {
    await tester.pumpWidget(_host(
      ProStatCard(
        index: 1,
        tint: const Color(0xFFEDF5FE),
        accent: const Color(0xFF2563EB),
        icon: Icons.check_circle,
        value: '24',
        title: 'Jobs status',
        sub: 'Jobs done',
        art: 'assets/images/pro-completed.png',
        onTap: () {},
      ),
    ));
    await tester.pump();
    expect(find.byIcon(Icons.visibility), findsNothing);
    expect(find.byIcon(Icons.visibility_off), findsNothing);
  });
}
