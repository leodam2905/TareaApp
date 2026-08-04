import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';
import '../api.dart';

const _statusColor = {
  'PENDING': 0xFFB45309,
  'ACCEPTED': 0xFF15803D,
  'IN_PROGRESS': 0xFFC2410C,
  'COMPLETED': 0xFF15803D,
  'CANCELLED': 0xFFB91C1C,
};

class BookingDetailScreen extends StatefulWidget {
  final Map<String, dynamic> booking;
  const BookingDetailScreen({super.key, required this.booking});
  @override
  State<BookingDetailScreen> createState() => _BookingDetailScreenState();
}

class _BookingDetailScreenState extends State<BookingDetailScreen> {
  Map<String, dynamic> _b = {};
  bool _busy = false;
  bool _reviewed = false;
  Timer? _ticker;
  int _elapsed = 0;

  @override
  void dispose() { _ticker?.cancel(); super.dispose(); }

  void _syncTimer() {
    _ticker?.cancel();
    if ((_b['status'] ?? '') == 'IN_PROGRESS' && _b['jobStartedAt'] != null) {
      final start = DateTime.tryParse(_b['jobStartedAt'].toString());
      if (start != null) {
        _elapsed = DateTime.now().difference(start).inSeconds;
        _ticker = Timer.periodic(const Duration(seconds: 1), (_) { if (mounted) setState(() => _elapsed++); });
      }
    }
  }

  String _fmtElapsed(int s) {
    final h = s ~/ 3600, m = (s % 3600) ~/ 60, sec = s % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
  }

  Future<void> _confirmPhase(String phaseId) async {
    try {
      final res = await Api.patch('/bookings/$_id/phases/$phaseId', {});
      if (res.statusCode >= 200 && res.statusCode < 300) { _toast('Phase confirmed'); await _load(); }
      else { _toast('Could not confirm. Try again.'); }
    } catch (_) { _toast('Could not connect. Try again.'); }
  }

  Future<void> _respondExtension(String extId, String action) async {
    try {
      final res = await Api.post('/bookings/$_id/extension/$extId', {'action': action});
      final data = jsonDecode(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final url = (data is Map ? data['checkoutUrl'] : null)?.toString();
        if (action == 'approve' && url != null && url.startsWith('http')) {
          await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        } else {
          _toast(action == 'approve' ? 'Extra work approved' : 'Request declined');
        }
        await _load();
      } else {
        _toast((data is Map ? data['error'] : null)?.toString() ?? 'Could not respond. Try again.');
      }
    } catch (_) { _toast('Could not connect. Try again.'); }
  }

  @override
  void initState() {
    super.initState();
    _b = Map<String, dynamic>.from(widget.booking);
    _load();
  }

  String get _id => (_b['id'] ?? '').toString();

  Future<void> _load() async {
    try {
      final res = await Api.get('/bookings/$_id');
      if (res.statusCode == 200) {
        final full = jsonDecode(res.body);
        if (full is Map) _b = {..._b, ...Map<String, dynamic>.from(full)};
      }
    } catch (_) {}
    _syncTimer();
    if (mounted) setState(() {});
  }

  Future<void> _leaveTip() async {
    final amt = await showModalBottomSheet<double>(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (_) => const _TipSheet(),
    );
    if (amt == null || amt <= 0) return;
    try {
      final res = await Api.post('/stripe/tip', {'bookingId': _id, 'tipAmount': amt});
      final data = jsonDecode(res.body);
      final url = (data is Map ? (data['url'] ?? data['checkoutUrl']) : null)?.toString();
      if (res.statusCode >= 200 && res.statusCode < 300 && url != null && url.startsWith('http')) {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      } else {
        _toast((data is Map ? data['error'] : null)?.toString() ?? 'Could not start tip.');
      }
    } catch (_) { _toast('Could not connect. Try again.'); }
  }

  Future<void> _leaveReview() async {
    final done = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ReviewSheet(bookingId: _id),
    );
    if (done == true && mounted) {
      setState(() => _reviewed = true);
      _toast('Thanks for your review!');
    }
  }

  Future<void> _cancel() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel booking?'),
        content: const Text('Cancellations within 24h of the appointment may incur a 50% fee.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Cancel booking', style: TextStyle(color: C.red))),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final res = await Api.patch('/bookings/$_id', {'status': 'CANCELLED'});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (mounted) setState(() => _b['status'] = 'CANCELLED');
        _toast('Booking cancelled');
      } else {
        String msg = 'Could not cancel booking';
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) {
      _toast('Could not connect. Try again.');
    }
    if (mounted) setState(() => _busy = false);
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  String _fmtDate(String iso) {
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '—';
    const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final ampm = d.hour < 12 ? 'AM' : 'PM';
    return '${wd[d.weekday - 1]}, ${mo[d.month - 1]} ${d.day} · $h:${d.minute.toString().padLeft(2, '0')} $ampm';
  }

  @override
  Widget build(BuildContext context) {
    final status = (_b['status'] ?? 'PENDING').toString();
    final color = Color(_statusColor[status] ?? 0xFF64748B);
    final handyman = (_b['handyman'] ?? {}) as Map;
    final name = (handyman['name'] ?? 'Pro').toString();
    final phone = (handyman['phone'] ?? '').toString();
    final service = (_b['service']?['title'] ?? _b['category'] ?? 'Service').toString();
    final category = (_b['service']?['category'] ?? '').toString();
    final price = (_b['totalPrice'] ?? 0) as num;
    final isPaid = _b['isPaid'] == true;
    final canCancel = ['PENDING', 'ACCEPTED'].contains(status);
    final canReview = status == 'COMPLETED' && _b['review'] == null;

    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.bg, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30), onPressed: () => context.pop()),
        title: const Text('Booking', style: TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          // Status
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.13), borderRadius: BorderRadius.circular(20)),
              child: Text(status.replaceAll('_', ' '), style: TextStyle(color: color, fontWeight: FontWeight.w800)),
            ),
          ),
          const SizedBox(height: 16),
          // Service + details
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(18)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(service, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
              if (category.isNotEmpty) Text(category.replaceAll('_', ' '), style: const TextStyle(color: C.muted)),
              const SizedBox(height: 14),
              const Divider(color: C.line, height: 1),
              _row('Handyman', name),
              _row('Date', _fmtDate((_b['scheduledAt'] ?? '').toString())),
              _row('Location', '${_b['address'] ?? ''}${_b['city'] != null ? ', ${_b['city']}' : ''}'),
              _row('Total', '\$${price.toStringAsFixed(2)}', highlight: true),
              if (!isPaid) ...[
                const SizedBox(height: 6),
                const Text('💳  Payment pending after acceptance', style: TextStyle(color: C.amber, fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ]),
          ),
          // On the way
          if (status == 'ACCEPTED' && _b['isOnMyWay'] == true) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity, padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFF5F3FF), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFDDD6FE))),
              child: const Row(children: [
                Text('🚗', style: TextStyle(fontSize: 20)), SizedBox(width: 10),
                Expanded(child: Text('Your pro is on the way!', style: TextStyle(color: Color(0xFF7C3AED), fontWeight: FontWeight.w800))),
              ]),
            ),
          ],
          // Live timer
          if (status == 'IN_PROGRESS' && _b['jobStartedAt'] != null) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity, padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(gradient: const LinearGradient(colors: [C.blue, Color(0xFF7C3AED)], begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.circular(16)),
              child: Column(children: [
                const Text('JOB IN PROGRESS', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 1)),
                const SizedBox(height: 8),
                Text(_fmtElapsed(_elapsed), style: const TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.w900, letterSpacing: 2)),
              ]),
            ),
          ],
          // Work phases
          if (((_b['phases'] as List?) ?? []).isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity, padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Work Phases', style: TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                const SizedBox(height: 12),
                ...(_b['phases'] as List).map((ph) => _phaseRow(ph, status)),
              ]),
            ),
          ],
          // Extension requests
          if (((_b['extensions'] as List?) ?? []).isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity, padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Extra Time / Work Requests', style: TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                const SizedBox(height: 12),
                ...(_b['extensions'] as List).map(_extRow),
              ]),
            ),
          ],
          const SizedBox(height: 16),
          // Handyman contact
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              CircleAvatar(radius: 24, backgroundColor: C.surface,
                  child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(fontWeight: FontWeight.w900, color: C.blue, fontSize: 20))),
              const SizedBox(width: 12),
              Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16))),
              IconButton(icon: const Icon(Icons.chat_bubble_outline, color: C.blue), onPressed: () => context.push('/chat', extra: {'bookingId': _id, 'name': name})),
              if (phone.isNotEmpty)
                IconButton(icon: const Icon(Icons.call_outlined, color: C.blue), onPressed: () => launchUrl(Uri.parse('tel:$phone'))),
            ]),
          ),
          const SizedBox(height: 20),
          if (canReview && !_reviewed)
            _primaryBtn('Leave a review', _leaveReview),
          if (canReview && !_reviewed) const SizedBox(height: 10),
          if (status == 'COMPLETED') ...[
            SizedBox(width: double.infinity, child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFFDE68A)), padding: const EdgeInsets.symmetric(vertical: 15), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              onPressed: _leaveTip,
              icon: const Icon(Icons.volunteer_activism_outlined, size: 18, color: Color(0xFFB45309)),
              label: const Text('Add a tip', style: TextStyle(color: Color(0xFFB45309), fontWeight: FontWeight.w800, fontSize: 15)))),
            const SizedBox(height: 10),
          ],
          if (canCancel)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFFECACA)), padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                onPressed: _busy ? null : _cancel,
                child: _busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: C.red))
                    : const Text('Cancel booking', style: TextStyle(color: C.red, fontWeight: FontWeight.w800, fontSize: 16)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {bool highlight = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: C.muted, fontWeight: FontWeight.w600)),
          Flexible(child: Text(value, textAlign: TextAlign.right,
              style: TextStyle(color: highlight ? C.blue : C.ink, fontWeight: highlight ? FontWeight.w900 : FontWeight.w700, fontSize: highlight ? 16 : 14))),
        ]),
      );

  Widget _phaseRow(dynamic ph, String status) {
    final confirmed = ph['confirmedAt'] != null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Container(width: 26, height: 26,
          decoration: BoxDecoration(color: confirmed ? const Color(0xFF16A34A) : const Color(0xFFFEF3C7), shape: BoxShape.circle),
          child: Icon(confirmed ? Icons.check : Icons.circle_outlined, size: 15, color: confirmed ? Colors.white : const Color(0xFFB45309))),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text((ph['title'] ?? '').toString(), style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
          Text(confirmed ? '✓ Confirmed' : 'Awaiting your confirmation',
            style: TextStyle(color: confirmed ? const Color(0xFF16A34A) : const Color(0xFFB45309), fontSize: 12, fontWeight: FontWeight.w700)),
        ])),
        if (!confirmed && status == 'IN_PROGRESS')
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6), minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
            onPressed: () => _confirmPhase((ph['id'] ?? '').toString()),
            child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13))),
      ]),
    );
  }

  Widget _extRow(dynamic ext) {
    final st = (ext['status'] ?? '').toString();
    final mins = (ext['additionalMinutes'] ?? 0) as int;
    final amt = (ext['extraAmount'] ?? 0) as num;
    final reason = (ext['reason'] ?? '').toString();
    final pending = st == 'PENDING';
    final color = st == 'APPROVED' ? const Color(0xFF16A34A) : st == 'DECLINED' ? C.red : const Color(0xFFB45309);
    final mLabel = mins >= 60 ? '${mins ~/ 60}h${mins % 60 > 0 ? ' ${mins % 60}m' : ''}' : '${mins}m';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('+$mLabel${amt > 0 ? ' · +\$${amt.toStringAsFixed(2)}' : ''}', style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 15)),
        if (reason.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(reason, style: const TextStyle(color: C.muted, fontSize: 13))),
        if (pending) ...[
          const SizedBox(height: 4),
          const Text('Your pro needs more time to finish. Approve to extend the job.', style: TextStyle(color: C.muted, fontSize: 12)),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: OutlinedButton(style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFFECACA))), onPressed: () => _respondExtension((ext['id'] ?? '').toString(), 'decline'), child: const Text('Decline', style: TextStyle(color: C.red, fontWeight: FontWeight.w800)))),
            const SizedBox(width: 8),
            Expanded(flex: 2, child: FilledButton(style: FilledButton.styleFrom(backgroundColor: const Color(0xFF16A34A)), onPressed: () => _respondExtension((ext['id'] ?? '').toString(), 'approve'), child: Text(amt > 0 ? 'Approve · \$${amt.toStringAsFixed(2)}' : 'Approve', style: const TextStyle(fontWeight: FontWeight.w800)))),
          ]),
        ] else
          Padding(padding: const EdgeInsets.only(top: 4), child: Text(st == 'APPROVED' ? 'Approved' : 'Declined', style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 13))),
      ]),
    );
  }

  Widget _primaryBtn(String label, VoidCallback onTap) => SizedBox(
        width: double.infinity,
        child: FilledButton(
          style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
          onPressed: onTap,
          child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
        ),
      );
}

class _ReviewSheet extends StatefulWidget {
  final String bookingId;
  const _ReviewSheet({required this.bookingId});
  @override
  State<_ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends State<_ReviewSheet> {
  int _rating = 0;
  final _comment = TextEditingController();
  bool _saving = false;

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _submit() async {
    if (_rating == 0) return _toast('Tap a star to rate');
    setState(() => _saving = true);
    try {
      final res = await Api.post('/reviews', {
        'bookingId': widget.bookingId,
        'rating': _rating,
        if (_comment.text.trim().isNotEmpty) 'comment': _comment.text.trim(),
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (mounted) Navigator.pop(context, true);
      } else {
        String msg = 'Could not submit review.';
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) {
      _toast('Could not connect. Please try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(color: C.bg, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Center(child: Text('Rate your experience', style: TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 18))),
          const SizedBox(height: 16),
          Center(
            child: Row(mainAxisSize: MainAxisSize.min, children: List.generate(5, (i) => IconButton(
              onPressed: () => setState(() => _rating = i + 1),
              icon: Icon(i < _rating ? Icons.star : Icons.star_border, color: const Color(0xFFF59E0B), size: 40),
            ))),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _comment,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Add a comment (optional)', filled: true, fillColor: C.white,
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.blue, width: 1.5)),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Submit review', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
          )),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }
}

class _TipSheet extends StatefulWidget {
  const _TipSheet();
  @override
  State<_TipSheet> createState() => _TipSheetState();
}

class _TipSheetState extends State<_TipSheet> {
  double _amount = 0;
  final _custom = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(color: C.bg, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Center(child: Text('Add a tip', style: TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 18))),
          const SizedBox(height: 4),
          const Center(child: Text('100% goes to your pro.', style: TextStyle(color: C.muted, fontSize: 13))),
          const SizedBox(height: 16),
          Row(children: [5, 10, 15, 20].map((v) {
            final on = _amount == v.toDouble() && _custom.text.isEmpty;
            return Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: GestureDetector(
              onTap: () => setState(() { _amount = v.toDouble(); _custom.clear(); }),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14), alignment: Alignment.center,
                decoration: BoxDecoration(color: on ? C.blue : C.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: on ? C.blue : C.line)),
                child: Text('\$$v', style: TextStyle(color: on ? Colors.white : C.ink, fontWeight: FontWeight.w900)),
              ),
            )));
          }).toList()),
          const SizedBox(height: 12),
          TextField(
            controller: _custom, keyboardType: TextInputType.number,
            onChanged: (v) => setState(() => _amount = double.tryParse(v) ?? 0),
            decoration: InputDecoration(
              hintText: 'Custom amount (\$)', filled: true, fillColor: C.white,
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.blue, width: 1.5)),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
            onPressed: _amount > 0 ? () => Navigator.pop(context, _amount) : null,
            child: Text(_amount > 0 ? 'Tip \$${_amount.toStringAsFixed(2)}' : 'Choose an amount', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
          )),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }
}
