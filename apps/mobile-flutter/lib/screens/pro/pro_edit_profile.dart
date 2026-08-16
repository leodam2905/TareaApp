import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';
import '../../avatar_util.dart';
import 'pro_widgets.dart';

// Pro edit-profile.
//
// The photo is not cosmetic here: a pro with no avatarUrl CANNOT BE BOOKED —
// browse hides them, applying is refused and hiring refuses again — and the
// setup checklist's `profile` step needs avatar + bio + ID. Nothing in the Pro
// app could set an avatar, so that step was unreachable and a pro could not
// finish becoming bookable. The server already accepted it; only the control
// was missing.

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
    if (_name.text.trim().isEmpty) return _toast('editProfile.nameRequired'.tr());
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

  /// Pick, upload and save a profile photo straight away.
  ///
  /// Saved immediately rather than on the Save button: the upload has already
  /// happened, so leaving without saving would strand an image nobody points
  /// at — and this is the field standing between the pro and being bookable.
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: proBar(context, 'editProfile.title'.tr()),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(20), children: [
              // A pro without this cannot be booked at all, so it leads the form
              // rather than sitting at the bottom as decoration.
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
                  if (_avatar.isEmpty)
                    Text('proEdit.photoRequired'.tr(),
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: C.red, fontSize: 12.5, fontWeight: FontWeight.w700)),
                ]),
              ),
              const SizedBox(height: 8),
              proField('register.fullName'.tr(), _name),
              proField('editProfile.phone'.tr(), _phone, keyboard: TextInputType.phone),
              proField('proEdit.bio'.tr(), _bio, maxLines: 4, hint: 'proEdit.bioHint'.tr()),
              proField('proEdit.hourlyRate'.tr(), _rate, keyboard: TextInputType.number),
              proField('proEdit.companyName'.tr(), _company),
              proField('proEdit.website'.tr(), _website, keyboard: TextInputType.url),
              const SizedBox(height: 10),
              proSaveButton(_saving, _save),
            ]),
    );
  }
}
