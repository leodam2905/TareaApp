import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';
import '../avatar_util.dart';

// Customer edit-profile (photo, name, phone, address).
//
// The photo was missing entirely: no screen in the customer app could change an
// avatar, and the one on the home header was not even tappable. Both halves of
// the plumbing already existed — Api.uploadImage and PATCH /profile accepting
// avatarUrl — so only the control was absent.
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
  String _avatar = '';
  bool _loading = true;
  bool _saving = false;
  bool _uploading = false;

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

  /// Pick a photo, upload it, and save it to the profile immediately.
  ///
  /// Saved on its own rather than waiting for the Save button: the upload has
  /// already happened by then, so leaving without saving would strand an image
  /// nobody points at, and the picture visibly changing is the confirmation
  /// that it worked.
  Future<void> _changePhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.camera_alt_outlined, color: C.blue),
            title: Text('booking.takePhoto'.tr()),
            onTap: () => Navigator.pop(context, ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined, color: C.blue),
            title: Text('booking.chooseGallery'.tr()),
            onTap: () => Navigator.pop(context, ImageSource.gallery),
          ),
        ]),
      ),
    );
    if (source == null) return;

    final picked = await ImagePicker().pickImage(
      source: source, imageQuality: 85, maxWidth: 1024, maxHeight: 1024);
    if (picked == null) return;

    setState(() => _uploading = true);
    try {
      final up = await Api.uploadImage(picked.path, folder: 'tarea/avatars');
      if (up.statusCode < 200 || up.statusCode >= 300) {
        _toast('booking.uploadFailed'.tr());
        return;
      }
      final url = (jsonDecode(up.body)['url'] ?? '').toString();
      if (url.isEmpty) {
        _toast('booking.uploadFailed'.tr());
        return;
      }
      final save = await Api.patch('/profile', {'avatarUrl': url});
      if (save.statusCode >= 200 && save.statusCode < 300) {
        if (mounted) setState(() => _avatar = url);
        _toast('editProfile.photoUpdated'.tr());
      } else {
        _toast('editProfile.photoSaveFailed'.tr());
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
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
              // Tappable, and labelled: an avatar that is silently a button is
              // the thing that was broken on the home header.
              Center(
                child: Column(children: [
                  GestureDetector(
                    onTap: _uploading ? null : _changePhoto,
                    child: Stack(children: [
                      roundAvatar(url: _avatar, radius: 44),
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: C.blue,
                            shape: BoxShape.circle,
                            border: Border.all(color: C.white, width: 2),
                          ),
                          child: const Icon(Icons.camera_alt, size: 15, color: Colors.white),
                        ),
                      ),
                    ]),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _uploading ? null : _changePhoto,
                    child: Text(
                      _uploading ? 'editProfile.uploading'.tr() : 'editProfile.changePhoto'.tr(),
                      style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800),
                    ),
                  ),
                ]),
              ),
              const SizedBox(height: 8),
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
