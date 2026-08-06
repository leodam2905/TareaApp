import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';

// Shared UI bits for the Pro sub-screens (edit profile, services, etc.).

// Maps a ServiceCategory enum value to a categories.* translation key.
const _catKeys = {
  'PLUMBING': 'categories.plumbing',
  'ELECTRICAL': 'categories.electrical',
  'CARPENTRY': 'categories.carpentry',
  'PAINTING': 'categories.painting',
  'CLEANING': 'categories.cleaning',
  'HVAC': 'categories.hvac',
  'ROOFING': 'categories.roofing',
  'LANDSCAPING': 'categories.landscaping',
  'MOVING': 'categories.moving',
  'APPLIANCE_REPAIR': 'categories.appliance',
  'LAUNDRY': 'categories.laundry',
  'GENERAL': 'categories.general',
};

PreferredSizeWidget proBar(BuildContext context, String title, {List<Widget>? actions}) => AppBar(
      backgroundColor: C.white, surfaceTintColor: Colors.transparent, elevation: 0.5,
      leading: IconButton(icon: const Icon(Icons.arrow_back, color: C.ink), onPressed: () => context.pop()),
      title: Text(title, style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 18)),
      actions: actions,
    );

Widget proField(String label, TextEditingController c, {int maxLines = 1, TextInputType? keyboard, String? hint}) => Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink, fontSize: 14)),
        const SizedBox(height: 8),
        TextField(
          controller: c, maxLines: maxLines, keyboardType: keyboard,
          decoration: InputDecoration(
            hintText: hint, filled: true, fillColor: C.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.line)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: C.blue, width: 1.5)),
          ),
        ),
      ]),
    );

Widget proSaveButton(bool saving, VoidCallback onTap, {String? label}) => SizedBox(
      width: double.infinity,
      child: FilledButton(
        style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
        onPressed: saving ? null : onTap,
        child: saving
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(label ?? 'common.save'.tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
      ),
    );

// Human label for a ServiceCategory enum value (localized when known).
String prettyCategory(String c) {
  if (c.isEmpty) return 'proProfile.serviceFallback'.tr();
  final key = _catKeys[c.toUpperCase()];
  if (key != null) return key.tr();
  return c.split('_').map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1).toLowerCase()).join(' ');
}

const kServiceCategories = [
  'PLUMBING', 'ELECTRICAL', 'CARPENTRY', 'PAINTING', 'CLEANING', 'HVAC',
  'ROOFING', 'LANDSCAPING', 'MOVING', 'APPLIANCE_REPAIR', 'LAUNDRY', 'GENERAL',
];
