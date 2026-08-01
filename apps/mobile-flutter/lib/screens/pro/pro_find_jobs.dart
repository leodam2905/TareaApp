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
    try { await Api.post('/job-requests/$id/apply', {}); } catch (_) {}
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Application sent!')));
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
    final category = _pretty((j['category'] ?? '').toString());
    final desc = (j['description'] ?? '').toString();
    final city = (j['city'] ?? '').toString();
    final min = j['budgetMin'], max = j['budgetMax'];
    final km = j['distanceKm'];
    final applied = _applied.contains(id);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(8)),
            child: Text(category, style: const TextStyle(color: C.blue, fontSize: 12, fontWeight: FontWeight.w700)),
          ),
          const Spacer(),
          if (min != null || max != null)
            Text('\$${(min ?? max as num).round()}–\$${(max ?? min as num).round()}', style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
        ]),
        const SizedBox(height: 10),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
        if (desc.isNotEmpty) ...[
          const SizedBox(height: 4),
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
}
