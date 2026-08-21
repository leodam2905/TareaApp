import 'package:flutter/widgets.dart';

/// Tells whichever tab is on screen to reload itself.
///
/// WHY THIS EXISTS
///
/// Both shells keep every tab alive inside an IndexedStack, so a tab's
/// initState runs ONCE for the life of the process. Switching tabs rebuilds
/// nothing, and `didPopNext` only fires when a pushed route pops — never when
/// you move between tabs. So a screen shows whatever it loaded the last time
/// the app genuinely started.
///
/// That stayed hidden on Android, which kills backgrounded processes readily:
/// reopening the app usually meant a fresh launch, so the list looked current.
/// iOS suspends and resumes the SAME process for days, so the tab kept serving
/// data from whenever the app last cold-started. A customer hired a pro,
/// opened My Jobs, and their own booking was not there — it existed, the list
/// was just old. Reported 2026-08-20 as "works on Android but not on iOS".
///
/// Screens compare [visible] against their own index so only the tab actually
/// on screen refetches; the other three stay idle.
class TabRefresh {
  /// Index of the tab currently on screen.
  static final ValueNotifier<int> visible = ValueNotifier<int>(0);

  /// Bumped whenever the visible tab should reload.
  static final ValueNotifier<int> tick = ValueNotifier<int>(0);

  /// A tab was selected.
  static void select(int index) {
    visible.value = index;
    tick.value++;
  }

  /// The app came back to the foreground — the iOS case above.
  static void resumed() => tick.value++;
}

/// Reloads a tab when it becomes visible, or when the app resumes while it is.
///
/// Mixed into a tab's State so each screen wires this up the same way instead
/// of remembering the rule. Implement [tabIndex] and [onTabRefresh].
mixin TabRefreshMixin<T extends StatefulWidget> on State<T> {
  int get tabIndex;
  void onTabRefresh();

  void _handle() {
    if (mounted && TabRefresh.visible.value == tabIndex) onTabRefresh();
  }

  @override
  void initState() {
    super.initState();
    TabRefresh.tick.addListener(_handle);
  }

  @override
  void dispose() {
    TabRefresh.tick.removeListener(_handle);
    super.dispose();
  }
}
