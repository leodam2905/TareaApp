import '../fees.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

import '../theme.dart';

/// Asks the pro what parts the job needs, at the moment they accept.
///
/// This number is not a formality — it is added to the labour price, shown to
/// the customer, and charged once they approve. So the sheet states who sees it
/// and what happens next, rather than presenting a bare field.
///
/// Returns the quote (0 when none needed), or null if the pro backed out —
/// in which case the job is NOT accepted.
Future<double?> showAcceptQuoteSheet(BuildContext context, {
  required double labour,
}) async {
  final amount = TextEditingController();
  bool needsMaterials = false;

  return showModalBottomSheet<double>(
    context: context,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setSheet) {
        final quoted = double.tryParse(amount.text.trim()) ?? 0;
        final total = customerTotal(labour, needsMaterials ? quoted : 0);
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('acceptQuote.title'.tr(),
                style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 18)),
            const SizedBox(height: 6),
            Text('acceptQuote.subtitle'.tr(),
                style: const TextStyle(color: C.muted, fontSize: 13, height: 1.5)),
            const SizedBox(height: 14),

            // Opt-in rather than a field defaulted to zero: most jobs need no
            // parts, and a blank money box invites a guess.
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              value: needsMaterials,
              activeColor: C.blue,
              onChanged: (v) => setSheet(() => needsMaterials = v),
              title: Text('acceptQuote.needMaterials'.tr(),
                  style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink, fontSize: 14)),
            ),
            if (needsMaterials) ...[
              TextField(
                controller: amount,
                autofocus: true,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                onChanged: (_) => setSheet(() {}),
                decoration: InputDecoration(
                  labelText: 'acceptQuote.materialsCost'.tr(),
                  prefixText: '\$ ',
                  helperText: 'acceptQuote.materialsHelp'.tr(),
                  helperMaxLines: 3,
                ),
              ),
              const SizedBox(height: 14),
            ],

            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(14)),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Expanded(
                  child: Text('acceptQuote.customerPays'.tr(),
                      style: const TextStyle(color: C.muted, fontSize: 12.5, height: 1.4)),
                ),
                const SizedBox(width: 10),
                Text('\$${total.toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 19)),
              ]),
            ),
            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: C.blue, minimumSize: const Size.fromHeight(52)),
                // A materials switch turned on with nothing typed is an
                // unfinished answer, not a zero.
                onPressed: needsMaterials && quoted <= 0
                    ? null
                    : () => Navigator.pop(ctx, needsMaterials ? quoted : 0.0),
                child: Text('acceptQuote.accept'.tr(),
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              ),
            ),
            const SizedBox(height: 4),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text('common.cancel'.tr(), style: const TextStyle(color: C.muted)),
              ),
            ),
          ]),
        );
      },
    ),
  );
}
