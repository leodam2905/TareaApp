import 'package:flutter/material.dart';
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

class _ProShellState extends State<ProShell> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    ProShell.go = (i) { if (mounted) setState(() => _index = i); };
  }

  @override
  void dispose() {
    ProShell.go = null;
    super.dispose();
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
    return Scaffold(
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
    );
  }

  Widget _item(IconData icon, String label, int i) {
    final active = _index == i;
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => _index = i),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: active ? C.blue : C.muted, size: 24),
          const SizedBox(height: 2),
          FittedBox(fit: BoxFit.scaleDown, child: Text(label, style: TextStyle(fontSize: 11, color: active ? C.blue : C.muted, fontWeight: FontWeight.w700))),
        ]),
      ),
    );
  }
}
