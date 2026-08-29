import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:image_picker/image_picker.dart';
import '../payment_method.dart';
import '../theme.dart';
import '../api.dart';
import '../job_timer.dart';
import '../masked_call.dart';

const _statusColor = {
  'PENDING': 0xFFB45309,
  'ACCEPTED': 0xFF15803D,
  'IN_PROGRESS': 0xFFC2410C,
  'COMPLETED': 0xFF15803D,
  'CANCELLED': 0xFFB91C1C,
};

// Maps a booking status enum to its status.* translation key.
const _statusKeys = {
  'PENDING': 'status.pending',
  'ACCEPTED': 'status.confirmed',
  'IN_PROGRESS': 'status.inProgress',
  'COMPLETED': 'status.completed',
  'CANCELLED': 'status.cancelled',
};

class BookingDetailScreen extends StatefulWidget {
  final Map<String, dynamic> booking;
  const BookingDetailScreen({super.key, required this.booking});
  @override
  State<BookingDetailScreen> createState() => _BookingDetailScreenState();
}

class _BookingDetailScreenState extends State<BookingDetailScreen> with WidgetsBindingObserver {
  Map<String, dynamic> _b = {};
  bool _busy = false;
  bool _reviewed = false;
  String? _receiptUrl;
  bool _uploadingReceipt = false;
  Timer? _ticker;
  int _elapsed = 0;
  bool _paused = false;
  // Set while the customer is away paying in the external browser. Checkout is
  // not an in-app route, so RouteAware.didPopNext never fires for it — we pick
  // the result up on app resume instead.
  bool _awaitingPayment = false;

  Future<void> _pickReceipt() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (_) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(leading: const Icon(Icons.camera_alt_outlined, color: C.blue), title: Text('booking.takePhoto'.tr()), onTap: () => Navigator.pop(context, ImageSource.camera)),
        ListTile(leading: const Icon(Icons.photo_library_outlined, color: C.blue), title: Text('booking.chooseGallery'.tr()), onTap: () => Navigator.pop(context, ImageSource.gallery)),
      ])),
    );
    if (source == null) return;
    final x = await ImagePicker().pickImage(source: source, imageQuality: 80, maxWidth: 1600);
    if (x == null) return;
    setState(() => _uploadingReceipt = true);
    try {
      final res = await Api.uploadImage(x.path, folder: 'tarea/receipts');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setState(() => _receiptUrl = (jsonDecode(res.body)['url'] ?? '').toString());
      } else { _toast('booking.uploadFailed'.tr()); }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _uploadingReceipt = false); }
  }

  Future<void> _confirmCompletion() async {
    setState(() => _busy = true);
    try {
      final res = await Api.patch('/bookings/$_id', {
        'status': 'COMPLETED',
        if (_receiptUrl != null && _receiptUrl!.isNotEmpty) 'receiptUrl': _receiptUrl,
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await _load();
        // Ask now, while the job is fresh.
        //
        // Rating and tipping were reachable only by opening the booking and
        // finding two buttons, so almost nothing was ever left. The moment a
        // customer confirms the work is done is the moment they have an opinion
        // — the same instant a ride-hailing app asks.
        if (mounted) await _promptRateAndTip();
      } else {
        String msg = 'proJobs.updateFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }


  @override
  void dispose() { WidgetsBinding.instance.removeObserver(this); _ticker?.cancel(); super.dispose(); }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _awaitingPayment) {
      _awaitingPayment = false;
      _load(); // reflects isPaid once Stripe's webhook has landed
    }
  }

  void _syncTimer() {
    _ticker?.cancel();
    if ((_b['status'] ?? '') != 'IN_PROGRESS') return;
    final t = JobTimer.from(_b);
    if (t == null) return;
    _elapsed = t.elapsedSeconds;
    _paused = t.isPaused;
    // Stop counting while the pro has paused, so the customer is never shown a
    // bigger number than the pro is looking at.
    if (!_paused) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) { if (mounted) setState(() => _elapsed++); });
    }
  }

  String _fmtElapsed(int s) {
    final h = s ~/ 3600, m = (s % 3600) ~/ 60, sec = s % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
  }

  Future<void> _confirmPhase(String phaseId) async {
    try {
      final res = await Api.patch('/bookings/$_id/phases/$phaseId', {});
      if (res.statusCode >= 200 && res.statusCode < 300) { _toast('booking.phaseConfirmedToast'.tr()); await _load(); }
      else { _toast('booking.confirmFailed'.tr()); }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
  }

  Future<void> _respondExtension(String extId, String action) async {
    try {
      final res = await Api.post('/bookings/$_id/extension/$extId', {'action': action, 'platform': 'app'});
      final data = jsonDecode(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final url = (data is Map ? data['checkoutUrl'] : null)?.toString();
        if (action == 'approve' && url != null && url.startsWith('http')) {
          // Paid in the browser, so the result only lands on resume — the
          // _load() below runs long before Stripe's webhook has been near it.
          _awaitingPayment = true;
          await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        } else {
          _toast(action == 'approve' ? 'booking.extraApproved'.tr() : 'booking.requestDeclined'.tr());
        }
        await _load();
      } else {
        _toast((data is Map ? data['error'] : null)?.toString() ?? 'booking.respondFailed'.tr());
      }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
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

  // Payment is due once the pro accepts. Card details are entered on Stripe's
  // hosted Checkout page in an external browser — they never touch the app.
  // The booking auto-cancels if it goes unpaid for 2h, so this has to be
  // reachable from the app, not just the web.
  /// Approve the final price the pro quoted, and pay.
  ///
  /// Uses the card already on file, so there is no browser round trip: the
  /// customer saved it when they requested this pro, precisely so approving
  /// would be one tap. _payNow (the hosted checkout) stays for bookings that
  /// have no card on file.
  Future<void> _approvePrice() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final res = await Api.patch('/bookings/$_id', {'approvePrice': true});
      final data = jsonDecode(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _toast('booking.approved'.tr());
        await _load();
      } else {
        final reason = (data is Map ? data['reason'] : null)?.toString();
        final msg = (data is Map ? data['error'] : null)?.toString() ?? 'booking.payFailed'.tr();
        // A missing card is the one failure the customer can fix here and now,
        // so offer the sheet instead of only reporting it.
        if (reason == 'no_card') {
          final added = await PaymentMethods.ensureCardOnFile(context);
          if (added && mounted) {
            setState(() => _busy = false);
            return _approvePrice();
          }
        }
        _toast(msg);
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _declinePrice() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('booking.declineTitle'.tr()),
        content: Text('booking.declineBody'.tr()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('common.cancel'.tr())),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('booking.declineConfirm'.tr(),
                style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFB91C1C))),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final res = await Api.patch('/bookings/$_id',
          {'status': 'CANCELLED', 'cancelReason': 'Customer declined the quoted price'});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await _load();
      } else {
        _toast('booking.payFailed'.tr());
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _payNow() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      // 'app' returns through the deep-link bridge instead of leaving the
      // customer stranded on the website after paying.
      final res = await Api.post('/stripe/checkout', {'bookingId': _id, 'platform': 'app'});
      final data = jsonDecode(res.body);
      final url = (data is Map ? data['url'] : null)?.toString();
      if (res.statusCode >= 200 && res.statusCode < 300 && url != null && url.startsWith('http')) {
        _awaitingPayment = true;
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      } else {
        _toast((data is Map ? data['error'] : null)?.toString() ?? 'booking.payFailed'.tr());
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _leaveTip() async {
    final amt = await showModalBottomSheet<double>(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (_) => const _TipSheet(),
    );
    if (amt == null || amt <= 0) return;
    try {
      final res = await Api.post('/stripe/tip', {'bookingId': _id, 'tipAmount': amt, 'platform': 'app'});
      final data = jsonDecode(res.body);
      final url = (data is Map ? (data['url'] ?? data['checkoutUrl']) : null)?.toString();
      if (res.statusCode >= 200 && res.statusCode < 300 && url != null && url.startsWith('http')) {
        // Tipping is paid in the browser too, so refresh on resume.
        _awaitingPayment = true;
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      } else {
        _toast((data is Map ? data['error'] : null)?.toString() ?? 'booking.tipStartFailed'.tr());
      }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
  }

  /// Rate, then offer a tip — the ride-hailing pattern, at the moment the
  /// customer confirms the work is done.
  ///
  /// Rating first and tipping second is deliberate: a tip asked before any
  /// judgement has been expressed reads as a toll, and a customer who was
  /// unhappy should be able to say so and leave without being asked for money.
  ///
  /// Both steps are skippable, and skipping is not a failure — the buttons on
  /// the booking remain, so nothing is lost by dismissing this.
  Future<void> _promptRateAndTip() async {
    if (_reviewed || _b['review'] != null) return;

    final rated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ReviewSheet(bookingId: _id),
    );
    if (!mounted) return;

    if (rated == true) {
      setState(() => _reviewed = true);
      _toast('booking.thanksReview'.tr());
    }

    // A tip is never implied by a rating: it is asked separately, and only
    // after the customer has chosen to leave one. 100% of it goes to the pro.
    if (!mounted) return;
    final wantsTip = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('booking.tipPromptTitle'.tr()),
        content: Text('booking.tipPromptBody'.tr()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('booking.notNow'.tr()),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('booking.addTip'.tr()),
          ),
        ],
      ),
    );
    if (wantsTip == true && mounted) await _leaveTip();
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
      _toast('booking.thanksReview'.tr());
    }
  }

  Future<void> _cancel() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('booking.cancelTitle'.tr()),
        content: Text('booking.cancelBody'.tr()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text('booking.keep'.tr())),
          TextButton(onPressed: () => Navigator.pop(context, true), child: Text('booking.cancelBooking'.tr(), style: const TextStyle(color: C.red))),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final res = await Api.patch('/bookings/$_id', {'status': 'CANCELLED'});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (mounted) setState(() => _b['status'] = 'CANCELLED');
        _toast('booking.bookingCancelled'.tr());
      } else {
        String msg = 'booking.cancelFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
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
    final name = (handyman['name'] ?? 'handymanDetail.proFallback'.tr()).toString();
    final callable = _b['canCall'] == true;
    final service = (_b['service']?['title'] ?? _b['category'] ?? 'proProfile.serviceFallback'.tr()).toString();
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
        title: Text('booking.title'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          // Status
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.13), borderRadius: BorderRadius.circular(20)),
              child: Text((_statusKeys[status] ?? 'status.booking').tr(), style: TextStyle(color: color, fontWeight: FontWeight.w800)),
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
              _row('booking.handyman'.tr(), name),
              _row('booking.date'.tr(), _fmtDate((_b['scheduledAt'] ?? '').toString())),
              _row('booking.location'.tr(), '${_b['address'] ?? ''}${_b['city'] != null ? ', ${_b['city']}' : ''}'),
              _row('booking.total'.tr(), '\$${price.toStringAsFixed(2)}', highlight: true),
              // What happens next, while the pro has not answered yet.
              //
              // The screen showed a "Pending" chip and nothing else, so a
              // customer who had just committed to a specific pro — and put a
              // card on file to do it — could not tell whether anything was
              // happening, how long it would take, or when they would be
              // charged.
              if (status == 'PENDING') ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(12)),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Icon(Icons.hourglass_top, size: 16, color: Color(0xFFB45309)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('booking.pendingExplainer'.tr(args: [name]),
                          style: const TextStyle(
                              color: Color(0xFFB45309), fontSize: 12.5, height: 1.45,
                              fontWeight: FontWeight.w600)),
                    ),
                  ]),
                ),
              ],
              if (!isPaid) ...[
                const SizedBox(height: 6),
                Row(children: [
                  const Icon(Icons.credit_card, size: 16, color: C.amber),
                  const SizedBox(width: 6),
                  Expanded(child: Text('booking.paymentPending'.tr(), style: const TextStyle(color: C.amber, fontSize: 13, fontWeight: FontWeight.w600))),
                ]),
                // Payment only opens once the pro has accepted — the checkout
                // endpoint rejects anything else.
                // The pro has accepted and named their price: this is the
                // approval step, and the only point at which money moves.
                if (status == 'ACCEPTED') ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('booking.approveTitle'.tr(),
                          style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 15)),
                      const SizedBox(height: 8),
                      _quoteLine('booking.approveLabour'.tr(), (_b['totalPrice'] ?? 0) as num),
                      const SizedBox(height: 5),
                      _quoteLine('booking.approveFee'.tr(), ((_b['totalPrice'] ?? 0) as num) * 0.15),
                      if (((_b['materialsEstimate'] ?? 0) as num) > 0) ...[
                        const SizedBox(height: 5),
                        _quoteLine('booking.approveMaterials'.tr(), (_b['materialsEstimate'] ?? 0) as num),
                      ],
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 9),
                        child: Divider(color: Color(0xFFBFDBFE), height: 1),
                      ),
                      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        Text('booking.approveTotal'.tr(),
                            style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 14)),
                        Text('\$${(((_b['totalPrice'] ?? 0) as num) * 1.15 + ((_b['materialsEstimate'] ?? 0) as num)).toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 20)),
                      ]),
                      const SizedBox(height: 8),
                      Text('booking.approveNote'.tr(),
                          style: const TextStyle(color: C.muted, fontSize: 11.5, height: 1.45)),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                              backgroundColor: C.blue, minimumSize: const Size.fromHeight(50)),
                          onPressed: _busy ? null : _approvePrice,
                          child: Text(_busy ? 'common.loading'.tr() : 'booking.approveButton'.tr(),
                              style: const TextStyle(fontWeight: FontWeight.w800)),
                        ),
                      ),
                      SizedBox(
                        width: double.infinity,
                        child: TextButton(
                          onPressed: _busy ? null : _declinePrice,
                          child: Text('booking.declineButton'.tr(),
                              style: const TextStyle(color: C.muted, fontSize: 13)),
                        ),
                      ),
                    ]),
                  ),
                ],
              ],
            ]),
          ),
          // On the way
          if (status == 'ACCEPTED' && _b['isOnMyWay'] == true) ...[
            const SizedBox(height: 16),
            // The pro has been reporting their position to
            // /bookings/:id/location all along and nothing ever showed it.
            // Tapping through opens the map.
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => context.push('/track-pro', extra: _b),
              child: Container(
                width: double.infinity, padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: const Color(0xFFF5F3FF), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFDDD6FE))),
                child: Row(children: [
                  const Icon(Icons.directions_car_outlined, size: 20, color: Color(0xFF7C3AED)), const SizedBox(width: 10),
                  Expanded(child: Text('booking.onTheWay'.tr(), style: const TextStyle(color: Color(0xFF7C3AED), fontWeight: FontWeight.w800))),
                  Text('track.title'.tr(), style: const TextStyle(color: Color(0xFF7C3AED), fontWeight: FontWeight.w800, fontSize: 13)),
                  const Icon(Icons.chevron_right, size: 18, color: Color(0xFF7C3AED)),
                ]),
              ),
            ),
          ],
          // Live timer
          if (status == 'IN_PROGRESS' && _b['jobStartedAt'] != null) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity, padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(gradient: const LinearGradient(colors: [C.blue, Color(0xFF7C3AED)], begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.circular(16)),
              child: Column(children: [
                Text(
                  _paused ? 'booking.workPaused'.tr() : 'booking.jobInProgress'.tr(),
                  style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 1),
                ),
                const SizedBox(height: 8),
                Text(_fmtElapsed(_elapsed), style: const TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.w900, letterSpacing: 2)),
                // Says why the number stopped moving. Without this a frozen
                // clock reads as a broken app rather than a pro on a break.
                if (_paused) ...[
                  const SizedBox(height: 6),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(Icons.pause_circle_outline, size: 14, color: Colors.white70),
                    const SizedBox(width: 6),
                    Text('booking.timerPausedNote'.tr(), style: const TextStyle(color: Colors.white70, fontSize: 12)),
                  ]),
                ],
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
                Text('jobDetail.workPhases'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
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
                Text('booking.extraRequests'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
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
              if (callable)
                IconButton(icon: const Icon(Icons.call_outlined, color: C.blue), onPressed: () => startMaskedCall(context, _id)),
            ]),
          ),
          const SizedBox(height: 20),
          if (status == 'IN_PROGRESS' && _b['workDoneAt'] != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFBBF7D0))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('booking.confirmCompletionTitle'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                const SizedBox(height: 4),
                Text('booking.confirmCompletionBody'.tr(), style: const TextStyle(color: C.muted, height: 1.35, fontSize: 13)),
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: _uploadingReceipt ? null : _pickReceipt,
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.line)),
                    child: Row(children: [
                      Icon(_receiptUrl != null ? Icons.check_circle : Icons.receipt_long_outlined,
                          color: _receiptUrl != null ? const Color(0xFF16A34A) : C.muted, size: 20),
                      const SizedBox(width: 10),
                      Expanded(child: Text(_receiptUrl != null ? 'booking.receiptAdded'.tr() : 'booking.addReceipt'.tr(),
                          style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink))),
                      if (_uploadingReceipt) const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                    ]),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(width: double.infinity, child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFF16A34A), padding: const EdgeInsets.symmetric(vertical: 15), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                  onPressed: _busy ? null : _confirmCompletion,
                  child: _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text('booking.confirmRelease'.tr(), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white)),
                )),
              ]),
            ),
            const SizedBox(height: 12),
          ],
          if (canReview && !_reviewed)
            _primaryBtn('booking.leaveReview'.tr(), _leaveReview),
          if (canReview && !_reviewed) const SizedBox(height: 10),
          if (status == 'COMPLETED') ...[
            SizedBox(width: double.infinity, child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFFDE68A)), padding: const EdgeInsets.symmetric(vertical: 15), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              onPressed: _leaveTip,
              icon: const Icon(Icons.volunteer_activism_outlined, size: 18, color: Color(0xFFB45309)),
              label: Text('booking.addTip'.tr(), style: const TextStyle(color: Color(0xFFB45309), fontWeight: FontWeight.w800, fontSize: 15)))),
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
                    : Text('booking.cancelBooking'.tr(), style: const TextStyle(color: C.red, fontWeight: FontWeight.w800, fontSize: 16)),
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
          Text(confirmed ? 'booking.phaseConfirmedShort'.tr() : 'booking.phaseAwaitingYou'.tr(),
            style: TextStyle(color: confirmed ? const Color(0xFF16A34A) : const Color(0xFFB45309), fontSize: 12, fontWeight: FontWeight.w700)),
        ])),
        if (!confirmed && status == 'IN_PROGRESS')
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6), minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
            onPressed: () => _confirmPhase((ph['id'] ?? '').toString()),
            child: Text('common.confirm'.tr(), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13))),
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
          Text('booking.extPending'.tr(), style: const TextStyle(color: C.muted, fontSize: 12)),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: OutlinedButton(style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFFECACA))), onPressed: () => _respondExtension((ext['id'] ?? '').toString(), 'decline'), child: Text('requests.decline'.tr(), style: const TextStyle(color: C.red, fontWeight: FontWeight.w800)))),
            const SizedBox(width: 8),
            Expanded(flex: 2, child: FilledButton(style: FilledButton.styleFrom(backgroundColor: const Color(0xFF16A34A)), onPressed: () => _respondExtension((ext['id'] ?? '').toString(), 'approve'), child: Text(amt > 0 ? 'booking.approveAmount'.tr(args: ['\$${amt.toStringAsFixed(2)}']) : 'booking.approve'.tr(), style: const TextStyle(fontWeight: FontWeight.w800)))),
          ]),
        ] else
          Padding(padding: const EdgeInsets.only(top: 4), child: Text(st == 'APPROVED' ? 'jobDetail.extApproved'.tr() : 'jobDetail.extDeclined'.tr(), style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 13))),
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

  static Widget _quoteLine(String label, num amount) =>
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: const TextStyle(color: C.muted, fontSize: 12.5)),
        Text('\$${amount.toStringAsFixed(2)}',
            style: const TextStyle(color: C.ink, fontSize: 12.5, fontWeight: FontWeight.w700)),
      ]);
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
    if (_rating == 0) return _toast('booking.tapStar'.tr());
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
        String msg = 'booking.submitReviewFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
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
          Center(child: Text('booking.rateExperience'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 18))),
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
              hintText: 'booking.commentHint'.tr(), filled: true, fillColor: C.white,
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
                : Text('booking.submitReview'.tr(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
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
          Center(child: Text('booking.addTip'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 18))),
          const SizedBox(height: 4),
          Center(child: Text('booking.tipGoesToPro'.tr(), style: const TextStyle(color: C.muted, fontSize: 13))),
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
              hintText: 'booking.customAmount'.tr(), filled: true, fillColor: C.white,
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.blue, width: 1.5)),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
            onPressed: _amount > 0 ? () => Navigator.pop(context, _amount) : null,
            child: Text(_amount > 0 ? 'booking.tipAmount'.tr(args: ['\$${_amount.toStringAsFixed(2)}']) : 'booking.chooseAmount'.tr(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
          )),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }

}
