import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme.dart';
import '../../api.dart';
import 'pro_widgets.dart';

class ProEditProfile extends StatefulWidget {
  const ProEditProfile({super.key});
  @override
  State<ProEditProfile> createState() => _ProEditProfileState();
}

class _ProEditProfileState extends State<ProEditProfile> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _bio = TextEditingController();
  final _rate = TextEditingController();
  final _company = TextEditingController();
  final _website = TextEditingController();
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
        _name.text = (p['name'] ?? '').toString();
        _phone.text = (p['phone'] ?? '').toString();
        _company.text = (p['companyName'] ?? '').toString();
        _website.text = (p['website'] ?? '').toString();
        _bio.text = (hp['bio'] ?? p['bio'] ?? '').toString();
        final rate = hp['hourlyRate'] ?? p['hourlyRate'];
        _rate.text = rate == null ? '' : (rate as num).toString();
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) return _toast('Name is required');
    setState(() => _saving = true);
    try {
      final body = {
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'bio': _bio.text.trim(),
        'companyName': _company.text.trim(),
        'website': _website.text.trim(),
        if (_rate.text.trim().isNotEmpty) 'hourlyRate': _rate.text.trim(),
      };
      final res = await Api.patch('/profile', body);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (mounted) { _toast('Profile updated'); context.pop(true); }
      } else {
        _toast('Could not save. Please try again.');
      }
    } catch (_) {
      _toast('Could not connect. Please try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: proBar(context, 'Edit Profile'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(20), children: [
              proField('Full name', _name),
              proField('Phone', _phone, keyboard: TextInputType.phone),
              proField('Bio', _bio, maxLines: 4, hint: 'Tell customers about your experience'),
              proField('Hourly rate (\$)', _rate, keyboard: TextInputType.number),
              proField('Company name (optional)', _company),
              proField('Website (optional)', _website, keyboard: TextInputType.url),
              const SizedBox(height: 10),
              proSaveButton(_saving, _save),
            ]),
    );
  }
}
