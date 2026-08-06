import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';

// Supported languages: label shown natively so users find their own language
// regardless of the current UI locale. Order = English, French, Spanish, Arabic.
const _languages = <(String, String)>[
  ('en', 'English'),
  ('fr', 'Français'),
  ('es', 'Español'),
  ('ar', 'العربية'),
];

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final currentLabel = _languages
        .firstWhere((l) => l.$1 == context.locale.languageCode,
            orElse: () => _languages.first)
        .$2;
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.bg, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30), onPressed: () => context.pop()),
        title: Text('settings.title'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          _section('Preferences', [
            _row(Icons.attach_money, 'Currency', trailing: 'USD (\$)'),
            _row(Icons.language, 'settings.language'.tr(), trailing: currentLabel, onTap: () => _pickLanguage(context)),
          ]),
          _section('Privacy & Permissions', [
            _row(Icons.location_on_outlined, 'Location', onTap: () => launchUrl(Uri.parse('app-settings:'))),
            _row(Icons.notifications_outlined, 'settings.notifications'.tr(), onTap: () => launchUrl(Uri.parse('app-settings:'))),
          ]),
          _section('Support & Legal', [
            _row(Icons.headset_mic_outlined, 'settings.help'.tr(), onTap: () => launchUrl(Uri.parse('mailto:support@taptarea.com?subject=Tarea%20Support'))),
            _row(Icons.description_outlined, 'Terms of Service', onTap: () => launchUrl(Uri.parse('https://taptarea.com/terms'))),
            _row(Icons.privacy_tip_outlined, 'Privacy Policy', onTap: () => launchUrl(Uri.parse('https://taptarea.com/privacy'))),
          ]),
          const SizedBox(height: 12),
          const Center(child: Text('Tarea • v1.0.0', style: TextStyle(color: C.muted, fontSize: 12))),
        ],
      ),
    );
  }

  void _pickLanguage(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: C.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
              child: Text('language.choose'.tr(),
                  style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 18)),
            ),
            for (final (code, label) in _languages)
              ListTile(
                title: Text(label,
                    style: const TextStyle(color: C.ink, fontWeight: FontWeight.w700, fontSize: 16)),
                trailing: context.locale.languageCode == code
                    ? const Icon(Icons.check, color: C.blue)
                    : null,
                onTap: () async {
                  await context.setLocale(Locale(code));
                  if (sheetContext.mounted) Navigator.of(sheetContext).pop();
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _section(String title, List<Widget> rows) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
            child: Text(title, style: const TextStyle(color: C.muted, fontWeight: FontWeight.w800, fontSize: 13)),
          ),
          Container(
            decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
            child: Column(children: [
              for (int i = 0; i < rows.length; i++) ...[
                rows[i],
                if (i < rows.length - 1) const Divider(height: 1, color: C.line, indent: 52),
              ],
            ]),
          ),
        ],
      );

  Widget _row(IconData icon, String label, {String? trailing, VoidCallback? onTap}) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
          child: Row(children: [
            Icon(icon, color: C.ink, size: 21),
            const SizedBox(width: 14),
            Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink, fontSize: 15))),
            if (trailing != null) Text(trailing, style: const TextStyle(color: C.muted, fontWeight: FontWeight.w600)),
            if (onTap != null) const Padding(padding: EdgeInsets.only(left: 6), child: Icon(Icons.chevron_right, color: C.muted, size: 20)),
          ]),
        ),
      );
}
