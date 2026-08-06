import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';

// Customer edit-profile (name, phone, address).
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});
  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _city = TextEditingController();
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/profile');
      if (res.statusCode == 200) {
        final p = jsonDecode(res.body) as Map<String, dynamic>;
        _name.text = (p['name'] ?? '').toString();
        _phone.text = (p['phone'] ?? '').toString();
        _address.text = (p['address'] ?? '').toString();
        _city.text = (p['city'] ?? '').toString();
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) return _toast('editProfile.nameRequired'.tr());
    setState(() => _saving = true);
    try {
      final res = await Api.patch('/profile', {
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'address': _address.text.trim(),
        'city': _city.text.trim(),
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (mounted) { _toast('editProfile.updated'.tr()); context.pop(true); }
      } else {
        _toast('editProfile.saveFailed'.tr());
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.white, surfaceTintColor: Colors.transparent, elevation: 0.5,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: C.ink), onPressed: () => context.pop()),
        title: Text('editProfile.title'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 18)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(20), children: [
              _field('register.fullName'.tr(), _name),
              _field('editProfile.phone'.tr(), _phone, keyboard: TextInputType.phone),
              _field('editProfile.address'.tr(), _address),
              _field('postjob.city'.tr(), _city),
              const SizedBox(height: 10),
              SizedBox(width: double.infinity, child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text('common.save'.tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
              )),
            ]),
    );
  }

  Widget _field(String label, TextEditingController c, {TextInputType? keyboard}) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink, fontSize: 14)),
          const SizedBox(height: 8),
          TextField(
            controller: c, keyboardType: keyboard,
            decoration: InputDecoration(
              filled: true, fillColor: C.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.blue, width: 1.5)),
            ),
          ),
        ]),
      );
}
