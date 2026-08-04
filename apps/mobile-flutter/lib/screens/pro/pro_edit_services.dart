import 'dart:convert';
import 'package:flutter/material.dart';
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
        title: const Text('Delete service?'),
        content: Text('Remove "${(s['title'] ?? 'this service')}" from your services?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: C.red, fontWeight: FontWeight.w800))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final res = await Api.delete('/services/$id');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _toast('Service deleted');
        _load();
      } else {
        String msg = 'Could not delete service.';
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) {
      _toast('Could not connect. Please try again.');
    }
  }

  Future<void> _addSheet() async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _AddServiceSheet(),
    );
    if (added == true) { _toast('Service added'); _load(); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: proBar(context, 'My Services'),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: C.blue,
        onPressed: _addSheet,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Add service', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _services.isEmpty
              ? const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('No services yet.\nTap "Add service" to list what you offer.', textAlign: TextAlign.center, style: TextStyle(color: C.muted))))
              : ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 90), children: _services.map(_card).toList()),
    );
  }

  Widget _card(dynamic s) {
    final title = (s['title'] ?? 'Service').toString();
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
    if (title.length < 3) return _toast('Title must be at least 3 characters');
    if (desc.length < 10) return _toast('Description must be at least 10 characters');
    if (min == null || max == null || min <= 0 || max <= 0) return _toast('Enter valid prices');
    if (dur == null || dur <= 0) return _toast('Enter a valid duration');
    setState(() => _saving = true);
    try {
      final res = await Api.post('/services', {
        'title': title, 'description': desc, 'category': _category,
        'minPrice': min, 'maxPrice': max, 'duration': dur,
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (mounted) Navigator.pop(context, true);
      } else {
        String msg = 'Could not add service.';
        try { msg = (jsonDecode(res.body)['error'] ?? msg).toString(); } catch (_) {}
        _toast(msg);
      }
    } catch (_) {
      _toast('Could not connect. Please try again.');
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
            const Center(child: Text('Add a service', style: TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 18))),
            const SizedBox(height: 16),
            proField('Title', _title, hint: 'e.g. Faucet & sink repair'),
            const Text('Category', style: TextStyle(fontWeight: FontWeight.w800, color: C.ink, fontSize: 14)),
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
            proField('Description', _desc, maxLines: 3, hint: 'What this service includes'),
            Row(children: [
              Expanded(child: proField('Min price (\$)', _min, keyboard: TextInputType.number)),
              const SizedBox(width: 12),
              Expanded(child: proField('Max price (\$)', _max, keyboard: TextInputType.number)),
            ]),
            proField('Duration (minutes)', _duration, keyboard: TextInputType.number),
            const SizedBox(height: 4),
            proSaveButton(_saving, _submit, label: 'Add service'),
            const SizedBox(height: 8),
          ]),
        ),
      ),
    );
  }
}
