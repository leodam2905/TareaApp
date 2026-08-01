import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';
import '../api.dart';

const _reqStatus = {
  'OPEN': ['Open', 0xFF2563EB, 0xFFEFF5FF],
  'ASSIGNED': ['Assigned', 0xFF15803D, 0xFFDCFCE7],
  'CLOSED': ['Closed', 0xFF64748B, 0xFFF1F5F9],
};

class RequestsScreen extends StatefulWidget {
  const RequestsScreen({super.key});
  @override
  State<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends State<RequestsScreen> {
  List<dynamic> _reqs = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/job-requests');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        _reqs = d is List ? d : (d['requests'] ?? d['jobRequests'] ?? []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.bg, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30), onPressed: () => context.pop()),
        title: const Text('My Requests', style: TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _reqs.isEmpty
              ? const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.description_outlined, size: 56, color: C.muted),
                  SizedBox(height: 12),
                  Text('No requests yet', style: TextStyle(color: C.muted, fontWeight: FontWeight.w700)),
                ]))
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: _reqs.length,
                  itemBuilder: (_, i) {
                    final r = _reqs[i] as Map;
                    final meta = _reqStatus[r['status']] ?? ['Request', 0xFF64748B, 0xFFF1F5F9];
                    final category = (r['category'] ?? 'Job').toString();
                    final desc = (r['description'] ?? '').toString();
                    final offers = (r['offers'] as List?)?.length ?? (r['bids'] as List?)?.length ?? 0;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text(_pretty(category), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16))),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(color: Color(meta[2] as int), borderRadius: BorderRadius.circular(20)),
                            child: Text(meta[0] as String, style: TextStyle(color: Color(meta[1] as int), fontWeight: FontWeight.w800, fontSize: 12)),
                          ),
                        ]),
                        if (desc.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(desc, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted, height: 1.3)),
                        ],
                        if (offers > 0) ...[
                          const SizedBox(height: 10),
                          Text('$offers pro${offers == 1 ? '' : 's'} responded', style: const TextStyle(color: C.blue, fontWeight: FontWeight.w700, fontSize: 13)),
                        ],
                      ]),
                    );
                  },
                ),
    );
  }

  String _pretty(String c) => c.isEmpty ? 'Job' : c[0].toUpperCase() + c.substring(1).toLowerCase().replaceAll('_', ' ');
}
