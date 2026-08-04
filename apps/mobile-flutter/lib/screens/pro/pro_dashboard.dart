import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme.dart';
import '../../api.dart';
import '../../avatar_util.dart';
import '../../pro_online.dart';
import 'pro_shell.dart';

class ProDashboard extends StatefulWidget {
  const ProDashboard({super.key});
  @override
  State<ProDashboard> createState() => _ProDashboardState();
}

class _ProDashboardState extends State<ProDashboard> {
  String _name = '';
  String _avatar = '';
  double _rating = 0;
  num _totalEarnings = 0;
  num _pendingEarnings = 0;
  bool _available = false;
  bool _busy = false;
  int _completed = 0;
  int _upcoming7 = 0;
  int _reviews = 0;
  int _pct = 0;
  List<dynamic> _upcoming = [];
  List<dynamic> _requests = [];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final p = await Api.get('/profile');
      if (p.statusCode == 200) {
        final pj = jsonDecode(p.body) as Map<String, dynamic>;
        _name = (pj['name'] ?? '').toString();
        _avatar = (pj['avatarUrl'] ?? '').toString();
        final hp = pj['handymanProfile'] ?? {};
        _rating = ((hp['rating']) as num?)?.toDouble() ?? 0;
        _available = hp['isAvailable'] == true;
        ProOnline.set(_available);
      }
    } catch (_) {}
    try {
      final e = await Api.get('/handyman/earnings');
      if (e.statusCode == 200) {
        final ej = jsonDecode(e.body) as Map<String, dynamic>;
        _totalEarnings = (ej['totalEarnings'] ?? 0) as num;
        _pendingEarnings = (ej['pendingEarnings'] ?? 0) as num;
      }
    } catch (_) {}
    try {
      final b = await Api.get('/bookings?role=handyman');
      if (b.statusCode == 200) {
        final all = jsonDecode(b.body);
        final list = (all is List ? all : (all['bookings'] ?? [])) as List;
        _completed = list.where((x) => x['status'] == 'COMPLETED').length;
        final soon = DateTime.now().add(const Duration(days: 7));
        _upcoming = list.where((x) => ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].contains(x['status'])).toList();
        _upcoming7 = _upcoming.where((x) {
          final d = DateTime.tryParse((x['scheduledAt'] ?? '').toString());
          return d != null && d.isBefore(soon);
        }).length;
        _upcoming = _upcoming.take(3).toList();
      }
    } catch (_) {}
    try {
      final r = await Api.get('/reviews/received');
      if (r.statusCode == 200) {
        final d = jsonDecode(r.body);
        _reviews = (d is List ? d : (d['reviews'] ?? [])).length;
      }
    } catch (_) {}
    try {
      final r = await Api.get('/job-requests');
      if (r.statusCode == 200) {
        final d = jsonDecode(r.body);
        _requests = (d is List ? d : (d['requests'] ?? d['jobRequests'] ?? [])).take(3).toList();
      }
    } catch (_) {}
    try {
      final c = await Api.get('/handyman/checklist');
      if (c.statusCode == 200) {
        final cj = jsonDecode(c.body);
        if (cj is Map && cj.isNotEmpty) {
          final done = cj.values.where((v) => v == true || (v is String && v.isNotEmpty)).length;
          _pct = (done / cj.length * 100).round();
        }
      }
    } catch (_) {}
    if (mounted) setState(() {});
  }

  Future<void> _toggleOnline() async {
    final next = !_available;
    setState(() { _available = next; _busy = true; });
    ProOnline.set(next);
    try {
      final res = await Api.patch('/profile', {'isAvailable': next});
      if (res.statusCode < 200 || res.statusCode >= 300) {
        setState(() => _available = !next);
        ProOnline.set(!next);
      }
    } catch (_) {
      setState(() => _available = !next);
      ProOnline.set(!next);
    }
    if (mounted) setState(() => _busy = false);
  }

  static const _mo = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  String _time(String iso) {
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '';
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    return '$h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'AM' : 'PM'}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            // Header
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Tarea Pro', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: C.blue, letterSpacing: -0.5)),
              Row(children: [
                GestureDetector(onTap: () => context.push('/notifications'), child: const Icon(Icons.notifications_none, size: 26, color: C.ink)),
                const SizedBox(width: 16),
                GestureDetector(
                  onTap: () async {
                    final url = await pickAndUploadAvatar(context);
                    if (url != null && mounted) setState(() => _avatar = url);
                  },
                  child: Stack(clipBehavior: Clip.none, children: [
                    roundAvatar(url: _avatar, radius: 20),
                    Positioned(
                      right: -2, bottom: -2,
                      child: Container(
                        width: 18, height: 18,
                        decoration: BoxDecoration(color: C.blue, shape: BoxShape.circle, border: Border.all(color: C.bg, width: 2)),
                        child: const Icon(Icons.camera_alt, size: 9, color: Colors.white),
                      ),
                    ),
                  ]),
                ),
              ]),
            ]),
            const SizedBox(height: 12),
            Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
              Flexible(child: Text('Welcome back${_name.isEmpty ? '' : ', ${_name.split(' ').first}'}!', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink))),
              const SizedBox(width: 6),
              const WavingHand(),
            ]),
            const Text("Here's what's happening with your business today.", style: TextStyle(color: C.muted)),
            const SizedBox(height: 14),
            // Online + Licensed badge
            Row(children: [
              GestureDetector(
                onTap: _busy ? null : _toggleOnline,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: _available ? const Color(0xFFECFDF3) : C.bg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _available ? const Color(0xFF16A34A) : C.line),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Container(width: 10, height: 10, decoration: BoxDecoration(color: _available ? const Color(0xFF16A34A) : const Color(0xFF94A3B8), shape: BoxShape.circle)),
                    const SizedBox(width: 8),
                    Text(_available ? 'Online' : 'Offline', style: TextStyle(fontWeight: FontWeight.w800, color: _available ? const Color(0xFF16A34A) : C.muted)),
                  ]),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(12)),
                child: Row(mainAxisSize: MainAxisSize.min, children: const [
                  Icon(Icons.shield_outlined, size: 14, color: C.blue),
                  SizedBox(width: 5),
                  Text('Licensed & Insured', style: TextStyle(color: C.blue, fontWeight: FontWeight.w700, fontSize: 12)),
                ]),
              ),
            ]),
            const SizedBox(height: 16),
            // Stat cards 2x2
            Row(children: [
              _stat(Icons.work_outline, const Color(0xFFEFF5FF), C.blue, 'Total Earned', '\$${_totalEarnings.round()}', 'All time', onTap: () => ProShell.go?.call(3)),
              _stat(Icons.task_alt, const Color(0xFFECFDF3), const Color(0xFF16A34A), 'Completed', '$_completed', 'Jobs done', onTap: () => ProShell.go?.call(2)),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              _stat(Icons.schedule, const Color(0xFFFFF7ED), const Color(0xFFF59E0B), 'Upcoming', '$_upcoming7', 'Next 7 days', onTap: () => ProShell.go?.call(2)),
              _stat(Icons.star, const Color(0xFFF5F3FF), const Color(0xFF7C3AED), 'Rating', _rating > 0 ? _rating.toStringAsFixed(1) : '—', '($_reviews)', onTap: () => context.push('/pro/reviews')),
            ]),
            const SizedBox(height: 24),
            _sectionHead('Upcoming Jobs', () => ProShell.go?.call(2)),
            const SizedBox(height: 10),
            if (_upcoming.isEmpty)
              _emptyCard('No upcoming jobs yet.')
            else
              ..._upcoming.map(_jobRow),
            const SizedBox(height: 20),
            // Earnings overview
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => ProShell.go?.call(3),
              child: Container(
              width: double.infinity, padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [C.blue, Color(0xFF7C3AED)]),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: const [
                  Icon(Icons.trending_up, color: Colors.white, size: 18),
                  SizedBox(width: 6),
                  Text('Earnings Overview', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white)),
                ]),
                const SizedBox(height: 10),
                Text('\$${_totalEarnings.round()}', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: Colors.white)),
                Text('\$${_pendingEarnings.round()} pending payout', style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 12),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                  alignment: Alignment.center,
                  child: const Text('Your earnings trend appears here as you complete jobs.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 12.5)),
                ),
              ]),
            ),
            ),
            const SizedBox(height: 16),
            // Profile completeness
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => ProShell.go?.call(4),
              child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                Container(
                  width: 60, height: 60,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: _pct >= 100 ? const Color(0xFF16A34A) : C.blue, width: 5),
                  ),
                  child: Center(child: Text('$_pct%', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: _pct >= 100 ? const Color(0xFF16A34A) : C.blue))),
                ),
                const SizedBox(width: 14),
                const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Profile Completeness', style: TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 15)),
                  Text('Complete your profile to get more job opportunities.', style: TextStyle(color: C.muted, fontSize: 13)),
                ])),
                Icon(Icons.chevron_right, color: C.muted),
              ]),
            ),
            ),
            const SizedBox(height: 24),
            _sectionHead('New Job Requests', () => ProShell.go?.call(1)),
            const SizedBox(height: 10),
            if (_requests.isEmpty)
              _emptyCard('No new requests right now.')
            else
              ..._requests.map(_reqRow),
          ],
        ),
      ),
    );
  }

  Widget _stat(IconData icon, Color tint, Color iconColor, String label, String value, String sub, {VoidCallback? onTap}) => Expanded(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4), padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(16), border: Border.all(color: iconColor.withValues(alpha: 0.18))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 36, height: 36, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle), child: Icon(icon, color: iconColor, size: 19)),
            const SizedBox(height: 10),
            Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: iconColor)),
            FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(label, style: const TextStyle(color: C.ink, fontSize: 12.5, fontWeight: FontWeight.w800))),
            Text(sub, style: const TextStyle(color: C.muted, fontSize: 11)),
          ]),
        ),
        ),
      );

  Widget _sectionHead(String title, VoidCallback onTap) => Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
        GestureDetector(onTap: onTap, child: const Text('View all', style: TextStyle(color: C.blue, fontWeight: FontWeight.w800))),
      ]);

  Widget _emptyCard(String text) => Container(
        width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 22), alignment: Alignment.center,
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
        child: Text(text, style: const TextStyle(color: C.muted)),
      );

  Widget _jobRow(dynamic b) {
    final d = DateTime.tryParse((b['scheduledAt'] ?? '').toString())?.toLocal();
    final service = (b['service']?['title'] ?? b['category'] ?? 'Job').toString();
    final place = (b['city'] ?? b['address'] ?? '').toString();
    return GestureDetector(
      onTap: () => context.push('/pro/job-detail', extra: (b as Map).cast<String, dynamic>()),
      child: Container(
      margin: const EdgeInsets.only(bottom: 10), padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        Container(
          width: 48, height: 48, decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(12)),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(d != null ? _mo[d.month - 1] : '--', style: const TextStyle(color: C.blue, fontSize: 10, fontWeight: FontWeight.w800)),
            Text(d != null ? '${d.day}' : '--', style: const TextStyle(color: C.blue, fontSize: 16, fontWeight: FontWeight.w900)),
          ]),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(service, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
          Text('${_time((b['scheduledAt'] ?? '').toString())}${place.isNotEmpty ? ' · $place' : ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted, fontSize: 13)),
        ])),
        const Icon(Icons.chevron_right, color: C.muted),
      ]),
      ),
    );
  }

  Widget _reqRow(dynamic r) {
    final title = (r['title'] ?? (r['category'] ?? 'Job').toString().replaceAll('_', ' ')).toString();
    final category = (r['category'] ?? '').toString().replaceAll('_', ' ');
    final min = r['budgetMin'], max = r['budgetMax'];
    return GestureDetector(
      onTap: () => ProShell.go?.call(1),
      child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF5FAFF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFDCEAFE)),
      ),
      child: Row(children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: C.blue.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
          child: const Icon(Icons.work_outline, color: C.blue, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink))),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(6)),
                child: const Text('NEW', style: TextStyle(color: Color(0xFF16A34A), fontSize: 9, fontWeight: FontWeight.w900)),
              ),
            ]),
            const SizedBox(height: 2),
            Text('${_time((r['scheduledAt'] ?? '').toString())}${category.trim().isNotEmpty ? ' · ${category.toLowerCase()}' : ''}',
                maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted, fontSize: 13)),
          ]),
        ),
        if (min != null)
          Text('\$${(min as num).round()}${max != null && (max as num) > min ? '–${max.round()}' : ''}',
              style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF16A34A), fontSize: 16)),
      ]),
      ),
    );
  }
}

/// A 👋 emoji that gently waves (tilts back and forth), pivoting at the wrist.
class WavingHand extends StatefulWidget {
  const WavingHand({super.key});
  @override
  State<WavingHand> createState() => _WavingHandState();
}

class _WavingHandState extends State<WavingHand> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 260))..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (_, __) => Transform.rotate(
        angle: (_c.value - 0.5) * 0.5, // ~ -0.25 to +0.25 rad
        alignment: Alignment.bottomCenter,
        child: const Text('👋', style: TextStyle(fontSize: 22)),
      ),
    );
  }
}
