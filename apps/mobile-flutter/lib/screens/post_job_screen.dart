import '../fees.dart';
import 'dart:convert';
import 'package:auto_size_text/auto_size_text.dart';
import '../widgets/confirm_request_sheet.dart';
import '../payment_method.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:geolocator/geolocator.dart';
import '../theme.dart';
import '../api.dart';
import '../service_catalog.dart';

class _Urgency {
  final String value, labelKey, descKey;
  final IconData icon;
  final Color color;
  const _Urgency(this.value, this.labelKey, this.descKey, this.icon, this.color);
}

const _urgencies = [
  _Urgency('STANDARD', 'postjob.urgencyStandard', 'postjob.urgencyStandardDesc', Icons.schedule, C.blue),
  _Urgency('SOON', 'postjob.urgencySoon', 'postjob.urgencySoonDesc', Icons.schedule, C.amber),
  _Urgency('URGENT', 'postjob.urgencyUrgent', 'postjob.urgencyUrgentDesc', Icons.bolt, C.red),
];

const _steps = ['postjob.stepDetails', 'postjob.stepSchedule', 'postjob.stepLocation', 'postjob.stepReview'];

class PostJobScreen extends StatefulWidget {
  final Map<String, dynamic>? directed;
  const PostJobScreen({super.key, this.directed});
  @override
  State<PostJobScreen> createState() => _PostJobScreenState();
}

class _PostJobScreenState extends State<PostJobScreen> {
  int _step = 0;
  String _urgency = 'STANDARD';

  // Structured service picker shared with Instant Quote so both flows ask the
  // exact same questions (service_catalog.dart).
  ServiceCat? _cat;
  Map<String, dynamic>? _task;
  final Map<String, String> _detailAnswers = {};

  List<dynamic> get _taskDetails => (_task?['details'] as List?) ?? const [];
  bool get _allFilled => _taskDetails.every((d) => _detailAnswers.containsKey(d['key']));

  // Directed = booking one specific pro (carries handymanId). A plain category
  // handoff (e.g. from AI Diagnose) preselects the service but stays an open job.
  bool get _isDirected => widget.directed?['handymanId'] != null;
  String get _proName => (widget.directed?['proName'] ?? 'the pro').toString().split(' ').first;

  @override
  void initState() {
    super.initState();
    final d = widget.directed;
    final cat = (d?['category'] ?? '').toString().toUpperCase();
    if (cat.isNotEmpty) {
      // Prefer an exact name match before the api match, so "GENERAL" resolves
      // to General (not Assembly, which also maps to the GENERAL enum).
      for (final c in kServiceCats) { if (c.name.toUpperCase() == cat) { _cat = c; break; } }
      if (_cat == null) {
        for (final c in kServiceCats) { if (c.api == cat) { _cat = c; break; } }
      }
    }

    // Seed from AI Diagnose, so the customer does not describe the same problem
    // twice. The guided questions still run — they are what makes the second
    // estimate firmer — but what they already wrote and photographed carries.
    final seeded = (d?['description'] ?? '').toString().trim();
    if (seeded.isNotEmpty) _desc.text = seeded;
    _diagnosis = (d?['diagnosis'] ?? '').toString().trim();
    _seedImagePath = (d?['imagePath'] ?? '').toString().trim();
    if (_seedImagePath!.isEmpty) _seedImagePath = null;
  }

  /// What AI Diagnose concluded, carried into the job so the pro reads the same
  /// assessment the customer did.
  String _diagnosis = '';

  /// The photo from Diagnose. Uploaded at post time, not before: a customer who
  /// backs out should not have left a file on the server.
  String? _seedImagePath;
  final _desc = TextEditingController(); // optional extra notes
  DateTime? _date;
  TimeOfDay? _time;
  final _address = TextEditingController();
  final _city = TextEditingController();
  final _zip = TextEditingController();
  bool _submitting = false;
  Map<String, dynamic>? _estimate;
  /// The estimate call ran and produced no price. Distinct from "not run
  /// yet", so Review can offer a retry instead of blaming the description.
  bool _estimateFailed = false;
  bool _aiLoading = false;

  // Build the plain-text description sent to the pricing AI + stored on the job,
  // from the chosen task, its structured answers, and any extra notes.
  String _builtDescription() {
    final b = StringBuffer();
    if (_task != null) b.write(_task!['label']);
    final filled = _taskDetails
        .where((d) => _detailAnswers[d['key']] != null)
        .map((d) => '${d['label']}: ${_detailAnswers[d['key']]}')
        .join(', ');
    if (filled.isNotEmpty) b.write(' ($filled)');
    final notes = _desc.text.trim();
    if (notes.isNotEmpty) b.write('. $notes');
    // The AI's read of the photo, when the customer came from Diagnose. The pro
    // reads the same assessment the customer did, attributed so nobody mistakes
    // it for something the customer asserted.
    if (_diagnosis.isNotEmpty) b.write(' [AI Diagnose: $_diagnosis]');
    return b.toString();
  }

  // AI fixes a fair price from the job details (called on the Review step),
  // mirroring the RN flow — the price is set by AI before you post.
  Future<void> _fetchAiPrice() async {
    if (_cat == null || _task == null || !_allFilled || _aiLoading) return;
    setState(() { _aiLoading = true; _estimateFailed = false; });
    try {
      final zip = _zip.text.trim();
      final res = await Api.post('/ai/price-estimate', {
        'category': _cat!.api,
        'description': _builtDescription(),
        'city': zip.isEmpty ? _city.text.trim() : '${_city.text.trim()} $zip',
        'urgent': _urgency == 'URGENT',
        // A directed request knows the pro, so it is quoted at THEIR rate
        // rather than at the platform rate card.
        if (widget.directed?['serviceRate'] != null)
          'proHourlyRate': widget.directed?['serviceRate'],
      }).timeout(const Duration(seconds: 25));
      var ok = false;
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body) as Map<String, dynamic>;
        if (d['price'] != null || (d['min'] != null && d['max'] != null)) {
          _estimate = d;
          ok = true;
        }
      }
      if (!ok) _estimateFailed = true;
    } catch (_) {
      // Was swallowed entirely, which is how a failed call ended up being
      // reported to the customer as "add a description" — advice they could not
      // act on, since _builtDescription() always contains the task label. The
      // pricing model needs a real estimate before a job can be posted, so the
      // failure is now surfaced with a way to retry. 25s because the endpoint
      // genuinely takes ~4s and there was no timeout at all before, so a hung
      // request span forever behind the "Calculating…" spinner.
      _estimateFailed = true;
    }
    if (mounted) setState(() => _aiLoading = false);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: _date ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (d != null) setState(() => _date = d);
  }

  Future<void> _pickTime() async {
    final t = await showTimePicker(context: context, initialTime: _time ?? TimeOfDay.now());
    if (t != null) setState(() => _time = t);
  }

  void _toast(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  // Backend title (English, stored + shown to pros): the chosen task label,
  // else "<Category> service".
  String _jobTitle() {
    final label = (_task?['label'] ?? '').toString().trim();
    if (label.isNotEmpty) return label;
    final n = _cat?.name ?? 'Service';
    return '$n service';
  }

  // Full street line with the ZIP appended when provided.
  String _addressLine() {
    final a = _address.text.trim();
    final z = _zip.text.trim();
    return z.isEmpty ? a : '$a, $z';
  }

  // Combine the picked date + time into scheduledAt (backend needs non-null).
  // Falls back to tomorrow when nothing is chosen; for URGENT this is preset to
  // today + the earliest slot.
  DateTime _scheduledAt() {
    final d = _date ?? DateTime.now().add(const Duration(days: 1));
    final t = _time;
    return t == null ? d : DateTime(d.year, d.month, d.day, t.hour, t.minute);
  }

  // Coordinates let the backend match pros by distance instead of falling back
  // to an exact city-name comparison. Best-effort only: never prompt from the
  // posting flow and never block the post — no coordinates just means the
  // server uses its city fallback.
  Future<Position?> _coords() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      final perm = await Geolocator.checkPermission();
      if (perm != LocationPermission.always &&
          perm != LocationPermission.whileInUse) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
      ).timeout(const Duration(seconds: 4));
    } catch (_) {
      return null;
    }
  }

  Future<void> _submit() async {
    // The one place a session is actually required. Everything before this —
    // AI Diagnose, Instant Quote, and seeing the price — works signed out, so a
    // visitor can reach Review without an account. Posting would otherwise 401
    // and look like the app failing rather than asking them to sign up.
    if (await Api.token() == null) {
      if (!mounted) return;
      _toast('postjob.signInToPost'.tr());
      context.push('/register');
      return;
    }
    // A directed hire commits a specific pro to a specific job, so the card
    // goes on file BEFORE the booking exists. Doing it afterwards would leave
    // bookings a pro can accept and drive to with no payment method behind
    // them — which is what the 2h auto-cancel was standing in for.
    //
    // Nothing is charged here. The card is charged off-session the moment the
    // pro accepts, so their acceptance confirms a paid job instead of starting
    // a 2h wait for the customer to open a payment page; see
    // apps/web/lib/booking-charge.ts (chargeSavedCardForBooking).
    if (_isDirected) {
      // Explain before asking, not after. The card is saved now and charged
      // later — only once the pro accepts AND the customer approves the final
      // price — so a sheet that just says "card required" invites the
      // assumption that the money has gone.
      // Last resort when there is no AI estimate: the pro's rate for one hour.
      // Becomes rate x estimatedBillableMinutes once the AI returns minutes.
      final labour = (_estimate?['price'] ?? _estimate?['min'] ?? widget.directed?['serviceRate'] ?? 0);
      final labourNum = (labour is num ? labour : num.tryParse('$labour') ?? 0).toDouble();
      final confirmed = await showConfirmRequestSheet(
        context,
        proName: _proName,
        labour: labourNum,
        serviceFee: serviceFee(labourNum),
      );
      if (!confirmed) return;
      if (!mounted) return;

      final ok = await PaymentMethods.ensureCardOnFile(context);
      if (!ok) {
        if (mounted) _toast('postjob.cardRequired'.tr());
        return;
      }
    }
    if (!mounted) return;
    setState(() => _submitting = true);
    try {
      final pos = _isDirected ? null : await _coords();

      // Upload the Diagnose photo now, not when it was taken: a customer who
      // looked at the diagnosis and backed out should not have left a file on
      // the server. A failed upload must not lose the job — the photo is
      // helpful, the booking is the point.
      final imageUrls = <String>[];
      if (_seedImagePath != null) {
        try {
          final up = await Api.uploadImage(_seedImagePath!, folder: 'tarea/jobs');
          if (up.statusCode >= 200 && up.statusCode < 300) {
            final url = (jsonDecode(up.body)['url'] ?? '').toString();
            if (url.isNotEmpty) imageUrls.add(url);
          }
        } catch (_) { /* post the job without it */ }
      }
      final res = _isDirected
          // Directed booking — request goes to one specific pro.
          ? await Api.post('/bookings', {
              'handymanUserId': widget.directed?['handymanId'],
              if (widget.directed?['serviceId'] != null) 'serviceId': widget.directed?['serviceId'],
              'scheduledAt': _scheduledAt().toIso8601String(),
              'address': _addressLine(),
              'city': _city.text.trim(),
              if ((_estimate?['price'] ?? _estimate?['min'] ?? widget.directed?['serviceRate']) != null)
                'totalPrice': _estimate?['price'] ?? _estimate?['min'] ?? widget.directed?['serviceRate'],
              // Tarea AI's estimated service time, as shown on Review. The
              // server snapshots it beside the rate so the invoice, and any
              // extra-time request, reconcile against what was agreed.
              if (_estimate?['estimatedBillableMinutes'] != null)
                'estimatedBillableMinutes': _estimate?['estimatedBillableMinutes'],
              'urgent': _urgency == 'URGENT',
              'description': _builtDescription(),
            })
          // Open job request — the backend requires title + a non-null scheduledAt.
          : await Api.post('/job-requests', {
              'category': _cat!.api,
              'title': _jobTitle(),
              'description': _builtDescription(),
              'urgency': _urgency,
              'scheduledAt': _scheduledAt().toIso8601String(),
              'address': _addressLine(),
              'city': _city.text.trim(),
              if (pos != null) ...{
                'latitude': pos.latitude,
                'longitude': pos.longitude,
              },
              if (imageUrls.isNotEmpty) 'imageUrls': imageUrls,
              // Persist the AI's service price as the budget (fee-able, no
              // materials) + materials separately (pass-through, no fee).
              if (_estimate?['price'] != null || _estimate?['min'] != null) ...{
                'budgetMin': _estimate?['price'] ?? _estimate?['min'],
                'budgetMax': _estimate?['price'] ?? _estimate?['max'] ?? _estimate?['min'],
                // Zero on purpose: the pro quotes materials when they apply,
                // and that quote is what the customer is charged.
                'materialsCost': 0,
              },
              // Every applicant is quoted on these minutes at their own rate,
              // so the customer's comparison between them is like-for-like.
              if (_estimate?['estimatedBillableMinutes'] != null)
                'estimatedBillableMinutes': _estimate?['estimatedBillableMinutes'],
            });
      if (res.statusCode < 200 || res.statusCode >= 300) {
        String msg = 'postjob.postFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        if (mounted) _toast(msg);
        return;
      }
      if (mounted) {
        _toast(_isDirected ? 'postjob.requestSent'.tr(args: [_proName]) : 'postjob.jobPosted'.tr());

        // Land where the answer to "what happens now" is, not on Home.
        //
        // Both paths used to bounce to the dashboard behind a toast that is
        // gone in three seconds, so a customer who had just committed to a pro
        // — and put a card on file to do it — had nothing to look at and no
        // idea what came next.
        String? newId;
        try { newId = (jsonDecode(res.body)['id'] ?? '').toString(); } catch (_) {}

        context.go('/home');
        if (_isDirected && (newId ?? '').isNotEmpty) {
          // The booking itself: the pro, the price, and the acceptance window.
          context.push('/booking-detail', extra: {'id': newId});
        } else if (!_isDirected) {
          // My Requests, where applications will start arriving.
          context.push('/requests');
        }
      }
    } catch (_) {
      if (mounted) _toast('postjob.postFailed'.tr());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _next() {
    // Validate required fields before advancing (the backend rejects any missing).
    if (_step == 0) {
      if (_cat == null) return _toast('postjob.pickService'.tr());
      if (_task == null) return _toast('postjob.pickTask'.tr());
      if (!_allFilled) return _toast('postjob.answerDetails'.tr());
    }
    // Standard/Soon must pick a date + time; Urgent is auto-set to ASAP.
    if (_step == 1 && _urgency != 'URGENT' && (_date == null || _time == null)) {
      return _toast('postjob.pickDateTime'.tr());
    }
    if (_step == 2) {
      if (_address.text.trim().isEmpty || _city.text.trim().isEmpty) {
        return _toast('postjob.addLocation'.tr());
      }
      if (_zip.text.trim().isEmpty) return _toast('postjob.addZip'.tr());
    }
    if (_step < 3) {
      setState(() => _step++);
      if (_step == 3) _fetchAiPrice();
    } else if (_estimate == null) {
      // Tarea sets the labour price, so a job with no estimate carries no budget
      // for a pro to see. Retry rather than post something unpriceable.
      _fetchAiPrice();
    } else {
      _submit();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      // The form owns the scrollable, and the CTA lives in bottomNavigationBar.
      //
      // This screen used to be a Column with a pinned header, subtitle and
      // stepper above an Expanded scroll view and a pinned button below. With
      // the keyboard up, the city and ZIP fields on the Location step ended up
      // behind it. Every other form in this app -- register, login, instant
      // quote -- makes the whole body a SingleChildScrollView and none of them
      // has ever had the problem, so this now matches them.
      //
      // With adjustResize (already set in the manifest) the Scaffold shrinks to
      // the space above the keyboard, so the scroll viewport ends exactly where
      // the keyboard begins and any focused field can always be scrolled clear
      // of it. bottomNavigationBar rides just above the keyboard rather than
      // competing with the form for height.
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _circleBtn(Icons.chevron_left, () => _step > 0 ? setState(() => _step--) : (context.canPop() ? context.pop() : context.go('/home'))),
                    Flexible(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(_isDirected ? 'postjob.requestPro'.tr(args: [_proName]) : 'nav.postJob'.tr(),
                              maxLines: 1, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink)),
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('postjob.draftSaved'.tr()))),
                      child: Text('postjob.saveDraft'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Text('postjob.subtitle'.tr(),
                    textAlign: TextAlign.center, style: const TextStyle(color: C.muted, fontSize: 15)),
              ),
              const SizedBox(height: 16),
              _stepper(),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _stepBody(),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: C.blue,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                  ),
                  onPressed: _submitting ? null : _next,
                  child: _submitting
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Flexible(child: Text(_step < 3
                                    ? 'common.continue'.tr()
                                    : (_estimate == null
                                        ? 'postjob.retryEstimate'.tr()
                                        : (_isDirected
                                            ? 'postjob.sendRequestTo'.tr(args: [_proName])
                                            : 'postjob.acceptEstimate'.tr())),
                                textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white))),
                            const SizedBox(width: 10),
                            Container(
                              width: 30, height: 30,
                              decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                              child: const Icon(Icons.arrow_forward, size: 18, color: C.blue),
                            ),
                          ],
                        ),
                ),
              ),
              if (_step == 3) ...[
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: () => setState(() => _step = 0),
                  child: Text('postjob.editDetails'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _circleBtn(IconData icon, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: C.white, shape: BoxShape.circle, border: Border.all(color: C.line)),
          child: Icon(icon, color: C.ink),
        ),
      );

  Widget _stepper() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: List.generate(_steps.length, (i) {
          final active = i == _step;
          final done = i < _step;
          return Expanded(
            child: Column(
              children: [
                Row(
                  children: [
                    if (i > 0) Expanded(child: Container(height: 2, color: done || active ? C.blue : C.line)),
                    Container(
                      width: 34, height: 34,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: active || done ? C.blue : C.white,
                        border: Border.all(color: active || done ? C.blue : C.line, width: 2),
                      ),
                      child: Center(
                        child: done
                            ? const Icon(Icons.check, size: 18, color: Colors.white)
                            : Text('${i + 1}', style: TextStyle(color: active ? Colors.white : C.muted, fontWeight: FontWeight.w800)),
                      ),
                    ),
                    if (i < _steps.length - 1) Expanded(child: Container(height: 2, color: done ? C.blue : C.line)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(_steps[i].tr(), style: TextStyle(fontSize: 13, color: active ? C.blue : C.muted, fontWeight: FontWeight.w800)),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _stepBody() {
    switch (_step) {
      case 0:
        return _details();
      case 1:
        return _schedule();
      case 2:
        return _location();
      default:
        return _review();
    }
  }

  Widget _card(List<Widget> children) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(18)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
      );

  Widget _details() {
    return Column(
      children: [
        _card([
          Text('postjob.urgencyTitle'.tr(), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
          const SizedBox(height: 14),
          Row(
            children: _urgencies.map((u) {
              final sel = _urgency == u.value;
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() {
                    _urgency = u.value;
                    _estimate = null; // price depends on urgency
                    // Urgent = ASAP: preselect today + the earliest slot so the
                    // job lands in a ~3-hour window (customer can still adjust).
                    if (u.value == 'URGENT') {
                      final now = DateTime.now();
                      _date = DateTime(now.year, now.month, now.day);
                      _time = TimeOfDay.fromDateTime(now);
                    }
                  }),
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: sel ? const Color(0xFFEFF5FF) : C.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: sel ? C.blue : C.line, width: sel ? 2 : 1),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(u.icon, color: u.color, size: 22),
                        const SizedBox(height: 10),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(u.labelKey.tr(), maxLines: 1, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: C.ink)),
                        ),
                        const SizedBox(height: 4),
                        Text(u.descKey.tr(), style: const TextStyle(fontSize: 12, color: C.muted, height: 1.2)),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ]),
        _card([
          Text('postjob.needTitle'.tr(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
          const SizedBox(height: 12),
          // Step 1 — service category (same tile style as Instant Quote)
          // Three across, measured rather than assumed.
          //
          // These were fixed 100pt tiles in a Wrap, so the count per row was
          // whatever happened to fit: 3x100 plus two 10pt gaps is 320, and the
          // card leaves 313 on a 393pt phone. Seven points short, so it broke
          // to two. Dividing the real width guarantees three at any size,
          // including when Display Zoom shrinks the logical width.
          LayoutBuilder(builder: (context, box) {
            const gap = 10.0;
            const columns = 3;
            final tile = (box.maxWidth - gap * (columns - 1)) / columns;
            return Wrap(
              spacing: gap, runSpacing: gap,
              children: kServiceCats.map((c) {
                final sel = _cat?.name == c.name;
                return GestureDetector(
                  onTap: () => setState(() { _cat = c; _task = null; _detailAnswers.clear(); _estimate = null; }),
                  child: Container(
                    width: tile,
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
                    decoration: BoxDecoration(
                      color: sel ? C.blue : C.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: sel ? C.blue : C.line),
                    ),
                    child: Column(children: [
                      Icon(c.icon, size: 28, color: sel ? Colors.white : C.blue),
                      const SizedBox(height: 6),
                      // Narrower tiles leave less room for the longest names,
                      // so the label shrinks to fit instead of breaking
                      // mid-word the way "Landscaping" did.
                      AutoSizeText(c.nameKey.tr(),
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          minFontSize: 9,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: sel ? Colors.white : C.ink, fontWeight: FontWeight.w700)),
                    ]),
                  ),
                );
              }).toList(),
            );
          }),
          // Step 2 — task
          if (_cat != null) ...[
            const SizedBox(height: 20),
            Text('postjob.pickTaskTitle'.tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 8, children: (kServiceTasks[_cat!.name] ?? []).map((t) {
              final sel = _task?['label'] == t['label'];
              return _chip(t['label'] as String, sel, () => setState(() { _task = t; _detailAnswers.clear(); _estimate = null; }));
            }).toList()),
          ],
          // Step 3 — structured details for an exact estimate
          if (_task != null) ...[
            const SizedBox(height: 20),
            if (_taskDetails.isNotEmpty)
              Text('instantQuote.aFewDetails'.tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: C.ink)),
            ..._taskDetails.map((d) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 12),
                    Text(d['label'] as String, style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink)),
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 8, children: (d['options'] as List).map<Widget>((o) {
                      final sel = _detailAnswers[d['key']] == o;
                      return _chip(o as String, sel, () => setState(() { _detailAnswers[d['key'] as String] = o; _estimate = null; }));
                    }).toList()),
                  ],
                )),
            const SizedBox(height: 18),
            Text('postjob.notesOptional'.tr(), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 8),
            TextField(
              controller: _desc,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'instantQuote.notesHint'.tr(),
                filled: true, fillColor: C.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              ),
            ),
          ],
        ]),
      ],
    );
  }

  Widget _chip(String label, bool sel, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: sel ? C.blue : C.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: sel ? C.blue : C.line),
          ),
          child: Text(label, style: TextStyle(color: sel ? Colors.white : C.ink, fontWeight: FontWeight.w700)),
        ),
      );

  Widget _schedule() {
    return _card([
      Text('postjob.scheduleTitle'.tr(), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
      const SizedBox(height: 6),
      Text('postjob.scheduleDesc'.tr(),
          style: const TextStyle(color: C.muted, height: 1.4)),
      if (_urgency == 'URGENT') ...[
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            const Icon(Icons.bolt, size: 18, color: C.red),
            const SizedBox(width: 8),
            Expanded(child: Text('postjob.urgentWindow'.tr(),
                style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13, height: 1.35, fontWeight: FontWeight.w600))),
          ]),
        ),
      ],
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: _pickerPill(Icons.calendar_today_outlined,
            _date == null ? 'postjob.dateLabel'.tr() : '${_date!.month}/${_date!.day}/${_date!.year}', _pickDate)),
        const SizedBox(width: 12),
        Expanded(child: _pickerPill(Icons.access_time,
            _time == null ? 'postjob.timeLabel'.tr() : _time!.format(context), _pickTime)),
      ]),
    ]);
  }

  Widget _pickerPill(IconData icon, String label, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
          decoration: BoxDecoration(border: Border.all(color: C.line), borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            Icon(icon, size: 18, color: C.muted),
            const SizedBox(width: 10),
            // Two of these sit side by side in Expanded halves, so the label
            // has a hard width limit and the Row overflowed the moment the
            // text wanted more — 31px for a full date like 8/21/2026, 11px for
            // the time. Shrink to fit rather than ellipsise: a date clipped to
            // "8/21/20…" is worse than a date one point smaller.
            Expanded(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: AlignmentDirectional.centerStart,
                child: Text(label,
                    maxLines: 1,
                    style: const TextStyle(fontSize: 15, color: C.ink, fontWeight: FontWeight.w600)),
              ),
            ),
          ]),
        ),
      );

  Widget _location() {
    return _card([
      Text('postjob.locationTitle'.tr(), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
      const SizedBox(height: 16),
      _input(_address, 'postjob.streetAddress'.tr(), Icons.location_on_outlined),
      const SizedBox(height: 12),
      _input(_city, 'postjob.city'.tr(), Icons.location_city_outlined),
      const SizedBox(height: 12),
      _input(_zip, 'postjob.zipCode'.tr(), Icons.markunread_mailbox_outlined, keyboard: TextInputType.number),
    ]);
  }

  Widget _input(TextEditingController c, String hint, IconData icon, {TextInputType? keyboard}) => Container(
        decoration: BoxDecoration(border: Border.all(color: C.line), borderRadius: BorderRadius.circular(14)),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(children: [
          Icon(icon, size: 20, color: C.muted),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: c,
              keyboardType: keyboard,
              decoration: InputDecoration(
                hintText: hint, border: InputBorder.none, isCollapsed: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 18),
              ),
            ),
          ),
        ]),
      );

  int _n(dynamic v) => (v is num) ? v.round() : 0;

  Color _confColor(String label) {
    final l = label.toLowerCase();
    if (l.startsWith('high')) return C.green;
    if (l.startsWith('med')) return C.amber;
    return C.red;
  }

  String _weekday(DateTime d) {
    const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${wd[d.weekday - 1]}, ${mo[d.month - 1]} ${d.day}';
  }

  Widget _review() {
    if (_aiLoading) {
      return _card([
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 40),
          child: Center(
            child: Column(children: [
              const CircularProgressIndicator(),
              const SizedBox(height: 14),
              Text('postjob.calculating'.tr(), style: const TextStyle(color: C.muted)),
            ]),
          ),
        ),
      ]);
    }
    final e = _estimate;
    if (e == null) {
      return _card([
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.error_outline, color: Color(0xFFB45309), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _estimateFailed
                  ? 'postjob.estimateFailed'.tr()
                  : 'postjob.estimatePending'.tr(),
              style: const TextStyle(color: C.muted, height: 1.4),
            ),
          ),
        ]),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _aiLoading ? null : _fetchAiPrice,
            icon: const Icon(Icons.refresh, size: 18, color: C.blue),
            label: Text('postjob.retryEstimate'.tr(),
                style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFFBFD4FF)),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ),
      ]);
    }
    final fixed = e['isFixed'] == true;
    // Always show a single exact figure so the customer knows what to expect —
    // prefer the AI's fixed price, else the midpoint of its range.
    final priceVal = e['price'] ??
        ((e['min'] != null && e['max'] != null) ? ((_n(e['min']) + _n(e['max'])) / 2).round() : null);
    final bd = (e['breakdown'] as Map?) ?? const {};
    final confLabel = (e['confidenceLabel'] ?? 'Medium').toString();
    final confPct = _n(e['confidence']);
    final included = (e['included'] as List?) ?? const [];
    final serviceFee = _n(e['serviceFee'] ?? bd['serviceFee']);
    final total = _n(e['total'] ?? bd['total']) > 0
        ? _n(e['total'] ?? bd['total'])
        : ((priceVal ?? 0) + serviceFee);
    final feePct = (((e['feeRate'] is num ? e['feeRate'] as num : 0.15)) * 100).round();

    // The headline is an INTERVAL, not a figure Tarea picked.
    //
    // Pros set their own rates, so what the job costs depends on which pro the
    // customer chooses. Showing the spread of real rates is what a marketplace
    // of independent contractors looks like — and it keeps Tarea out of setting
    // anyone's pay, which is the control test that decides whether these are
    // contractors at all.
    //
    // Collapses to one number when only one pro qualifies, or when the server
    // is older than this and sends no range.
    final range = e['priceRange'] as Map?;
    final hasRange = range != null && range['single'] != true;
    final headline = hasRange
        ? '\$${_n(range['low'])}–\$${_n(range['high'])}'
        : '\$$total';

    return _card([
      Center(child: Text(headline, style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: C.blue))),
      Center(
        child: Text(
            hasRange
                ? 'postjob.rangeAcrossPros'.tr(args: ['${_n(range['proCount'])}'])
                : (fixed ? 'postjob.fixedPrice'.tr() : 'postjob.estimatedPrice'.tr()),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: C.muted)),
      ),
      if (hasRange) ...[
        const SizedBox(height: 6),
        Center(child: Text('postjob.youChoosePro'.tr(),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: C.muted, height: 1.3))),
      ],
      const SizedBox(height: 16),
      Container(
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(14)),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Column(children: [
          // Labor + travel = the service price minus the (separately shown) rush fee.
          _feeRow(
              hasRange ? 'postjob.laborServiceLowest'.tr() : 'postjob.laborService'.tr(),
              '\$${_n(e['price']) - _n(bd['urgency'])}'),
          if (_n(bd['urgency']) > 0) ...[
            const SizedBox(height: 10),
            _feeRow('postjob.rushFee'.tr(), '+\$${_n(bd['urgency'])}', color: const Color(0xFFB91C1C)),
          ],
          const SizedBox(height: 10),
          _feeRow('${'postjob.serviceFee'.tr()} ($feePct%)', '\$$serviceFee'),
          const SizedBox(height: 12),
          const Divider(color: C.line, height: 1),
          const SizedBox(height: 12),
          _feeRow('postjob.total'.tr(), '\$$total', bold: true),
        ]),
      ),
      // Always shown, not just when the model guessed a figure.
      //
      // Materials used to appear as an AI estimate inside this total, but the
      // pro who applies names their own — so the number here was one nobody
      // would honour. Saying so up front is the difference between a quote that
      // grows unexpectedly and one the customer understood.
      const SizedBox(height: 8),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.info_outline, size: 14, color: C.muted),
        const SizedBox(width: 6),
        Expanded(child: Text('postjob.materialsByPro'.tr(),
            style: const TextStyle(color: C.muted, fontSize: 12, height: 1.3))),
      ]),
      const SizedBox(height: 16),
      const Divider(color: C.line, height: 1),
      const SizedBox(height: 14),
      Row(children: [
        // The single estimated billable time is what the price is built from and
        // what an extra-time request is measured against, so it leads. The old
        // hours range stays as a fallback for a server that has not shipped it.
        Expanded(child: _statCell(
          'postjob.estimatedServiceTime'.tr(),
          (e['estimatedServiceTime'] ?? e['workTime'] ?? '—').toString(),
          // A bill longer than the estimate needs its reason stated, not a
          // silently larger number — the customer is being asked to rely on it.
          sub: e['minimumApplied'] == true && e['minimumMinutes'] != null
              ? 'postjob.billedAtMinimum'.tr(args: ['${((e['minimumMinutes'] as num) ~/ 60)}'])
              : null,
        )),
        Expanded(child: _statCell('postjob.minAppointment'.tr(), 'postjob.hours'.tr(args: ['${_n(e['minWindow'])}']))),
      ]),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: _statCell('postjob.earliestAvail'.tr(), _date != null ? _weekday(_date!) : 'postjob.flexible'.tr())),
        Expanded(child: _statCell('postjob.confidence'.tr(), '$confLabel — $confPct%', color: _confColor(confLabel))),
      ]),
      if (included.isNotEmpty) ...[
        const SizedBox(height: 18),
        Text('postjob.included'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 15)),
        const SizedBox(height: 10),
        ...included.map((it) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.check_circle, color: C.green, size: 20),
                const SizedBox(width: 10),
                Expanded(child: Text(it.toString(), style: const TextStyle(color: C.ink, height: 1.3))),
              ]),
            )),
      ],
    ]);
  }

  Widget _feeRow(String label, String value, {bool bold = false, Color? color}) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(child: Text(label, style: TextStyle(color: color ?? (bold ? C.ink : C.muted), fontSize: bold ? 15 : 14, fontWeight: bold ? FontWeight.w900 : FontWeight.w600))),
          Text(value, style: TextStyle(color: color ?? C.ink, fontSize: bold ? 18 : 15, fontWeight: bold ? FontWeight.w900 : FontWeight.w700)),
        ],
      );

  Widget _statCell(String label, String value, {Color color = C.ink, String? sub}) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: C.muted, fontSize: 13)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: color)),
          if (sub != null)
            Text(sub, style: const TextStyle(color: C.muted, fontSize: 11, height: 1.3)),
        ],
      );
}
