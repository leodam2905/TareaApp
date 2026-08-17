// The steps that make a pro bookable.
//
// WHY THIS SCREEN EXISTS
//
// The dashboard has always shown a completeness ring driven by
// /api/handyman/checklist, and tapping it opened the profile tab — which is not
// where most of these are done. So a pro was told they were at 60% and left to
// work out which 40% was missing, and where. The steps existed only as a
// percentage.
//
// Each row here names the step, says whether it is done, and goes to the screen
// that completes it. Nothing is inferred locally: `done` comes from the server's
// checklist, so this screen cannot disagree with the ring above it.
//
// BACKGROUND CHECK IS THREE STATES, NOT TWO
//
// The endpoint returns both `backgroundCheck` (initiated: paid, deferred, in
// progress or passed) and the raw `backgroundCheckStatus`. Showing a tick for
// "initiated" would tell a pro they are cleared while an admin has not yet
// approved them, so awaiting review renders as its own state.

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';

import '../../theme.dart';
import '../../api.dart';
import 'pro_availability.dart';

enum _StepState { done, pending, todo }

class _Step {
  const _Step({
    required this.titleKey,
    required this.descKey,
    required this.state,
    required this.onTap,
  });
  final String titleKey;
  final String descKey;
  final _StepState state;
  final VoidCallback onTap;
}

class ProSetupSteps extends StatefulWidget {
  const ProSetupSteps({super.key});
  @override
  State<ProSetupSteps> createState() => _ProSetupStepsState();
}

class _ProSetupStepsState extends State<ProSetupSteps> {
  Map<String, dynamic> _c = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await Api.get('/handyman/checklist');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        if (d is Map) _c = Map<String, dynamic>.from(d);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  bool _flag(String k) => _c[k] == true;

  /// Re-reads the checklist when a step screen returns, so a step completed
  /// just now stops showing as outstanding without the pro leaving and
  /// coming back.
  Future<void> _goThen(Future<void> Function() nav) async {
    await nav();
    if (mounted) await _load();
  }

  _StepState get _bgState {
    final raw = (_c['backgroundCheckStatus'] ?? '').toString();
    if (raw == 'PASSED') return _StepState.done;
    if (_flag('backgroundCheck')) return _StepState.pending; // paid / deferred / running
    return _StepState.todo;
  }

  List<_Step> get _steps => [
        _Step(
          titleKey: 'proSetup.profile',
          descKey: 'proSetup.profileDesc',
          state: _flag('profile') ? _StepState.done : _StepState.todo,
          onTap: () => _goThen(() => context.push('/pro/edit-profile')),
        ),
        _Step(
          titleKey: 'proSetup.services',
          descKey: 'proSetup.servicesDesc',
          state: _flag('services') ? _StepState.done : _StepState.todo,
          onTap: () => _goThen(() => context.push('/pro/services')),
        ),
        _Step(
          titleKey: 'proSetup.availability',
          descKey: 'proSetup.availabilityDesc',
          state: _flag('availability') ? _StepState.done : _StepState.todo,
          onTap: () => _goThen(() => Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => const ProAvailability()))),
        ),
        _Step(
          titleKey: 'proSetup.backgroundCheck',
          descKey: 'proSetup.backgroundCheckDesc',
          state: _bgState,
          onTap: () => _goThen(() => context.push('/pro/certifications')),
        ),
        _Step(
          titleKey: 'proSetup.payouts',
          descKey: 'proSetup.payoutsDesc',
          state: _flag('stripe') ? _StepState.done : _StepState.todo,
          onTap: () => _goThen(() => context.push('/pro/payout-methods')),
        ),
        _Step(
          titleKey: 'proSetup.agreement',
          descKey: 'proSetup.agreementDesc',
          state: _flag('ica') ? _StepState.done : _StepState.todo,
          // Was '/pro/certifications' — the document-upload screen. There was
          // no agreement screen to point at, so this step could never be
          // completed and no pro could become bookable from the app.
          onTap: () => _goThen(() => context.push('/pro/ica')),
        ),
      ];

  @override
  Widget build(BuildContext context) {
    final steps = _steps;
    final done = steps.where((s) => s.state == _StepState.done).length;
    final pct = steps.isEmpty ? 0 : (done / steps.length * 100).round();

    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.white,
        foregroundColor: C.ink,
        elevation: 0,
        title: Text('proSetup.title'.tr(),
            style: const TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                        color: C.white, borderRadius: BorderRadius.circular(16)),
                    child: Row(children: [
                      Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: pct >= 100 ? const Color(0xFF16A34A) : C.blue,
                              width: 5),
                        ),
                        child: Center(
                          child: Text('$pct%',
                              style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
                                  color: pct >= 100 ? const Color(0xFF16A34A) : C.blue)),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Text(
                          pct >= 100
                              ? 'proSetup.allDone'.tr()
                              : 'proSetup.remaining'
                                  .tr(args: ['${steps.length - done}']),
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, color: C.ink, height: 1.35),
                        ),
                      ),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  ...steps.map(_row),
                ],
              ),
            ),
    );
  }

  Widget _row(_Step s) {
    final (icon, colour) = switch (s.state) {
      _StepState.done => (Icons.check_circle, const Color(0xFF16A34A)),
      _StepState.pending => (Icons.schedule, const Color(0xFFF59E0B)),
      _StepState.todo => (Icons.radio_button_unchecked, C.muted),
    };
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: s.onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration:
            BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          Icon(icon, color: colour, size: 26),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.titleKey.tr(),
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, color: C.ink, fontSize: 15.5)),
              const SizedBox(height: 2),
              Text(
                s.state == _StepState.pending
                    ? 'proSetup.awaitingReview'.tr()
                    : s.descKey.tr(),
                style: TextStyle(
                    color: s.state == _StepState.pending ? const Color(0xFFB45309) : C.muted,
                    fontSize: 13,
                    height: 1.3),
              ),
            ]),
          ),
          const Icon(Icons.chevron_right, color: C.muted),
        ]),
      ),
    );
  }
}
