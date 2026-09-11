import 'dart:async';
import '../../location_permission.dart';
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
  // Stripe's pending balance — money that has left Tarea and is settling
  // towards the pro's bank. This is what a pro means by "pending"; the field
  // above means "Tarea has not sent it", which is now an error state.
  num? _clearingSoon;
  bool _available = false;
  bool _busy = false;
  int _completed = 0;
  int _upcoming7 = 0;
  int _reviews = 0;
  int _pct = 0;
  /// Unread notifications, for the badge on the bell.
  int _unread = 0;
  // Licence and insurance are separate credentials, separately reviewed with
  // separate expiry dates. The dashboard used to show ONE hardcoded
  // "Licensed & Insured" pill to every pro — unconditionally, whether or not
  // either document existed, let alone had been approved.
  bool _licensed = false;
  bool _insured = false;
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

  /// One credential badge. Shown only when that credential is actually valid —
  /// an absent badge is the honest state, not a gap to fill with a default.
  Widget _credentialPill(String label, IconData icon, Color fg, Color bg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 5),
          Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12)),
        ]),
      );

  Future<void> _fetchAll() async {
    try {
      final p = await Api.get('/profile');
      if (p.statusCode == 200) {
        final pj = jsonDecode(p.body) as Map<String, dynamic>;
        _name = (pj['name'] ?? '').toString();
        _avatar = (pj['avatarUrl'] ?? '').toString();
        final hp = pj['handymanProfile'] ?? {};
        // Server-computed (lib/credentials.ts): approved by an admin AND not
        // past its expiry date. Never inferred from a document existing.
        final badges = hp['badges'] ?? {};
        _licensed = badges['licensed'] == true;
        _insured = badges['insured'] == true;
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
        _clearingSoon = ej['clearingSoon'] as num?;
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
      final r = await Api.get('/job-requests?role=handyman');
      if (r.statusCode == 200) {
        final d = jsonDecode(r.body);
        _requests = (d is List ? d : (d['requests'] ?? d['jobRequests'] ?? [])).take(3).toList();
      }
    } catch (_) {}
    try {
      // Counted from the list rather than a new endpoint: /notifications already
      // returns isRead per row, and a dedicated count route would be one more
      // thing to keep in step with it.
      final n = await Api.get('/notifications');
      if (n.statusCode == 200) {
        final d = jsonDecode(n.body);
        final list = (d is List ? d : (d['notifications'] ?? [])) as List;
        _unread = list.where((x) => x is Map && x['isRead'] != true).length;
      }
    } catch (_) {/* the badge simply stays as it was */}
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

  /// The bell, carrying the number of unread notifications.
  ///
  /// A bell with no count says "notifications exist somewhere" — the same thing
  /// it says when there is nothing to see, so there was never a reason to tap it.
  Widget _bellWithBadge() {
    final n = _unread;
    return Stack(clipBehavior: Clip.none, children: [
      Icon(n > 0 ? Icons.notifications : Icons.notifications_none, size: 26, color: C.ink),
      if (n > 0)
        Positioned(
          right: -4,
          top: -4,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            constraints: const BoxConstraints(minWidth: 18),
            decoration: BoxDecoration(
              color: C.red,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: C.white, width: 1.5),
            ),
            child: Text(
              // Past 99 the exact number stops meaning anything, and stops fitting.
              n > 99 ? '99+' : '$n',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900, height: 1.2),
            ),
          ),
        ),
    ]);
  }

  /// The pro's current position, or null if unavailable.
  ///
  /// Same shape as the en-route sharing in pro_job_detail: ask once, give up
  /// quietly if refused. Going online must not be blocked by a permission
  /// dialog — a pro who declines location still wants to be online.
  Future<Position?> _currentPosition() async {
    try {
      final perm = await ensureLocationPermission();
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
                GestureDetector(
                  // Coming back from the list with everything read should clear
                  // the badge; without this it keeps the stale count until the
                  // next 20s tick.
                  onTap: () async {
                    await context.push('/notifications');
                    if (mounted) _load();
                  },
                  child: _bellWithBadge(),
                ),
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
              if (_licensed) ...[
                const SizedBox(width: 10),
                _credentialPill('pro.licensed'.tr(), Icons.verified_outlined, C.blue, const Color(0xFFEFF5FF)),
              ],
              if (_insured) ...[
                const SizedBox(width: 10),
                _credentialPill('pro.insured'.tr(), Icons.shield_outlined, C.green, const Color(0xFFECFDF3)),
              ],
            ]),
            const SizedBox(height: 16),
            // Stat cards. The numbers are read from state, never painted into
            // the art: the source images carried 4.9 stars, 24 jobs and $1,280,
            // and shipping those would have told every pro someone else's
            // earnings and rating.
            _ProStatCard(
              index: 0,
              tint: const Color(0xFFEFFCF5),
              accent: const Color(0xFF16A34A),
              icon: Icons.attach_money,
              value: '\$${_totalEarnings.round()}',
              title: 'pro.earningsOverview'.tr(),
              // Was 'All time'. The Earnings Overview panel below used to be
              // the only place that showed money still clearing, so that line
              // moves up here rather than being lost with the panel.
              sub: _clearingSoon == null
                  ? 'pro.onTheWayUnknown'.tr()
                  : 'pro.onTheWay'.tr(args: ['\$${_clearingSoon!.round()}']),
              art: 'assets/images/pro-earned.png',
              onTap: () => ProShell.go?.call(3),
            ),
            const SizedBox(height: 12),
            _ProStatCard(
              index: 1,
              tint: const Color(0xFFEDF5FE),
              accent: C.blue,
              icon: Icons.check_circle,
              value: '$_completed',
              title: 'pro.jobsStatus'.tr(),
              sub: 'pro.jobsDone'.tr(),
              art: 'assets/images/pro-completed.png',
              onTap: () => ProShell.go?.call(2),
            ),
            const SizedBox(height: 12),
            _ProStatCard(
              index: 2,
              tint: const Color(0xFFFEF6EC),
              accent: const Color(0xFFEA7A22),
              icon: Icons.calendar_month,
              value: '$_upcoming7',
              title: 'pro.schedule'.tr(),
              sub: 'pro.next7days'.tr(),
              art: 'assets/images/pro-upcoming.png',
              onTap: () => ProShell.go?.call(2),
            ),
            const SizedBox(height: 12),
            _ProStatCard(
              index: 3,
              tint: const Color(0xFFF5F1FE),
              accent: const Color(0xFF7C3AED),
              icon: Icons.star,
              value: _rating > 0 ? _rating.toStringAsFixed(1) : '—',
              title: 'pro.rating'.tr(),
              sub: 'pro.reviewCount'.tr(args: ['$_reviews']),
              // Stars are DRAWN from the real rating rather than cropped from
              // the artwork -- the art shows five gold stars, which would be a
              // claim about the pro, not a decoration.
              stars: _rating,
              onTap: () => context.push('/pro/reviews'),
            ),
            const SizedBox(height: 24),
            _sectionHead('pro.upcomingJobs'.tr(), () => ProShell.go?.call(2)),
            const SizedBox(height: 10),
            if (_upcoming.isEmpty)
              _emptyCard('pro.noUpcomingJobs'.tr())
            else
              ..._upcoming.map(_jobRow),
            const SizedBox(height: 20),
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

/// A Pro dashboard stat, in the style of the supplied artwork.
///
/// The artwork arrived with its numbers painted in -- 4.9 stars from 32
/// reviews, 24 jobs done, $1,280 earned. Shipping that would show every pro
/// the same invented figures, so only the ILLUSTRATION is taken from the
/// image and everything that states a fact is drawn from live state.
class _ProStatCard extends StatefulWidget {
  const _ProStatCard({
    required this.index,
    required this.tint,
    required this.accent,
    required this.icon,
    required this.value,
    required this.title,
    required this.sub,
    required this.onTap,
    this.art,
    this.stars,
  });

  final int index;
  final Color tint;
  final Color accent;
  final IconData icon;
  final String value;
  final String title;
  final String sub;
  final VoidCallback onTap;

  /// The 3D object cropped out of the source image, on its own tint. Null for
  /// the rating card, which draws stars instead.
  final String? art;

  /// Rating out of 5, when this card should show stars.
  final double? stars;

  @override
  State<_ProStatCard> createState() => _ProStatCardState();
}

class _ProStatCardState extends State<_ProStatCard> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    Widget card = AnimatedScale(
      scale: _down && !reduced ? 0.96 : 1.0,
      duration: Duration(milliseconds: _down ? 110 : 300),
      curve: _down ? Curves.easeOut : Curves.easeOutBack,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 146,
        decoration: BoxDecoration(
          color: widget.tint,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: _down ? 0.04 : 0.09),
              blurRadius: _down ? 5 : 16,
              offset: Offset(0, _down ? 2 : 6),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Stack(
            children: [
              // Text and art share a Row rather than being stacked. Absolute
              // positioning ran the illustration to the full card height, so
              // the rounded corners clipped its top and bottom -- and nothing
              // stopped it sliding under the numbers.
              Row(
                children: [
                  Expanded(child: _body()),
                  if (widget.art != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(0, 12, 12, 12),
                      child: Image.asset(widget.art!, fit: BoxFit.contain,
                          errorBuilder: (_, _, _) => const SizedBox.shrink()),
                    ),
                  if (widget.stars != null)
                    Padding(
                      padding: const EdgeInsets.only(right: 14),
                      child: _stars(widget.stars!),
                    ),
                ],
              ),
              Positioned(
                right: 12, bottom: 8,
                child: Icon(Icons.chevron_right, color: C.muted.withValues(alpha: 0.7), size: 22),
              ),
            ],
          ),
        ),
      ),
    );

    if (!reduced) {
      card = TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.0, end: 1.0),
        duration: Duration(milliseconds: 520 + widget.index * 150),
        curve: Curves.easeOutCubic,
        builder: (_, t, child) {
          final start = widget.index * 0.16;
          final p = ((t - start) / (1 - start)).clamp(0.0, 1.0);
          return Opacity(
            opacity: p,
            child: Transform.translate(offset: Offset(0, (1 - p) * 24), child: child),
          );
        },
        child: card,
      );
    }

    return Semantics(
      button: true,
      label: '${widget.value} ${widget.title}. ${widget.sub}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _down = true),
        onTapUp: (_) => setState(() => _down = false),
        onTapCancel: () => setState(() => _down = false),
        onTap: widget.onTap,
        child: card,
      ),
    );
  }

  Widget _body() => Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 8, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  // Top, not centred. The column was centred in the card, so
                  // the title sat in the middle of the block rather than at
                  // the card's top edge.
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: [
                    // Title leads: it says what the card is about before the
                    // number does. It gets the column's full width rather than
                    // sharing a row with the icon, so "Earnings Overview" is
                    // not squeezed into whatever the icon leaves behind.
                    Text(widget.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w900, color: C.ink)),
                    // Enough air that the title reads as a heading over the
                    // card rather than as the first line of the number block.
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Container(
                          width: 34, height: 34,
                          decoration: BoxDecoration(color: widget.accent, shape: BoxShape.circle),
                          child: Icon(widget.icon, color: Colors.white, size: 19),
                        ),
                        const SizedBox(width: 10),
                        Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Text(widget.value,
                                style: const TextStyle(
                                    fontSize: 28, fontWeight: FontWeight.w900, color: C.ink, height: 1.05)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(widget.sub,
                        maxLines: 2,
                        style: const TextStyle(
                            fontSize: 12.5, height: 1.2, color: C.muted, fontWeight: FontWeight.w600)),
                  ],
                ),
              );

  /// Five stars, filled to the real rating -- half a star where the average
  /// lands between two whole ones.
  Widget _stars(double r) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (int i = 1; i <= 5; i++)
            Icon(
              r >= i
                  ? Icons.star
                  : (r >= i - 0.5 ? Icons.star_half : Icons.star_border),
              size: 26,
              color: const Color(0xFFFBBF24),
            ),
        ],
      );
}
