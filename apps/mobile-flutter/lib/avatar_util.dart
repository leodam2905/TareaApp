import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'theme.dart';
import 'api.dart';

/// A circular avatar that shows [url], or a friendly default person illustration
/// (soft blue gradient) when the URL is empty/broken. Pass [fallback] to override
/// the default (e.g. an initial). Broken/placeholder URLs won't crash or go blank.
Widget roundAvatar({required String url, required double radius, Widget? fallback, Color bg = C.surface}) {
  final fb = SizedBox(
    width: radius * 2,
    height: radius * 2,
    child: fallback != null
        ? CircleAvatar(radius: radius, backgroundColor: bg, child: fallback)
        : DecoratedBox(
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFEFF5FF), Color(0xFFCFE0FF)]),
            ),
            child: Icon(Icons.person_rounded, size: radius * 1.05, color: C.blue),
          ),
  );
  if (url.isEmpty || !url.startsWith('http')) return ClipOval(child: fb);
  return ClipOval(
    child: SizedBox(
      width: radius * 2,
      height: radius * 2,
      child: Image.network(
        url,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => fb,
        loadingBuilder: (_, child, prog) => prog == null ? child : fb,
      ),
    ),
  );
}

/// Lets the user pick/take a photo, uploads it to /upload/avatar, saves it on
/// the profile, and returns the new avatar URL (or null if cancelled/failed).
Future<String?> pickAndUploadAvatar(BuildContext context) async {
  final source = await showModalBottomSheet<ImageSource>(
    context: context,
    builder: (_) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(leading: const Icon(Icons.camera_alt_outlined, color: C.blue), title: const Text('Take Photo'), onTap: () => Navigator.pop(context, ImageSource.camera)),
        ListTile(leading: const Icon(Icons.photo_library_outlined, color: C.blue), title: const Text('Choose from Library'), onTap: () => Navigator.pop(context, ImageSource.gallery)),
      ]),
    ),
  );
  if (source == null) return null;

  final x = await ImagePicker().pickImage(source: source, imageQuality: 85, maxWidth: 1000);
  if (x == null) return null;

  final messenger = context.mounted ? ScaffoldMessenger.of(context) : null;
  try {
    final res = await Api.uploadAvatar(x.path);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      messenger?.showSnackBar(const SnackBar(content: Text('Could not upload photo')));
      return null;
    }
    final d = jsonDecode(res.body);
    final url = (d['url'] ?? d['avatarUrl'] ?? '').toString();
    if (url.isEmpty) return null;
    await Api.patch('/profile', {'avatarUrl': url});
    messenger?.showSnackBar(const SnackBar(content: Text('Profile photo updated')));
    return url;
  } catch (_) {
    messenger?.showSnackBar(const SnackBar(content: Text('Could not upload photo')));
    return null;
  }
}
