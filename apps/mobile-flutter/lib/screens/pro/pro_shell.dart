import 'package:flutter/material.dart';
import '../../tab_refresh.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import 'pro_dashboard.dart';
import 'pro_find_jobs.dart';
import 'pro_jobs.dart';
import 'pro_earnings.dart';
import 'pro_profile.dart';

class ProShell extends StatefulWidget {
  const ProShell({super.key});

  /// Lets child tabs jump to another tab (e.g. dashboard "View all" → My Jobs).
  static void Function(int)? go;

  @override
  State<ProShell> createState() => _ProShellState();
}

class _ProShellState extends State<ProShell> with WidgetsBindingObserver {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ProShell.go = (i) { if (mounted) { setState(() => _index = i); TabRefresh.select(i); } };
  }

  @override
  void dispose() {
    ProShell.go = null;
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) TabRefresh.resumed();
  }

  static const _tabs = [
    ProDashboard(),
    ProFindJobs(),
    ProJobs(),
    ProEarnings(),
    ProProfile(),
  ];

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Allowed through only on the first tab; anywhere else the pop is
      // intercepted and turned into a tab change.
      canPop: _index == 0,
      onPopInvokedWithResult: _handleBack,
      child: Scaffold(
        backgroundColor: C.bg,
        body: IndexedStack(index: _index, children: _tabs),
        bottomNavigationBar: Container(
          decoration: const BoxDecoration(color: C.white, border: Border(top: BorderSide(color: C.line))),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(children: [
                _item(Icons.home_outlined, 'nav.home'.tr(), 0),
                _item(Icons.search, 'nav.findJobs'.tr(), 1),
                _item(Icons.assignment_outlined, 'nav.myJobs'.tr(), 2),
                _item(Icons.account_balance_wallet_outlined, 'nav.earnings'.tr(), 3),
                _item(Icons.person_outline, 'nav.profile'.tr(), 4),
              ]),
            ),
          ),
        ),
      ),
    );
  }

  /// Android's back button, on a tabbed shell.
  ///
  /// Tabs are an IndexedStack, not routes -- switching one never pushes
  /// anything, so at the root route the system back had nothing to pop and
  /// closed the app instead. Back now returns to the first tab, and only
  /// leaves once you are already on it.
  void _handleBack(bool didPop, Object? result) {
    if (didPop) return;
    if (_index != 0) {
      setState(() => _index = 0);
      TabRefresh.select(0);
    }
  }

  Widget _item(IconData icon, String label, int i) {
    final active = _index == i;
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () { setState(() => _index = i); TabRefresh.select(i); },
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: active ? C.blue : C.muted, size: 24),
          const SizedBox(height: 2),
          FittedBox(fit: BoxFit.scaleDown, child: Text(label, style: TextStyle(fontSize: 11, color: active ? C.blue : C.muted, fontWeight: FontWeight.w700))),
        ]),
      ),
    );
  }
}
