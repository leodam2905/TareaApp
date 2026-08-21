import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';
import '../../avatar_util.dart';
import '../../pro_online.dart';
import 'pro_setup_steps.dart';
import 'pro_shell.dart';

class ProDashboard extends StatefulWidget {
  const ProDashboard({super.key});
  @override
  State<ProDashboard> createState() => _ProDashboardState();
}

class _ProDashboardState extends State<ProDashboard> with WidgetsBindingObserver {
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

  // The dashboard shows the three newest open jobs. It loaded them once in
  // initState, so a pro who left this screen open saw whatever was posted
  // before they arrived and nothing after — which is the "new jobs don't
  // appear" symptom, on the screen a pro actually sits on.
  Timer? _poll;
  static const _interval = Duration(seconds: 20);
  bool _inFlight = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _startPolling();
  }

  @override
  void dispose() {
    _poll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _startPolling() {
    _poll?.cancel();
    _poll = Timer.periodic(_interval, (_) => _load());
  }

  // Nothing is being read while the app is backgrounded, so nothing should be
  // fetched. Refresh once on return rather than showing a stale dashboard.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _load();
      _startPolling();
    } else {
      _poll?.cancel();
    }
  }

  Future<void> _load() async {
    // Six sequential requests: a slow run must not be overtaken by the next
    // tick and land its results out of order.
    if (_inFlight) return;
    _inFlight = true;
    try {
      await _fetchAll();
    } finally {
      _inFlight = false;
    }
  }

  Future<void> _fetchAll() async {
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

  /// The pro's current position, or null if unavailable.
  ///
  /// Same shape as the en-route sharing in pro_job_detail: ask once, give up
  /// quietly if refused. Going online must not be blocked by a permission
  /// dialog — a pro who declines location still wants to be online.
  Future<Position?> _currentPosition() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return null;
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      ).timeout(const Duration(seconds: 12));
    } catch (_) {
      return null;
    }
  }

  Future<void> _toggleOnline() async {
    final next = !_available;
    setState(() { _available = next; _busy = true; });
    ProOnline.set(next);
    try {
      // Going online sends where "here" is.
      //
      // isAvailable alone only says a pro is willing to work; it says nothing
      // about where. Matching is by distance — haversine over user.latitude /
      // longitude — and with those null on every pro the distance branch never
      // ran at all, so jobs either reached everyone or nobody. Capturing the
      // position at the moment of going online is what makes "jobs near you"
      // mean anything.
      //
      // Only when going ON: coordinates captured while going offline would
      // describe somewhere the pro is not working from.
      Position? pos;
      if (next) pos = await _currentPosition();

      final res = await Api.patch('/profile', {
        'isAvailable': next,
        if (pos != null) 'latitude': pos.latitude,
        if (pos != null) 'longitude': pos.longitude,
      });
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
        // Pull-to-refresh in addition to the 20s poll: when a pro is waiting on
        // a specific job they will reach for it, and waiting out a timer they
        // cannot see feels broken even when it is working.
        child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
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
              Flexible(child: Text(_name.isEmpty ? 'pro.welcomeBackPlain'.tr() : 'pro.welcomeBackNamed'.tr(args: [_name.split(' ').first]), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink))),
              const SizedBox(width: 6),
              const WavingHand(),
            ]),
            Text('pro.todaySummary'.tr(), style: const TextStyle(color: C.muted)),
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
                    Text(_available ? 'pro.online'.tr() : 'pro.offline'.tr(), style: TextStyle(fontWeight: FontWeight.w800, color: _available ? const Color(0xFF16A34A) : C.muted)),
                  ]),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(12)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.shield_outlined, size: 14, color: C.blue),
                  const SizedBox(width: 5),
                  Text('pro.licensedInsured'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w700, fontSize: 12)),
                ]),
              ),
            ]),
            const SizedBox(height: 16),
            // Stat cards 2x2
            Row(children: [
              _stat(Icons.work_outline, const Color(0xFFEFF5FF), C.blue, 'pro.totalEarned'.tr(), '\$${_totalEarnings.round()}', 'pro.allTime'.tr(), onTap: () => ProShell.go?.call(3)),
              _stat(Icons.task_alt, const Color(0xFFECFDF3), const Color(0xFF16A34A), 'pro.completed'.tr(), '$_completed', 'pro.jobsDone'.tr(), onTap: () => ProShell.go?.call(2)),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              _stat(Icons.schedule, const Color(0xFFFFF7ED), const Color(0xFFF59E0B), 'pro.upcoming'.tr(), '$_upcoming7', 'pro.next7days'.tr(), onTap: () => ProShell.go?.call(2)),
              _stat(Icons.star, const Color(0xFFF5F3FF), const Color(0xFF7C3AED), 'pro.rating'.tr(), _rating > 0 ? _rating.toStringAsFixed(1) : '—', '($_reviews)', onTap: () => context.push('/pro/reviews')),
            ]),
            const SizedBox(height: 24),
            _sectionHead('pro.upcomingJobs'.tr(), () => ProShell.go?.call(2)),
            const SizedBox(height: 10),
            if (_upcoming.isEmpty)
              _emptyCard('pro.noUpcomingJobs'.tr())
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
                Row(children: [
                  const Icon(Icons.trending_up, color: Colors.white, size: 18),
                  const SizedBox(width: 6),
                  Text('pro.earningsOverview'.tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white)),
                ]),
                const SizedBox(height: 10),
                Text('\$${_totalEarnings.round()}', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: Colors.white)),
                Text('pro.pendingPayout'.tr(args: ['\$${_pendingEarnings.round()}']), style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 12),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                  alignment: Alignment.center,
                  child: Text('pro.earningsTrend'.tr(), textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 12.5)),
                ),
              ]),
            ),
            ),
            const SizedBox(height: 16),
            // Profile completeness
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              // The percentage comes from /handyman/checklist, so this opens the steps
              // behind it. It used to jump to the profile tab, where most of those
              // steps are not done — a pro was told what was missing and sent to the
              // wrong place. Availability, in particular, had no screen at all.
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const ProSetupSteps()))
                  .then((_) { if (mounted) _load(); }),
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
                  // A 60px circle with a 5px border leaves 50px inside, and
                  // "100%" at weight 900 does not fit that in SF Pro — the
                  // three-digit case is the only one that overflows, so it
                  // only showed once a pro was actually finished.
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text('$_pct%',
                            maxLines: 1,
                            softWrap: false,
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: _pct >= 100 ? const Color(0xFF16A34A) : C.blue)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('pro.profileCompleteness'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 15)),
                  Text('pro.completenessDesc'.tr(), style: const TextStyle(color: C.muted, fontSize: 13)),
                ])),
                const Icon(Icons.chevron_right, color: C.muted),
              ]),
            ),
            ),
            const SizedBox(height: 24),
            _sectionHead('pro.newJobRequests'.tr(), () => ProShell.go?.call(1)),
            const SizedBox(height: 10),
            if (_requests.isEmpty)
              _emptyCard('pro.noNewRequests'.tr())
            else
              ..._requests.map(_reqRow),
          ],
        ),
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
        GestureDetector(onTap: onTap, child: Text('pro.viewAll'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800))),
      ]);

  Widget _emptyCard(String text) => Container(
        width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 22), alignment: Alignment.center,
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
        child: Text(text, style: const TextStyle(color: C.muted)),
      );

  Widget _jobRow(dynamic b) {
    final d = DateTime.tryParse((b['scheduledAt'] ?? '').toString())?.toLocal();
    final service = (b['service']?['title'] ?? b['category'] ?? 'pro.jobFallback'.tr()).toString();
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
    final title = (r['title'] ?? (r['category'] ?? 'pro.jobFallback'.tr()).toString().replaceAll('_', ' ')).toString();
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
                child: Text('pro.new'.tr(), style: const TextStyle(color: Color(0xFF16A34A), fontSize: 9, fontWeight: FontWeight.w900)),
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

/// A waving-hand icon that gently waves (tilts back and forth), pivoting at the wrist.
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
        child: const Icon(Icons.waving_hand, size: 22, color: Color(0xFFF59E0B)),
      ),
    );
  }
}
