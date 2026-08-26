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
                  Row(children: [
                    _stat('\$${_pending.round()}', 'proEarnings.pendingPayout'.tr(), C.amber),
                    _stat('$_jobs', 'proEarnings.jobsCompleted'.tr(), C.blue),
                  ]),
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
