import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../../theme.dart';
import '../../api.dart';
import 'pro_widgets.dart';

class ProCertifications extends StatefulWidget {
  const ProCertifications({super.key});
  @override
  State<ProCertifications> createState() => _ProCertificationsState();
}

class _ProCertificationsState extends State<ProCertifications> {
  String _status = '';
  bool _hasLicense = false;
  bool _hasInsurance = false;
  bool _loading = true;
  bool _uploading = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/profile');
      if (res.statusCode == 200) {
        final p = jsonDecode(res.body) as Map<String, dynamic>;
        final hp = p['handymanProfile'] ?? {};
        _status = (hp['verificationStatus'] ?? 'none').toString();
        _hasLicense = hp['licenseDocUrl'] != null;
        _hasInsurance = hp['insuranceDocUrl'] != null;
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _upload() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );
    final path = result?.files.single.path;
    if (path == null) return;
    setState(() => _uploading = true);
    try {
      final res = await Api.uploadDoc(path);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _toast('Document submitted for review');
        await _load();
      } else {
        _toast('Upload failed. Please try again.');
      }
    } catch (_) {
      _toast('Could not connect. Please try again.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _toast(String m) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m))); }

  (Color, Color, String) get _statusStyle {
    switch (_status.toLowerCase()) {
      case 'approved': return (const Color(0xFF16A34A), const Color(0xFFECFDF3), 'Verified');
      case 'pending': return (const Color(0xFFB45309), const Color(0xFFFEF3C7), 'Under review');
      case 'rejected': return (const Color(0xFFB91C1C), const Color(0xFFFEE2E2), 'Rejected — re-upload');
      default: return (C.muted, C.surface, 'Not submitted');
    }
  }

  @override
  Widget build(BuildContext context) {
    final (fg, bg, label) = _statusStyle;
    return Scaffold(
      backgroundColor: C.bg,
      appBar: proBar(context, 'Certifications'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(20), children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
                child: Row(children: [
                  const Expanded(child: Text('Verification status', style: TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
                    child: Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 12)),
                  ),
                ]),
              ),
              const SizedBox(height: 14),
              _docRow(Icons.badge_outlined, 'License', _hasLicense),
              _docRow(Icons.shield_outlined, 'Insurance', _hasInsurance),
              const SizedBox(height: 8),
              const Text('Upload a photo or PDF of your license, insurance, or ID. Our team reviews documents to verify your account.',
                  style: TextStyle(color: C.muted, fontSize: 13, height: 1.4)),
              const SizedBox(height: 16),
              proSaveButton(_uploading, _upload, label: 'Upload document'),
            ]),
    );
  }

  Widget _docRow(IconData icon, String label, bool present) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          Container(width: 40, height: 40, decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(20)), child: Icon(icon, color: C.blue, size: 20)),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink))),
          Icon(present ? Icons.check_circle : Icons.remove_circle_outline, color: present ? const Color(0xFF16A34A) : C.muted, size: 20),
        ]),
      );
}
