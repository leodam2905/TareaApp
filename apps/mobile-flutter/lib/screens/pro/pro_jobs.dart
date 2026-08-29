import 'dart:convert';
import '../../widgets/materials_sheet.dart';
import '../../tab_refresh.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import 'package:image_picker/image_picker.dart';
import '../../api.dart';

// [translation key, textColor, bgColor]
const _statusPill = {
  'PENDING': ['status.pending', 0xFFB45309, 0xFFFEF3C7],
  'ACCEPTED': ['status.confirmed', 0xFF15803D, 0xFFDCFCE7],
  'IN_PROGRESS': ['status.inProgress', 0xFFC2410C, 0xFFFFEDD5],
  'COMPLETED': ['status.completed', 0xFF15803D, 0xFFDCFCE7],
  'CANCELLED': ['status.cancelled', 0xFFB91C1C, 0xFFFEE2E2],
};

class ProJobs extends StatefulWidget {
  const ProJobs({super.key});
  @override
  State<ProJobs> createState() => _ProJobsState();
}

class _ProJobsState extends State<ProJobs> with TabRefreshMixin {
  @override
  int get tabIndex => 2;

  @override
  void onTabRefresh() => _load();

  List<dynamic> _bookings = [];
  // Applications the customer has not answered yet. These are NOT bookings —
  // a booking only exists once the pro is hired — so without this the work a
  // pro is waiting on appeared nowhere in the app.
  List<dynamic> _pending = [];
  bool _loading = true;
  String _filter = 'ALL';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/bookings?role=handyman');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        _bookings = d is List ? d : (d['bookings'] ?? []);
      }
    } catch (_) {}
    try {
      final res = await Api.get('/handyman/applications');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        final all = d is List ? d : (d['applications'] ?? []);
        // Only what the pro is still waiting on. A rejected application, or one
        // whose job went to somebody else, is not "pending work".
        _pending = all.where((a) =>
            a['status'] == 'PENDING' && a['jobRequest']?['status'] == 'OPEN').toList();
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _setStatus(dynamic b, String status) async {
    try {
      final res = await Api.patch('/bookings/${b['id']}', {'status': status});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setState(() => b['status'] = status);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('proJobs.updateFailed'.tr())));
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('common.connectionRetry'.tr())));
    }
  }

  // Pro signals work finished — the customer then confirms + releases payment.
  Future<void> _markWorkDone(dynamic b) async {
    // Offer to attach the materials receipt, but only when there were
    // materials. Asking for a receipt on a job with none is a question with no
    // right answer, and the pro learns to dismiss the prompt.
    String? receiptUrl;
    num? materialsActual;
    final estimate = (b['materialsEstimate'] ?? 0) as num;
    if (estimate > 0) {
      final out = await showMaterialsAtFinish(context, estimate);
      if (out == null) return; // cancelled — do not finish the job half-reported
      receiptUrl = out['receiptUrl'] as String?;
      materialsActual = out['materialsActual'] as num?;
    }

    try {
      final res = await Api.patch('/bookings/${b['id']}', {
        'workDone': true,
        if (receiptUrl != null) 'receiptUrl': receiptUrl,
        if (materialsActual != null) 'materialsActual': materialsActual,
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setState(() => b['workDoneAt'] = DateTime.now().toIso8601String());
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('proJobs.updateFailed'.tr())));
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('common.connectionRetry'.tr())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filter == 'ALL' ? _bookings : _bookings.where((b) => b['status'] == _filter).toList();
    // An application is not a booking status, so it belongs under ALL and under
    // PENDING — never under CONFIRMED or COMPLETED, which are about real jobs.
    final showPending = _filter == 'ALL' || _filter == 'PENDING' ? _pending : const [];
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 8, 20, 12), child: Text('nav.myJobs'.tr(), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: C.ink))),
          SizedBox(height: 40, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
            _chip('ALL', 'bookings.all'.tr()), _chip('PENDING', 'status.pending'.tr()), _chip('ACCEPTED', 'status.confirmed'.tr()), _chip('IN_PROGRESS', 'bookings.inProgress'.tr()), _chip('COMPLETED', 'bookings.completed'.tr()),
          ])),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : (filtered.isEmpty && showPending.isEmpty)
                    ? Center(child: Text('proJobs.noJobs'.tr(), style: const TextStyle(color: C.muted)))
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        children: [
                          // Waiting-on-the-customer sits above confirmed work:
                          // it is the thing a pro opens the tab to check.
                          if (showPending.isNotEmpty) ...[
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8, top: 4),
                              child: Text(
                                'proJobs.appliedSection'.tr(args: ['${showPending.length}']),
                                style: const TextStyle(fontWeight: FontWeight.w900, color: C.muted, fontSize: 13, letterSpacing: 0.5),
                              ),
                            ),
                            ...showPending.map(_appliedCard),
                            const SizedBox(height: 16),
                          ],
                          ...filtered.map(_card),
                        ],
                      ),
          ),
        ]),
      ),
    );
  }

  Widget _chip(String key, String label) {
    final sel = _filter == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: () => setState(() => _filter = key),
        child: Container(
          alignment: Alignment.center, padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(color: sel ? C.blue : C.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: sel ? C.blue : C.line)),
          child: Text(label, style: TextStyle(color: sel ? Colors.white : C.ink, fontWeight: FontWeight.w700)),
        ),
      ),
    );
  }

  /// An application the customer has not answered. Deliberately quieter than a
  /// booking card and with no action on it: there is nothing for the pro to do
  /// but wait, and a button that does nothing is worse than no button.
  Widget _appliedCard(dynamic a) {
    final jr = (a['jobRequest'] ?? {}) as Map;
    final title = (jr['title'] ?? 'pro.jobFallback'.tr()).toString();
    final city = (jr['city'] ?? '').toString();
    final miles = a['distanceMiles'];
    final budget = (jr['budgetMin'] ?? 0) as num;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: C.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: C.line),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 15))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(20)),
            child: Text('proJobs.appliedPill'.tr(), style: const TextStyle(color: C.muted, fontWeight: FontWeight.w800, fontSize: 12)),
          ),
        ]),
        const SizedBox(height: 4),
        Text(
          '$city${miles is num ? ' · ${'proFind.milesAway'.tr(args: [miles.toStringAsFixed(0)])}' : ''}',
          style: const TextStyle(color: C.muted, fontSize: 13),
        ),
        const SizedBox(height: 10),
        Row(children: [
          Text('\$${budget.round()}', style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 15)),
          const Spacer(),
          Text('proJobs.awaitingCustomer'.tr(), style: const TextStyle(color: C.muted, fontSize: 12, fontWeight: FontWeight.w700)),
        ]),
      ]),
    );
  }

  Widget _card(dynamic b) {
    final meta = _statusPill[b['status']] ?? ['pro.jobFallback', 0xFF64748B, 0xFFF1F5F9];
    final service = (b['service']?['title'] ?? b['category'] ?? 'pro.jobFallback'.tr()).toString();
    final customer = (b['customer']?['name'] ?? 'proJobs.customerFallback'.tr()).toString();
    final price = (b['totalPrice'] ?? 0) as num;
    final status = b['status'];
    return GestureDetector(
      onTap: () => context.push('/pro/job-detail', extra: (b as Map).cast<String, dynamic>()).then((_) { if (mounted) _load(); }),
      child: Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(service, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
            Text(customer, style: const TextStyle(color: C.muted)),
          ])),
          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: Color(meta[2] as int), borderRadius: BorderRadius.circular(20)),
              child: Text((meta[0] as String).tr(), style: TextStyle(color: Color(meta[1] as int), fontWeight: FontWeight.w800, fontSize: 12))),
        ]),
        const SizedBox(height: 10),
        const Divider(color: C.line, height: 1),
        const SizedBox(height: 10),
        Row(children: [
          Text('\$${price.round()}', style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
          const Spacer(),
          if (status == 'PENDING') ...[
            _smallBtn('requests.decline'.tr(), C.muted, () => _setStatus(b, 'CANCELLED'), outlined: true),
            const SizedBox(width: 8),
            _smallBtn('proJobs.accept'.tr(), C.blue, () => _setStatus(b, 'ACCEPTED')),
          ] else if (status == 'ACCEPTED')
            // Start is offered only once the customer has paid.
            //
            // The server refuses IN_PROGRESS on an unpaid booking, so tapping
            // this used to fail with a 409 after the pro had already decided to
            // travel. Pay-at-hire promises a pro the money is there before they
            // set off; the button has to say so rather than let them find out.
            (b['isPaid'] == true
                ? _smallBtn('proJobs.startJob'.tr(), C.blue, () => _setStatus(b, 'IN_PROGRESS'))
                : Text('proJobs.awaitingPayment'.tr(),
                    style: const TextStyle(
                        color: Color(0xFFB45309), fontWeight: FontWeight.w800, fontSize: 12)))
          else if (status == 'IN_PROGRESS')
            (b['workDoneAt'] != null
                ? Text('proJobs.awaiting'.tr(), style: const TextStyle(color: Color(0xFF15803D), fontWeight: FontWeight.w800, fontSize: 12))
                : _smallBtn('jobDetail.markWorkDone'.tr(), C.green, () => _markWorkDone(b))),
        ]),
      ]),
      ),
    );
  }

  Widget _smallBtn(String label, Color color, VoidCallback onTap, {bool outlined = false}) => outlined
      ? OutlinedButton(style: OutlinedButton.styleFrom(side: BorderSide(color: C.line), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8)), onPressed: onTap, child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w800)))
      : FilledButton(style: FilledButton.styleFrom(backgroundColor: color, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))), onPressed: onTap, child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)));
}
