import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';
import 'pro_widgets.dart';

class ProEditServices extends StatefulWidget {
  const ProEditServices({super.key});
  @override
  State<ProEditServices> createState() => _ProEditServicesState();
}

class _ProEditServicesState extends State<ProEditServices> {
  List<dynamic> _services = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/services?mine=1');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        _services = d is List ? d : (d['services'] ?? []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _toast(String m) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m))); }

  Future<void> _delete(dynamic s) async {
    final id = (s['id'] ?? '').toString();
    if (id.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('proEdit.deleteServiceTitle'.tr()),
        content: Text('proEdit.deleteServiceBody'.tr(args: [(s['title'] ?? 'proEdit.thisService'.tr()).toString()])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text('common.cancel'.tr())),
          TextButton(onPressed: () => Navigator.pop(context, true), child: Text('common.delete'.tr(), style: const TextStyle(color: C.red, fontWeight: FontWeight.w800))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final res = await Api.delete('/services/$id');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _toast('proEdit.serviceDeleted'.tr());
        _load();
      } else {
        String msg = 'proEdit.deleteServiceFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    }
  }

  Future<void> _addSheet() async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _AddServiceSheet(),
    );
    if (added == true) { _toast('proEdit.serviceAdded'.tr()); _load(); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: proBar(context, 'proEdit.myServices'.tr()),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: C.blue,
        onPressed: _addSheet,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text('proEdit.addService'.tr(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _services.isEmpty
              ? Center(child: Padding(padding: const EdgeInsets.all(32), child: Text('proEdit.noServices'.tr(), textAlign: TextAlign.center, style: const TextStyle(color: C.muted))))
              : ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 90), children: _services.map(_card).toList()),
    );
  }

  Widget _card(dynamic s) {
    final title = (s['title'] ?? 'proProfile.serviceFallback'.tr()).toString();
    final cat = prettyCategory((s['category'] ?? '').toString());
    final min = (s['minPrice'] ?? 0) as num;
    final max = (s['maxPrice'] ?? 0) as num;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
          const SizedBox(height: 2),
          Text(cat, style: const TextStyle(color: C.muted)),
        ])),
        Text('\$${min.round()}–${max.round()}', style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF16A34A))),
        IconButton(icon: const Icon(Icons.delete_outline, color: C.red, size: 20), onPressed: () => _delete(s)),
      ]),
    );
  }
}

class _AddServiceSheet extends StatefulWidget {
  const _AddServiceSheet();
  @override
  State<_AddServiceSheet> createState() => _AddServiceSheetState();
}

class _AddServiceSheetState extends State<_AddServiceSheet> {
  final _title = TextEditingController();
  final _desc = TextEditingController();
  final _min = TextEditingController();
  final _max = TextEditingController();
  final _duration = TextEditingController(text: '60');
  String _category = kServiceCategories.first;
  bool _saving = false;

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _submit() async {
    final title = _title.text.trim();
    final desc = _desc.text.trim();
    final min = double.tryParse(_min.text.trim());
    final max = double.tryParse(_max.text.trim());
    final dur = int.tryParse(_duration.text.trim());
    if (title.length < 3) return _toast('proEdit.titleMin'.tr());
    if (desc.length < 10) return _toast('proEdit.descMin'.tr());
    if (min == null || max == null || min <= 0 || max <= 0) return _toast('proEdit.validPrices'.tr());
    if (dur == null || dur <= 0) return _toast('proEdit.validDuration'.tr());
    setState(() => _saving = true);
    try {
      final res = await Api.post('/services', {
        'title': title, 'description': desc, 'category': _category,
        'minPrice': min, 'maxPrice': max, 'duration': dur,
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (mounted) Navigator.pop(context, true);
      } else {
        String msg = 'proEdit.addServiceFailed'.tr();
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(color: C.bg, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Text('proEdit.addServiceTitle'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 18))),
            const SizedBox(height: 16),
            proField('proEdit.fldTitle'.tr(), _title, hint: 'proEdit.titleHint'.tr()),
            Text('proEdit.category'.tr(), style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink, fontSize: 14)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.line)),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _category, isExpanded: true,
                  items: kServiceCategories.map((c) => DropdownMenuItem(value: c, child: Text(prettyCategory(c)))).toList(),
                  onChanged: (v) => setState(() => _category = v ?? _category),
                ),
              ),
            ),
            const SizedBox(height: 16),
            proField('proEdit.fldDescription'.tr(), _desc, maxLines: 3, hint: 'proEdit.descHint'.tr()),
            Row(children: [
              Expanded(child: proField('proEdit.minPrice'.tr(), _min, keyboard: TextInputType.number)),
              const SizedBox(width: 12),
              Expanded(child: proField('proEdit.maxPrice'.tr(), _max, keyboard: TextInputType.number)),
            ]),
            proField('proEdit.duration'.tr(), _duration, keyboard: TextInputType.number),
            const SizedBox(height: 4),
            proSaveButton(_saving, _submit, label: 'proEdit.addService'.tr()),
            const SizedBox(height: 8),
          ]),
        ),
      ),
    );
  }
}
