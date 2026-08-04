import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geolocator/geolocator.dart';
import '../../theme.dart';
import '../../api.dart';

const _statusMeta = {
  'PENDING': ['Pending', 0xFFB45309, 0xFFFEF3C7],
  'ACCEPTED': ['Confirmed', 0xFF15803D, 0xFFDCFCE7],
  'IN_PROGRESS': ['In progress', 0xFFC2410C, 0xFFFFEDD5],
  'COMPLETED': ['Completed', 0xFF15803D, 0xFFDCFCE7],
  'CANCELLED': ['Cancelled', 0xFFB91C1C, 0xFFFEE2E2],
};

class ProJobDetail extends StatefulWidget {
  final Map<String, dynamic> booking;
  const ProJobDetail({super.key, required this.booking});
  @override
  State<ProJobDetail> createState() => _ProJobDetailState();
}

class _ProJobDetailState extends State<ProJobDetail> {
  Map<String, dynamic> _b = {};
  bool _busy = false;
  Timer? _ticker;
  Timer? _locTimer;
  int _elapsed = 0;

  // phase form
  bool _showPhase = false;
  final _phaseTitle = TextEditingController();
  // extension form
  bool _showExt = false;
  String _extMin = '';
  final _extAmount = TextEditingController();
  final _extReason = TextEditingController();

  String get _id => (_b['id'] ?? '').toString();
  String get _status => (_b['status'] ?? '').toString();
  bool get _active => _status == 'ACCEPTED' || _status == 'IN_PROGRESS';

  @override
  void initState() {
    super.initState();
    _b = Map<String, dynamic>.from(widget.booking);
    _load();
  }

  @override
  void dispose() { _ticker?.cancel(); _locTimer?.cancel(); super.dispose(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/bookings/$_id');
      if (res.statusCode == 200) {
        final full = jsonDecode(res.body);
        if (full is Map) _b = {..._b, ...Map<String, dynamic>.from(full)};
      }
    } catch (_) {}
    _syncTimer();
    if (_status == 'ACCEPTED' && _b['isOnMyWay'] == true && _locTimer == null) _startLocationSharing();
    if (mounted) setState(() {});
  }

  void _syncTimer() {
    _ticker?.cancel();
    if (_status == 'IN_PROGRESS' && _b['jobStartedAt'] != null) {
      final start = DateTime.tryParse(_b['jobStartedAt'].toString());
      if (start != null) {
        _elapsed = DateTime.now().difference(start).inSeconds;
        _ticker = Timer.periodic(const Duration(seconds: 1), (_) { if (mounted) setState(() => _elapsed++); });
      }
    }
  }

  String _fmtTime(int s) {
    final h = s ~/ 3600, m = (s % 3600) ~/ 60, sec = s % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
  }

  String _clock(dynamic iso) {
    final d = DateTime.tryParse((iso ?? '').toString())?.toLocal();
    if (d == null) return '';
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    return '$h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'AM' : 'PM'}';
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _patchStatus(String status) async {
    setState(() => _busy = true);
    try {
      final res = await Api.patch('/bookings/$_id', {'status': status});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await _load();
      } else {
        _toast('Could not update the job. Please try again.');
      }
    } catch (_) { _toast('Could not connect. Please try again.'); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _confirmStatus(String title, String msg, String status) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: Text(title), content: Text(msg),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
        TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.w800))),
      ],
    ));
    if (ok == true) _patchStatus(status);
  }

  Future<Position?> _currentPosition() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return null;
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      ).timeout(const Duration(seconds: 12));
    } catch (_) { return null; }
  }

  void _startLocationSharing() {
    _locTimer?.cancel();
    _locTimer = Timer.periodic(const Duration(seconds: 25), (_) async {
      // Stop sharing once the pro has arrived (job started) or is no longer on the way.
      if (_status != 'ACCEPTED' || _b['isOnMyWay'] != true) { _locTimer?.cancel(); return; }
      final pos = await _currentPosition();
      if (pos != null) {
        try { await Api.patch('/bookings/$_id/location', {'lat': pos.latitude, 'lng': pos.longitude}); } catch (_) {}
      }
    });
  }

  Future<void> _onMyWay() async {
    setState(() => _busy = true);
    try {
      final pos = await _currentPosition();
      final body = <String, dynamic>{'isOnMyWay': true};
      if (pos != null) { body['lat'] = pos.latitude; body['lng'] = pos.longitude; }
      final res = await Api.patch('/bookings/$_id/location', body);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _startLocationSharing();
        await _load();
        if (pos == null) _toast('On the way — turn on location to share your live position.');
      } else { _toast('Could not update. Try again.'); }
    } catch (_) { _toast('Could not connect. Try again.'); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _addPhase() async {
    final t = _phaseTitle.text.trim();
    if (t.isEmpty) return _toast('Enter a phase title');
    setState(() => _busy = true);
    try {
      final res = await Api.post('/bookings/$_id/phases', {'title': t});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _phaseTitle.clear(); _showPhase = false; await _load();
      } else {
        String msg = 'Could not add phase.';
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) { _toast('Could not connect. Try again.'); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _requestExtension() async {
    final min = int.tryParse(_extMin.trim());
    if (min == null || min <= 0) return _toast('Choose or enter extra minutes');
    setState(() => _busy = true);
    try {
      final res = await Api.post('/bookings/$_id/extension', {
        'additionalMinutes': min,
        if (_extAmount.text.trim().isNotEmpty) 'extraAmount': _extAmount.text.trim(),
        if (_extReason.text.trim().isNotEmpty) 'reason': _extReason.text.trim(),
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _showExt = false; _extMin = ''; _extAmount.clear(); _extReason.clear();
        _toast('Request sent to customer'); await _load();
      } else {
        String msg = 'Could not send request.';
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) { _toast('Could not connect. Try again.'); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  String _fmtMins(int m) => m >= 60 ? '${m ~/ 60}h${m % 60 > 0 ? ' ${m % 60}m' : ''}' : '${m}m';

  @override
  Widget build(BuildContext context) {
    final meta = _statusMeta[_status] ?? ['Job', 0xFF64748B, 0xFFF1F5F9];
    final customer = _b['customer'] ?? {};
    final name = (customer['name'] ?? 'Customer').toString();
    final phone = (customer['phone'] ?? '').toString();
    final service = (_b['service']?['title'] ?? _b['category'] ?? 'Service').toString();
    final price = (_b['totalPrice'] ?? 0) as num;
    final phases = (_b['phases'] as List?) ?? [];
    final extensions = (_b['extensions'] as List?) ?? [];
    final pendingExt = extensions.any((e) => e['status'] == 'PENDING');

    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.white, surfaceTintColor: Colors.transparent, elevation: 0.5,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: C.ink), onPressed: () => context.pop()),
        title: const Text('Job Detail', style: TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 18)),
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Header
        _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(service, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink))),
            Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: Color(meta[2] as int), borderRadius: BorderRadius.circular(20)),
              child: Text(meta[0] as String, style: TextStyle(color: Color(meta[1] as int), fontWeight: FontWeight.w800, fontSize: 12))),
          ]),
          const SizedBox(height: 12),
          _infoRow(Icons.person_outline, 'Customer', name),
          if ((_b['scheduledAt'] ?? '') != '') _infoRow(Icons.event_outlined, 'Date', _clock(_b['scheduledAt'])),
          if ((_b['address'] ?? '') != '') _infoRow(Icons.location_on_outlined, 'Location', (_b['address']).toString()),
          _infoRow(Icons.payments_outlined, 'Total', '\$${price.round()}'),
        ])),

        // Timer
        if (_status == 'IN_PROGRESS' && _b['jobStartedAt'] != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity, padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [C.blue, Color(0xFF7C3AED)], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.circular(16)),
            child: Column(children: [
              const Text('⏱ JOB TIMER', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 1)),
              const SizedBox(height: 8),
              Text(_fmtTime(_elapsed), style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w900, letterSpacing: 2)),
              const SizedBox(height: 4),
              Text('Started ${_clock(_b['jobStartedAt'])}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ]),
          ),
        ],

        // Phases
        if (_active || phases.isNotEmpty) ...[
          const SizedBox(height: 12),
          _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Work Phases', style: TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
            const SizedBox(height: 4),
            const Text('Log each stage so the customer can confirm progress.', style: TextStyle(color: C.muted, fontSize: 13)),
            const SizedBox(height: 12),
            if (phases.isEmpty && !_showPhase) const Text('No phases yet.', style: TextStyle(color: C.muted)),
            ...phases.map(_phaseRow),
            const SizedBox(height: 8),
            if (_active)
              _showPhase
                  ? Column(children: [
                      TextField(controller: _phaseTitle, decoration: _inputDec('Phase title (e.g. Removed old faucet)')),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: OutlinedButton(onPressed: () => setState(() { _showPhase = false; _phaseTitle.clear(); }), child: const Text('Cancel'))),
                        const SizedBox(width: 10),
                        Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: C.blue), onPressed: _busy ? null : _addPhase, child: const Text('Add Phase'))),
                      ]),
                    ])
                  : OutlinedButton(
                      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46), side: const BorderSide(color: C.blue)),
                      onPressed: () => setState(() => _showPhase = true),
                      child: const Text('+ Add Work Phase', style: TextStyle(color: C.blue, fontWeight: FontWeight.w800))),
          ])),
        ],

        // Extensions
        if (_active || extensions.isNotEmpty) ...[
          const SizedBox(height: 12),
          _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('More Time / Extra Work', style: TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
            const SizedBox(height: 10),
            ...extensions.map(_extRow),
            if (_active && pendingExt)
              const Padding(padding: EdgeInsets.only(top: 8), child: Text('⏳ A request is pending. You can send another once the customer responds.', style: TextStyle(color: C.muted, fontSize: 13))),
            if (_active && !pendingExt) ...[
              const SizedBox(height: 8),
              _showExt ? _extForm() : OutlinedButton(
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46), side: const BorderSide(color: C.blue)),
                onPressed: () => setState(() => _showExt = true),
                child: const Text('+ Request More Time / Extra Work', style: TextStyle(color: C.blue, fontWeight: FontWeight.w800))),
            ],
          ])),
        ],

        const SizedBox(height: 16),
        // Actions
        if (_status == 'PENDING')
          Row(children: [
            Expanded(child: OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), side: const BorderSide(color: C.line)),
              onPressed: _busy ? null : () => _patchStatus('CANCELLED'), child: const Text('Decline', style: TextStyle(color: C.muted, fontWeight: FontWeight.w800)))),
            const SizedBox(width: 12),
            Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: C.blue, minimumSize: const Size.fromHeight(50)),
              onPressed: _busy ? null : () => _patchStatus('ACCEPTED'), child: const Text('Accept Job', style: TextStyle(fontWeight: FontWeight.w800)))),
          ]),
        if (_status == 'ACCEPTED') ...[
          if (_b['isOnMyWay'] != true)
            FilledButton(style: FilledButton.styleFrom(backgroundColor: const Color(0xFF7C3AED), minimumSize: const Size.fromHeight(50)),
              onPressed: _busy ? null : _onMyWay, child: const Text('🚗  I\'m On My Way', style: TextStyle(fontWeight: FontWeight.w800)))
          else
            Container(width: double.infinity, padding: const EdgeInsets.all(14), alignment: Alignment.center,
              decoration: BoxDecoration(color: const Color(0xFFF5F3FF), borderRadius: BorderRadius.circular(12)),
              child: const Text('📍 Sharing your live location with the customer', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF7C3AED), fontWeight: FontWeight.w700))),
          const SizedBox(height: 10),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: C.blue, minimumSize: const Size.fromHeight(50)),
            onPressed: _busy ? null : () => _confirmStatus('Start Job', 'Mark this job as started? The timer will begin.', 'IN_PROGRESS'),
            child: const Text('▶  Start Job', style: TextStyle(fontWeight: FontWeight.w800))),
        ],
        if (_status == 'IN_PROGRESS')
          FilledButton(style: FilledButton.styleFrom(backgroundColor: const Color(0xFF16A34A), minimumSize: const Size.fromHeight(50)),
            onPressed: _busy ? null : () => _confirmStatus('Complete Job', 'Mark this job as completed?', 'COMPLETED'),
            child: const Text('✓  Mark as Complete', style: TextStyle(fontWeight: FontWeight.w800))),
        if (_status != 'COMPLETED' && _status != 'CANCELLED') ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), side: const BorderSide(color: C.line)),
            onPressed: () => context.push('/chat', extra: {'bookingId': _id, 'name': name}),
            icon: const Icon(Icons.chat_bubble_outline, size: 18, color: C.ink),
            label: Text('Message $name', style: const TextStyle(color: C.ink, fontWeight: FontWeight.w800))),
          if (phone.isNotEmpty) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), side: const BorderSide(color: C.line)),
              onPressed: () => launchUrl(Uri.parse('tel:$phone')),
              icon: const Icon(Icons.call_outlined, size: 18, color: C.ink),
              label: const Text('Call customer', style: TextStyle(color: C.ink, fontWeight: FontWeight.w800))),
          ],
        ],
        if (_status == 'COMPLETED')
          Container(
            width: double.infinity, padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(color: const Color(0xFFECFDF3), borderRadius: BorderRadius.circular(16)),
            child: Column(children: [
              const Text('Job Completed', style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF16A34A), fontSize: 16)),
              if (_b['completedAt'] != null) Text('Finished at ${_clock(_b['completedAt'])}', style: const TextStyle(color: C.muted, fontSize: 13)),
              const SizedBox(height: 6),
              Text('Earnings: \$${(price * 0.9).toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
              if (_b['review'] != null)
                Padding(padding: const EdgeInsets.only(top: 6), child: Text('Customer rated: ${'★' * ((_b['review']['rating'] ?? 0) as int)}', style: const TextStyle(color: Color(0xFFF59E0B)))),
            ]),
          ),
        const SizedBox(height: 20),
      ]),
    );
  }

  Widget _card(Widget child) => Container(
        width: double.infinity, padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)), child: child);

  Widget _infoRow(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          Icon(icon, size: 18, color: C.muted), const SizedBox(width: 10),
          Text('$label:  ', style: const TextStyle(color: C.muted)),
          Expanded(child: Text(value, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink))),
        ]),
      );

  Widget _phaseRow(dynamic ph) {
    final confirmed = ph['confirmedAt'] != null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(width: 26, height: 26,
          decoration: BoxDecoration(color: confirmed ? const Color(0xFF16A34A) : const Color(0xFFFEF3C7), shape: BoxShape.circle),
          child: Icon(confirmed ? Icons.check : Icons.circle_outlined, size: 15, color: confirmed ? Colors.white : const Color(0xFFB45309))),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text((ph['title'] ?? '').toString(), style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
          Text('Started ${_clock(ph['startedAt'])}', style: const TextStyle(color: C.muted, fontSize: 12)),
          Text(confirmed ? '✓ Customer confirmed' : 'Awaiting customer confirmation',
            style: TextStyle(color: confirmed ? const Color(0xFF16A34A) : const Color(0xFFB45309), fontSize: 12, fontWeight: FontWeight.w700)),
        ])),
      ]),
    );
  }

  Widget _extRow(dynamic ext) {
    final st = (ext['status'] ?? '').toString();
    final color = st == 'APPROVED' ? const Color(0xFF16A34A) : st == 'DECLINED' ? C.red : const Color(0xFFB45309);
    final label = st == 'APPROVED' ? 'Approved' : st == 'DECLINED' ? 'Declined' : 'Waiting';
    final mins = (ext['additionalMinutes'] ?? 0) as int;
    final amt = (ext['extraAmount'] ?? 0) as num;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('+${_fmtMins(mins)}${amt > 0 ? ' · +\$${amt.toStringAsFixed(2)}' : ''}', style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
          if ((ext['reason'] ?? '') != '') Text((ext['reason']).toString(), style: const TextStyle(color: C.muted, fontSize: 12)),
        ])),
        Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12)),
      ]),
    );
  }

  Widget _extForm() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Extra time needed', style: TextStyle(fontWeight: FontWeight.w700, color: C.ink, fontSize: 13)),
        const SizedBox(height: 8),
        Row(children: ['30', '60', '90', '120'].map((m) {
          final on = _extMin == m;
          return Padding(padding: const EdgeInsets.only(right: 8), child: GestureDetector(
            onTap: () => setState(() => _extMin = m),
            child: Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(color: on ? C.blue : C.bg, borderRadius: BorderRadius.circular(20), border: Border.all(color: on ? C.blue : C.line)),
              child: Text(_fmtMins(int.parse(m)), style: TextStyle(color: on ? Colors.white : C.ink, fontWeight: FontWeight.w700))),
          ));
        }).toList()),
        const SizedBox(height: 12),
        TextField(controller: _extAmount, keyboardType: TextInputType.number, decoration: _inputDec('Extra charge (optional, \$)')),
        const SizedBox(height: 10),
        TextField(controller: _extReason, maxLines: 2, decoration: _inputDec('Reason (optional)')),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: () => setState(() { _showExt = false; _extMin = ''; _extAmount.clear(); _extReason.clear(); }), child: const Text('Cancel'))),
          const SizedBox(width: 10),
          Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: C.blue), onPressed: _busy ? null : _requestExtension, child: const Text('Send Request'))),
        ]),
      ]);

  InputDecoration _inputDec(String hint) => InputDecoration(
        hintText: hint, filled: true, fillColor: C.bg, isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.line)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.blue, width: 1.5)),
      );
}
