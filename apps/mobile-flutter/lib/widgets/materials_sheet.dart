import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../theme.dart';

// The materials-at-finish sheet, shared by every path that finishes a job.
//
// It lived as a private method on the jobs LIST, so finishing from the job
// DETAIL screen — the more natural place to do it — sent workDone with no
// materials figure at all, and the underspend refund could never fire. One
// copy, so a new way to finish a job cannot silently skip it.

/// What the materials actually cost, plus the receipt.
///
/// The amount is what moves money: materials are reimbursed at cost capped at
/// the estimate, so spending less returns the difference to the customer. It
/// is pre-filled with the estimate, because that is the answer most of the
/// time and a pro who spent exactly what they quoted should not have to type.
///
/// Returns null if cancelled.
Future<Map<String, dynamic>?> showMaterialsAtFinish(BuildContext context, num estimate) async {
  final amount = TextEditingController(text: estimate.toStringAsFixed(2));
  String? uploadedUrl;
  num? receiptTotal;   // what the model read, null until a receipt is attached
  bool reading = false;

  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    isScrollControlled: true,
    // Backdrop taps and drags cannot dismiss this.
    //
    // Cancelling silently returns null, which aborts finishing the job — a
    // pro who brushed the scrim would think they had marked it done and only
    // find out later. The two explicit buttons are the only ways out, and
    // the global tap-to-dismiss in main.dart still closes the keyboard.
    isDismissible: false,
    enableDrag: false,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(ctx).viewInsets.bottom + 18),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('proJobs.materialsTitle'.tr(),
              style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 17)),
          const SizedBox(height: 6),
          Text('proJobs.materialsNote'.tr(args: [estimate.toStringAsFixed(2)]),
              style: const TextStyle(color: C.muted, fontSize: 13, height: 1.5)),
          const SizedBox(height: 14),
          TextField(
            controller: amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'proJobs.materialsSpent'.tr(),
              prefixText: '\$ ',
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46)),
            onPressed: reading ? null : () async {
              final shot = await _pickReceipt(context);
              if (shot == null) return;
              setSheet(() { uploadedUrl = shot['url'] as String?; reading = true; });
              final total = await _readReceiptTotal(shot['bytes'] as String, shot['mediaType'] as String);
              setSheet(() {
                receiptTotal = total;
                reading = false;
                // Fill the amount from the receipt rather than leaving the
                // estimate sitting there. The estimate pre-fill is the reason
                // an underspend was easy to keep: it was already the right
                // shape, so the honest answer took typing and the other did not.
                if (total != null) amount.text = total.toStringAsFixed(2);
              });
            },
            icon: Icon(uploadedUrl == null ? Icons.camera_alt_outlined : Icons.check_circle, size: 18),
            label: Text(uploadedUrl == null ? 'proJobs.receiptPrompt'.tr() : 'proJobs.receiptAttached'.tr()),
          ),
          if (reading) ...[
            const SizedBox(height: 8),
            Row(children: [
              const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
              const SizedBox(width: 8),
              Text('proJobs.receiptReading'.tr(), style: const TextStyle(color: C.muted, fontSize: 12)),
            ]),
          ],
          if (!reading && uploadedUrl != null) ...[
            const SizedBox(height: 8),
            Text(
              receiptTotal == null
                  ? 'proJobs.receiptUnread'.tr()
                  : 'proJobs.receiptRead'.tr(args: [receiptTotal!.toStringAsFixed(2)]),
              style: TextStyle(
                color: receiptTotal == null ? const Color(0xFFB45309) : C.muted, fontSize: 12, height: 1.4),
            ),
          ],
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('common.cancel'.tr()),
            )),
            Expanded(child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: C.blue),
              // The server refuses a finish without one, so refusing here too
              // saves a round trip and says why before the pro taps.
              onPressed: (uploadedUrl == null || reading) ? null : () => Navigator.pop(ctx, <String, dynamic>{
                'receiptUrl': uploadedUrl,
                // Left out entirely when unparseable, so the server keeps the
                // estimate rather than reading a typo as "spent nothing".
                'materialsActual': num.tryParse(amount.text.trim()),
                // Evidence for the server's comparison. It never decides the
                // refund — that is always computed from the figure above.
                'materialsReceiptTotal': receiptTotal,
              }),
              child: Text('proJobs.finishJob'.tr(), style: const TextStyle(fontWeight: FontWeight.w800)),
            )),
          ]),
        ]),
      ),
    ),
  );
}

/// Camera or gallery, uploaded. Returns the stored url and the raw bytes so the
/// receipt can be read without asking for the photo twice. Null if backed out.
Future<Map<String, dynamic>?> _pickReceipt(BuildContext context) async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    builder: (_) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(
          leading: const Icon(Icons.camera_alt_outlined, color: C.blue),
          title: Text('booking.takePhoto'.tr()),
          onTap: () => Navigator.pop(context, 'camera'),
        ),
        ListTile(
          leading: const Icon(Icons.photo_library_outlined, color: C.blue),
          title: Text('booking.chooseGallery'.tr()),
          onTap: () => Navigator.pop(context, 'gallery'),
        ),
      ]),
    ),
  );
  if (choice == null) return null;
  final shot = await ImagePicker().pickImage(
    source: choice == 'camera' ? ImageSource.camera : ImageSource.gallery,
    imageQuality: 85, maxWidth: 1600, maxHeight: 1600,
  );
  if (shot == null) return null;
  final up = await Api.uploadImage(shot.path, folder: 'tarea/images');
  if (up.statusCode < 200 || up.statusCode >= 300) {
    // context.mounted rather than a State's `mounted`: this is a top-level
    // function now, and the sheet it was called from may have closed while the
    // upload was in flight.
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('booking.uploadFailed'.tr())));
    }
    return null;
  }
  return {
    'url': (jsonDecode(up.body)['url'] ?? '').toString(),
    'bytes': base64Encode(await File(shot.path).readAsBytes()),
    'mediaType': shot.path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
  };
}

/// Ask the model what the receipt says. Advisory only — the server compares it
/// with what the pro typed and routes a disagreement to a human. A failure here
/// must never stop a pro finishing their job, so everything returns null.
Future<num?> _readReceiptTotal(String base64, String mediaType) async {
  try {
    final res = await Api.post('/ai/receipt', {'imageBase64': base64, 'mediaType': mediaType});
    if (res.statusCode < 200 || res.statusCode >= 300) return null;
    final d = jsonDecode(res.body);
    return d['readable'] == true ? d['total'] as num? : null;
  } catch (_) {
    return null;
  }
}

