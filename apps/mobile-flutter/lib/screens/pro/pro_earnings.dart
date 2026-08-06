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
