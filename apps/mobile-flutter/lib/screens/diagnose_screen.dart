import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';

// [translation key, textColor, bgColor]
const _urgencyMeta = {
  'urgent': ['diagnose.urgent', 0xFFEF4444, 0xFFFEE2E2],
  'soon': ['diagnose.soon', 0xFFF59E0B, 0xFFFEF3C7],
  'routine': ['diagnose.routine', 0xFF10B981, 0xFFDCFCE7],
};

class DiagnoseScreen extends StatefulWidget {
  const DiagnoseScreen({super.key});
  @override
  State<DiagnoseScreen> createState() => _DiagnoseScreenState();
}

class _DiagnoseScreenState extends State<DiagnoseScreen> {
  final _desc = TextEditingController();
  String? _imagePath;
  String? _imageB64;
  bool _loading = false;
  Map<String, dynamic>? _result;

  Future<void> _pick(ImageSource source) async {
    try {
      final x = await ImagePicker().pickImage(source: source, imageQuality: 70, maxWidth: 1600);
      if (x == null) return;
      final bytes = await x.readAsBytes();
      setState(() {
        _imagePath = x.path;
        _imageB64 = base64Encode(bytes);
        _result = null;
      });
    } catch (_) {}
  }

  void _choosePhoto() {
    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.camera_alt_outlined), title: Text('diagnose.takePhoto'.tr()),
              onTap: () { Navigator.pop(context); _pick(ImageSource.camera); }),
          ListTile(leading: const Icon(Icons.photo_library_outlined), title: Text('diagnose.chooseLibrary'.tr()),
              onTap: () { Navigator.pop(context); _pick(ImageSource.gallery); }),
        ]),
      ),
    );
  }

  Future<void> _analyze() async {
    if (_imageB64 == null && _desc.text.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      final res = await Api.post('/ai/diagnose', {
        if (_imageB64 != null) 'imageBase64': _imageB64,
        'description': _desc.text.trim(),
      });
      if (res.statusCode == 200) {
        setState(() => _result = jsonDecode(res.body) as Map<String, dynamic>);
      } else {
        _toast('diagnose.analyzeFailed'.tr());
      }
    } catch (_) {
      _toast('diagnose.connectFailed'.tr());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.white,
      appBar: AppBar(
        backgroundColor: C.white, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30), onPressed: () => context.pop()),
        title: Text('diagnose.title'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 8),
            Text('diagnose.whatsTheProblem'.tr(), textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 10),
            Text('diagnose.subtitle'.tr(),
                textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: C.muted, height: 1.5)),
            const SizedBox(height: 20),
            // Photo box
            GestureDetector(
              onTap: _choosePhoto,
              child: Container(
                height: 200,
                decoration: BoxDecoration(
                  color: C.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: C.line),
                  image: _imagePath != null
                      ? DecorationImage(image: FileImage(File(_imagePath!)), fit: BoxFit.cover)
                      : null,
                ),
                child: _imagePath != null
                    ? null
                    : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Container(
                          width: 64, height: 64,
                          decoration: const BoxDecoration(color: Color(0xFFEFF5FF), shape: BoxShape.circle),
                          child: const Icon(Icons.camera_alt_outlined, color: C.blue, size: 30),
                        ),
                        const SizedBox(height: 10),
                        Text('diagnose.addPhoto'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                        Text('diagnose.addPhotoSub'.tr(), textAlign: TextAlign.center, style: const TextStyle(color: C.muted, fontSize: 13)),
                      ]),
              ),
            ),
            const SizedBox(height: 18),
            Row(children: [
              const Expanded(child: Divider(color: C.line)),
              Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text('diagnose.orDescribe'.tr(), style: const TextStyle(color: C.muted))),
              const Expanded(child: Divider(color: C.line)),
            ]),
            const SizedBox(height: 18),
            TextField(
              controller: _desc,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'diagnose.descHint'.tr(),
                filled: true, fillColor: C.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _loading ? null : _analyze,
              child: _loading
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text('diagnose.diagnose'.tr(), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
            ),
            if (_result != null) ...[
              const SizedBox(height: 20),
              _resultCard(_result!),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _resultCard(Map<String, dynamic> r) {
    final urg = _urgencyMeta[(r['urgency'] ?? 'routine').toString()] ?? _urgencyMeta['routine']!;
    final category = (r['category'] ?? '').toString();
    final tips = (r['tips'] as List?) ?? const [];
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: const Color(0xFFF8FAFF), borderRadius: BorderRadius.circular(18), border: Border.all(color: C.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: C.blue.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(20)),
              child: Text(_pretty(category), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: Color(urg[2] as int), borderRadius: BorderRadius.circular(20)),
              child: Text((urg[0] as String).tr(), style: TextStyle(color: Color(urg[1] as int), fontWeight: FontWeight.w800)),
            ),
          ]),
          const SizedBox(height: 14),
          // Prominent disclaimer — the AI diagnosis is informational, not a
          // professional assessment.
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFED7AA)),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.info_outline, size: 18, color: Color(0xFFEA580C)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'diagnose.disclaimer'.tr(),
                  style: const TextStyle(fontSize: 12.5, color: Color(0xFF9A3412), height: 1.35, fontWeight: FontWeight.w600),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 14),
          Text((r['explanation'] ?? '').toString(), style: const TextStyle(color: C.ink, height: 1.5, fontSize: 15)),
          if (tips.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('diagnose.tips'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 8),
            ...tips.map((t) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Icon(Icons.check_circle, color: C.green, size: 18),
                    const SizedBox(width: 8),
                    Expanded(child: Text(t.toString(), style: const TextStyle(color: C.ink, height: 1.3))),
                  ]),
                )),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              onPressed: () => context.push('/post-job', extra: {'category': category}),
              child: Text('diagnose.postThisJob'.tr(), style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 16)),
            ),
          ),
        ],
      ),
    );
  }

  String _pretty(String c) {
    if (c.isEmpty) return 'proProfile.serviceFallback'.tr();
    return c[0].toUpperCase() + c.substring(1).toLowerCase().replaceAll('_', ' ');
  }
}
