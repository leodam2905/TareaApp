import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';
import 'pro_widgets.dart';

class ProPortfolio extends StatefulWidget {
  const ProPortfolio({super.key});
  @override
  State<ProPortfolio> createState() => _ProPortfolioState();
}

class _ProPortfolioState extends State<ProPortfolio> {
  List<dynamic> _photos = [];
  bool _loading = true;
  bool _uploading = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/portfolio');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        _photos = d is List ? d : (d['photos'] ?? []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _add() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    setState(() => _uploading = true);
    try {
      final up = await Api.uploadImage(picked.path);
      if (up.statusCode < 200 || up.statusCode >= 300) { _toast('proEdit.uploadFailed'.tr()); return; }
      final url = (jsonDecode(up.body)['url'] ?? '').toString();
      final res = await Api.post('/portfolio', {'url': url, 'caption': ''});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _toast('proEdit.photoAdded'.tr());
        await _load();
      } else {
        _toast('proEdit.savePhotoFailed'.tr());
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _delete(dynamic p) async {
    final id = (p['id'] ?? '').toString();
    if (id.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('proEdit.deletePhotoTitle'.tr()),
        content: Text('proEdit.deletePhotoBody'.tr()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text('common.cancel'.tr())),
          TextButton(onPressed: () => Navigator.pop(context, true), child: Text('common.delete'.tr(), style: const TextStyle(color: C.red, fontWeight: FontWeight.w800))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final res = await Api.delete('/portfolio/$id');
      if (res.statusCode >= 200 && res.statusCode < 300) { _toast('proEdit.photoRemoved'.tr()); _load(); }
      else { _toast('proEdit.deletePhotoFailed'.tr()); }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    }
  }

  void _toast(String m) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m))); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: proBar(context, 'proProfile.portfolio'.tr()),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: C.blue,
        onPressed: _uploading ? null : _add,
        icon: _uploading
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.add_a_photo_outlined, color: Colors.white),
        label: Text('proEdit.addPhoto'.tr(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _photos.isEmpty
              ? Center(child: Padding(padding: const EdgeInsets.all(32), child: Text('proEdit.noPortfolio'.tr(), textAlign: TextAlign.center, style: const TextStyle(color: C.muted))))
              : GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12),
                  itemCount: _photos.length,
                  itemBuilder: (_, i) {
                    final p = _photos[i];
                    final url = (p['url'] ?? '').toString();
                    return GestureDetector(
                      onLongPress: () => _delete(p),
                      child: Stack(fit: StackFit.expand, children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: url.startsWith('http')
                              ? Image.network(url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: C.surface, child: const Icon(Icons.broken_image_outlined, color: C.muted)))
                              : Container(color: C.surface),
                        ),
                        Positioned(
                          top: 6, right: 6,
                          child: GestureDetector(
                            onTap: () => _delete(p),
                            child: Container(
                              padding: const EdgeInsets.all(5),
                              decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.45), shape: BoxShape.circle),
                              child: const Icon(Icons.delete_outline, color: Colors.white, size: 16),
                            ),
                          ),
                        ),
                      ]),
                    );
                  },
                ),
    );
  }
}
