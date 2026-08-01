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
        if (full is Map && mounted) setState(() => _b = {..._b, ...Map<String, dynamic>.from(full)});
      }
    } catch (_) {}
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
              IconButton(icon: const Icon(Icons.chat_bubble_outline, color: C.blue), onPressed: () => context.push('/messages')),
              if (phone.isNotEmpty)
                IconButton(icon: const Icon(Icons.call_outlined, color: C.blue), onPressed: () => launchUrl(Uri.parse('tel:$phone'))),
            ]),
          ),
          const SizedBox(height: 20),
          if (canReview)
            _primaryBtn('Leave a review', () => context.push('/messages')),
          if (canReview) const SizedBox(height: 10),
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
