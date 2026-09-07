import 'package:flutter/material.dart';
import '../fees.dart' show kFeePct;
import 'package:easy_localization/easy_localization.dart';

import '../theme.dart';

/// Shown before a directed request is sent, so the customer knows exactly what
/// putting a card on file does and does not mean.
///
/// The card is saved here but charged much later — only once the pro has
/// accepted AND the customer has approved the final price, which can be hours
/// apart. Two separate moments where somebody could reasonably assume they had
/// already paid, so both are stated before the sheet is opened rather than
/// after.
///
/// Returns true when the customer confirms.
Future<bool> showConfirmRequestSheet(BuildContext context, {
  required String proName,
  required double labour,
  required double serviceFee,
}) async {
  final total = labour + serviceFee;
  final ok = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Container(
      decoration: const BoxDecoration(
        color: C.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Center(
          child: Container(
            width: 40, height: 4,
            decoration: BoxDecoration(color: C.line, borderRadius: BorderRadius.circular(2)),
          ),
        ),
        const SizedBox(height: 16),
        Text('confirmRequest.title'.tr(),
            style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 19)),
        const SizedBox(height: 6),
        Text('confirmRequest.subtitle'.tr(args: [proName]),
            style: const TextStyle(color: C.muted, fontSize: 13.5, height: 1.5)),
        const SizedBox(height: 16),

        // The price so far. Materials are absent on purpose: the pro names them
        // when they accept, and the customer approves the total after that.
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(14)),
          child: Column(children: [
            _line('confirmRequest.labour'.tr(), labour),
            const SizedBox(height: 8),
            _line('confirmRequest.serviceFee'.tr(namedArgs: {'pct': kFeePct}), serviceFee),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 10),
              child: Divider(color: C.line, height: 1),
            ),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('confirmRequest.soFar'.tr(),
                  style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 14)),
              Text('\$${total.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 18)),
            ]),
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: Text('confirmRequest.materialsLater'.tr(),
                  style: const TextStyle(color: C.muted, fontSize: 11.5, height: 1.4)),
            ),
          ]),
        ),
        const SizedBox(height: 14),

        // The promise, in the order it happens.
        _step(Icons.credit_card, 'confirmRequest.step1'.tr()),
        const SizedBox(height: 10),
        _step(Icons.how_to_reg_outlined, 'confirmRequest.step2'.tr()),
        const SizedBox(height: 10),
        _step(Icons.check_circle_outline, 'confirmRequest.step3'.tr()),
        const SizedBox(height: 18),

        SizedBox(
          width: double.infinity,
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: C.blue, minimumSize: const Size.fromHeight(52)),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('confirmRequest.confirm'.tr(),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          ),
        ),
        const SizedBox(height: 6),
        SizedBox(
          width: double.infinity,
          child: TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('common.cancel'.tr(), style: const TextStyle(color: C.muted)),
          ),
        ),
      ]),
    ),
  );
  return ok == true;
}

Widget _line(String label, double amount) =>
    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(color: C.muted, fontSize: 13)),
      Text('\$${amount.toStringAsFixed(2)}',
          style: const TextStyle(color: C.ink, fontSize: 13, fontWeight: FontWeight.w700)),
    ]);

Widget _step(IconData icon, String text) =>
    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 17, color: C.blue),
      const SizedBox(width: 10),
      Expanded(
        child: Text(text, style: const TextStyle(color: C.ink, fontSize: 12.5, height: 1.45)),
      ),
    ]);
