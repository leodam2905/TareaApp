import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme.dart';
import '../api.dart';
import '../avatar_util.dart';

// Detail view for a job request the customer posted — full info + applicants
// with hire/decline. Opened by tapping a card in RequestsScreen.
const _reqStatus = {
  'OPEN': ['requests.statusOpen', 0xFF2563EB, 0xFFEFF5FF],
  'ASSIGNED': ['requests.statusAssigned', 0xFF15803D, 0xFFDCFCE7],
  'CLOSED': ['requests.statusClosed', 0xFF64748B, 0xFFF1F5F9],
};

class RequestDetailScreen extends StatefulWidget {
  final Map<String, dynamic> request;
  const RequestDetailScreen({super.key, required this.request});
  @override
  State<RequestDetailScreen> createState() => _RequestDetailScreenState();
}

class _RequestDetailScreenState extends State<RequestDetailScreen> {
  late Map<String, dynamic> _req = widget.request;
  bool _busy = false;
  bool _changed = false;

  Future<void> _reload() async {
    try {
      final res = await Api.get('/job-requests');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        final list = d is List ? d : (d['requests'] ?? d['jobRequests'] ?? []);
        final fresh = (list as List).cast<Map>().firstWhere(
            (r) => r['id'] == _req['id'], orElse: () => {});
        if (fresh.isNotEmpty && mounted) setState(() => _req = fresh.cast<String, dynamic>());
      }
    } catch (_) {}
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _respond(String appId, String action) async {
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
      final res = await Api.patch('/job-requests/${_req['id']}/applications/$appId', {'action': action, 'platform': 'app'});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _changed = true;
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
        await _reload();
      } else {
        String msg = 'requests.updateFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  String _pretty(String c) => c.isEmpty ? 'Job' : c[0].toUpperCase() + c.substring(1).toLowerCase().replaceAll('_', ' ');

  String _date(dynamic iso) {
    final d = DateTime.tryParse((iso ?? '').toString())?.toLocal();
    if (d == null) return '—';
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final m = d.minute.toString().padLeft(2, '0');
    return '${mo[d.month - 1]} ${d.day}, ${d.year} · $h:$m ${d.hour < 12 ? 'AM' : 'PM'}';
  }

  @override
  Widget build(BuildContext context) {
    final meta = _reqStatus[_req['status']] ?? ['requests.statusFallback', 0xFF64748B, 0xFFF1F5F9];
    final title = (_req['title'] ?? _pretty((_req['category'] ?? '').toString())).toString();
    final desc = (_req['description'] ?? '').toString();
    final apps = (_req['applications'] as List?) ?? [];
    final open = _req['status'] == 'OPEN';
    final bMin = (_req['budgetMin'] as num?)?.round();
    final bMax = (_req['budgetMax'] as num?)?.round();
    final images = ((_req['imageUrls'] as List?) ?? []).cast<dynamic>();

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {},
      child: Scaffold(
        backgroundColor: C.bg,
        appBar: AppBar(
          backgroundColor: C.bg, surfaceTintColor: Colors.transparent, elevation: 0,
          leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30),
              onPressed: () => Navigator.of(context).pop(_changed)),
          title: Text('requests.detailTitle'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          children: [
            Row(children: [
              Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 22))),
              Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: Color(meta[2] as int), borderRadius: BorderRadius.circular(20)),
                child: Text((meta[0] as String).tr(), style: TextStyle(color: Color(meta[1] as int), fontWeight: FontWeight.w800, fontSize: 12))),
            ]),
            const SizedBox(height: 4),
            Text(_pretty((_req['category'] ?? '').toString()), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            if (desc.isNotEmpty) _infoCard('requests.description'.tr(), desc),
            _infoCard('requests.schedule'.tr(), _date(_req['scheduledAt'])),
            _infoCard('requests.location'.tr(),
                [_req['address'], _req['city']].where((x) => (x ?? '').toString().isNotEmpty).join(', ')),
            if (bMin != null && bMax != null)
              _infoCard('requests.budget'.tr(), bMin == bMax ? '\$$bMin' : '\$$bMin–\$$bMax'),
            if (images.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text('requests.photos'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 15)),
              const SizedBox(height: 8),
              SizedBox(
                height: 90,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: images.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(images[i].toString(), width: 90, height: 90, fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Container(width: 90, height: 90, color: C.surface, child: const Icon(Icons.broken_image_outlined, color: C.muted))),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 18),
            Text(apps.isEmpty ? 'requests.noApplied'.tr() : (apps.length == 1 ? 'requests.prosAppliedOne' : 'requests.prosAppliedMany').tr(args: ['${apps.length}']),
                style: TextStyle(color: apps.isEmpty ? C.muted : C.blue, fontWeight: FontWeight.w800, fontSize: 15)),
            ...apps.map((a) => _applicantRow(a as Map, open)),
            if (open) ...[
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFFECACA)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _busy ? null : _cancelRequest,
                  icon: const Icon(Icons.close, size: 18, color: C.red),
                  label: Text('requests.cancelRequest'.tr(), style: const TextStyle(color: C.red, fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _cancelRequest() async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: Text('requests.cancelTitle'.tr()),
      content: Text('requests.cancelBody'.tr()),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: Text('common.cancel'.tr())),
        TextButton(onPressed: () => Navigator.pop(context, true),
            child: Text('requests.cancelRequest'.tr(), style: const TextStyle(color: C.red, fontWeight: FontWeight.w800))),
      ],
    ));
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final res = await Api.delete('/job-requests/${_req['id']}');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (mounted) { _toast('requests.cancelled'.tr()); Navigator.of(context).pop(true); }
      } else {
        String msg = 'requests.updateFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Widget _infoCard(String label, String value) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: C.muted, fontWeight: FontWeight.w800, fontSize: 12)),
          const SizedBox(height: 6),
          Text(value.isEmpty ? '—' : value, style: const TextStyle(color: C.ink, height: 1.4, fontWeight: FontWeight.w600)),
        ]),
      );

  Widget _applicantRow(Map a, bool open) {
    final u = (a['user'] ?? {}) as Map;
    final hp = (a['handyman'] ?? {}) as Map;
    final name = (u['name'] ?? 'Pro').toString();
    final rating = ((hp['rating']) as num?)?.toDouble() ?? 0;
    final jobs = (hp['totalJobs'] ?? 0);
    final st = (a['status'] ?? '').toString();
    final accepted = st == 'ACCEPTED';
    final rejected = st == 'REJECTED';
    // Tapping an applicant opens the full breakdown.
    //
    // The card can only show a couple of lines before it crowds out hire and
    // decline, so it kept materials and the total — but the payload already
    // carries this pro's labour and the service fee, and requests.priceLabour
    // and requests.priceServiceFee were already translated in all four
    // languages with nothing rendering them. The customer was comparing
    // applicants on a total whose composition they could not see, on the one
    // screen where they choose who comes to their house.
    return InkWell(
      onTap: () => _showApplicantPrice(a),
      borderRadius: BorderRadius.circular(12),
      child: Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(12)),
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
          Align(alignment: Alignment.centerLeft, child: Text((hp['bio']).toString(), style: const TextStyle(color: C.muted, fontSize: 12))),
        ],
        // What hiring THIS pro costs. Pros quote their own materials, so two
        // applicants on the same job are not the same price — and without the
        // breakdown a customer comparing them is comparing names and ratings
        // while the amount they pay differs silently.
        if (((a['customerTotal'] ?? 0) as num) > 0) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(12)),
            child: Column(children: [
              _priceRow('requests.priceMaterials'.tr(),
                  '\$${((a['effectiveMaterials'] ?? 0) as num).toStringAsFixed(2)}'),
              const SizedBox(height: 6),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('requests.priceTotal'.tr(),
                    style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 13)),
                Text('\$${((a['customerTotal'] ?? 0) as num).toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
              ]),
              const SizedBox(height: 6),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text('requests.priceDetails'.tr(),
                    style: const TextStyle(color: C.blue, fontSize: 12, fontWeight: FontWeight.w800)),
                const Icon(Icons.chevron_right, size: 16, color: C.blue),
              ]),
            ]),
          ),
        ],
        if (open && st == 'PENDING') ...[
          const SizedBox(height: 10),
          Row(children: [
            // Equal widths — see the note in requests_screen.dart. Hire took two
            // thirds, leaving Decline too narrow for its own label.
            Expanded(child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: C.line),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              onPressed: _busy ? null : () => _respond(a['id'].toString(), 'reject'),
              child: Text('requests.decline'.tr(),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: C.muted, fontWeight: FontWeight.w800)))),
            const SizedBox(width: 8),
            Expanded(child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: C.blue,
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              onPressed: _busy ? null : () => _respond(a['id'].toString(), 'accept'),
              child: Text('requests.hire'.tr(),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800)))),
          ]),
        ],
      ]),
      ),
    );
  }

  /// The full price of hiring THIS applicant, and who they are.
  ///
  /// Every figure here comes from the server, which prices each applicant with
  /// hireAmounts — the same call that runs at checkout. Recomputing any of it
  /// in the app is how a preview and a charge end up disagreeing.
  void _showApplicantPrice(Map a) {
    final u = (a['user'] ?? {}) as Map;
    final hp = (a['handyman'] ?? {}) as Map;
    final labour = ((a['effectiveLabour'] ?? 0) as num).toDouble();
    final materials = ((a['effectiveMaterials'] ?? 0) as num).toDouble();
    final fee = ((a['serviceFee'] ?? 0) as num).toDouble();
    final total = ((a['customerTotal'] ?? 0) as num).toDouble();
    final years = hp['yearsExperience'];

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: C.bg,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              roundAvatar(url: (u['avatarUrl'] ?? '').toString(), radius: 24),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text((u['name'] ?? 'Pro').toString(),
                    style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 17)),
                if (years != null)
                  Text('requests.experienceYears'.tr(args: ['$years']),
                      style: const TextStyle(color: C.muted, fontSize: 12)),
              ])),
            ]),
            // Shown for EVERY category, not just the ones where a licence is
            // legally material. Browse still ranks on relevance, but here the
            // customer has already chosen the trade and is choosing a person:
            // a pro who went and got licensed and insured has earned the badge
            // on a cleaning job as much as on a roofing one.
            //
            // Still gated on credentialBadges, which means approved by an admin
            // and unexpired — never "a document was uploaded".
            if (a['licensed'] == true || a['insured'] == true) ...[
              const SizedBox(height: 10),
              Wrap(spacing: 8, children: [
                if (a['licensed'] == true) _badge('browse.licensed'.tr()),
                if (a['insured'] == true) _badge('browse.insured'.tr()),
              ]),
            ],
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
              child: Column(children: [
                _priceRow('requests.priceLabour'.tr(), '\$${labour.toStringAsFixed(2)}'),
                const SizedBox(height: 8),
                _priceRow('requests.priceMaterials'.tr(), '\$${materials.toStringAsFixed(2)}'),
                const SizedBox(height: 8),
                _priceRow('requests.priceServiceFee'.tr(), '\$${fee.toStringAsFixed(2)}'),
                const SizedBox(height: 12),
                const Divider(color: C.line, height: 1),
                const SizedBox(height: 12),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text('requests.priceTotal'.tr(),
                      style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 14)),
                  Text('\$${total.toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 20)),
                ]),
              ]),
            ),
            const SizedBox(height: 12),
            Text('requests.priceBreakdownNote'.tr(),
                style: const TextStyle(color: C.muted, fontSize: 12, height: 1.4)),
            const SizedBox(height: 8),
          ]),
        ),
      ),
    );
  }

  static Widget _badge(String label) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.verified, size: 13, color: Color(0xFF15803D)),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(color: Color(0xFF15803D), fontWeight: FontWeight.w800, fontSize: 11)),
        ]),
      );

  static Widget _priceRow(String label, String value) =>
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: const TextStyle(color: C.muted, fontSize: 12)),
        Text(value, style: const TextStyle(color: C.ink, fontSize: 12, fontWeight: FontWeight.w700)),
      ]);

}
