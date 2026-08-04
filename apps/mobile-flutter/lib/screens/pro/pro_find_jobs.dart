import 'dart:convert';
import 'package:flutter/material.dart';
import '../../theme.dart';
import '../../api.dart';

class ProFindJobs extends StatefulWidget {
  const ProFindJobs({super.key});
  @override
  State<ProFindJobs> createState() => _ProFindJobsState();
}

class _ProFindJobsState extends State<ProFindJobs> {
  List<dynamic> _jobs = [];
  bool _loading = true;
  final Set<String> _applied = {};

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/job-requests');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        _jobs = d is List ? d : (d['requests'] ?? d['jobRequests'] ?? []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _apply(String id) async {
    setState(() => _applied.add(id));
    try {
      final res = await Api.post('/job-requests/$id/apply', {});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Application sent!')));
      } else {
        setState(() => _applied.remove(id));
        String msg = 'Could not apply. Please try again.';
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      setState(() => _applied.remove(id));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not connect. Please try again.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 8, 20, 4),
            child: Text('Find Jobs', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: C.ink)),
          ),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Text('Open jobs near you — apply to get hired.', style: TextStyle(color: C.muted))),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _jobs.isEmpty
                    ? const Center(child: Text('No open jobs right now.', style: TextStyle(color: C.muted)))
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        itemCount: _jobs.length,
                        itemBuilder: (_, i) => _jobCard(_jobs[i]),
                      ),
          ),
        ]),
      ),
    );
  }

  Widget _jobCard(dynamic j) {
    final id = (j['id'] ?? '').toString();
    final title = (j['title'] ?? _pretty((j['category'] ?? 'General').toString())).toString();
    final rawCat = (j['category'] ?? '').toString();
    final category = _pretty(rawCat);
    final desc = (j['description'] ?? '').toString();
    final city = (j['city'] ?? '').toString();
    final min = j['budgetMin'], max = j['budgetMax'];
    final km = j['distanceKm'];
    final applied = _applied.contains(id);
    final cc = _catColor(rawCat);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: C.white,
        borderRadius: BorderRadius.circular(16),
        border: Border(left: BorderSide(color: cc, width: 4)),
        boxShadow: [BoxShadow(color: cc.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 42, height: 42,
            decoration: BoxDecoration(color: cc.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
            child: Icon(_catIcon(rawCat), color: cc, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
              const SizedBox(height: 2),
              Text(category, style: TextStyle(color: cc, fontSize: 12.5, fontWeight: FontWeight.w800)),
            ]),
          ),
          if (min != null || max != null)
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('\$${(min ?? max as num).round()}–${(max ?? min as num).round()}', style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF16A34A), fontSize: 16)),
              const Text('budget', style: TextStyle(color: C.muted, fontSize: 11)),
            ]),
        ]),
        if (desc.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(desc, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted, height: 1.3)),
        ],
        const SizedBox(height: 10),
        Row(children: [
          const Icon(Icons.location_on_outlined, size: 15, color: C.muted),
          const SizedBox(width: 3),
          Text('$city${km != null ? ' · ${(km as num).toStringAsFixed(0)} km' : ''}', style: const TextStyle(color: C.muted, fontSize: 13)),
          const Spacer(),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: applied ? C.muted : C.blue, padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
            onPressed: applied ? null : () => _apply(id),
            child: Text(applied ? 'Applied' : 'Apply', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
        ]),
      ]),
    );
  }

  String _pretty(String c) => c.isEmpty ? '' : c[0].toUpperCase() + c.substring(1).toLowerCase().replaceAll('_', ' ');

  Color _catColor(String c) {
    switch (c.toUpperCase()) {
      case 'PLUMBING': return const Color(0xFF2563EB);
      case 'ELECTRICAL': return const Color(0xFFF59E0B);
      case 'PAINTING': return const Color(0xFF7C3AED);
      case 'CARPENTRY': return const Color(0xFFD97706);
      case 'CLEANING': return const Color(0xFF10B981);
      case 'HVAC': return const Color(0xFF06B6D4);
      case 'ROOFING': return const Color(0xFF4F46E5);
      case 'LANDSCAPING': return const Color(0xFF16A34A);
      case 'MOVING': return const Color(0xFFFB923C);
      case 'APPLIANCE_REPAIR': return const Color(0xFF0D9488);
      case 'LAUNDRY': return const Color(0xFF3B82F6);
      default: return C.blue;
    }
  }

  IconData _catIcon(String c) {
    switch (c.toUpperCase()) {
      case 'PLUMBING': return Icons.water_drop_outlined;
      case 'ELECTRICAL': return Icons.bolt_outlined;
      case 'PAINTING': return Icons.palette_outlined;
      case 'CARPENTRY': return Icons.handyman_outlined;
      case 'CLEANING': return Icons.auto_awesome_outlined;
      case 'HVAC': return Icons.ac_unit_outlined;
      case 'ROOFING': return Icons.roofing_outlined;
      case 'LANDSCAPING': return Icons.eco_outlined;
      case 'MOVING': return Icons.local_shipping_outlined;
      case 'APPLIANCE_REPAIR': return Icons.kitchen_outlined;
      case 'LAUNDRY': return Icons.local_laundry_service_outlined;
      default: return Icons.work_outline;
    }
  }
}
