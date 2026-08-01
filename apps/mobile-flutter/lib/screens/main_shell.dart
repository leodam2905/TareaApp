import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';
import 'dashboard_screen.dart';
import 'my_jobs_screen.dart';
import 'messages_screen.dart';
import 'profile_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});
  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  static const _tabs = [
    DashboardScreen(),
    MyJobsScreen(),
    MessagesScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.white,
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: _nav(),
    );
  }

  Widget _navItem(IconData icon, String label, int i) {
    final active = _index == i;
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => _index = i),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: active ? C.blue : C.muted, size: 24),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 11, color: active ? C.blue : C.muted, fontWeight: FontWeight.w700)),
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
              _navItem(Icons.home_filled, 'Home', 0),
              _navItem(Icons.work_outline, 'My Jobs', 1),
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
                    const Text('Post a Job', style: TextStyle(fontSize: 11, color: C.blue, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ),
              _navItem(Icons.chat_bubble_outline, 'Messages', 2),
              _navItem(Icons.person_outline, 'Profile', 3),
            ],
          ),
        ),
      ),
    );
  }
}
