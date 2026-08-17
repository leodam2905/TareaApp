import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:easy_localization/easy_localization.dart';
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
  /// Which document is uploading, so only that row shows a spinner.
  String? _busyField;

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

  /// Upload a document and attach it to a specific field.
  ///
  /// Two steps because they are two different things: /api/verification stores
  /// the file and hands back a URL, and /api/handyman/onboarding records which
  /// document that URL actually is. The old screen only did the first, so every
  /// document landed in the same generic slot — a licence and an insurance
  /// certificate were indistinguishable afterwards.
  ///
  /// Uploading anything also returns verification to `pending`, which is
  /// correct: a new document is a document an admin has not seen.
  Future<void> _uploadFor(String field) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );
    final path = result?.files.single.path;
    if (path == null) return;

    setState(() => _busyField = field);
    try {
      final up = await Api.uploadDoc(path);
      if (up.statusCode < 200 || up.statusCode >= 300) {
        _toast('proEdit.uploadDocFailed'.tr());
        return;
      }
      final url = (jsonDecode(up.body)['url'] ?? '').toString();
      if (url.isEmpty) {
        _toast('proEdit.uploadDocFailed'.tr());
        return;
      }
      final save = await Api.post('/handyman/onboarding', {field: url});
      if (save.statusCode >= 200 && save.statusCode < 300) {
        _toast('proEdit.docSubmitted'.tr());
        await _load();
      } else {
        _toast('proEdit.uploadDocFailed'.tr());
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _busyField = null);
    }
  }

  void _toast(String m) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m))); }

  (Color, Color, String) get _statusStyle {
    switch (_status.toLowerCase()) {
      case 'approved': return (const Color(0xFF16A34A), const Color(0xFFECFDF3), 'proEdit.statusVerified'.tr());
      case 'pending': return (const Color(0xFFB45309), const Color(0xFFFEF3C7), 'proEdit.statusReview'.tr());
      case 'rejected': return (const Color(0xFFB91C1C), const Color(0xFFFEE2E2), 'proEdit.statusRejected'.tr());
      default: return (C.muted, C.surface, 'proEdit.statusNotSubmitted'.tr());
    }
  }

  @override
  Widget build(BuildContext context) {
    final (fg, bg, label) = _statusStyle;
    return Scaffold(
      backgroundColor: C.bg,
      appBar: proBar(context, 'proProfile.certifications'.tr()),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(20), children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
                child: Row(children: [
                  Expanded(child: Text('proEdit.verifStatus'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
                    child: Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 12)),
                  ),
                ]),
              ),
              const SizedBox(height: 14),

              // Government ID is NOT here. It identifies the person and gates the
              // background check, so it lives on that screen. This one is the
              // credentials a pro keeps current — licence and insurance expire
              // and get renewed, so both stay replaceable.
              _docRow(Icons.workspace_premium_outlined, 'proEdit.license'.tr(), _hasLicense,
                  field: 'licenseDocUrl'),
              _docRow(Icons.shield_outlined, 'proEdit.insurance'.tr(), _hasInsurance,
                  field: 'insuranceDocUrl'),

              const SizedBox(height: 8),
              Text('proEdit.certDesc'.tr(),
                  style: const TextStyle(color: C.muted, fontSize: 13, height: 1.4)),
            ]),
    );
  }

  Widget _docRow(
    IconData icon,
    String label,
    bool present, {
    required String field,
    bool locked = false,
  }) {
    final busy = _busyField == field;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(20)),
          child: Icon(icon, color: C.blue, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink))),
        if (busy)
          const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
        else if (locked)
          // On file and unchangeable — a tick, and no control that would lie.
          const Icon(Icons.lock_outline, color: Color(0xFF16A34A), size: 20)
        else
          TextButton(
            onPressed: _busyField != null ? null : () => _uploadFor(field),
            child: Text(
              present ? 'proEdit.replace'.tr() : 'proEdit.upload'.tr(),
              style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800),
            ),
          ),
        if (!busy && !locked && present) ...[
          const SizedBox(width: 6),
          const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 20),
        ],
      ]),
    );
  }
}
