import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme.dart';
import '../api.dart';
import '../avatar_util.dart';

// [translation key, textColor, bgColor]
const _reqStatus = {
  'OPEN': ['requests.statusOpen', 0xFF2563EB, 0xFFEFF5FF],
  'ASSIGNED': ['requests.statusAssigned', 0xFF15803D, 0xFFDCFCE7],
  'CLOSED': ['requests.statusClosed', 0xFF64748B, 0xFFF1F5F9],
};

class RequestsScreen extends StatefulWidget {
  const RequestsScreen({super.key});
  @override
  State<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends State<RequestsScreen> {
  List<dynamic> _reqs = [];
  bool _loading = true;
  bool _busy = false;

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

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _respond(String reqId, String appId, String action) async {
    if (action == 'accept') {
      final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
        title: Text('requests.hireTitle'.tr()),
        content: Text('requests.hireBody'.tr()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text('common.cancel'.tr())),
          TextButton(onPressed: () => Navigator.pop(context, true), child: Text('requests.hire'.tr(), style: const TextStyle(fontWeight: FontWeight.w800))),
        ],
      ));
      if (ok != true) return;
    }
    setState(() => _busy = true);
    try {
      final res = await Api.patch('/job-requests/$reqId/applications/$appId', {'action': action, 'platform': 'app'});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Hiring IS paying: accepting an applicant returns a Stripe Checkout
        // link, and nobody is hired — no application accepted, no runner-up
        // rejected, no notification to the pro — until that payment lands.
        // Closing the payment page simply leaves the request open.
        String? payUrl;
        try { payUrl = (jsonDecode(res.body) as Map)['checkoutUrl']?.toString(); } catch (_) {}
        if (action == 'accept' && payUrl != null && payUrl.startsWith('http')) {
          _toast('requests.hirePaying'.tr());
          await launchUrl(Uri.parse(payUrl), mode: LaunchMode.externalApplication);
        } else {
          _toast(action == 'accept' ? 'requests.proHired'.tr() : 'requests.applicantDeclined'.tr());
        }
        await _load();
      } else {
        String msg = 'requests.updateFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.bg, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30), onPressed: () => context.pop()),
        title: Text('profile.myRequests'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _reqs.isEmpty
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.description_outlined, size: 56, color: C.muted),
                  const SizedBox(height: 12),
                  Text('requests.noneTitle'.tr(), style: const TextStyle(color: C.muted, fontWeight: FontWeight.w700)),
                ]))
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: _reqs.length,
                  itemBuilder: (_, i) => _requestCard(_reqs[i] as Map),
                ),
    );
  }

  Widget _requestCard(Map r) {
    final meta = _reqStatus[r['status']] ?? ['requests.statusFallback', 0xFF64748B, 0xFFF1F5F9];
    final category = (r['category'] ?? 'pro.jobFallback'.tr()).toString();
    final desc = (r['description'] ?? '').toString();
    final apps = (r['applications'] as List?) ?? [];
    final open = r['status'] == 'OPEN';
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => context
          .push('/request-detail', extra: r.cast<String, dynamic>())
          .then((changed) { if (changed == true && mounted) _load(); }),
      child: Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(_pretty(category), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16))),
          const Icon(Icons.chevron_right, color: C.muted, size: 20),
          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: Color(meta[2] as int), borderRadius: BorderRadius.circular(20)),
            child: Text((meta[0] as String).tr(), style: TextStyle(color: Color(meta[1] as int), fontWeight: FontWeight.w800, fontSize: 12))),
        ]),
        if (desc.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(desc, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted, height: 1.3)),
        ],
        const SizedBox(height: 12),
        Text(apps.isEmpty ? 'requests.noApplied'.tr() : (apps.length == 1 ? 'requests.prosAppliedOne' : 'requests.prosAppliedMany').tr(args: ['${apps.length}']),
          style: TextStyle(color: apps.isEmpty ? C.muted : C.blue, fontWeight: FontWeight.w800, fontSize: 13)),
        ...apps.map((a) => _applicantRow(r['id'].toString(), a as Map, open)),
      ]),
      ),
    );
  }

  Widget _applicantRow(String reqId, Map a, bool open) {
    final u = (a['user'] ?? {}) as Map;
    final hp = (a['handyman'] ?? {}) as Map;
    final name = (u['name'] ?? 'Pro').toString();
    final rating = ((hp['rating']) as num?)?.toDouble() ?? 0;
    final jobs = (hp['totalJobs'] ?? 0);
    final st = (a['status'] ?? '').toString();
    final accepted = st == 'ACCEPTED';
    final rejected = st == 'REJECTED';
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        Row(children: [
          roundAvatar(url: (u['avatarUrl'] ?? '').toString(), radius: 20),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink)),
            Row(children: [
              const Icon(Icons.star, size: 14, color: Color(0xFFF59E0B)),
              const SizedBox(width: 3),
              Text(rating > 0 ? rating.toStringAsFixed(1) : 'browse.newRating'.tr(), style: const TextStyle(color: C.muted, fontSize: 12)),
              Text('  ${'requests.jobsCount'.tr(args: ['$jobs'])}', style: const TextStyle(color: C.muted, fontSize: 12)),
            ]),
          ])),
          if (accepted) Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.check, size: 14, color: Color(0xFF16A34A)),
            const SizedBox(width: 3),
            Text('requests.hired'.tr(), style: const TextStyle(color: Color(0xFF16A34A), fontWeight: FontWeight.w800, fontSize: 12)),
          ]),
          if (rejected) Text('requests.declined'.tr(), style: const TextStyle(color: C.muted, fontWeight: FontWeight.w700, fontSize: 12)),
        ]),
        if ((hp['bio'] ?? '') != '') ...[
          const SizedBox(height: 6),
          Text((hp['bio']).toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted, fontSize: 12)),
        ],
        if (open && st == 'PENDING') ...[
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: OutlinedButton(
              style: OutlinedButton.styleFrom(side: const BorderSide(color: C.line)),
              onPressed: _busy ? null : () => _respond(reqId, a['id'].toString(), 'reject'),
              child: Text('requests.decline'.tr(), style: const TextStyle(color: C.muted, fontWeight: FontWeight.w800)))),
            const SizedBox(width: 8),
            Expanded(flex: 2, child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: C.blue),
              onPressed: _busy ? null : () => _respond(reqId, a['id'].toString(), 'accept'),
              child: Text('requests.hire'.tr(), style: const TextStyle(fontWeight: FontWeight.w800)))),
          ]),
        ],
      ]),
    );
  }

  String _pretty(String c) => c.isEmpty ? 'Job' : c[0].toUpperCase() + c.substring(1).toLowerCase().replaceAll('_', ' ');
}
