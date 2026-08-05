import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';
import '../api.dart';
import '../avatar_util.dart';

class _Action {
  final String title, desc, img;
  const _Action(this.title, this.desc, this.img);
}

const _actions = [
  _Action('Post a Job', 'Tell us what you need done', 'action-postjob.png'),
  _Action('Find Pros', 'Discover trusted pros & reviews', 'action-findpros.png'),
  _Action('AI Diagnose', 'Upload a photo, get AI insights', 'action-diagnose.png'),
  _Action('Instant Quote', 'Get an estimated price fast', 'action-quote.png'),
];

class _Cat {
  final IconData icon;
  final String label;
  const _Cat(this.icon, this.label);
}

const _cats = [
  _Cat(Icons.water_drop_outlined, 'Plumbing'),
  _Cat(Icons.bolt_outlined, 'Electrical'),
  _Cat(Icons.auto_awesome_outlined, 'Cleaning'),
  _Cat(Icons.palette_outlined, 'Painting'),
  _Cat(Icons.handyman_outlined, 'Carpentry'),
  _Cat(Icons.ac_unit_outlined, 'HVAC'),
  _Cat(Icons.eco_outlined, 'Landscaping'),
  _Cat(Icons.local_laundry_service_outlined, 'Laundry'),
];

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  String _firstName = '';
  String _avatar = '';
  List<dynamic> _pros = [];
  List<dynamic> _recent = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

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
      final res = await Api.get('/job-requests');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final list = (data is List ? data : (data['requests'] ?? data['jobRequests'] ?? [])) as List;
        for (final r in list) { if (r is Map) r['_isRequest'] = true; }
        activity.addAll(list);
      }
    } catch (_) {}
    DateTime _when(dynamic x) => DateTime.tryParse(
        (x['updatedAt'] ?? x['createdAt'] ?? x['scheduledAt'] ?? '').toString()) ?? DateTime(2000);
    activity.sort((a, b) => _when(b).compareTo(_when(a)));
    if (mounted) setState(() => _recent = activity.take(4).toList());
  }

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.white,
      body: SafeArea(
        child: SingleChildScrollView(
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
                    GestureDetector(onTap: () => context.push('/notifications'), child: _circleIcon(Icons.notifications_none)),
                    const SizedBox(width: 10),
                    roundAvatar(url: _avatar, radius: 18),
                  ]),
                ],
              ),
              const SizedBox(height: 16),
              Text(_greeting, style: const TextStyle(fontSize: 14, color: C.muted)),
              Text(_firstName.isEmpty ? 'there' : _firstName,
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
              const Text('Categories', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: C.ink)),
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
                  children: const [
                    Text('20% off', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: Color(0xFFB45309))),
                    Text('your first job', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFFB45309))),
                    SizedBox(height: 4),
                    Text('Use code TAREA20 on any first order', style: TextStyle(fontSize: 14, color: Color(0xFFC2610C))),
                  ],
                ),
              ),
              // Recommended near you
              if (_pros.isNotEmpty) ...[
                _sectionHead('Recommended near you', onSeeAll: () => context.push('/browse')),
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
              _sectionHead('Recent activity', onSeeAll: _recent.isEmpty ? null : () {}),
              const SizedBox(height: 12),
              if (_recent.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  alignment: Alignment.center,
                  child: const Text('No activity yet. Post a job to get started.', style: TextStyle(color: C.muted)),
                )
              else
                ..._recent.map(_activityRow),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _circleIcon(IconData icon) => Container(
        width: 40, height: 40,
        decoration: const BoxDecoration(color: C.surface, shape: BoxShape.circle),
        child: Icon(icon, color: C.ink, size: 22),
      );

  Widget _actionCard(_Action a) {
    return GestureDetector(
      onTap: () {
        if (a.title == 'Post a Job') context.push('/post-job');
        if (a.title == 'Find Pros') context.push('/browse');
        if (a.title == 'AI Diagnose') context.push('/diagnose');
        if (a.title == 'Instant Quote') context.push('/instant-quote');
      },
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
              child: Text(a.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
            ),
          ),
          const SizedBox(height: 2),
          Text(a.desc, style: const TextStyle(fontSize: 13, color: C.muted, height: 1.25)),
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
              child: Text(c.label, maxLines: 1,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: C.ink)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionHead(String title, {VoidCallback? onSeeAll}) => Padding(
        padding: const EdgeInsets.only(top: 24),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Flexible(child: Text(title, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink))),
            if (onSeeAll != null) ...[
              const SizedBox(width: 12),
              GestureDetector(onTap: onSeeAll, child: const Text('See all', style: TextStyle(color: C.blue, fontWeight: FontWeight.w800))),
            ],
          ],
        ),
      );

  Widget _proMini(dynamic p) {
    final name = (p['name'] ?? 'Pro').toString();
    final services = (p['services'] as List?) ?? const [];
    final trade = services.isNotEmpty ? '${_prettyCat((services[0]['category'] ?? '').toString())} Pro' : 'Handyman';
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

  Widget _activityRow(dynamic b) {
    final isReq = b['_isRequest'] == true;
    final service = (b['service']?['title'] ?? b['category'] ?? b['title'] ?? 'Service').toString();
    final rawStatus = (b['status'] ?? '').toString();
    final label = isReq && rawStatus == 'OPEN'
        ? 'Posted'
        : rawStatus.isEmpty ? '' : '${rawStatus[0]}${rawStatus.substring(1).toLowerCase().replaceAll('_', ' ')}';
    return GestureDetector(
      onTap: () {
        if (isReq) {
          context.push('/requests').then((_) { if (mounted) _load(); });
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
        if (label.isNotEmpty)
          Text(label,
              style: TextStyle(color: isReq ? C.blue : C.muted, fontSize: 12, fontWeight: FontWeight.w700)),
      ]),
      ),
    );
  }

  String _prettyCat(String c) {
    if (c.isEmpty) return '';
    return c[0].toUpperCase() + c.substring(1).toLowerCase().replaceAll('_', ' ');
  }
}
