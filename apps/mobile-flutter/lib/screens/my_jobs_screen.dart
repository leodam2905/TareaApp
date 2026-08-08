import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';
import '../route_observer.dart';

class MyJobsScreen extends StatefulWidget {
  const MyJobsScreen({super.key});
  @override
  State<MyJobsScreen> createState() => _MyJobsScreenState();
}

// status pill: [translation key, textColor, bgColor] — mirrors the RN STATUS map
const _statusPill = {
  'PENDING': ['status.pending', 0xFFB45309, 0xFFFEF3C7],
  'ACCEPTED': ['status.confirmed', 0xFF15803D, 0xFFDCFCE7],
  'IN_PROGRESS': ['status.inProgress', 0xFFC2410C, 0xFFFFEDD5],
  'COMPLETED': ['status.completed', 0xFF15803D, 0xFFDCFCE7],
  'CANCELLED': ['status.cancelled', 0xFFB91C1C, 0xFFFEE2E2],
};

class _MyJobsScreenState extends State<MyJobsScreen> with RouteAware {
  List<dynamic> _bookings = [];
  bool _loading = true;
  String _filter = 'ALL';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route is PageRoute) routeObserver.subscribe(this, route);
  }

  @override
  void dispose() {
    routeObserver.unsubscribe(this);
    super.dispose();
  }

  // Reload when returning to the shell (e.g. after hiring a pro) so a newly
  // created booking shows up.
  @override
  void didPopNext() => _load();

  Future<void> _load() async {
    try {
      final res = await Api.get('/bookings?role=customer');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        _bookings = data is List ? data : (data['bookings'] ?? []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<dynamic> _byStatus(List<String> st) => _bookings.where((b) => st.contains(b['status'])).toList();

  @override
  Widget build(BuildContext context) {
    final upcoming = _byStatus(['PENDING', 'ACCEPTED']);
    final inProgress = _byStatus(['IN_PROGRESS']);
    final completed = _byStatus(['COMPLETED']);
    final cancelled = _byStatus(['CANCELLED']);

    final filtered = _filter == 'UPCOMING'
        ? upcoming
        : _filter == 'IN_PROGRESS'
            ? inProgress
            : _filter == 'COMPLETED'
                ? completed
                : _filter == 'CANCELLED'
                    ? cancelled
                    : _bookings;

    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.zero,
                children: [
                  // Header
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('bookings.title'.tr(), style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: C.ink, letterSpacing: -0.5)),
                              Text('bookings.summary'.tr(args: ['${upcoming.length}', '${_bookings.length}']), style: const TextStyle(color: C.muted, fontSize: 14)),
                            ],
                          ),
                        ),
                        GestureDetector(onTap: () => context.push('/notifications'), child: const Icon(Icons.notifications_none, size: 26, color: C.ink)),
                      ],
                    ),
                  ),
                  // Filter chips
                  SizedBox(
                    height: 40,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      children: [
                        _chip('ALL', 'bookings.all'.tr()),
                        _chip('UPCOMING', 'bookings.upcoming'.tr()),
                        _chip('IN_PROGRESS', 'bookings.inProgress'.tr()),
                        _chip('COMPLETED', 'bookings.completed'.tr()),
                        _chip('CANCELLED', 'bookings.cancelled'.tr()),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  // Stats
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(children: [
                      _stat(upcoming.length, 'bookings.upcoming'.tr(), Icons.calendar_today, C.blue),
                      _stat(inProgress.length, 'bookings.inProgress'.tr(), Icons.circle_outlined, C.green),
                      _stat(completed.length, 'bookings.completed'.tr(), Icons.check_circle, const Color(0xFF7C3AED)),
                      _stat(cancelled.length, 'bookings.cancelled'.tr(), Icons.cancel, C.red),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  if (filtered.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(children: filtered.map(_bookingCard).toList()),
                    ),
                    const SizedBox(height: 24),
                  ] else if (_filter == 'ALL') ...[
                    // Empty state — calendar illustration + support
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Image.asset('assets/images/bookings-illustration.png', fit: BoxFit.contain),
                    ),
                    const SizedBox(height: 8),
                    _supportCard(),
                    const SizedBox(height: 24),
                  ] else ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: _emptyCard(),
                    ),
                    const SizedBox(height: 24),
                  ],
                ],
              ),
              ),
      ),
    );
  }

  Widget _chip(String key, String label) {
    final sel = _filter == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: () => setState(() => _filter = key),
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: sel ? C.blue : C.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: sel ? C.blue : C.line),
          ),
          child: Text(label, style: TextStyle(color: sel ? Colors.white : C.ink, fontWeight: FontWeight.w700)),
        ),
      ),
    );
  }

  Widget _stat(int n, String label, IconData icon, Color color) => Expanded(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
          decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
          child: Column(children: [
            Container(
              width: 34, height: 34,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(height: 8),
            Text('$n', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
            FittedBox(fit: BoxFit.scaleDown, child: Text(label, style: const TextStyle(fontSize: 11, color: C.muted, fontWeight: FontWeight.w600))),
          ]),
        ),
      );

  Widget _supportCard() => Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
        child: Row(children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(22)),
            child: const Icon(Icons.headset_mic_outlined, color: C.blue),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('bookings.needHelp'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
              Text('bookings.supportDesc'.tr(), style: const TextStyle(color: C.muted, fontSize: 13)),
            ]),
          ),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFBFD4FF))),
            onPressed: () => launchUrl(Uri.parse('mailto:support@taptarea.com?subject=Tarea%20Support')),
            icon: const Icon(Icons.chat_bubble_outline, size: 15, color: C.blue),
            label: Text('bookings.contact'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
          ),
        ]),
      );

  Widget _emptyCard() => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
        child: Column(children: [
          Text('bookings.nothingHere'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
          const SizedBox(height: 4),
          Text('bookings.noBookings'.tr(), style: const TextStyle(color: C.muted)),
        ]),
      );

  Widget _bookingCard(dynamic b) {
    final meta = _statusPill[b['status']] ?? ['status.booking', 0xFF64748B, 0xFFF1F5F9];
    final color = Color(meta[1] as int);
    final bg = Color(meta[2] as int);
    final handyman = b['handyman'] ?? {};
    final name = (handyman['name'] ?? 'Pro').toString();
    final service = (b['service']?['title'] ?? b['category'] ?? 'Service').toString();
    final price = b['totalPrice'];
    return GestureDetector(
      onTap: () => context.push('/booking-detail', extra: (b as Map).cast<String, dynamic>()).then((_) { if (mounted) _load(); }),
      child: Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            CircleAvatar(radius: 22, backgroundColor: C.surface,
                child: Text(name.isNotEmpty ? name[0] : '?', style: const TextStyle(fontWeight: FontWeight.w900, color: C.blue))),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                Text(service, style: const TextStyle(color: C.muted)),
              ]),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
              child: Text((meta[0] as String).tr(), style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12)),
            ),
          ]),
          if (price != null) ...[
            const SizedBox(height: 12),
            const Divider(color: C.line, height: 1),
            const SizedBox(height: 10),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('bookings.total'.tr(), style: const TextStyle(color: C.muted)),
              Text('\$${(price as num).round()}', style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
            ]),
          ],
        ],
      ),
      ),
    );
  }
}
