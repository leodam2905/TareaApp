import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';
import 'pro_widgets.dart';

class ProServiceArea extends StatefulWidget {
  const ProServiceArea({super.key});
  @override
  State<ProServiceArea> createState() => _ProServiceAreaState();
}

class _ProServiceAreaState extends State<ProServiceArea> {
  final _city = TextEditingController();
  final _state = TextEditingController();
  double _radius = 25;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/profile');
      if (res.statusCode == 200) {
        final p = jsonDecode(res.body) as Map<String, dynamic>;
        final hp = p['handymanProfile'] ?? {};
        _city.text = (p['city'] ?? hp['city'] ?? '').toString();
        _state.text = (p['state'] ?? hp['state'] ?? '').toString();
        final r = hp['serviceRadius'] ?? p['serviceRadius'];
        if (r != null) _radius = (r as num).toDouble().clamp(5, 100);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final res = await Api.patch('/profile', {
        'city': _city.text.trim(),
        'state': _state.text.trim(),
        'serviceRadius': _radius.round().toString(),
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (mounted) { _toast('proEdit.areaUpdated'.tr()); context.pop(true); }
      } else {
        _toast('editProfile.saveFailed'.tr());
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: proBar(context, 'proProfile.serviceArea'.tr()),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(20), children: [
              proField('postjob.city'.tr(), _city),
              proField('proEdit.state'.tr(), _state),
              Text('proEdit.travelRadius'.tr(args: ['${_radius.round()}']), style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink, fontSize: 14)),
              const SizedBox(height: 4),
              Text('proEdit.travelDesc'.tr(), style: const TextStyle(color: C.muted, fontSize: 13)),
              Slider(
                value: _radius, min: 5, max: 100, divisions: 19,
                activeColor: C.blue, label: 'proEdit.radiusMi'.tr(args: ['${_radius.round()}']),
                onChanged: (v) => setState(() => _radius = v),
              ),
              const SizedBox(height: 16),
              proSaveButton(_saving, _save),
            ]),
    );
  }
}
