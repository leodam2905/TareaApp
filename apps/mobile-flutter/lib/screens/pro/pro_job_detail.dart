import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../widgets/materials_sheet.dart';
import '../../theme.dart';
import '../../api.dart';
import '../../job_timer.dart';
import '../../masked_call.dart';

// [translation key, textColor, bgColor]
const _statusMeta = {
  'PENDING': ['status.pending', 0xFFB45309, 0xFFFEF3C7],
  'ACCEPTED': ['status.confirmed', 0xFF15803D, 0xFFDCFCE7],
  'IN_PROGRESS': ['status.inProgress', 0xFFC2410C, 0xFFFFEDD5],
  'COMPLETED': ['status.completed', 0xFF15803D, 0xFFDCFCE7],
  'CANCELLED': ['status.cancelled', 0xFFB91C1C, 0xFFFEE2E2],
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
  bool _paused = false;

  // phase form
  bool _showPhase = false;
  final _phaseTitle = TextEditingController();
  // extension form
  bool _showExt = false;
  String _extMin = '';
  final _extReason = TextEditingController();

  /// The rate this booking was priced at. Extra time bills at the same rate —
  /// the pro does not name a new number, so the customer cannot be surprised.
  num? get _proRate => _b['proRateSnapshot'] as num?;

  /// What the selected extra time will cost. No travel and no call-out minimum:
  /// the pro is already on site.
  double? get _extCost {
    final rate = _proRate;
    final mins = int.tryParse(_extMin);
    if (rate == null || mins == null) return null;
    return (rate / 60) * mins;
  }

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
    if (_status != 'IN_PROGRESS') return;
    final t = JobTimer.from(_b);
    if (t == null) return;
    _elapsed = t.elapsedSeconds;
    _paused = t.isPaused;
    // A paused clock must not tick, or the pro watches a number climb that the
    // customer's screen has stopped at.
    if (!_paused) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) { if (mounted) setState(() => _elapsed++); });
    }
  }

  Future<void> _toggleTimer() async {
    final action = _paused ? 'resume' : 'pause';
    setState(() => _busy = true);
    try {
      final res = await Api.patch('/bookings/$_id', {'timer': action});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Reload rather than flipping local state: the banked seconds are
        // computed server-side and this screen must show that figure, not a
        // guess at it.
        await _load();
      } else {
        String msg = 'jobDetail.timerFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
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
        _toast('proJobs.updateFailed'.tr());
      }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _markWorkDone() async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: Text('jobDetail.workDoneTitle'.tr()),
      content: Text('jobDetail.workDoneMsg'.tr()),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: Text('common.cancel'.tr())),
        TextButton(onPressed: () => Navigator.pop(context, true), child: Text('common.confirm'.tr(), style: const TextStyle(fontWeight: FontWeight.w800))),
      ],
    ));
    if (ok != true) return;

    // Same materials capture as the jobs list. This screen sent workDone with
    // no figure, so finishing a job from here meant the customer was charged
    // the estimate whatever the pro actually spent.
    String? receiptUrl;
    num? materialsActual;
    final estimate = (_b['materialsEstimate'] ?? 0) as num;
    if (estimate > 0) {
      final out = await showMaterialsAtFinish(context, estimate);
      if (out == null) return; // cancelled — do not finish half-reported
      receiptUrl = out['receiptUrl'] as String?;
      materialsActual = out['materialsActual'] as num?;
    }

    setState(() => _busy = true);
    try {
      final res = await Api.patch('/bookings/$_id', {
        'workDone': true,
        if (receiptUrl != null) 'receiptUrl': receiptUrl,
        if (materialsActual != null) 'materialsActual': materialsActual,
      });
      if (res.statusCode >= 200 && res.statusCode < 300) { await _load(); }
      else { _toast('proJobs.updateFailed'.tr()); }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _confirmStatus(String title, String msg, String status) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: Text(title), content: Text(msg),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: Text('common.cancel'.tr())),
        TextButton(onPressed: () => Navigator.pop(context, true), child: Text('common.confirm'.tr(), style: const TextStyle(fontWeight: FontWeight.w800))),
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
        if (pos == null) _toast('jobDetail.onWayNoLoc'.tr());
      } else { _toast('requests.updateFailed'.tr()); }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _addPhase() async {
    final t = _phaseTitle.text.trim();
    if (t.isEmpty) return _toast('jobDetail.enterPhaseTitle'.tr());
    setState(() => _busy = true);
    try {
      final res = await Api.post('/bookings/$_id/phases', {'title': t});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _phaseTitle.clear(); _showPhase = false; await _load();
      } else {
        String msg = 'jobDetail.addPhaseFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _requestExtension() async {
    final min = int.tryParse(_extMin.trim());
    if (min == null || min <= 0) return _toast('jobDetail.chooseMinutes'.tr());
    setState(() => _busy = true);
    try {
      final res = await Api.post('/bookings/$_id/extension', {
        'additionalMinutes': min,
        if (_extReason.text.trim().isNotEmpty) 'reason': _extReason.text.trim(),
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _showExt = false; _extMin = ''; _extReason.clear();
        _toast('jobDetail.requestSentCustomer'.tr()); await _load();
      } else {
        String msg = 'jobDetail.sendRequestFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  String _fmtMins(int m) => m >= 60 ? '${m ~/ 60}h${m % 60 > 0 ? ' ${m % 60}m' : ''}' : '${m}m';

  @override
  Widget build(BuildContext context) {
    final meta = _statusMeta[_status] ?? ['pro.jobFallback', 0xFF64748B, 0xFFF1F5F9];
    final customer = _b['customer'] ?? {};
    final name = (customer['name'] ?? 'proJobs.customerFallback'.tr()).toString();
    final callable = _b['canCall'] == true;
    final service = (_b['service']?['title'] ?? _b['category'] ?? 'proProfile.serviceFallback'.tr()).toString();
    final price = (_b['totalPrice'] ?? 0) as num;
    final phases = (_b['phases'] as List?) ?? [];
    final extensions = (_b['extensions'] as List?) ?? [];
    final pendingExt = extensions.any((e) => e['status'] == 'PENDING');

    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.white, surfaceTintColor: Colors.transparent, elevation: 0.5,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: C.ink), onPressed: () => context.pop()),
        title: Text('jobDetail.title'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 18)),
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Header
        _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(service, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink))),
            Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: Color(meta[2] as int), borderRadius: BorderRadius.circular(20)),
              child: Text((meta[0] as String).tr(), style: TextStyle(color: Color(meta[1] as int), fontWeight: FontWeight.w800, fontSize: 12))),
          ]),
          const SizedBox(height: 12),
          _infoRow(Icons.person_outline, 'jobDetail.infoCustomer'.tr(), name),
          if ((_b['scheduledAt'] ?? '') != '') _infoRow(Icons.event_outlined, 'jobDetail.infoDate'.tr(), _clock(_b['scheduledAt'])),
          if ((_b['address'] ?? '') != '') _infoRow(Icons.location_on_outlined, 'jobDetail.infoLocation'.tr(), (_b['address']).toString()),
          _infoRow(Icons.payments_outlined, 'jobDetail.infoTotal'.tr(), '\$${price.round()}'),
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
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.timer_outlined, size: 14, color: Colors.white70),
                const SizedBox(width: 6),
                Text('jobDetail.timerLabel'.tr(), style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 1)),
              ]),
              const SizedBox(height: 8),
              Text(_fmtTime(_elapsed), style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w900, letterSpacing: 2)),
              const SizedBox(height: 4),
              Text(
                _paused ? 'jobDetail.timerPaused'.tr() : 'jobDetail.startedAt'.tr(args: [_clock(_b['jobStartedAt'])]),
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.18),
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(44),
                  ),
                  onPressed: _busy ? null : _toggleTimer,
                  icon: Icon(_paused ? Icons.play_arrow_rounded : Icons.pause_rounded, size: 20),
                  label: Text(
                    _paused ? 'jobDetail.timerResume'.tr() : 'jobDetail.timerPause'.tr(),
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ]),
          ),
        ],

        // Phases
        if (_active || phases.isNotEmpty) ...[
          const SizedBox(height: 12),
          _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('jobDetail.workPhases'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
            const SizedBox(height: 4),
            Text('jobDetail.phasesDesc'.tr(), style: const TextStyle(color: C.muted, fontSize: 13)),
            const SizedBox(height: 12),
            if (phases.isEmpty && !_showPhase) Text('jobDetail.noPhases'.tr(), style: const TextStyle(color: C.muted)),
            ...phases.map(_phaseRow),
            const SizedBox(height: 8),
            if (_active)
              _showPhase
                  ? Column(children: [
                      TextField(controller: _phaseTitle, decoration: _inputDec('jobDetail.phaseHint'.tr())),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: OutlinedButton(onPressed: () => setState(() { _showPhase = false; _phaseTitle.clear(); }), child: Text('common.cancel'.tr()))),
                        const SizedBox(width: 10),
                        Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: C.blue), onPressed: _busy ? null : _addPhase, child: Text('jobDetail.addPhase'.tr()))),
                      ]),
                    ])
                  : OutlinedButton(
                      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46), side: const BorderSide(color: C.blue)),
                      onPressed: () => setState(() => _showPhase = true),
                      child: Text('jobDetail.addWorkPhase'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800))),
          ])),
        ],

        // Extensions
        if (_active || extensions.isNotEmpty) ...[
          const SizedBox(height: 12),
          _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('jobDetail.moreTime'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
            const SizedBox(height: 10),
            ...extensions.map(_extRow),
            if (_active && pendingExt)
              Padding(padding: const EdgeInsets.only(top: 8), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.hourglass_empty, size: 15, color: C.muted),
                const SizedBox(width: 6),
                Expanded(child: Text('jobDetail.requestPending'.tr(), style: const TextStyle(color: C.muted, fontSize: 13))),
              ])),
            if (_active && !pendingExt) ...[
              const SizedBox(height: 8),
              _showExt ? _extForm() : OutlinedButton(
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46), side: const BorderSide(color: C.blue)),
                onPressed: () => setState(() => _showExt = true),
                child: Text('jobDetail.requestMoreTime'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800))),
            ],
          ])),
        ],

        const SizedBox(height: 16),
        // Actions
        if (_status == 'PENDING')
          Row(children: [
            Expanded(child: OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), side: const BorderSide(color: C.line)),
              onPressed: _busy ? null : () => _patchStatus('CANCELLED'), child: Text('requests.decline'.tr(), style: const TextStyle(color: C.muted, fontWeight: FontWeight.w800)))),
            const SizedBox(width: 12),
            Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: C.blue, minimumSize: const Size.fromHeight(50)),
              onPressed: _busy ? null : () => _patchStatus('ACCEPTED'), child: Text('jobDetail.acceptJob'.tr(), style: const TextStyle(fontWeight: FontWeight.w800)))),
          ]),
        if (_status == 'ACCEPTED') ...[
          if (_b['isOnMyWay'] != true)
            FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: const Color(0xFF7C3AED), minimumSize: const Size.fromHeight(50)),
              onPressed: _busy ? null : _onMyWay,
              icon: const Icon(Icons.directions_car_outlined, size: 20),
              label: Text('jobDetail.onMyWay'.tr(), style: const TextStyle(fontWeight: FontWeight.w800)))
          else
            Container(width: double.infinity, padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFF5F3FF), borderRadius: BorderRadius.circular(12)),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.location_on_outlined, size: 18, color: Color(0xFF7C3AED)),
                const SizedBox(width: 8),
                Flexible(child: Text('jobDetail.sharingLocation'.tr(), textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF7C3AED), fontWeight: FontWeight.w700))),
              ])),
          const SizedBox(height: 10),
          FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: C.blue, minimumSize: const Size.fromHeight(50)),
            onPressed: _busy ? null : () => _confirmStatus('jobDetail.startJobTitle'.tr(), 'jobDetail.startJobMsg'.tr(), 'IN_PROGRESS'),
            icon: const Icon(Icons.play_arrow, size: 20),
            label: Text('jobDetail.startJobBtn'.tr(), style: const TextStyle(fontWeight: FontWeight.w800))),
        ],
        if (_status == 'IN_PROGRESS')
          _b['workDoneAt'] != null
              ? Container(width: double.infinity, padding: const EdgeInsets.all(14), alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(12)),
                  child: Text('jobDetail.awaitingConfirm'.tr(), textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF15803D), fontWeight: FontWeight.w700)))
              : FilledButton(style: FilledButton.styleFrom(backgroundColor: const Color(0xFF16A34A), minimumSize: const Size.fromHeight(50)),
                  onPressed: _busy ? null : _markWorkDone,
                  child: Text('jobDetail.markWorkDone'.tr(), style: const TextStyle(fontWeight: FontWeight.w800))),
        if (_status != 'COMPLETED' && _status != 'CANCELLED') ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), side: const BorderSide(color: C.line)),
            onPressed: () => context.push('/chat', extra: {'bookingId': _id, 'name': name}),
            icon: const Icon(Icons.chat_bubble_outline, size: 18, color: C.ink),
            label: Text('jobDetail.messageCustomer'.tr(args: [name]), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w800))),
          if (callable) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), side: const BorderSide(color: C.line)),
              onPressed: () => startMaskedCall(context, _id),
              icon: const Icon(Icons.call_outlined, size: 18, color: C.ink),
              label: Text('jobDetail.callCustomer'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w800))),
          ],
        ],
        if (_status == 'COMPLETED')
          Container(
            width: double.infinity, padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(color: const Color(0xFFECFDF3), borderRadius: BorderRadius.circular(16)),
            child: Column(children: [
              Text('jobDetail.jobCompleted'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF16A34A), fontSize: 16)),
              if (_b['completedAt'] != null) Text('jobDetail.finishedAt'.tr(args: [_clock(_b['completedAt'])]), style: const TextStyle(color: C.muted, fontSize: 13)),
              const SizedBox(height: 6),
              // The pro keeps the whole labour amount. This multiplied by 0.9
              // for the retired 10% pro-side fee, which is now zero — so a
              // finished job under-reported what the pro was actually paid, on
              // the one screen that tells them. Tarea's fee is charged to the
              // customer on top and never comes out of this number.
              Text('jobDetail.earnings'.tr(args: ['\$${price.toStringAsFixed(2)}']), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
              if (_b['review'] != null)
                Padding(padding: const EdgeInsets.only(top: 6), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text('jobDetail.customerRated'.tr(), style: const TextStyle(color: Color(0xFFF59E0B))),
                  const SizedBox(width: 6),
                  ...List.generate(5, (i) => Icon(
                    i < ((_b['review']['rating'] ?? 0) as int) ? Icons.star : Icons.star_border,
                    size: 16, color: const Color(0xFFF59E0B))),
                ])),
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
          Text('jobDetail.startedAt'.tr(args: [_clock(ph['startedAt'])]), style: const TextStyle(color: C.muted, fontSize: 12)),
          Text(confirmed ? 'jobDetail.phaseConfirmed'.tr() : 'jobDetail.phaseAwaiting'.tr(),
            style: TextStyle(color: confirmed ? const Color(0xFF16A34A) : const Color(0xFFB45309), fontSize: 12, fontWeight: FontWeight.w700)),
        ])),
      ]),
    );
  }

  Widget _extRow(dynamic ext) {
    final st = (ext['status'] ?? '').toString();
    final color = st == 'APPROVED' ? const Color(0xFF16A34A) : st == 'DECLINED' ? C.red : const Color(0xFFB45309);
    final label = st == 'APPROVED' ? 'jobDetail.extApproved'.tr() : st == 'DECLINED' ? 'jobDetail.extDeclined'.tr() : 'jobDetail.extWaiting'.tr();
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
        Text('jobDetail.extraTimeNeeded'.tr(), style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink, fontSize: 13)),
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
        if (_extCost != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(10)),
            child: Text(
              'jobDetail.extraCostAtRate'.tr(namedArgs: {
                'amount': _extCost!.toStringAsFixed(2),
                'rate': _proRate!.round().toString(),
              }),
              style: const TextStyle(color: C.ink, fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ),
        const SizedBox(height: 10),
        TextField(controller: _extReason, maxLines: 2, decoration: _inputDec('jobDetail.reasonHint'.tr())),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: () => setState(() { _showExt = false; _extMin = ''; _extReason.clear(); }), child: Text('common.cancel'.tr()))),
          const SizedBox(width: 10),
          Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: C.blue), onPressed: _busy ? null : _requestExtension, child: Text('jobDetail.sendRequest'.tr()))),
        ]),
      ]);

  InputDecoration _inputDec(String hint) => InputDecoration(
        hintText: hint, filled: true, fillColor: C.bg, isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.line)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.blue, width: 1.5)),
      );
}
