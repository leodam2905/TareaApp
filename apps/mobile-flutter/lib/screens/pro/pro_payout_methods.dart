import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';
import '../../stripe.dart';

class ProPayoutMethods extends StatefulWidget {
  const ProPayoutMethods({super.key});
  @override
  State<ProPayoutMethods> createState() => _ProPayoutMethodsState();
}

class _ProPayoutMethodsState extends State<ProPayoutMethods> {
  List<dynamic> _banks = [];
  List<dynamic> _cards = [];
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/handyman/payout-methods');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body) as Map<String, dynamic>;
        _banks = (d['banks'] as List?) ?? [];
        _cards = (d['cards'] as List?) ?? [];
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _setDefault(String id) async {
    setState(() => _busy = true);
    try {
      final res = await Api.patch('/handyman/payout-methods/$id', {});
      if (res.statusCode >= 200 && res.statusCode < 300) { _toast('payout.defaultUpdated'.tr()); await _load(); }
      else { _toast('requests.updateFailed'.tr()); }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _delete(String id, String label) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: Text('payout.removeTitle'.tr()),
      content: Text('payout.removeConfirm'.tr(args: [label])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: Text('common.cancel'.tr())),
        TextButton(onPressed: () => Navigator.pop(context, true), child: Text('payout.remove'.tr(), style: const TextStyle(color: C.red, fontWeight: FontWeight.w800))),
      ],
    ));
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final res = await Api.delete('/handyman/payout-methods/$id');
      if (res.statusCode >= 200 && res.statusCode < 300) { _toast('payout.removed'.tr()); await _load(); }
      else { _toast('payout.removeFailed'.tr()); }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _addToken(String token, String type) async {
    setState(() => _busy = true);
    try {
      final res = await Api.post('/handyman/payout-methods', {'token': token, 'type': type});
      final data = jsonDecode(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300) { _toast('payout.added'.tr()); await _load(); }
      else { _toast((data is Map ? data['error'] : null)?.toString() ?? 'payout.addFailedStripe'.tr()); }
    } catch (_) { _toast('common.connectionRetry'.tr()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _addBank() async {
    final tok = await showModalBottomSheet<StripeTokenResult>(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (_) => const _BankSheet());
    if (tok?.id != null) _addToken(tok!.id!, 'bank_account');
    else if (tok?.error != null) _toast(tok!.error!);
  }

  Future<void> _addCard() async {
    final tok = await showModalBottomSheet<StripeTokenResult>(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (_) => const _CardSheet());
    if (tok?.id != null) _addToken(tok!.id!, 'card');
    else if (tok?.error != null) _toast(tok!.error!);
  }

  Future<void> _connectStripe() async {
    try {
      final res = await Api.post('/stripe/connect', {});
      final url = (jsonDecode(res.body)['url'] ?? '').toString();
      if (url.startsWith('http')) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      else _toast('payout.openStripeFailed'.tr());
    } catch (_) { _toast('common.connectionRetry'.tr()); }
  }

  @override
  Widget build(BuildContext context) {
    final empty = _banks.isEmpty && _cards.isEmpty;
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.white, surfaceTintColor: Colors.transparent, elevation: 0.5,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: C.ink), onPressed: () => context.pop()),
        title: Text('payout.title'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 18)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(16), children: [
              if (empty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(14)),
                  child: Text('payout.emptyDesc'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w600)),
                ),
              ..._banks.map((b) => _row(
                    id: (b['id'] ?? '').toString(),
                    icon: Icons.account_balance_outlined,
                    title: '${(b['bankName'] ?? 'payout.bankFallback'.tr())} •••• ${b['last4'] ?? ''}',
                    sub: 'payout.bankAccount'.tr(),
                    isDefault: b['isDefault'] == true,
                  )),
              ..._cards.map((c) => _row(
                    id: (c['id'] ?? '').toString(),
                    icon: Icons.credit_card,
                    title: '${_titleCase((c['brand'] ?? 'payout.cardFallback'.tr()).toString())} •••• ${c['last4'] ?? ''}',
                    sub: 'payout.debitCardInstant'.tr(),
                    isDefault: c['isDefault'] == true,
                  )),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), side: const BorderSide(color: C.blue)),
                onPressed: _busy ? null : _addBank,
                icon: const Icon(Icons.account_balance_outlined, size: 18, color: C.blue),
                label: Text('payout.addBank'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800))),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), side: const BorderSide(color: C.blue)),
                onPressed: _busy ? null : _addCard,
                icon: const Icon(Icons.credit_card, size: 18, color: C.blue),
                label: Text('payout.addCard'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800))),
              const SizedBox(height: 10),
              TextButton.icon(onPressed: _connectStripe,
                iconAlignment: IconAlignment.end,
                icon: const Icon(Icons.arrow_forward, size: 16, color: C.muted),
                label: Text('payout.manageStripe'.tr(), style: const TextStyle(color: C.muted, fontWeight: FontWeight.w700))),
              const SizedBox(height: 24),
              Center(
                child: Image.asset(
                  'assets/images/payout-illustration.png',
                  height: 200,
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(height: 8),
            ]),
    );
  }

  Widget _row({required String id, required IconData icon, required String title, required String sub, required bool isDefault}) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          Container(width: 42, height: 42, decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(21)), child: Icon(icon, color: C.blue, size: 20)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink)),
            Text(sub, style: const TextStyle(color: C.muted, fontSize: 12)),
          ])),
          if (isDefault)
            Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(20)),
                child: Text('payout.default'.tr(), style: const TextStyle(color: Color(0xFF15803D), fontWeight: FontWeight.w800, fontSize: 12)))
          else
            TextButton(onPressed: _busy ? null : () => _setDefault(id), child: Text('payout.setDefault'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800, fontSize: 13))),
          IconButton(icon: const Icon(Icons.delete_outline, color: C.red, size: 20), onPressed: _busy ? null : () => _delete(id, title)),
        ]),
      );

  String _titleCase(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

class _BankSheet extends StatefulWidget {
  const _BankSheet();
  @override
  State<_BankSheet> createState() => _BankSheetState();
}

class _BankSheetState extends State<_BankSheet> {
  final _routing = TextEditingController();
  final _account = TextEditingController();
  final _holder = TextEditingController();
  bool _saving = false;

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _submit() async {
    if (_routing.text.trim().length < 9 || _account.text.trim().isEmpty || _holder.text.trim().isEmpty) {
      return _toast('payout.enterBank'.tr());
    }
    setState(() => _saving = true);
    final r = await StripeTokens.bankAccount(
      routingNumber: _routing.text.trim(), accountNumber: _account.text.trim(), accountHolderName: _holder.text.trim());
    if (mounted) { setState(() => _saving = false); Navigator.pop(context, r); }
  }

  @override
  Widget build(BuildContext context) => _sheet(context, 'payout.addBank'.tr(), _saving, _submit, [
        _f('payout.accountHolder'.tr(), _holder),
        _f('payout.routing'.tr(), _routing, keyboard: TextInputType.number),
        _f('payout.account'.tr(), _account, keyboard: TextInputType.number),
        Text('payout.bankPrivacy'.tr(), style: const TextStyle(color: C.muted, fontSize: 12)),
      ]);
}

class _CardSheet extends StatefulWidget {
  const _CardSheet();
  @override
  State<_CardSheet> createState() => _CardSheetState();
}

class _CardSheetState extends State<_CardSheet> {
  final _number = TextEditingController();
  final _month = TextEditingController();
  final _year = TextEditingController();
  final _cvc = TextEditingController();
  final _name = TextEditingController();
  bool _saving = false;

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _submit() async {
    if (_number.text.trim().length < 12 || _month.text.trim().isEmpty || _year.text.trim().isEmpty || _cvc.text.trim().isEmpty) {
      return _toast('payout.enterCard'.tr());
    }
    setState(() => _saving = true);
    final r = await StripeTokens.card(
      number: _number.text.replaceAll(' ', ''), expMonth: _month.text.trim(), expYear: _year.text.trim(),
      cvc: _cvc.text.trim(), name: _name.text.trim());
    if (mounted) { setState(() => _saving = false); Navigator.pop(context, r); }
  }

  @override
  Widget build(BuildContext context) => _sheet(context, 'payout.addCard'.tr(), _saving, _submit, [
        _f('payout.nameOnCard'.tr(), _name),
        _f('payout.cardNumber'.tr(), _number, keyboard: TextInputType.number),
        Row(children: [
          Expanded(child: _f('MM', _month, keyboard: TextInputType.number)),
          const SizedBox(width: 10),
          Expanded(child: _f('YYYY', _year, keyboard: TextInputType.number)),
          const SizedBox(width: 10),
          Expanded(child: _f('CVC', _cvc, keyboard: TextInputType.number)),
        ]),
        Text('payout.cardPrivacy'.tr(), style: const TextStyle(color: C.muted, fontSize: 12)),
      ]);
}

// Shared sheet chrome + field.
Widget _sheet(BuildContext context, String title, bool saving, VoidCallback onSubmit, List<Widget> fields) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(color: C.bg, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 18))),
            const SizedBox(height: 16),
            ...fields.map((w) => Padding(padding: const EdgeInsets.only(bottom: 12), child: w)),
            const SizedBox(height: 8),
            SizedBox(width: double.infinity, child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              onPressed: saving ? null : onSubmit,
              child: saving
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text('payout.add'.tr(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
            )),
            const SizedBox(height: 8),
          ]),
        ),
      ),
    );

Widget _f(String label, TextEditingController c, {TextInputType? keyboard}) => TextField(
      controller: c, keyboardType: keyboard,
      decoration: InputDecoration(
        labelText: label, filled: true, fillColor: C.white, isDense: true,
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.line)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.blue, width: 1.5)),
      ),
    );
