import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';
import '../flavor.dart';
import 'pro/pro_shell.dart';

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
    setState(() { for (final n in _items) { (n as Map)['isRead'] = true; } });
  }

  /// Open one notification: mark it read, then go where it points.
  ///
  /// The PATCH is deliberately not awaited — the screen should open on the tap,
  /// not after a round trip. The row is already shown as read locally, and a
  /// failed call only means the bell recounts it on the next poll.
  void _open(Map n, VoidCallback go) {
    if (n['isRead'] != true) {
      setState(() => n['isRead'] = true);
      _markOne(n['id']);
    }
    go();
  }

  Future<void> _markOne(dynamic id) async {
    try { await Api.patch('/notifications', {'id': id}); } catch (_) {}
  }

  /// Where a notification leads, by type — mirrors the CTA map in
  /// apps/web/lib/notify.ts, so tapping the row lands where the email said it
  /// would. `refId` is a bookingId for booking types and a reviewId for review.
  ///
  /// Returns null when there is nowhere sensible to go. An inert row is better
  /// than one that dumps you on the wrong screen, or on a detail screen that
  /// will 404 because the id belongs to a different model.
  VoidCallback? _tapFor(Map n) {
    final type = (n['type'] ?? '').toString();
    final refId = (n['refId'] ?? '').toString();

    void toBooking() => context.push(
          isPro ? '/pro/job-detail' : '/booking-detail',
          extra: {'id': refId},
        );
    // Tabs live inside the shell, so switch tab after the route settles —
    // the same 350ms hand-off push_service already uses for job pushes.
    void toProTab(int i) {
      context.go(homeRoute);
      Future.delayed(const Duration(milliseconds: 350), () => ProShell.go?.call(i));
    }

    switch (type) {
      // The only notification that opens the live map rather than the booking:
      // what it is telling you is where the pro is right now.
      case 'handyman_on_way':
        return (isPro || refId.isEmpty)
            ? null
            : () => context.push('/track-pro', extra: {'id': refId});
      case 'booking_accepted':
      case 'booking_cancelled':
      case 'booking_completed':
      case 'job_completed':
      case 'booking_reminder':
      case 'tip':
        return refId.isEmpty ? null : toBooking;
      // Chat has its own type now. It used to arrive as booking_request, which
      // also meant "a pro applied", "a phase started" and "a new service exists"
      // — four meanings, no safe destination, so a customer tapping
      // "New message" got nothing at all.
      case 'chat_message':
        return refId.isEmpty ? null : () => context.push('/chat', extra: {'bookingId': refId});
      // Older builds sent job phases and new-service notices under this type
      // with a bookingId attached; open the booking rather than doing nothing.
      case 'booking_request' when !isPro && refId.isNotEmpty:
        return toBooking;
      case 'booking_disputed':
        return () => context.push('/disputes');
      case 'booking_request':
        return isPro ? () => toProTab(1) : null;      // Find Jobs (pro only)
      case 'application_accepted':
        return isPro ? () => toProTab(2) : null;      // My Jobs
      case 'payout':
        return isPro ? () => toProTab(3) : null;      // Earnings
      case 'job_application':
        return isPro ? null : () => context.push('/requests');
      case 'review':
        return isPro ? () => context.push('/pro/reviews') : null;
      case 'background_check':
        return isPro ? () => context.push('/pro/background-check') : null;
      case 'account_onboarding':
        return isPro ? () => context.push('/pro/payout-methods') : null;
      default:
        return null;
    }
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
                    // The API returns isRead; reading 'read' meant every row
                    // rendered unread for ever, including after Mark all read.
                    final read = n['isRead'] == true;
                    final onTap = _tapFor(n);
                    final row = Container(
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
                        // Only advertise a tap where there is somewhere to go.
                        if (onTap != null)
                          const Padding(
                            padding: EdgeInsets.only(left: 8),
                            child: Icon(Icons.chevron_right, size: 20, color: C.muted),
                          ),
                      ]),
                    );
                    if (onTap == null) return row;
                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => _open(n, onTap),
                      child: row,
                    );
                  },
                ),
    );
  }
}
