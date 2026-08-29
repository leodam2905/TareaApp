import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';

class ProEarnings extends StatefulWidget {
  const ProEarnings({super.key});
  @override
  State<ProEarnings> createState() => _ProEarningsState();
}

class _ProEarningsState extends State<ProEarnings> {
  num _total = 0;
  num _pending = 0;
  // Straight from Stripe. null means the lookup failed — shown differently
  // from zero, because "we don't know" and "you have nothing" are not the same
  // thing to somebody deciding whether to cash out.
  num? _withdrawable;
  num? _clearing;
  int _jobs = 0;
  // Progress towards instant cash-out. Stripe sets the platform's instant
  // limit itself from volume and history, so this is Tarea's own threshold for
  // who is offered it — shown as progress rather than a button, because a
  // button that refuses every pro is worse than none.
  int _instantDone = 0;
  int _instantNeed = 0;
  String _stripe = '';
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/handyman/earnings');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body) as Map<String, dynamic>;
        _total = (d['totalEarnings'] ?? 0) as num;
        _pending = (d['pendingEarnings'] ?? 0) as num;
        _jobs = (d['totalJobs'] ?? 0) as int;
        _stripe = (d['stripeAccountStatus'] ?? '').toString();
        _withdrawable = d['withdrawableNow'] as num?;
        _clearing = d['clearingSoon'] as num?;
        _instantDone = (d['instantJobsCompleted'] ?? 0) as int;
        _instantNeed = (d['instantJobsRequired'] ?? 0) as int;
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  Text('nav.earnings'.tr(), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: C.ink)),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity, padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(gradient: const LinearGradient(colors: [C.green, Color(0xFF059669)]), borderRadius: BorderRadius.circular(20)),
                    child: Column(children: [
                      Text('proEarnings.totalEarned'.tr(), style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      Text('\$${_total.round()}', style: const TextStyle(color: Colors.white, fontSize: 44, fontWeight: FontWeight.w900)),
                    ]),
                  ),
                  const SizedBox(height: 12),
                  // "On the way" is what a pro means by pending: money that
                  // has left Tarea and is settling towards their bank. The old
                  // second stat was pendingEarnings — earned but NOT YET
                  // TRANSFERRED — which since payouts moved to job completion
                  // is zero except when a transfer has failed. A pro reading
                  // "Pending payout $0" three days after finishing a job
                  // reasonably concluded they had not been paid.
                  Row(children: [
                    _stat(
                      _clearing == null ? '—' : '\$${_clearing!.round()}',
                      'proEarnings.onTheWay'.tr(),
                      C.amber,
                    ),
                    _stat('$_jobs', 'proEarnings.jobsCompleted'.tr(), C.blue),
                  ]),
                  // Untransferred earnings are now an exception, not a normal
                  // state, so they get an explicit warning rather than a stat
                  // tile that reads as routine.
                  if (_pending > 0) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(14)),
                      child: Text(
                        'proEarnings.awaitingTransfer'.tr(args: [_pending.toStringAsFixed(2)]),
                        style: const TextStyle(
                            color: Color(0xFFB45309), fontSize: 13, fontWeight: FontWeight.w600, height: 1.45),
                      ),
                    ),
                  ],
                  // What Stripe will actually release, and what is still
                  // settling. Card money takes about two business days to
                  // clear, and a pro told "available" for funds that cannot be
                  // withdrawn reads as a broken promise rather than a bank
                  // delay.
                  if (_withdrawable != null || _clearing != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
                      child: Column(children: [
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          Text('proEarnings.readyToCashOut'.tr(),
                              style: const TextStyle(color: C.muted, fontSize: 14)),
                          Text('\$${(_withdrawable ?? 0).toStringAsFixed(2)}',
                              style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 18)),
                        ]),
                        if ((_clearing ?? 0) > 0) ...[
                          const SizedBox(height: 8),
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            Text('proEarnings.clearing'.tr(),
                                style: const TextStyle(color: C.muted, fontSize: 14)),
                            Text('\$${_clearing!.toStringAsFixed(2)}',
                                style: const TextStyle(fontWeight: FontWeight.w700, color: C.amber, fontSize: 16)),
                          ]),
                          const SizedBox(height: 8),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text('proEarnings.clearingNote'.tr(),
                                style: const TextStyle(color: C.muted, fontSize: 12, height: 1.5)),
                          ),
                        ],
                      ]),
                    ),
                  ],
                  // Instant cash-out progress. Only while it is still locked —
                  // once a pro passes the threshold this row has nothing left
                  // to say, and Stripe's own limit decides the rest.
                  if (_instantNeed > 0 && _instantDone < _instantNeed) ...[
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Container(
                            width: 44, height: 44,
                            decoration: BoxDecoration(color: const Color(0xFFF3F0FF), borderRadius: BorderRadius.circular(22)),
                            child: const Icon(Icons.bolt_outlined, color: Color(0xFF7C5CFF)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text('proEarnings.instantTitle'.tr(),
                                style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                          ),
                          Text('$_instantDone/$_instantNeed',
                              style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF7C5CFF), fontSize: 16)),
                        ]),
                        const SizedBox(height: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: LinearProgressIndicator(
                            value: _instantNeed == 0 ? 0 : (_instantDone / _instantNeed).clamp(0.0, 1.0),
                            minHeight: 8,
                            backgroundColor: const Color(0xFFEDE9FE),
                            valueColor: const AlwaysStoppedAnimation(Color(0xFF7C5CFF)),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text('proEarnings.instantNote'.tr(args: ['$_instantNeed']),
                            style: const TextStyle(color: C.muted, fontSize: 12, height: 1.5)),
                      ]),
                    ),
                  ],
                  const SizedBox(height: 20),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => context.push('/pro/payout-methods').then((_) { if (mounted) _load(); }),
                    child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
                    child: Row(children: [
                      Container(width: 44, height: 44, decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(22)), child: const Icon(Icons.account_balance_outlined, color: C.blue)),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('proEarnings.payoutMethod'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                        Text(_stripe.toLowerCase() == 'active' || _stripe.toLowerCase() == 'complete' ? 'proEarnings.connected'.tr() : 'proEarnings.setupBank'.tr(), style: const TextStyle(color: C.muted, fontSize: 13)),
                      ])),
                      const Icon(Icons.chevron_right, color: C.muted),
                    ]),
                  ),
                  ),
                  const SizedBox(height: 12),
                  // Lives beside payouts because both answer "where is my
                  // money" — and this one existed only on the website, which
                  // the pros who need it never open.
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => context.push('/pro/tax-report'),
                    child: Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
                      child: Row(children: [
                        Container(
                          width: 44, height: 44,
                          decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(22)),
                          child: const Icon(Icons.description_outlined, color: Color(0xFFB45309)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('tax.title'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                          Text('tax.cardSubtitle'.tr(), style: const TextStyle(color: C.muted, fontSize: 13)),
                        ])),
                        const Icon(Icons.chevron_right, color: C.muted),
                      ]),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _stat(String value, String label, Color color) => Expanded(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4), padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: color)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: C.muted, fontSize: 12)),
          ]),
        ),
      );
}
