import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';
import '../../units.dart';
import '../../widgets/urgent_badge.dart';

class ProFindJobs extends StatefulWidget {
  const ProFindJobs({super.key});
  @override
  State<ProFindJobs> createState() => _ProFindJobsState();
}

class _ProFindJobsState extends State<ProFindJobs> with WidgetsBindingObserver {
  List<dynamic> _jobs = [];
  bool _loading = true;
  final Set<String> _applied = {};

  // A job a pro cannot see is a job they cannot take. This screen used to load
  // once in initState and never again, so a pro sitting on it never saw
  // anything posted after they opened it — the list was only as fresh as the
  // moment they navigated in.
  Timer? _poll;
  static const _interval = Duration(seconds: 20);

  /// Guards against overlapping requests: a slow response must not be
  /// overtaken by the next tick and applied out of order.
  bool _inFlight = false;

  DateTime? _lastUpdated;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _startPolling();
  }

  @override
  void dispose() {
    _poll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _startPolling() {
    _poll?.cancel();
    _poll = Timer.periodic(_interval, (_) => _load(silent: true));
  }

  // Polling a REST endpoint from a backgrounded app spends the pro's battery
  // and data on results nobody is looking at. Stop while away, and refresh
  // once on return so the first thing they see is current rather than stale.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _load(silent: true);
      _startPolling();
    } else {
      _poll?.cancel();
    }
  }

  /// [silent] keeps the current list and spinner state untouched while
  /// refreshing. Only the very first load may show a spinner: replacing a
  /// populated list with a loading indicator every 20 seconds would make the
  /// screen unusable, and a failed background refresh must leave what the pro
  /// is already reading exactly where it is.
  Future<void> _load({bool silent = false}) async {
    if (_inFlight) return;
    _inFlight = true;
    try {
      final res = await Api.get('/job-requests');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        final next = d is List ? d : (d['requests'] ?? d['jobRequests'] ?? []);
        if (mounted) {
          setState(() {
            _jobs = next;
            _lastUpdated = DateTime.now();
          });
        }
      }
    } catch (_) {
      // Swallowed on purpose for background ticks: a dropped poll on a phone
      // moving between cells is normal, and an error banner every 20 seconds
      // would train the pro to ignore the screen.
    } finally {
      _inFlight = false;
      if (mounted && !silent) setState(() => _loading = false);
    }
  }

  String _updatedLabel() {
    final t = _lastUpdated;
    if (t == null) return '';
    final hh = t.hour.toString().padLeft(2, '0');
    final mm = t.minute.toString().padLeft(2, '0');
    return 'proFind.updatedAt'.tr(args: ['$hh:$mm']);
  }

  String _numText(dynamic v) => (v is num && v > 0) ? '${v.round()}' : '';

  // Show the labour price and ask only for the materials estimate.
  //
  // The price field used to be editable here, and whatever the pro typed became
  // the amount the customer owed — a customer agreed to one number and could be
  // billed another. Tarea sets the labour price from its pricing rules; a pro
  // takes the job at that price or does not take it. Materials are genuinely
  // the pro's to estimate, so that field stays.
  Future<void> _applySheet(dynamic job) async {
    final id = (job['id'] ?? '').toString();
    final matCtl = TextEditingController(text: _numText(job['materialsCost']));
    final labour = _numText(job['budgetMin']);
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => StatefulBuilder(builder: (ctx, setDialog) {
      // Tiers mirror lib/materials-policy.ts on the server. The server is the
      // authority and rejects either way; this exists so a pro finds out before
      // writing a quote rather than after submitting one.
      final typed = double.tryParse(matCtl.text.trim()) ?? 0;
      final overMax = typed > 1000;
      final needsCredentials = typed > 300 && !overMax;
      return AlertDialog(
        title: Text('proFind.applyTitle'.tr()),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Read-only on purpose: shown so the pro knows what they are accepting.
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('proFind.labourPriceFixed'.tr(),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: C.muted)),
              const SizedBox(height: 4),
              Text(labour.isEmpty ? '—' : '\$$labour',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink)),
            ]),
          ),
          const SizedBox(height: 14),
          TextField(controller: matCtl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: (_) => setDialog(() {}),
              decoration: InputDecoration(labelText: 'proFind.materialsEstimate'.tr(), helperText: 'proFind.materialsHint'.tr(), helperMaxLines: 3)),
          if (overMax || needsCredentials) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: overMax ? const Color(0xFFFEE2E2) : const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                overMax ? 'proFind.materialsOverMax'.tr() : 'proFind.materialsLicensedOnly'.tr(),
                style: TextStyle(
                    fontSize: 12, height: 1.45, fontWeight: FontWeight.w600,
                    color: overMax ? const Color(0xFFB91C1C) : const Color(0xFFB45309)),
              ),
            ),
          ],
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('common.cancel'.tr())),
          FilledButton(
              onPressed: overMax ? null : () => Navigator.pop(ctx, true),
              child: Text('proFind.apply'.tr())),
        ],
      );
      }),
    );
    if (ok == true) await _apply(id, materials: matCtl.text.trim());
  }

  Future<void> _apply(String id, {String materials = ''}) async {
    setState(() => _applied.add(id));
    try {
      // No proposedPrice: the server ignores it, and sending it would imply the
      // pro had set something.
      final res = await Api.post('/job-requests/$id/apply', {
        if (materials.isNotEmpty) 'materialsEstimate': materials,
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('proFind.applicationSent'.tr())));
      } else {
        setState(() => _applied.remove(id));
        String msg = 'proFind.applyFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      setState(() => _applied.remove(id));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('common.connectionRetry'.tr())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
            child: Text('nav.findJobs'.tr(), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: C.ink)),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(children: [
              Expanded(child: Text('proFind.subtitle'.tr(), style: const TextStyle(color: C.muted))),
              // Says the list is live without claiming more than it can: a
              // clock time the pro can compare against their own.
              if (_lastUpdated != null)
                Text(_updatedLabel(), style: const TextStyle(color: C.muted, fontSize: 11.5)),
            ]),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: () => _load(silent: true),
                    child: _jobs.isEmpty
                        // Still a scroll view: an empty list must be pullable,
                        // or the one pro who most needs to refresh — the one
                        // seeing nothing — is the one who cannot.
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              SizedBox(
                                height: MediaQuery.of(context).size.height * 0.5,
                                child: Center(
                                  child: Text('proFind.noOpen'.tr(),
                                      style: const TextStyle(color: C.muted)),
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                            itemCount: _jobs.length,
                            itemBuilder: (_, i) => _jobCard(_jobs[i]),
                          ),
                  ),
          ),
        ]),
      ),
    );
  }

  Widget _jobCard(dynamic j) {
    final id = (j['id'] ?? '').toString();
    final title = (j['title'] ?? _pretty((j['category'] ?? 'categories.general'.tr()).toString())).toString();
    final rawCat = (j['category'] ?? '').toString();
    final category = _pretty(rawCat);
    final desc = (j['description'] ?? '').toString();
    final city = (j['city'] ?? '').toString();
    final min = j['budgetMin'], max = j['budgetMax'];
    final miles = distanceMilesFrom(Map<String, dynamic>.from(j as Map));
    // Server-owned so it survives a restart; the local set only covers the
    // moment between tapping Apply and the list reloading.
    final applied = _applied.contains(id) || j['applied'] == true;
    final urgent = (j['urgency'] ?? '').toString() == 'URGENT';
    final cc = _catColor(rawCat);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: C.white,
        borderRadius: BorderRadius.circular(16),
        border: Border(left: BorderSide(color: cc, width: 4)),
        boxShadow: [BoxShadow(color: cc.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 42, height: 42,
            decoration: BoxDecoration(color: cc.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
            child: Icon(_catIcon(rawCat), color: cc, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
              const SizedBox(height: 2),
              Row(children: [
                Flexible(child: Text(category, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: cc, fontSize: 12.5, fontWeight: FontWeight.w800))),
                if (urgent) ...[const SizedBox(width: 8), const UrgentBadge()],
              ]),
            ]),
          ),
          if ((min != null || max != null) && (((min ?? max) as num).round() > 0))
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Builder(builder: (_) {
                final lo = ((min ?? max) as num).round();
                final hi = ((max ?? min) as num).round();
                return Text(lo == hi ? '\$$lo' : '\$$lo–\$$hi',
                    style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF16A34A), fontSize: 16));
              }),
              Text('proFind.budget'.tr(), style: const TextStyle(color: C.muted, fontSize: 11)),
            ]),
        ]),
        if (desc.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(desc, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted, height: 1.3)),
        ],
        const SizedBox(height: 10),
        Row(children: [
          const Icon(Icons.location_on_outlined, size: 15, color: C.muted),
          const SizedBox(width: 3),
          Text(
            '$city${miles != null ? ' · ${'proFind.milesAway'.tr(args: [miles.toStringAsFixed(0)])}' : ''}',
            style: const TextStyle(color: C.muted, fontSize: 13),
          ),
          const Spacer(),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: applied ? C.muted : C.blue, padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
            onPressed: applied ? null : () => _applySheet(j),
            child: Text(applied ? 'proFind.applied'.tr() : 'proFind.apply'.tr(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
        ]),
      ]),
    );
  }

  String _pretty(String c) => c.isEmpty ? '' : c[0].toUpperCase() + c.substring(1).toLowerCase().replaceAll('_', ' ');

  Color _catColor(String c) {
    switch (c.toUpperCase()) {
      case 'PLUMBING': return const Color(0xFF2563EB);
      case 'ELECTRICAL': return const Color(0xFFF59E0B);
      case 'PAINTING': return const Color(0xFF7C3AED);
      case 'CARPENTRY': return const Color(0xFFD97706);
      case 'CLEANING': return const Color(0xFF10B981);
      case 'HVAC': return const Color(0xFF06B6D4);
      case 'ROOFING': return const Color(0xFF4F46E5);
      case 'LANDSCAPING': return const Color(0xFF16A34A);
      case 'MOVING': return const Color(0xFFFB923C);
      case 'APPLIANCE_REPAIR': return const Color(0xFF0D9488);
      case 'LAUNDRY': return const Color(0xFF3B82F6);
      default: return C.blue;
    }
  }

  IconData _catIcon(String c) {
    switch (c.toUpperCase()) {
      case 'PLUMBING': return Icons.water_drop_outlined;
      case 'ELECTRICAL': return Icons.bolt_outlined;
      case 'PAINTING': return Icons.palette_outlined;
      case 'CARPENTRY': return Icons.handyman_outlined;
      case 'CLEANING': return Icons.auto_awesome_outlined;
      case 'HVAC': return Icons.ac_unit_outlined;
      case 'ROOFING': return Icons.roofing_outlined;
      case 'LANDSCAPING': return Icons.eco_outlined;
      case 'MOVING': return Icons.local_shipping_outlined;
      case 'APPLIANCE_REPAIR': return Icons.kitchen_outlined;
      case 'LAUNDRY': return Icons.local_laundry_service_outlined;
      default: return Icons.work_outline;
    }
  }
}
