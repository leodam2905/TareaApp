import 'dart:convert';
import '../tab_refresh.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../widgets/unread_bell.dart';
import '../api.dart';
import '../avatar_util.dart';
import '../widgets/urgent_badge.dart';
import '../route_observer.dart';

class _Action {
  // titleKey/descKey are translation keys; route is the navigation target
  // (kept separate so display text can be localized without breaking routing).
  final String titleKey, descKey, img, route;

  /// Card background, icon-badge colour, and the badge glyph. Each card is
  /// colour-coded so the four are told apart at a glance rather than by
  /// reading them.
  final Color tint, accent;
  final IconData icon;

  const _Action(
    this.titleKey,
    this.descKey,
    this.img,
    this.route, {
    required this.tint,
    required this.accent,
    required this.icon,
  });
}

const _actions = [
  _Action('nav.postJob', 'dashboard.postJobDesc', 'tile-postjob.jpg', '/post-job',
      tint: Color(0xFFFDF1E7), accent: Color(0xFFEA7A22), icon: Icons.description_outlined),
  _Action('dashboard.aiDiagnose', 'dashboard.aiDiagnoseDesc', 'tile-diagnose.jpg', '/diagnose',
      tint: Color(0xFFEAF2FE), accent: Color(0xFF2563EB), icon: Icons.auto_awesome),
  _Action('landing.instantQuote', 'dashboard.instantQuoteDesc', 'tile-quote.jpg', '/instant-quote',
      tint: Color(0xFFE9F8EF), accent: Color(0xFF16A34A), icon: Icons.sell_outlined),
  _Action('dashboard.findPros', 'dashboard.findProsDesc', 'tile-browse.jpg', '/browse',
      tint: Color(0xFFF1EDFD), accent: Color(0xFF7C3AED), icon: Icons.groups_outlined),
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
  String _city = '';
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
                  Flexible(
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Image.asset('assets/images/tarea-home-mark.png', width: 32, height: 32),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('Tarea',
                                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink, height: 1)),
                            // The strapline from the launch artwork, which the
                            // dashboard never carried.
                            Text('dashboard.tagline'.tr(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 11, fontWeight: FontWeight.w600, color: C.muted, height: 1.3)),
                          ],
                        ),
                      ),
                    ]),
                  ),
                  Row(children: [
                    // Live, not decorative: it shows the city on the profile
                    // and opens the screen where that city is changed. A chip
                    // that looked like a picker and did nothing would be worse
                    // than no chip at all.
                    // Always shown. It used to render only when the profile
                    // already had a city, which meant the one person who most
                    // needs it -- someone who has not set a location -- saw
                    // nothing at all.
                    GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => context.push('/edit-profile').then((_) { if (mounted) _load(); }),
                        child: Padding(
                          padding: const EdgeInsets.only(right: 10),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.place_outlined, size: 15, color: C.muted),
                            const SizedBox(width: 3),
                            ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 92),
                              child: Text(_city.isEmpty ? 'dashboard.setLocation'.tr() : _city,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: _city.isEmpty ? C.muted : C.ink)),
                            ),
                            const Icon(Icons.expand_more, size: 15, color: C.muted),
                          ]),
                        ),
                      ),
                    GestureDetector(
                      onTap: () => context.push('/notifications').then((_) { if (mounted) _load(); }),
                      child: UnreadBell(count: _unread),
                    ),
                    const SizedBox(width: 10),
                    // The avatar looked like a control and was not one — tapping it
                    // did nothing, which is exactly where someone goes to change
                    // their picture.
                    GestureDetector(
                      onTap: () => context.push('/profile').then((_) { if (mounted) _load(); }),
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
              // The hero IS the supplied artwork. Its headline, subtitle, pill
              // and the handwritten "More time for what matters" are painted
              // into the image, so nothing is drawn over it and the whole
              // banner is the tap target -- the same rule the action cards
              // followed before they went back to a grid.
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => context.push('/post-job'),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: AspectRatio(
                    aspectRatio: 752 / 318,
                    child: Image.asset('assets/images/hero-home.png',
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const SizedBox.shrink()),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              // Two by two. IntrinsicHeight keeps the pair in a row the same
              // height, so a longer description cannot make one card taller
              // than its neighbour.
              Column(
                children: [
                  for (int i = 0; i < _actions.length; i += 2) ...[
                    if (i > 0) const SizedBox(height: 12),
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (int j = i; j < i + 2 && j < _actions.length; j++) ...[
                            if (j > i) const SizedBox(width: 12),
                            Expanded(child: _actionCard(_actions[j], j)),
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


  Widget _actionCard(_Action a, int index) => _ActionCard(action: a, index: index);

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

/// A dashboard card: the picture, and the two things touch expects of it.
///
/// A ripple is the usual answer, but these cards are photographs -- a ripple
/// spreading over a photo is nearly invisible, so the press had no feedback at
/// all. Scaling the whole card instead reads as something physical being
/// pushed, and it works regardless of what the picture underneath looks like.
class _ActionCard extends StatefulWidget {
  const _ActionCard({required this.action, required this.index});

  final _Action action;

  /// Position in the list, used to stagger the entrance so the four cards
  /// arrive in sequence rather than all at once.
  final int index;

  @override
  State<_ActionCard> createState() => _ActionCardState();
}

class _ActionCardState extends State<_ActionCard> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final a = widget.action;
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    Widget card = AnimatedScale(
      scale: _down && !reduced ? 0.96 : 1.0,
      duration: Duration(milliseconds: _down ? 110 : 300),
      curve: _down ? Curves.easeOut : Curves.easeOutBack,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          color: a.tint,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: _down ? 0.04 : 0.07),
              blurRadius: _down ? 4 : 12,
              offset: Offset(0, _down ? 1 : 4),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Stack(
            children: [
              // The photo bleeds off the top-right corner, behind the text.
              // Only the LEFT half of each source is used -- the right half
              // carries baked-in marketing text that would be unreadable at
              // this size and wrong next to the real title.
              Positioned(
                right: 0, top: 0, bottom: 0, width: 96,
                child: ShaderMask(
                  // Fades into the tint so there is no hard seam where the
                  // photograph meets the flat colour.
                  shaderCallback: (r) => LinearGradient(
                    begin: Alignment.centerRight,
                    end: Alignment.centerLeft,
                    colors: [Colors.white, Colors.white.withValues(alpha: 0)],
                    stops: const [0.45, 1.0],
                  ).createShader(r),
                  blendMode: BlendMode.dstIn,
                  child: Image.asset(
                    'assets/images/${a.img}',
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 38, height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.85),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(a.icon, color: a.accent, size: 21),
                    ),
                    const SizedBox(height: 40),
                    Text(a.titleKey.tr(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w900, color: C.ink)),
                    const SizedBox(height: 2),
                    Text(a.descKey.tr(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, height: 1.25, color: C.muted)),
                  ],
                ),
              ),
              Positioned(
                right: 10, bottom: 10,
                child: Container(
                  width: 28, height: 28,
                  decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                  child: Icon(Icons.chevron_right, size: 18, color: a.accent),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (!reduced) {
      // Fade up on first paint, one after another. Runs once: the builder is
      // driven by a Tween that has already reached its end on any rebuild.
      card = TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.0, end: 1.0),
        duration: Duration(milliseconds: 520 + widget.index * 150),
        curve: Curves.easeOutCubic,
        builder: (_, t, child) {
          // Hold each card still until its turn, then run its own 60%.
          final start = widget.index * 0.16;
          final p = ((t - start) / (1 - start)).clamp(0.0, 1.0);
          return Opacity(
            opacity: p,
            child: Transform.translate(offset: Offset(0, (1 - p) * 28), child: child),
          );
        },
        child: card,
      );
    }

    return Semantics(
      button: true,
      // The words live inside the JPEG, where a screen reader cannot reach
      // them. These keys are the same strings the artwork shows.
      label: '${a.titleKey.tr()}. ${a.descKey.tr()}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _down = true),
        onTapUp: (_) => setState(() => _down = false),
        onTapCancel: () => setState(() => _down = false),
        onTap: () => context.push(a.route),
        child: card,
      ),
    );
  }
}
