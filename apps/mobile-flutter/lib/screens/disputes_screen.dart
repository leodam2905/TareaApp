// Disputes — raising one, and following the ones already raised.
//
// WHY THIS SCREEN EXISTS
//
// POST /api/bookings/:id/dispute, the admin review queue and the schema fields
// have all been on the server for a long time, and no screen in the app ever
// called any of it. A customer who had a problem with a job had no way to say
// so from the app.
//
// WHAT CAN BE DISPUTED, AND WHY THE LIST IS SHORT
//
// The server only accepts a dispute on a booking that is IN_PROGRESS or
// COMPLETED, and refuses one already disputed. So this offers exactly those
// bookings rather than listing everything and failing on tap — a control that
// is visible but always errors is worse than one that is absent.
//
// This screen deliberately does NOT decide anything. Filing a dispute freezes
// the booking and hands it to an admin; the app's job is to state that plainly
// so nobody expects an instant refund from it.

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

import '../theme.dart';
import '../api.dart';

class DisputesScreen extends StatefulWidget {
  const DisputesScreen({super.key});
  @override
  State<DisputesScreen> createState() => _DisputesScreenState();
}

class _DisputesScreenState extends State<DisputesScreen> {
  List<dynamic> _bookings = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await Api.get('/bookings?role=customer');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        _bookings = (d is List ? d : (d['bookings'] ?? [])) as List;
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<dynamic> get _open =>
      _bookings.where((b) => (b['status'] ?? '') == 'DISPUTED').toList();

  /// Only what the server will actually accept.
  List<dynamic> get _disputable => _bookings
      .where((b) => ['IN_PROGRESS', 'COMPLETED'].contains((b['status'] ?? '').toString()))
      .toList();

  String _ref(dynamic b) {
    final id = (b['id'] ?? '').toString();
    return id.length >= 8 ? id.substring(id.length - 8).toUpperCase() : id;
  }

  String _title(dynamic b) {
    final svc = b['service'];
    final t = (svc is Map ? svc['title'] : null) ?? b['title'];
    return (t ?? 'disputes.thisBooking'.tr()).toString();
  }

  Future<void> _raise(dynamic b) async {
    final ctl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('disputes.raiseTitle'.tr()),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('disputes.raiseExplain'.tr(),
              style: const TextStyle(color: C.muted, height: 1.35, fontSize: 13.5)),
          const SizedBox(height: 12),
          TextField(
            controller: ctl,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: 'disputes.reasonHint'.tr(),
              border: const OutlineInputBorder(),
            ),
          ),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text('common.cancel'.tr())),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text('disputes.submit'.tr())),
        ],
      ),
    );
    if (ok != true) return;

    final reason = ctl.text.trim();
    if (reason.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('disputes.reasonRequired'.tr())));
      }
      return;
    }

    try {
      final res = await Api.post('/bookings/${b['id']}/dispute', {'reason': reason});
      if (!mounted) return;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('disputes.filed'.tr())));
        await _load();
        return;
      }
      // Surface the server's own reason: it knows why better than a generic
      // message does (already disputed, wrong status, not your booking).
      String msg = 'disputes.failed'.tr();
      try {
        msg = (jsonDecode(res.body)['error'] ?? msg).toString();
      } catch (_) {}
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('common.connectionRetry'.tr())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.white,
        foregroundColor: C.ink,
        elevation: 0,
        title: Text('disputes.title'.tr(), style: const TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                children: [
                  if (_open.isNotEmpty) ...[
                    _heading('disputes.openHeading'.tr()),
                    ..._open.map(_openCard),
                    const SizedBox(height: 22),
                  ],
                  _heading('disputes.raiseHeading'.tr()),
                  if (_disputable.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                          color: C.white, borderRadius: BorderRadius.circular(14)),
                      child: Text('disputes.nothingDisputable'.tr(),
                          style: const TextStyle(color: C.muted, height: 1.35)),
                    )
                  else
                    ..._disputable.map(_disputableCard),
                  const SizedBox(height: 18),
                  Text('disputes.footnote'.tr(),
                      style: const TextStyle(color: C.muted, fontSize: 12.5, height: 1.4)),
                ],
              ),
            ),
    );
  }

  Widget _heading(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(t,
            style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 17)),
      );

  Widget _openCard(dynamic b) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: C.white,
          borderRadius: BorderRadius.circular(14),
          border: Border(left: BorderSide(color: C.red, width: 4)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.gavel_outlined, color: C.red, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(_title(b),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink)),
            ),
            Text('#${_ref(b)}', style: const TextStyle(color: C.muted, fontSize: 12)),
          ]),
          const SizedBox(height: 8),
          Text('disputes.underReview'.tr(),
              style: const TextStyle(color: C.muted, height: 1.35, fontSize: 13.5)),
          if ((b['disputeReason'] ?? '').toString().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('"${b['disputeReason']}"',
                style: const TextStyle(color: C.ink, fontSize: 13, fontStyle: FontStyle.italic)),
          ],
        ]),
      );

  Widget _disputableCard(dynamic b) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_title(b),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink)),
              const SizedBox(height: 2),
              Text('#${_ref(b)} · ${(b['status'] ?? '').toString().toLowerCase()}',
                  style: const TextStyle(color: C.muted, fontSize: 12.5)),
            ]),
          ),
          TextButton(
            onPressed: () => _raise(b),
            child: Text('disputes.report'.tr(),
                style: const TextStyle(color: C.red, fontWeight: FontWeight.w800)),
          ),
        ]),
      );
}
