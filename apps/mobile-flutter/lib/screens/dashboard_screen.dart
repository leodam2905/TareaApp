import 'dart:convert';
import '../tab_refresh.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';
import '../avatar_util.dart';
import '../widgets/urgent_badge.dart';
import '../route_observer.dart';

class _Action {
  // titleKey/descKey are translation keys; route is the navigation target
  // (kept separate so display text can be localized without breaking routing).
  final String titleKey, descKey, img, route;
  const _Action(this.titleKey, this.descKey, this.img, this.route);
}

const _actions = [
  _Action('nav.postJob', 'dashboard.postJobDesc', 'action-postjob.png', '/post-job'),
  _Action('dashboard.findPros', 'dashboard.findProsDesc', 'action-findpros.png', '/browse'),
  _Action('dashboard.aiDiagnose', 'dashboard.aiDiagnoseDesc', 'action-diagnose.png', '/diagnose'),
  _Action('landing.instantQuote', 'dashboard.instantQuoteDesc', 'action-quote.png', '/instant-quote'),
];

class _Cat {
  final IconData icon;
  final String labelKey;
  const _Cat(this.icon, this.labelKey);
}

const _cats = [
  _Cat(Icons.water_drop_outlined, 'categories.plumbing'),
  _Cat(Icons.bolt_outlined, 'categories.electrical'),
  _Cat(Icons.auto_awesome_outlined, 'categories.cleaning'),
  _Cat(Icons.palette_outlined, 'categories.painting'),
  _Cat(Icons.handyman_outlined, 'categories.carpentry'),
  _Cat(Icons.ac_unit_outlined, 'categories.hvac'),
  _Cat(Icons.eco_outlined, 'categories.landscaping'),
  _Cat(Icons.local_laundry_service_outlined, 'categories.laundry'),
  _Cat(Icons.local_shipping_outlined, 'categories.moving'),
  _Cat(Icons.chair_outlined, 'categories.assembly'),
  _Cat(Icons.roofing_outlined, 'categories.roofing'),
  _Cat(Icons.kitchen_outlined, 'categories.appliance'),
  _Cat(Icons.build_outlined, 'categories.general'),
];

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with RouteAware, TabRefreshMixin {
  @override
  int get tabIndex => 0;

  @override
  void onTabRefresh() => _load();

  String _firstName = '';
  String _avatar = '';
  /// Unread notifications, for the badge on the bell.
  int _unread = 0;
  List<dynamic> _pros = [];
  List<dynamic> _recent = [];

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

  // Refresh when returning to the shell from a pushed screen (e.g. after
  // posting a job) so recent activity reflects the new job.
  @override
  void didPopNext() => _load();

  Future<void> _load() async {
    try {
      final res = await Api.get('/profile');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final name = (data['name'] ?? '').toString();
        if (mounted) setState(() {
          if (name.isNotEmpty) _firstName = name.split(' ').first;
          _avatar = (data['avatarUrl'] ?? '').toString();
        });
      }
    } catch (_) {/* greeting stays generic */}
    try {
      // Counted from the list rather than a new endpoint: /notifications already
      // returns isRead per row, and a dedicated count route would be one more
      // thing to keep in step with it.
      final res = await Api.get('/notifications');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        final list = (d is List ? d : (d['notifications'] ?? [])) as List;
        final n = list.where((x) => x is Map && x['isRead'] != true).length;
        if (mounted) setState(() => _unread = n);
      }
    } catch (_) {/* the badge simply stays as it was */}
    try {
      final res = await Api.get('/handyman/browse');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final list = data is List ? data : (data['handymen'] ?? data['pros'] ?? []);
        if (mounted) setState(() => _pros = (list as List).take(6).toList());
      }
    } catch (_) {}
    // Recent activity = most recent jobs of ANY status, incl. just-posted ones:
    // directed posts come back as bookings, open posts as job-requests.
    final List<dynamic> activity = [];
    try {
      final res = await Api.get('/bookings?role=customer');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        activity.addAll((data is List ? data : (data['bookings'] ?? [])) as List);
      }
    } catch (_) {}
    try {
      final res = await Api.get('/job-requests?role=customer');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final list = (data is List ? data : (data['requests'] ?? data['jobRequests'] ?? [])) as List;
        for (final r in list) { if (r is Map) r['_isRequest'] = true; }
        // A hired request becomes a booking, and the booking is the one with
        // the live status. Keeping both would list the same job twice — once
        // frozen at "posted" and once showing what is actually happening.
        activity.addAll(list.where((r) => r is Map && r['status'] == 'OPEN'));
      }
    } catch (_) {}
    DateTime _when(dynamic x) => DateTime.tryParse(
        (x['updatedAt'] ?? x['createdAt'] ?? x['scheduledAt'] ?? '').toString()) ?? DateTime(2000);
    activity.sort((a, b) => _when(b).compareTo(_when(a)));
    // Every job, not the last four: this is the customer's whole picture of
    // what is happening, and a job scrolling off the end is a job they stop
    // chasing.
    if (mounted) setState(() => _recent = activity);
  }

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'dashboard.greetingMorning'.tr();
    if (h < 18) return 'dashboard.greetingAfternoon'.tr();
    return 'dashboard.greetingEvening'.tr();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.white,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 8),
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(children: [
                    Image.asset('assets/images/tarea-home-mark.png', width: 30, height: 30),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('Tarea', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.blue, height: 1)),
                        Text('Home', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: C.ink, height: 1.1)),
                      ],
                    ),
                  ]),
                  Row(children: [
                    GestureDetector(
                      onTap: () => context.push('/notifications').then((_) { if (mounted) _load(); }),
                      child: _bellWithBadge(),
                    ),
                    const SizedBox(width: 10),
                    // The avatar looked like a control and was not one — tapping it
                    // did nothing, which is exactly where someone goes to change
                    // their picture.
                    GestureDetector(
                      onTap: () => context.push('/edit-profile').then((_) { if (mounted) _load(); }),
                      child: roundAvatar(url: _avatar, radius: 18),
                    ),
                  ]),
                ],
              ),
              const SizedBox(height: 16),
              Text(_greeting, style: const TextStyle(fontSize: 14, color: C.muted)),
              Text(_firstName.isEmpty ? 'dashboard.there'.tr() : _firstName,
                  style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: C.ink)),
              const SizedBox(height: 16),
              // Action cards — content-sized rows (IntrinsicHeight keeps the two
              // cards in a row equal height) so titles/descriptions can't
              // overflow the cell and spill into the section below on iOS.
              Column(
                children: [
                  for (int i = 0; i < _actions.length; i += 2) ...[
                    if (i > 0) const SizedBox(height: 14),
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (int j = i; j < i + 2; j++) ...[
                            if (j > i) const SizedBox(width: 14),
                            Expanded(
                              child: j < _actions.length
                                  ? _actionCard(_actions[j])
                                  : const SizedBox.shrink(),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 20),
              _sectionHead('dashboard.categories'.tr(), accent: C.blue),
              const SizedBox(height: 12),
              SizedBox(
                height: 96,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _cats.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 16),
                  itemBuilder: (_, i) => _catItem(_cats[i]),
                ),
              ),
              const SizedBox(height: 20),
              // Promo
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: const Color(0xFFFFF3E0), borderRadius: BorderRadius.circular(18)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('dashboard.promoOff'.tr(), style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: Color(0xFFB45309))),
                    Text('dashboard.promoFirstJob'.tr(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFFB45309))),
                    const SizedBox(height: 4),
                    Text('dashboard.promoCode'.tr(), style: const TextStyle(fontSize: 14, color: Color(0xFFC2610C))),
                  ],
                ),
              ),
              // Recommended near you
              if (_pros.isNotEmpty) ...[
                _sectionHead('dashboard.recommendedNearYou'.tr(), accent: C.green, onSeeAll: () => context.push('/browse')),
                const SizedBox(height: 12),
                SizedBox(
                  height: 150,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _pros.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (_, i) => _proMini(_pros[i]),
                  ),
                ),
              ],
              // Recent activity
              _sectionHead(
                'dashboard.recentActivity'.tr(),
                accent: C.amber,
                // Was `() {}` — a live "See all" that did nothing when tapped.
                onSeeAll: _recent.isEmpty
                    ? null
                    : () => context.push('/requests').then((_) { if (mounted) _load(); }),
              ),
              const SizedBox(height: 12),
              if (_recent.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  alignment: Alignment.center,
                  child: Text('dashboard.noActivity'.tr(), style: const TextStyle(color: C.muted)),
                )
              else
                ..._recent.map(_activityRow),
              const SizedBox(height: 24),
            ],
          ),
        ),
        ),
      ),
    );
  }

  /// The bell, carrying the number of unread notifications.
  ///
  /// Without a count the bell says "notifications exist somewhere" — the same
  /// thing it says when there is nothing to see, so there was never a reason
  /// to tap it.
  Widget _bellWithBadge() {
    final n = _unread;
    return Stack(clipBehavior: Clip.none, children: [
      _circleIcon(n > 0 ? Icons.notifications : Icons.notifications_none),
      if (n > 0)
        Positioned(
          right: -2,
          top: -2,
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

  Widget _circleIcon(IconData icon) => Container(
        width: 40, height: 40,
        decoration: const BoxDecoration(color: C.surface, shape: BoxShape.circle),
        child: Icon(icon, color: C.ink, size: 22),
      );

  Widget _actionCard(_Action a) {
    return GestureDetector(
      onTap: () => context.push(a.route),
      child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: C.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: C.blue, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(child: Image.asset('assets/images/${a.img}', height: 84, fit: BoxFit.contain)),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(a.titleKey.tr(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
            ),
          ),
          const SizedBox(height: 2),
          Text(a.descKey.tr(), style: const TextStyle(fontSize: 13, color: C.muted, height: 1.25)),
        ],
      ),
      ),
    );
  }

  Widget _catItem(_Cat c) {
    return SizedBox(
      width: 72,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56, height: 56,
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(16)),
            child: Icon(c.icon, color: C.blue, size: 24),
          ),
          const SizedBox(height: 8),
          // Single line — long labels (Landscaping) auto-shrink to fit, like the RN app.
          SizedBox(
            width: 72,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(c.labelKey.tr(), maxLines: 1,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: C.ink)),
            ),
          ),
        ],
      ),
    );
  }

  /// Section header with a coloured accent bar.
  ///
  /// The accent carries the colour, not the title text: a heading in brand
  /// blue competes with "See all" beside it, which is the only thing in the row
  /// that is actually tappable. Each section gets its own colour so the page
  /// reads as distinct blocks while scrolling.
  Widget _sectionHead(String title, {VoidCallback? onSeeAll, Color accent = C.blue}) => Padding(
        padding: const EdgeInsets.only(top: 24),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Flexible(
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 4,
                  height: 20,
                  margin: const EdgeInsets.only(right: 10),
                  decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(3)),
                ),
                Flexible(child: Text(title, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink))),
              ]),
            ),
            if (onSeeAll != null) ...[
              const SizedBox(width: 12),
              GestureDetector(onTap: onSeeAll, child: Text('common.seeAll'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800))),
            ],
          ],
        ),
      );

  Widget _proMini(dynamic p) {
    final name = (p['name'] ?? 'Pro').toString();
    final services = (p['services'] as List?) ?? const [];
    final trade = services.isNotEmpty
        ? 'dashboard.proSuffix'.tr(args: [_prettyCat((services[0]['category'] ?? '').toString())])
        : 'dashboard.handyman'.tr();
    return GestureDetector(
      onTap: () => context.push('/browse'),
      child: Container(
        width: 130,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: C.line)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CircleAvatar(radius: 26, backgroundColor: C.surface,
              child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: C.blue))),
          const SizedBox(height: 10),
          Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink)),
          Text(trade, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: C.muted)),
        ]),
      ),
    );
  }

  /// Where a job actually IS, in one label.
  ///
  /// The raw status was shown prettified ("In progress"), which hid everything
  /// that had happened underneath it: an unpaid booking, a pro waiting for the
  /// customer to confirm completion, and an extension request needing an answer
  /// all read as the same word. These are the states a customer needs to act
  /// on, so each gets its own label — the ones needing THEM are amber, work in
  /// motion is blue, settled states are grey or green.
  _ActivityStatus? _activityStatus(dynamic b) {
    if (b['_isRequest'] == true) {
      return _ActivityStatus('dashboard.stPosted'.tr(), const Color(0xFFB45309), const Color(0xFFFEF3C7));
    }
    final status = (b['status'] ?? '').toString();
    final paid = b['isPaid'] == true;
    final pendingExt = ((b['extensions'] as List?) ?? const []).isNotEmpty;

    switch (status) {
      case 'PENDING':
        return _ActivityStatus('dashboard.stAwaitingPro'.tr(), C.muted, C.surface);
      case 'ACCEPTED':
        // Unpaid + ACCEPTED has exactly one cause now: the card saved at hire
        // was charged when the pro accepted and the charge failed (declined, or
        // the bank wanted 3-D Secure, which needs the customer present). It is
        // never a step the customer simply has not reached — hiring pays. And
        // it self-cancels within 2h, so the label has to prompt action, not
        // describe a state.
        return paid
            ? _ActivityStatus('dashboard.stProHired'.tr(), const Color(0xFF15803D), const Color(0xFFDCFCE7))
            : _ActivityStatus('dashboard.stPayNow'.tr(), const Color(0xFFB91C1C), const Color(0xFFFEE2E2));
      case 'IN_PROGRESS':
        // Ordered by what the customer has to do about it: an extension needs an
        // answer, a finished job needs confirming, everything else is just news.
        if (pendingExt) {
          return _ActivityStatus('dashboard.stExtensionRequested'.tr(), const Color(0xFFB45309), const Color(0xFFFEF3C7));
        }
        if (b['workDoneAt'] != null) {
          return _ActivityStatus('dashboard.stConfirmCompletion'.tr(), const Color(0xFFB45309), const Color(0xFFFEF3C7));
        }
        if (b['pausedAt'] != null) {
          return _ActivityStatus('dashboard.stPaused'.tr(), C.muted, C.surface);
        }
        return _ActivityStatus('dashboard.stInProgress'.tr(), const Color(0xFFC2410C), const Color(0xFFFFEDD5));
      case 'COMPLETED':
        return _ActivityStatus('dashboard.stCompleted'.tr(), const Color(0xFF15803D), const Color(0xFFDCFCE7));
      case 'CANCELLED':
        return _ActivityStatus('dashboard.stCancelled'.tr(), const Color(0xFFB91C1C), const Color(0xFFFEE2E2));
    }
    return null;
  }

  Widget _activityRow(dynamic b) {
    final isReq = b['_isRequest'] == true;
    final service = (b['service']?['title'] ?? b['category'] ?? b['title'] ?? 'Service').toString();
    final st = _activityStatus(b);
    return GestureDetector(
      onTap: () {
        if (isReq) {
          // Open THIS job, not the list of every job. The detail screen is
          // where the applicants are — the point of tapping a posted job is to
          // see which pros applied to it.
          context.push('/request-detail', extra: (b as Map).cast<String, dynamic>())
              .then((_) { if (mounted) _load(); });
        } else {
          context.push('/booking-detail', extra: (b as Map).cast<String, dynamic>()).then((_) { if (mounted) _load(); });
        }
      },
      child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: C.line)),
      child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(12)),
            child: Icon(isReq ? Icons.campaign_outlined : Icons.receipt_long_outlined, color: C.blue, size: 20)),
        const SizedBox(width: 12),
        Expanded(child: Text(service, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink))),
        if (isReq && (b['urgency'] ?? '').toString() == 'URGENT') ...[
          const UrgentBadge(),
          const SizedBox(width: 8),
        ],
        if (st != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(color: st.bg, borderRadius: BorderRadius.circular(20)),
            child: Text(st.label,
                style: TextStyle(color: st.fg, fontSize: 11, fontWeight: FontWeight.w800)),
          ),
      ]),
      ),
    );
  }

  String _prettyCat(String c) {
    if (c.isEmpty) return '';
    return c[0].toUpperCase() + c.substring(1).toLowerCase().replaceAll('_', ' ');
  }
}

class _ActivityStatus {
  final String label;
  final Color fg;
  final Color bg;
  const _ActivityStatus(this.label, this.fg, this.bg);
}
