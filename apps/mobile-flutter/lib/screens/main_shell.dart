import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../tab_refresh.dart';
import 'dashboard_screen.dart';
import 'my_jobs_screen.dart';
import 'messages_screen.dart';
import 'requests_screen.dart';

/// Two lines at fontSize 11, height 1.15, plus a hair of slack.
const double _kLabelHeight = 27;

/// Break a label at its last space so it renders on two lines.
String _twoLine(String s) {
  final i = s.lastIndexOf(' ');
  return i <= 0 ? s : '${s.substring(0, i)}\n${s.substring(i + 1)}';
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});
  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> with WidgetsBindingObserver {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // iOS resumes the same process for days, so without this the visible tab
  // keeps showing whatever it loaded at the last cold start.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) TabRefresh.resumed();
  }


  static const _tabs = [
    DashboardScreen(),
    MyJobsScreen(),
    MessagesScreen(),
    RequestsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Allowed through only on the first tab; anywhere else the pop is
      // intercepted and turned into a tab change.
      canPop: _index == 0,
      onPopInvokedWithResult: _handleBack,
      child: Scaffold(
        backgroundColor: C.white,
        body: IndexedStack(index: _index, children: _tabs),
        bottomNavigationBar: _nav(),
      ),
    );
  }

  /// Android's back button, on a tabbed shell.
  ///
  /// Tabs are an IndexedStack, not routes -- switching one never pushes
  /// anything, so at the root route the system back had nothing to pop and
  /// closed the app instead. Back now returns to the first tab, and only
  /// leaves once you are already on it, which is what every other tabbed app
  /// on the platform does.
  void _handleBack(bool didPop, Object? result) {
    if (didPop) return;
    if (_index != 0) {
      setState(() => _index = 0);
      TabRefresh.select(0);
    }
  }


  Widget _navItem(IconData icon, String label, int i) {
    final active = _index == i;
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () { setState(() => _index = i); TabRefresh.select(i); },
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: active ? C.blue : C.muted, size: 24),
            const SizedBox(height: 2),
            // Two lines' worth of room for every tab, whether it uses it or
            // not: "My Requests" needs the second line, and reserving the
            // space for all five keeps the icons on one baseline instead of
            // letting the long label shove its own icon upward.
            SizedBox(
              height: _kLabelHeight,
              child: Text(label,
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 11,
                      height: 1.15,
                      color: active ? C.blue : C.muted,
                      fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _nav() {
    return Container(
      decoration: const BoxDecoration(color: C.white, border: Border(top: BorderSide(color: C.line))),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              _navItem(Icons.home_filled, 'nav.home'.tr(), 0),
              _navItem(Icons.work_outline, 'nav.myJobs'.tr(), 1),
              // center Post a Job
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => context.push('/post-job'),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Container(
                      width: 54, height: 54,
                      decoration: const BoxDecoration(color: C.blue, shape: BoxShape.circle),
                      child: const Icon(Icons.add, color: Colors.white, size: 30),
                    ),
                    const SizedBox(height: 2),
                    SizedBox(
                      height: _kLabelHeight,
                      child: Text('nav.postJob'.tr(),
                          maxLines: 2,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              fontSize: 11, height: 1.15, color: C.blue, fontWeight: FontWeight.w700)),
                    ),
                  ]),
                ),
              ),
              _navItem(Icons.chat_bubble_outline, 'nav.messages'.tr(), 2),
              // Broken explicitly: the label FITS on one line, so maxLines
              // alone would never have wrapped it. Splits on the last space,
              // so "My Requests" / "Mes demandes" / "Mis solicitudes" each
              // break sensibly, and Arabic (no space) simply stays as it is.
              _navItem(Icons.description_outlined, _twoLine('nav.myRequests'.tr()), 3),
            ],
          ),
        ),
      ),
    );
  }
}
