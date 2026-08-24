import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';

/// A pro's annual earnings, for filing taxes.
///
/// This existed only on the website, and Tarea's pros are on phones — so the
/// people who need it had no way to reach it. What a pro actually needs is the
/// three totals; the per-job list is there to check them against. The CSV goes
/// out by email rather than a share sheet, because it usually has to reach an
/// accountant anyway.
class ProTaxReport extends StatefulWidget {
  const ProTaxReport({super.key});
  @override
  State<ProTaxReport> createState() => _ProTaxReportState();
}

class _ProTaxReportState extends State<ProTaxReport> {
  late int _year = DateTime.now().year;
  Map<String, dynamic>? _report;
  bool _loading = true;
  bool _emailing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await Api.get('/handyman/tax-report?year=$_year');
      if (res.statusCode == 200) {
        _report = jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _toast(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _emailReport() async {
    if (_emailing) return;
    setState(() => _emailing = true);
    try {
      final res = await Api.post('/handyman/tax-report/email', {'year': _year});
      final d = jsonDecode(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _toast('tax.emailSent'.tr(args: [(d is Map ? d['sentTo'] : '') ?? '']));
      } else {
        _toast((d is Map ? d['error'] : null)?.toString() ?? 'tax.emailFailed'.tr());
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _emailing = false);
    }
  }

  String _money(dynamic v) => '\$${((v ?? 0) as num).toStringAsFixed(2)}';

  @override
  Widget build(BuildContext context) {
    final r = _report;
    final jobs = (r?['bookings'] as List?) ?? const [];
    final thisYear = DateTime.now().year;
    // Only years the platform could have earnings in, newest first.
    final years = [for (var y = thisYear; y >= 2026; y--) y];

    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.chevron_left, color: C.ink, size: 30),
          onPressed: () => context.pop(),
        ),
        title: Text('tax.title'.tr(),
            style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
              children: [
                if (years.length > 1)
                  SizedBox(
                    height: 40,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        for (final y in years)
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: GestureDetector(
                              onTap: () {
                                setState(() => _year = y);
                                _load();
                              },
                              child: Container(
                                alignment: Alignment.center,
                                padding: const EdgeInsets.symmetric(horizontal: 18),
                                decoration: BoxDecoration(
                                  color: _year == y ? C.blue : C.white,
                                  borderRadius: BorderRadius.circular(22),
                                  border: Border.all(color: _year == y ? C.blue : C.line),
                                ),
                                child: Text('$y',
                                    style: TextStyle(
                                        color: _year == y ? Colors.white : C.ink,
                                        fontWeight: FontWeight.w700)),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                const SizedBox(height: 16),

                // Totals. Net is bottom and biggest: it is the number that goes
                // on the tax form, and the only one the pro was actually paid.
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(18)),
                  child: Column(children: [
                    _row('tax.gross'.tr(), _money(r?['grossEarnings'])),
                    const SizedBox(height: 10),
                    _row('tax.platformFee'.tr(), '-${_money(r?['platformFees'])}'),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Divider(color: C.line, height: 1),
                    ),
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Text('tax.net'.tr(),
                          style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                      Text(_money(r?['netEarnings']),
                          style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 26)),
                    ]),
                    const SizedBox(height: 6),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'tax.jobsCompleted'.tr(args: ['${r?['jobCount'] ?? 0}', '$_year']),
                        style: const TextStyle(color: C.muted, fontSize: 13),
                      ),
                    ),
                  ]),
                ),

                if (r?['over1099Threshold'] == true) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(14)),
                    child: Text('tax.form1099'.tr(args: ['$_year']),
                        style: const TextStyle(color: Color(0xFFB45309), fontSize: 13, fontWeight: FontWeight.w700)),
                  ),
                ],

                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                        backgroundColor: C.blue, minimumSize: const Size.fromHeight(52)),
                    onPressed: (_emailing || (r?['jobCount'] ?? 0) == 0) ? null : _emailReport,
                    icon: const Icon(Icons.mail_outline, size: 20),
                    label: Text(_emailing ? 'common.loading'.tr() : 'tax.emailCsv'.tr(),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),

                const SizedBox(height: 24),
                Text('tax.jobsHeading'.tr(),
                    style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                const SizedBox(height: 8),
                // An empty year must say so. A blank screen in January reads as
                // a broken app, not as "you completed no jobs".
                if (jobs.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 28),
                    alignment: Alignment.center,
                    child: Text('tax.noJobs'.tr(args: ['$_year']),
                        style: const TextStyle(color: C.muted)),
                  )
                else
                  ...jobs.map(_jobRow),

                const SizedBox(height: 16),
                Text('tax.disclaimer'.tr(),
                    style: const TextStyle(color: C.muted, fontSize: 12, height: 1.5)),
              ],
            ),
    );
  }

  Widget _row(String label, String value) =>
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: const TextStyle(color: C.muted, fontSize: 15)),
        Text(value, style: const TextStyle(color: C.ink, fontWeight: FontWeight.w700, fontSize: 15)),
      ]);

  Widget _jobRow(dynamic j) {
    final date = DateTime.tryParse((j['completedAt'] ?? '').toString())?.toLocal();
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final when = date == null ? '' : '${mo[date.month - 1]} ${date.day}';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: C.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: C.line)),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text((j['serviceTitle'] ?? '').toString(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
            Text('$when · ${(j['customerName'] ?? '').toString()}',
                style: const TextStyle(color: C.muted, fontSize: 12)),
          ]),
        ),
        Text(_money(j['netAmount']),
            style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink)),
      ]),
    );
  }
}
