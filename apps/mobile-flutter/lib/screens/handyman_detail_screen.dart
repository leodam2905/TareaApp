import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';

class HandymanDetailScreen extends StatefulWidget {
  final Map<String, dynamic> pro;
  const HandymanDetailScreen({super.key, required this.pro});
  @override
  State<HandymanDetailScreen> createState() => _HandymanDetailScreenState();
}

class _HandymanDetailScreenState extends State<HandymanDetailScreen> {
  List<dynamic> _reviews = [];
  Map<String, dynamic> _p = {};
  bool _fav = false;

  @override
  void initState() {
    super.initState();
    _p = Map<String, dynamic>.from(widget.pro);
    _load();
  }

  String get _userId => (_p['id'] ?? '').toString();

  Future<void> _load() async {
    try {
      final res = await Api.get('/users/$_userId');
      if (res.statusCode == 200) {
        final full = jsonDecode(res.body);
        if (full is Map && mounted) setState(() => _p = {..._p, ...Map<String, dynamic>.from(full)});
      }
    } catch (_) {}
    try {
      final res = await Api.get('/reviews/handyman/$_userId');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (mounted) setState(() => _reviews = data is List ? data : (data['reviews'] ?? []));
      }
    } catch (_) {}
    try {
      final res = await Api.get('/favorites');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final list = (data is List ? data : (data['favorites'] ?? [])) as List;
        final fav = list.any((f) => (f['handymanUserId'] ?? f['handyman']?['id'] ?? f['id'] ?? '').toString() == _userId);
        if (mounted) setState(() => _fav = fav);
      }
    } catch (_) {}
  }

  Future<void> _toggleFav() async {
    final next = !_fav;
    setState(() => _fav = next);
    try {
      final res = next ? await Api.post('/favorites/$_userId', {}) : await Api.delete('/favorites/$_userId');
      if (res.statusCode < 200 || res.statusCode >= 300) setState(() => _fav = !next);
    } catch (_) { setState(() => _fav = !next); }
  }

  void _book({Map? service}) {
    final hp = _p['handymanProfile'] ?? {};
    context.push('/post-job', extra: {
      'handymanId': _userId,
      'proName': (_p['name'] ?? 'handymanDetail.proFallback'.tr()).toString(),
      if (service != null) 'serviceId': service['id'],
      if (service != null) 'category': (service['category'] ?? '').toString(),
      if (service != null) 'serviceRate': service['hourlyRate'] ?? hp['hourlyRate'],
    });
  }

  @override
  Widget build(BuildContext context) {
    final name = (_p['name'] ?? 'handymanDetail.proFallback'.tr()).toString();
    final hp = _p['handymanProfile'] ?? {};
    final rating = hp['rating'];
    final totalJobs = hp['totalJobs'] ?? 0;
    final hourly = hp['hourlyRate'];
    final years = hp['yearsExperience'];
    final bio = (hp['bio'] ?? '').toString();
    final services = (hp['services'] ?? _p['services'] as List?) ?? const [];
    final isVerified = _p['isVerified'] == true;

    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.bg, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30), onPressed: () => context.pop()),
        actions: [
          IconButton(
            icon: Icon(_fav ? Icons.favorite : Icons.favorite_border, color: _fav ? C.red : C.ink),
            onPressed: _toggleFav),
          const SizedBox(width: 8),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        children: [
          // Header
          Center(
            child: Column(children: [
              CircleAvatar(radius: 42, backgroundColor: C.surface,
                  child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: C.blue))),
              const SizedBox(height: 12),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: C.ink)),
                if (isVerified) ...[const SizedBox(width: 6), const Icon(Icons.verified, color: C.blue, size: 20)],
              ]),
              if (rating != null) ...[
                const SizedBox(height: 6),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.star, color: Color(0xFFF59E0B), size: 18),
                  const SizedBox(width: 4),
                  Text('handymanDetail.ratingJobs'.tr(args: [(rating as num).toStringAsFixed(1), '$totalJobs']), style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink)),
                ]),
              ],
            ]),
          ),
          const SizedBox(height: 20),
          // Stats
          Row(children: [
            if (hourly != null) _stat('\$${(hourly as num).round()}/hr', 'handymanDetail.rate'.tr()),
            _stat('$totalJobs', 'handymanDetail.jobs'.tr()),
            if (years != null) _stat('handymanDetail.yearShort'.tr(args: ['$years']), 'handymanDetail.experience'.tr()),
          ]),
          if (bio.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text('handymanDetail.about'.tr(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 8),
            Text(bio, style: const TextStyle(color: C.muted, height: 1.5)),
          ],
          if (services.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text('proProfile.services'.tr(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 8),
            ...services.map<Widget>((sv) => _serviceRow(sv)),
          ],
          if (_reviews.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text('handymanDetail.reviewsTitle'.tr(args: ['${_reviews.length}']), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 8),
            ..._reviews.take(5).map<Widget>((r) => _reviewRow(r)),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30))),
            onPressed: () => _book(),
            child: Text('handymanDetail.request'.tr(args: [name.split(' ').first]), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
          ),
        ),
      ),
    );
  }

  Widget _stat(String value, String label) => Expanded(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
          child: Column(children: [
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: C.muted, fontSize: 12)),
          ]),
        ),
      );

  Widget _serviceRow(dynamic sv) {
    final title = (sv['title'] ?? _pretty((sv['category'] ?? '').toString())).toString();
    final rate = sv['hourlyRate'] as num?;
    final priceText = rate != null ? '\$${rate.round()}/hr' : '';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink, fontSize: 15)),
            if (priceText.isNotEmpty) Text(priceText, style: const TextStyle(color: C.muted)),
          ]),
        ),
        GestureDetector(
          onTap: () => _book(service: sv is Map ? sv : null),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text('handymanDetail.book'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_forward, size: 16, color: C.blue),
          ]),
        ),
      ]),
    );
  }

  Widget _reviewRow(dynamic r) {
    final author = (r['author']?['name'] ?? 'proJobs.customerFallback'.tr()).toString();
    final rating = (r['rating'] ?? 0) as num;
    final comment = (r['comment'] ?? '').toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(author, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
          const Spacer(),
          Row(mainAxisSize: MainAxisSize.min, children: List.generate(5, (i) => Icon(
            i < rating.round() ? Icons.star : Icons.star_border,
            size: 15, color: const Color(0xFFF59E0B)))),
        ]),
        if (comment.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(comment, style: const TextStyle(color: C.muted, height: 1.4)),
        ],
      ]),
    );
  }

  String _pretty(String c) {
    if (c.isEmpty) return 'proProfile.serviceFallback'.tr();
    return c[0].toUpperCase() + c.substring(1).toLowerCase().replaceAll('_', ' ');
  }
}
