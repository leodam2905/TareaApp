import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../theme.dart';

/// Every receipt a customer has.
///
/// Invoices existed only as a link inside the completion email, so anyone who
/// deleted the mail — or changed address, or just wanted last month's receipt
/// — had no way to reach one. Tapping a row opens the printable invoice in the
/// browser through a signed URL, so it needs no website login.
class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});
  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  List<dynamic> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await Api.get('/invoices');
      if (res.statusCode == 200) {
        _items = (jsonDecode(res.body) as Map<String, dynamic>)['invoices'] as List? ?? [];
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _open(Map inv) async {
    final url = (inv['url'] ?? '').toString();
    if (url.isEmpty) return;
    final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('invoices.openFailed'.tr())));
    }
  }

  String _money(dynamic v) => '\$${((v ?? 0) as num).toStringAsFixed(2)}';

  @override
  Widget build(BuildContext context) {
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
        title: Text('invoices.title'.tr(),
            style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              // An empty list must say why. A blank screen reads as a broken
              // app rather than "you have not paid for a job yet".
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 40),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.receipt_long_outlined, size: 48, color: C.muted),
                      const SizedBox(height: 12),
                      Text('invoices.emptyTitle'.tr(),
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
                      const SizedBox(height: 6),
                      Text('invoices.emptyBody'.tr(),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: C.muted, fontSize: 13, height: 1.5)),
                    ]),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                    itemCount: _items.length,
                    itemBuilder: (_, i) => _card(_items[i] as Map),
                  ),
                ),
    );
  }

  Widget _card(Map inv) {
    final date = DateTime.tryParse((inv['date'] ?? '').toString())?.toLocal();
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    final when = date == null ? '' : '${mo[date.month - 1]} ${date.day}, ${date.year}';
    final refunded = ((inv['materialsRefunded'] ?? 0) as num).toDouble();

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _open(inv),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text((inv['service'] ?? '').toString(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink, fontSize: 15)),
                const SizedBox(height: 2),
                Text('$when · ${(inv['handyman'] ?? '').toString()}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: C.muted, fontSize: 12)),
              ]),
            ),
            const SizedBox(width: 8),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(_money(inv['total']),
                  style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
              Text('#${(inv['number'] ?? '').toString()}',
                  style: const TextStyle(color: C.muted, fontSize: 11)),
            ]),
          ]),
          // Only worth showing when something came back — otherwise it is a
          // line of zeroes on every receipt.
          if (refunded > 0) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.undo, size: 14, color: Color(0xFF047857)),
              const SizedBox(width: 6),
              Text('invoices.refunded'.tr(args: [refunded.toStringAsFixed(2)]),
                  style: const TextStyle(color: Color(0xFF047857), fontSize: 12, fontWeight: FontWeight.w600)),
            ]),
          ],
          const SizedBox(height: 10),
          Row(children: [
            const Icon(Icons.open_in_new, size: 14, color: C.blue),
            const SizedBox(width: 6),
            Text('invoices.viewReceipt'.tr(),
                style: const TextStyle(color: C.blue, fontSize: 12, fontWeight: FontWeight.w700)),
          ]),
        ]),
      ),
    );
  }
}
