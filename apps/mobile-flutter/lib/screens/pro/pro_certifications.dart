import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';
import 'pro_widgets.dart';

/// Licence and insurance — the two credentials a pro renews.
///
/// Each one carries its own decision and its own expiry date, so each one gets
/// its own status here. They used to share a single chip showing
/// `verificationStatus`, which is the *identity* decision and said nothing
/// about either document on this screen.
class ProCertifications extends StatefulWidget {
  const ProCertifications({super.key});
  @override
  State<ProCertifications> createState() => _ProCertificationsState();
}

class _ProCertificationsState extends State<ProCertifications> {
  /// The pro's own name, used to pre-fill the licensee prompt.
  String _proName = '';
  Map<String, dynamic> _license = const {};
  Map<String, dynamic> _insurance = const {};
  bool _loading = true;

  /// Which credential is uploading, so only that row shows a spinner.
  String? _busyKind;

  @override
  void initState() { super.initState(); _load(); }

  /// Asks for the name printed on the licence, defaulting to the pro's own —
  /// which is the answer most of the time, and pre-filling it means the
  /// unusual case (a trade name, a company) is the one they have to type.
  Future<String?> _askLicenseeName() async {
    final ctrl = TextEditingController(text: _proName);
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('proEdit.licenseeTitle'.tr()),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('proEdit.licenseeHelp'.tr(), style: const TextStyle(color: C.muted, fontSize: 13)),
          const SizedBox(height: 12),
          TextField(
            controller: ctrl,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(hintText: 'proEdit.licenseeHint'.tr()),
          ),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('common.cancel'.tr())),
          TextButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: Text('common.continue'.tr(), style: const TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  Future<void> _load() async {
    try {
      final me = await Api.get('/profile');
      if (me.statusCode == 200) {
        _proName = ((jsonDecode(me.body) as Map)['name'] ?? '').toString();
      }
      final res = await Api.get('/handyman/credentials');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body) as Map<String, dynamic>;
        _license = (d['license'] as Map<String, dynamic>?) ?? const {};
        _insurance = (d['insurance'] as Map<String, dynamic>?) ?? const {};
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  /// Upload a document and submit it as a specific credential.
  ///
  /// Two steps because they are two different things: /api/verification stores
  /// the file and hands back a URL, and /api/handyman/credentials records which
  /// credential that URL is and puts it in the review queue. This screen used
  /// to POST to /api/handyman/onboarding, which ignored the field and returned
  /// success — the toast below was the only thing that happened.
  Future<void> _uploadFor(String kind) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );
    final path = result?.files.single.path;
    if (path == null) return;

    // A licence number is public record, so the number alone proves nothing —
    // ask whose licence it is. The reviewer compares this against the pro's
    // own name; without it they have a number and no way to tell.
    String? licenseeName;
    if (kind == 'license') {
      licenseeName = await _askLicenseeName();
      if (licenseeName == null) return; // cancelled — do not upload half a claim
    }

    setState(() => _busyKind = kind);
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
      final save = await Api.post('/handyman/credentials', {
        'kind': kind,
        'docUrl': url,
        if (licenseeName != null && licenseeName.isNotEmpty) 'licenseeName': licenseeName,
      });
      if (save.statusCode >= 200 && save.statusCode < 300) {
        _toast('proEdit.docSubmitted'.tr());
        await _load();
      } else {
        _toast('proEdit.uploadDocFailed'.tr());
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _busyKind = null);
    }
  }

  void _toast(String m) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m))); }

  /// `expired` is a status the server derives from the expiry date — an
  /// approved document that has lapsed is not an approved document.
  (Color, Color, String) _statusStyle(String status) {
    switch (status) {
      case 'approved': return (const Color(0xFF16A34A), const Color(0xFFECFDF3), 'proEdit.statusVerified'.tr());
      case 'pending':  return (const Color(0xFFB45309), const Color(0xFFFEF3C7), 'proEdit.statusReview'.tr());
      case 'rejected': return (const Color(0xFFB91C1C), const Color(0xFFFEE2E2), 'proEdit.statusRejected'.tr());
      case 'expired':  return (const Color(0xFFB91C1C), const Color(0xFFFEE2E2), 'proEdit.statusExpired'.tr());
      default:         return (C.muted, C.surface, 'proEdit.statusNotSubmitted'.tr());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: proBar(context, 'proProfile.certifications'.tr()),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.all(20), children: [
                // Government ID is NOT here. It identifies the person and gates
                // the background check, so it lives on that screen. This one is
                // the credentials a pro keeps current — licence and insurance
                // expire and get renewed, so both stay replaceable.
                _credRow(Icons.workspace_premium_outlined, 'proEdit.license'.tr(), 'license', _license),
                _credRow(Icons.shield_outlined, 'proEdit.insurance'.tr(), 'insurance', _insurance),

                const SizedBox(height: 8),
                Text('proEdit.certDesc'.tr(),
                    style: const TextStyle(color: C.muted, fontSize: 13, height: 1.4)),
              ]),
            ),
    );
  }

  Widget _credRow(IconData icon, String label, String kind, Map<String, dynamic> cred) {
    final status = (cred['status'] ?? 'none').toString();
    final (fg, bg, statusLabel) = _statusStyle(status);
    final busy = _busyKind == kind;
    final present = cred['docUrl'] != null;
    final note = (cred['reviewNote'] ?? '').toString();
    final expiresAt = cred['expiresAt']?.toString();
    final expiringSoon = cred['expiringSoon'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(20)),
            child: Icon(icon, color: C.blue, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
              child: Text(statusLabel, style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 11)),
            ),
          ])),
          if (busy)
            const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
          else
            TextButton(
              onPressed: _busyKind != null ? null : () => _uploadFor(kind),
              child: Text(
                present ? 'proEdit.replace'.tr() : 'proEdit.upload'.tr(),
                style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800),
              ),
            ),
        ]),

        // Why it was rejected. Without it the pro re-uploads the same document.
        if (status == 'rejected' && note.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(note, style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12, height: 1.35)),
        ],

        // An expiry is only worth showing once it is real — an approved
        // document that runs out on a date, or one that already has.
        if (expiresAt != null && (status == 'approved' || status == 'expired')) ...[
          const SizedBox(height: 8),
          Text(
            expiringSoon || status == 'expired'
                ? 'proEdit.credExpiresSoon'.tr(args: [_fmtDate(expiresAt)])
                : 'proEdit.credExpires'.tr(args: [_fmtDate(expiresAt)]),
            style: TextStyle(
              color: expiringSoon || status == 'expired' ? const Color(0xFFB45309) : C.muted,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ]),
    );
  }

  String _fmtDate(String iso) {
    final d = DateTime.tryParse(iso);
    return d == null ? iso : DateFormat.yMMMd().format(d.toLocal());
  }
}
