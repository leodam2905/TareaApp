import 'dart:convert';
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

  /// What the materials actually cost, plus the receipt.
  ///
  /// The amount is what moves money: materials are reimbursed at cost capped at
  /// the estimate, so spending less returns the difference to the customer. It
  /// is pre-filled with the estimate, because that is the answer most of the
  /// time and a pro who spent exactly what they quoted should not have to type.
  ///
  /// Returns null if cancelled.
  Future<Map<String, dynamic>?> _materialsAtFinish(num estimate) async {
    final amount = TextEditingController(text: estimate.toStringAsFixed(2));
    String? uploadedUrl;

    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(ctx).viewInsets.bottom + 18),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('proJobs.materialsTitle'.tr(),
                style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 17)),
            const SizedBox(height: 6),
            Text('proJobs.materialsNote'.tr(args: [estimate.toStringAsFixed(2)]),
                style: const TextStyle(color: C.muted, fontSize: 13, height: 1.5)),
            const SizedBox(height: 14),
            TextField(
              controller: amount,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: 'proJobs.materialsSpent'.tr(),
                prefixText: '\$ ',
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46)),
              onPressed: () async {
                final url = await _pickReceipt();
                if (url != null) setSheet(() => uploadedUrl = url);
              },
              icon: Icon(uploadedUrl == null ? Icons.camera_alt_outlined : Icons.check_circle, size: 18),
              label: Text(uploadedUrl == null ? 'proJobs.receiptPrompt'.tr() : 'proJobs.receiptAttached'.tr()),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text('common.cancel'.tr()),
              )),
              Expanded(child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: C.blue),
                onPressed: () => Navigator.pop(ctx, <String, dynamic>{
                  'receiptUrl': uploadedUrl,
                  // Left out entirely when unparseable, so the server keeps the
                  // estimate rather than reading a typo as "spent nothing".
                  'materialsActual': num.tryParse(amount.text.trim()),
                }),
                child: Text('proJobs.finishJob'.tr(), style: const TextStyle(fontWeight: FontWeight.w800)),
              )),
            ]),
          ]),
        ),
      ),
    );
  }

  /// Camera or gallery, uploaded; null if the pro backed out.
  Future<String?> _pickReceipt() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.camera_alt_outlined, color: C.blue),
            title: Text('booking.takePhoto'.tr()),
            onTap: () => Navigator.pop(context, 'camera'),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined, color: C.blue),
            title: Text('booking.chooseGallery'.tr()),
            onTap: () => Navigator.pop(context, 'gallery'),
          ),
        ]),
      ),
    );
    if (choice == null) return null;
    final shot = await ImagePicker().pickImage(
      source: choice == 'camera' ? ImageSource.camera : ImageSource.gallery,
      imageQuality: 85, maxWidth: 1600, maxHeight: 1600,
    );
    if (shot == null) return null;
    final up = await Api.uploadImage(shot.path, folder: 'tarea/images');
    if (up.statusCode < 200 || up.statusCode >= 300) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('booking.uploadFailed'.tr())));
      return null;
    }
    return (jsonDecode(up.body)['url'] ?? '').toString();
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
      final out = await _materialsAtFinish(estimate);
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
            _smallBtn('proJobs.startJob'.tr(), C.blue, () => _setStatus(b, 'IN_PROGRESS'))
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
