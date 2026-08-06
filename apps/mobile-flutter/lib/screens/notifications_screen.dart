import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _items = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/notifications');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        _items = d is List ? d : (d['notifications'] ?? []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _markAll() async {
    try { await Api.patch('/notifications', {}); } catch (_) {}
    setState(() { for (final n in _items) { (n as Map)['read'] = true; } });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.bg, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30), onPressed: () => context.pop()),
        title: Text('settings.notifications'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
        actions: [
          if (_items.isNotEmpty)
            TextButton(onPressed: _markAll, child: Text('notifications.markAllRead'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w700))),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.notifications_none, size: 56, color: C.muted),
                  const SizedBox(height: 12),
                  Text('notifications.allCaughtUp'.tr(), style: const TextStyle(color: C.muted, fontWeight: FontWeight.w700)),
                ]))
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: _items.length,
                  itemBuilder: (_, i) {
                    final n = _items[i] as Map;
                    final read = n['read'] == true;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: read ? C.white : const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(14)),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 6, right: 12),
                            decoration: BoxDecoration(color: read ? Colors.transparent : C.blue, shape: BoxShape.circle)),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text((n['title'] ?? 'notifications.fallbackTitle'.tr()).toString(), style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
                          if ((n['body'] ?? n['message'] ?? '').toString().isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text((n['body'] ?? n['message']).toString(), style: const TextStyle(color: C.muted, height: 1.3)),
                          ],
                        ])),
                      ]),
                    );
                  },
                ),
    );
  }
}
