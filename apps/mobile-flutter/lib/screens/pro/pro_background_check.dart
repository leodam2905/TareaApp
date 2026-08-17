import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';
import 'pro_widgets.dart';

// The background check step: prove who you are, then settle the fee.
//
// This step used to open /pro/certifications, which is the licence-and-
// insurance screen. Those are different things — a licence says what you are
// allowed to do, a government ID says who you are — and the background check
// cannot run without the ID. Certifications now live in the profile, where a
// pro goes to keep them current, and this screen owns identity and the fee.
//
// Government ID can be set ONCE. The server accepts idFront/idBack only while
// they are empty and silently ignores them afterwards, so once a document is on
// file the control is replaced by who to ask.

class ProBackgroundCheck extends StatefulWidget {
  const ProBackgroundCheck({super.key});
  @override
  State<ProBackgroundCheck> createState() => _ProBackgroundCheckState();
}

class _ProBackgroundCheckState extends State<ProBackgroundCheck> {
  bool _loading = true;
  bool _hasIdFront = false;
  bool _hasIdBack = false;
  String _status = 'NONE';
  double _fee = 29.99;
  String? _busyField;
  bool _submitting = false;

  bool get _idComplete => _hasIdFront && _hasIdBack;
  bool get _feeSettled =>
      const {'PAID', 'DEFERRED', 'IN_PROGRESS', 'PASSED'}.contains(_status);

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        Api.get('/profile'),
        Api.get('/handyman/background-check'),
      ]);
      final pr = results[0];
      if (pr.statusCode == 200) {
        final hp = (jsonDecode(pr.body) as Map<String, dynamic>)['handymanProfile'] ?? {};
        _hasIdFront = hp['idFrontUrl'] != null;
        _hasIdBack = hp['idBackUrl'] != null;
      }
      final br = results[1];
      if (br.statusCode == 200) {
        final b = jsonDecode(br.body) as Map<String, dynamic>;
        _status = (b['status'] ?? 'NONE').toString();
        final f = b['fee'];
        if (f is num) _fee = f.toDouble();
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _toast(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  /// Camera, gallery or a file — an ID is usually photographed, not on disk,
  /// so the camera is offered first.
  Future<void> _addId(String field) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: C.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined, color: C.blue),
            title: Text('proBg.takePhoto'.tr(),
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            onTap: () => Navigator.pop(context, 'camera'),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined, color: C.blue),
            title: Text('proBg.choosePhoto'.tr(),
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            onTap: () => Navigator.pop(context, 'gallery'),
          ),
          ListTile(
            leading: const Icon(Icons.attach_file, color: C.blue),
            title: Text('proBg.chooseFile'.tr(),
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            onTap: () => Navigator.pop(context, 'file'),
          ),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (choice == null) return;

    String? path;
    if (choice == 'file') {
      final r = await FilePicker.platform.pickFiles(
          type: FileType.custom, allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png']);
      path = r?.files.single.path;
    } else {
      final picked = await ImagePicker().pickImage(
        source: choice == 'camera' ? ImageSource.camera : ImageSource.gallery,
        imageQuality: 88,
        maxWidth: 1600,
      );
      path = picked?.path;
    }
    if (path == null) return;

    setState(() => _busyField = field);
    try {
      final up = await Api.uploadDoc(path);
      if (up.statusCode < 200 || up.statusCode >= 300) {
        _toast('proEdit.uploadDocFailed'.tr());
        return;
      }
      final url = (jsonDecode(up.body)['url'] ?? '').toString();
      if (url.isEmpty) { _toast('proEdit.uploadDocFailed'.tr()); return; }

      final save = await Api.post('/handyman/onboarding', {field: url});
      if (save.statusCode >= 200 && save.statusCode < 300) {
        _toast('proEdit.docUploaded'.tr());
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

  Future<void> _choose(String method) async {
    setState(() => _submitting = true);
    try {
      final res = await Api.post('/handyman/background-check', {'method': method});
      final body = res.body.isNotEmpty ? jsonDecode(res.body) : {};
      if (res.statusCode < 200 || res.statusCode >= 300) {
        _toast((body is Map ? body['error'] : null)?.toString() ?? 'proBg.failed'.tr());
        return;
      }
      final url = (body is Map ? body['checkoutUrl'] : null)?.toString();
      if (method == 'now' && url != null && url.startsWith('http')) {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        // Payment completes in the browser; the webhook flips the status, so
        // re-read rather than assuming it worked.
        await _load();
      } else {
        _toast('proBg.deferredDone'.tr());
        await _load();
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: proBar(context, 'proSetup.backgroundCheck'.tr()),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(20), children: [
              _statusCard(),
              const SizedBox(height: 16),

              _sectionTitle('proBg.idTitle'.tr()),
              const SizedBox(height: 4),
              Text('proBg.idDesc'.tr(),
                  style: const TextStyle(color: C.muted, fontSize: 14, height: 1.45)),
              const SizedBox(height: 12),
              _idRow('proEdit.idFront'.tr(), _hasIdFront, 'idFrontUrl'),
              const SizedBox(height: 10),
              _idRow('proEdit.idBack'.tr(), _hasIdBack, 'idBackUrl'),
              if (_idComplete)
                Padding(
                  padding: const EdgeInsets.only(top: 10, left: 2),
                  child: Text('proEdit.idLocked'.tr(),
                      style: const TextStyle(color: C.muted, fontSize: 13, height: 1.4)),
                ),

              const SizedBox(height: 24),
              _sectionTitle('proBg.feeTitle'.tr()),
              const SizedBox(height: 4),
              Text('proBg.feeDesc'.tr(args: [_fee.toStringAsFixed(2)]),
                  style: const TextStyle(color: C.muted, fontSize: 14, height: 1.45)),
              const SizedBox(height: 12),
              if (_feeSettled) _feeSettledCard() else _feeChoices(),
              const SizedBox(height: 28),
            ]),
    );
  }

  Widget _sectionTitle(String t) => Text(t,
      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: C.ink));

  Widget _statusCard() {
    final (fg, bg, label) = switch (_status) {
      'PASSED' => (const Color(0xFF047857), const Color(0xFFD1FAE5), 'proBg.statusPassed'.tr()),
      'IN_PROGRESS' => (const Color(0xFF1D4ED8), const Color(0xFFDBEAFE), 'proBg.statusRunning'.tr()),
      'PAID' => (const Color(0xFF1D4ED8), const Color(0xFFDBEAFE), 'proBg.statusPaid'.tr()),
      'DEFERRED' => (const Color(0xFFB45309), const Color(0xFFFEF3C7), 'proBg.statusDeferred'.tr()),
      'FAILED' => (const Color(0xFFB91C1C), const Color(0xFFFEE2E2), 'proBg.statusFailed'.tr()),
      _ => (C.muted, const Color(0xFFF1F5F9), 'proBg.statusNone'.tr()),
    };
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Expanded(
          child: Text('proBg.statusLabel'.tr(),
              style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
          child: Text(label,
              style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 13)),
        ),
      ]),
    );
  }

  Widget _idRow(String label, bool present, String field) {
    final busy = _busyField == field;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        Icon(present ? Icons.check_circle : Icons.badge_outlined,
            color: present ? C.green : C.muted, size: 24),
        const SizedBox(width: 12),
        Expanded(
          child: Text(label,
              style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink, fontSize: 15)),
        ),
        if (busy)
          const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
        else if (present)
          const Icon(Icons.lock_outline, color: C.muted, size: 20)
        else
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: C.blue,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => _addId(field),
            child: Text('proBg.add'.tr(),
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
          ),
      ]),
    );
  }

  Widget _feeSettledCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        const Icon(Icons.verified_outlined, color: C.green, size: 22),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            _status == 'DEFERRED'
                ? 'proBg.deferredNote'.tr(args: [_fee.toStringAsFixed(2)])
                : 'proBg.paidNote'.tr(),
            style: const TextStyle(color: C.ink, fontSize: 14, height: 1.45),
          ),
        ),
      ]),
    );
  }

  Widget _feeChoices() {
    // The ID gates the fee: paying for a check that cannot run yet just takes
    // money and leaves the pro exactly where they were.
    final enabled = _idComplete && !_submitting;
    return Column(children: [
      if (!_idComplete)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(children: [
            const Icon(Icons.info_outline, size: 18, color: C.muted),
            const SizedBox(width: 8),
            Expanded(
              child: Text('proBg.idFirst'.tr(),
                  style: const TextStyle(color: C.muted, fontSize: 13.5, height: 1.4)),
            ),
          ]),
        ),
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: C.blue,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          onPressed: enabled ? () => _choose('now') : null,
          child: Text('proBg.payNow'.tr(args: [_fee.toStringAsFixed(2)]),
              style: const TextStyle(
                  fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
        ),
      ),
      const SizedBox(height: 10),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton(
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: Color(0xFFBFD4FF)),
            padding: const EdgeInsets.symmetric(vertical: 15),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          onPressed: enabled ? () => _choose('deferred') : null,
          child: Text('proBg.deferPay'.tr(),
              style: const TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w800, color: C.blue)),
        ),
      ),
      const SizedBox(height: 8),
      Text('proBg.deferHint'.tr(args: [_fee.toStringAsFixed(2)]),
          style: const TextStyle(color: C.muted, fontSize: 13, height: 1.4)),
    ]);
  }
}
