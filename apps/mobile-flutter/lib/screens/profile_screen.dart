import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';
import '../api.dart';
import '../avatar_util.dart';

class _MenuItem {
  final IconData icon;
  final String label;
  final String route;
  const _MenuItem(this.icon, this.label, this.route);
}

const _menu = [
  _MenuItem(Icons.favorite_border, 'Saved Pros', '/favorites'),
  _MenuItem(Icons.card_giftcard, 'Refer & Earn', '/refer-earn'),
  _MenuItem(Icons.account_balance_wallet_outlined, 'Spending', '/spending'),
  _MenuItem(Icons.notifications_outlined, 'Notifications', '/notifications'),
  _MenuItem(Icons.description_outlined, 'My Requests', '/requests'),
  _MenuItem(Icons.settings_outlined, 'Settings', '/settings'),
];

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _name = '';
  String _phone = '';
  String _avatar = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await Api.get('/profile');
      if (res.statusCode == 200) {
        final p = jsonDecode(res.body) as Map<String, dynamic>;
        if (mounted) setState(() {
          _name = (p['name'] ?? '').toString();
          _phone = (p['phone'] ?? '').toString();
          _avatar = (p['avatarUrl'] ?? '').toString();
        });
      }
    } catch (_) {}
  }

  Future<void> _logout() async {
    await Api.clearToken();
    if (mounted) context.go('/');
  }

  Future<void> _deleteAccount() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
            'This permanently deletes your Tarea account and removes your personal information. This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete', style: TextStyle(color: C.red, fontWeight: FontWeight.w800))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final res = await Api.delete('/account');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await Api.clearToken();
        if (mounted) context.go('/');
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not delete account. Please try again.')));
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not connect. Please try again.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            const Text('Profile', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 16),
            // Identity card
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => context.push('/edit-profile').then((_) { if (mounted) _load(); }),
              child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(18)),
              child: Row(children: [
                GestureDetector(
                  onTap: () async {
                    final url = await pickAndUploadAvatar(context);
                    if (url != null && mounted) setState(() => _avatar = url);
                  },
                  child: Stack(clipBehavior: Clip.none, children: [
                    roundAvatar(url: _avatar, radius: 30),
                    Positioned(
                      right: -2, bottom: -2,
                      child: Container(
                        width: 22, height: 22,
                        decoration: BoxDecoration(color: C.blue, shape: BoxShape.circle, border: Border.all(color: C.white, width: 2)),
                        child: const Icon(Icons.camera_alt, size: 11, color: Colors.white),
                      ),
                    ),
                  ]),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_name.isEmpty ? 'Your account' : _name,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
                    if (_phone.isNotEmpty) Text(_phone, style: const TextStyle(color: C.muted)),
                  ]),
                ),
                const Icon(Icons.chevron_right, color: C.muted),
              ]),
            ),
            ),
            const SizedBox(height: 20),
            Container(
              decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(18)),
              child: Column(
                children: [
                  for (int i = 0; i < _menu.length; i++) ...[
                    _row(_menu[i]),
                    if (i < _menu.length - 1) const Divider(height: 1, color: C.line, indent: 56),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFFECACA)),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: _logout,
                child: const Text('Log out', style: TextStyle(color: C.red, fontWeight: FontWeight.w800, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: TextButton.icon(
                style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13)),
                onPressed: _deleteAccount,
                icon: const Icon(Icons.delete_outline, size: 18, color: C.red),
                label: const Text('Delete account', style: TextStyle(color: C.red, fontWeight: FontWeight.w800, fontSize: 15)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(_MenuItem m) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          // Secondary screens are built in later batches.
          final exists = GoRouter.of(context).configuration.routes
              .whereType<GoRoute>().any((r) => r.path == m.route);
          if (exists) {
            context.push(m.route);
          } else {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${m.label} — coming soon')));
          }
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Row(children: [
            Icon(m.icon, color: C.ink, size: 22),
            const SizedBox(width: 14),
            Expanded(child: Text(m.label, style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink, fontSize: 15))),
            const Icon(Icons.chevron_right, color: C.muted),
          ]),
        ),
      );
}
