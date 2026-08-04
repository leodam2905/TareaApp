import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';
import '../api.dart';

class _Cat {
  final String value;
  final String label;
  final IconData icon;
  const _Cat(this.value, this.label, this.icon);
}

const _cats = [
  _Cat('', 'All', Icons.grid_view_rounded),
  _Cat('PLUMBING', 'Plumbing', Icons.water_drop_outlined),
  _Cat('ELECTRICAL', 'Electrical', Icons.bolt_outlined),
  _Cat('CLEANING', 'Cleaning', Icons.auto_awesome_outlined),
  _Cat('PAINTING', 'Painting', Icons.palette_outlined),
  _Cat('CARPENTRY', 'Carpentry', Icons.handyman_outlined),
  _Cat('HVAC', 'HVAC', Icons.ac_unit_outlined),
  _Cat('LANDSCAPING', 'Landscaping', Icons.eco_outlined),
];

const _trustDefs = {
  'licensed': ['Licensed', 0xFF2563EB],
  'insured': ['Insured', 0xFF10B981],
  'backgroundCheck': ['Background checked', 0xFF7C3AED],
};

class BrowseScreen extends StatefulWidget {
  const BrowseScreen({super.key});
  @override
  State<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends State<BrowseScreen> {
  List<dynamic> _pros = [];
  final Set<String> _favIds = {};
  bool _loading = true;
  String _cat = '';
  bool _nearMe = true;
  String _sort = 'best';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await Api.get('/handyman/browse');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        _pros = data is List ? data : (data['handymen'] ?? data['pros'] ?? []);
      }
    } catch (_) {}
    try {
      final res = await Api.get('/favorites');
      if (res.statusCode == 200) {
        final list = (jsonDecode(res.body) is List ? jsonDecode(res.body) : (jsonDecode(res.body)['favorites'] ?? [])) as List;
        _favIds
          ..clear()
          ..addAll(list.map((f) => (f['handymanUserId'] ?? f['handyman']?['id'] ?? f['id'] ?? '').toString()));
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _toggleFav(String userId) async {
    final next = !_favIds.contains(userId);
    setState(() => next ? _favIds.add(userId) : _favIds.remove(userId));
    try {
      final res = next ? await Api.post('/favorites/$userId', {}) : await Api.delete('/favorites/$userId');
      if (res.statusCode < 200 || res.statusCode >= 300) setState(() => next ? _favIds.remove(userId) : _favIds.add(userId));
    } catch (_) { setState(() => next ? _favIds.remove(userId) : _favIds.add(userId)); }
  }

  List<dynamic> get _filtered {
    var list = _pros.where((h) {
      if (_cat.isEmpty) return true;
      final services = (h['services'] as List?) ?? const [];
      return services.any((s) => (s['category'] ?? '').toString() == _cat);
    }).toList();
    double rate(h) => ((h['handymanProfile']?['hourlyRate']) as num?)?.toDouble() ?? 1e9;
    double rating(h) => ((h['handymanProfile']?['rating']) as num?)?.toDouble() ?? 0;
    if (_sort == 'rating') list.sort((a, b) => rating(b).compareTo(rating(a)));
    if (_sort == 'price') list.sort((a, b) => rate(a).compareTo(rate(b)));
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 20, 8),
              child: Row(children: [
                IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 28), onPressed: () => context.pop()),
                const Text('Browse Pros', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: C.ink)),
                const Spacer(),
                const Icon(Icons.location_on_outlined, size: 15, color: C.muted),
                const SizedBox(width: 2),
                const Text('Near you', style: TextStyle(color: C.muted)),
              ]),
            ),
            // Category chips
            SizedBox(
              height: 78,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _cats.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (_, i) => _catTile(_cats[i]),
              ),
            ),
            const SizedBox(height: 10),
            // Filter pills
            SizedBox(
              height: 38,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _pill('Within 60 mi', on: _nearMe, icon: Icons.navigation_outlined, onTap: () => setState(() => _nearMe = !_nearMe)),
                  _pill('Available now', on: true, dot: true),
                  _pill('Top rated', on: _sort == 'rating', onTap: () => setState(() => _sort = _sort == 'rating' ? 'best' : 'rating')),
                  _pill('Price', on: _sort == 'price', trailing: Icons.keyboard_arrow_down, onTap: () => setState(() => _sort = _sort == 'price' ? 'best' : 'price')),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Divider(color: C.line, height: 1),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _filtered.isEmpty
                      ? const Center(child: Text('No pros match your filters.', style: TextStyle(color: C.muted)))
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                          itemCount: _filtered.length,
                          itemBuilder: (_, i) => _proCard(_filtered[i]),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _catTile(_Cat c) {
    final sel = _cat == c.value;
    return GestureDetector(
      onTap: () => setState(() => _cat = c.value),
      child: SizedBox(
        width: 64,
        child: Column(children: [
          Container(
            width: 52, height: 52,
            decoration: BoxDecoration(
              color: sel ? const Color(0xFFEFF5FF) : C.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: sel ? C.blue : C.line),
            ),
            child: Icon(c.icon, color: sel ? C.blue : const Color(0xFF475569), size: 22),
          ),
          const SizedBox(height: 6),
          FittedBox(fit: BoxFit.scaleDown, child: Text(c.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: sel ? C.blue : C.muted))),
        ]),
      ),
    );
  }

  Widget _pill(String label, {bool on = false, IconData? icon, IconData? trailing, bool dot = false, VoidCallback? onTap}) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: on ? const Color(0xFFEFF5FF) : C.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: on ? const Color(0xFFBFD4FF) : C.line),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (dot) Container(width: 7, height: 7, margin: const EdgeInsets.only(right: 6), decoration: const BoxDecoration(color: C.green, shape: BoxShape.circle)),
            if (icon != null) ...[Icon(icon, size: 13, color: on ? C.blue : C.muted), const SizedBox(width: 5)],
            Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: dot ? C.green : (on ? C.blue : C.muted))),
            if (trailing != null) Icon(trailing, size: 14, color: on ? C.blue : C.muted),
          ]),
        ),
      ),
    );
  }

  Widget _proCard(dynamic h) {
    final name = (h['name'] ?? 'Pro').toString();
    final hp = h['handymanProfile'] ?? {};
    final rating = hp['rating'];
    final totalJobs = hp['totalJobs'] ?? 0;
    final years = hp['yearsExperience'];
    final hourly = hp['hourlyRate'];
    final bio = (hp['bio'] ?? '').toString();
    final services = (h['services'] as List?) ?? const [];
    final specialty = services.isNotEmpty ? '${_pretty((services[0]['category'] ?? '').toString())} Pro' : 'Handyman';
    final isVerified = h['isVerified'] == true;
    final trust = (h['trust'] as Map?) ?? const {};
    final badges = _trustDefs.entries.where((e) => trust[e.key] == true).take(3).toList();

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Avatar + Available badge
              Stack(clipBehavior: Clip.none, children: [
                CircleAvatar(radius: 32, backgroundColor: C.surface,
                    child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: C.blue))),
                Positioned(
                  bottom: -6, left: 4, right: 4,
                  child: Container(
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    decoration: BoxDecoration(color: C.green, borderRadius: BorderRadius.circular(8), border: Border.all(color: C.white, width: 1.5)),
                    child: const Text('Available', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                  ),
                ),
              ]),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Flexible(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: C.ink))),
                      if (isVerified) ...[const SizedBox(width: 4), const Icon(Icons.verified, size: 16, color: C.blue)],
                      const Spacer(),
                      GestureDetector(
                        onTap: () => _toggleFav((h['id'] ?? '').toString()),
                        child: Icon(
                          _favIds.contains((h['id'] ?? '').toString()) ? Icons.favorite : Icons.favorite_border,
                          size: 20, color: _favIds.contains((h['id'] ?? '').toString()) ? C.red : const Color(0xFFCBD5E1)),
                      ),
                    ]),
                    const SizedBox(height: 2),
                    Text(specialty, style: const TextStyle(color: C.muted, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    Row(children: [
                      const Icon(Icons.star, size: 14, color: Color(0xFFF59E0B)),
                      const SizedBox(width: 3),
                      Text(rating != null ? (rating as num).toStringAsFixed(1) : 'New', style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
                      const SizedBox(width: 4),
                      Text('($totalJobs reviews)', style: const TextStyle(color: C.muted, fontSize: 12)),
                    ]),
                    if (years != null) ...[
                      const SizedBox(height: 4),
                      Row(children: [
                        const Icon(Icons.shield_outlined, size: 13, color: C.blue),
                        const SizedBox(width: 4),
                        Text('$years+ years experience', style: const TextStyle(color: C.muted, fontSize: 12)),
                      ]),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (badges.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(spacing: 6, runSpacing: 6, children: badges.map((b) {
              final color = Color(b.value[1] as int);
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(8)),
                child: Text(b.value[0] as String, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
              );
            }).toList()),
          ],
          if (bio.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(bio, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted, fontSize: 13, height: 1.4)),
          ],
          if (services.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(spacing: 6, runSpacing: 6, children: services.take(3).map<Widget>((sv) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(8)),
                  child: Text(_pretty((sv['category'] ?? '').toString()), style: const TextStyle(fontSize: 12, color: C.ink, fontWeight: FontWeight.w600)),
                )).toList()),
          ],
          const SizedBox(height: 14),
          const Divider(color: C.line, height: 1),
          const SizedBox(height: 12),
          Row(children: [
            if (hourly != null) ...[
              Text('\$${(hourly as num).round()}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
              const Text('/hr', style: TextStyle(color: C.muted)),
              const SizedBox(width: 8),
              const Text('• Min. 1 hour', style: TextStyle(color: C.muted, fontSize: 12)),
            ],
            const Spacer(),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              onPressed: () => context.push('/handyman-detail', extra: (h as Map).cast<String, dynamic>()),
              child: const Text('View Profile', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
            ),
          ]),
        ],
      ),
    );
  }

  String _pretty(String cat) {
    if (cat.isEmpty) return '';
    return cat[0].toUpperCase() + cat.substring(1).toLowerCase().replaceAll('_', ' ');
  }
}
