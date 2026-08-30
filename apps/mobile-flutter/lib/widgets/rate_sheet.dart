import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

import '../theme.dart';
import '../screens/pro/pro_widgets.dart';

// The per-category rate sheet.
//
// A pro's rate is the thing most likely to change after onboarding — fuel, the
// season, a licence earned — and until this existed the only place to change it
// was the website. It lives in widgets/ rather than as a private class on the
// services screen for the same reason the materials sheet does: a sheet that
// decides what somebody is paid should be testable without a network, and
// reachable from anywhere that later needs it.

/// Asks for a new hourly rate for one category.
///
/// Returns the rate, or null if the pro cancelled. Deliberately does NOT save:
/// the caller owns the request, so this can be exercised in a widget test with
/// no API and no auth — which is the whole point of it being here.
Future<RateEdit?> showEditRateSheet(
  BuildContext context, {
  required String categoryLabel,
  num? currentRate,
  int? currentMinimumMinutes,
}) {
  return showModalBottomSheet<RateEdit>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _RateSheet(
      categoryLabel: categoryLabel,
      currentRate: currentRate,
      currentMinimumMinutes: currentMinimumMinutes,
    ),
  );
}

/// What the pro chose: their rate, and the shortest job they will bill for.
class RateEdit {
  const RateEdit(this.hourlyRate, this.minimumMinutes);
  final double hourlyRate;
  final int minimumMinutes;
}

/// The minimums a pro may pick. An hour is the shortest — below that a call-out
/// stops covering the trip — and four hours the longest offered, because a
/// larger minimum on a marketplace mostly means declined work.
const List<int> kMinimumOptions = [60, 90, 120, 180, 240];

class _RateSheet extends StatefulWidget {
  const _RateSheet({required this.categoryLabel, this.currentRate, this.currentMinimumMinutes});

  final String categoryLabel;
  final num? currentRate;
  final int? currentMinimumMinutes;

  @override
  State<_RateSheet> createState() => _RateSheetState();
}

class _RateSheetState extends State<_RateSheet> {
  late final TextEditingController _rate = TextEditingController(
    text: widget.currentRate == null ? '' : '${widget.currentRate!.round()}',
  );
  late int _minimum = kMinimumOptions.contains(widget.currentMinimumMinutes)
      ? widget.currentMinimumMinutes!
      : 60;

  @override
  void dispose() { _rate.dispose(); super.dispose(); }

  void _submit() {
    final rate = double.tryParse(_rate.text.trim());
    if (rate == null || rate <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('proEdit.validRate'.tr())),
      );
      return;
    }
    Navigator.pop(context, RateEdit(rate, _minimum));
  }

  static String _fmt(int m) => m % 60 == 0 ? '${m ~/ 60}h' : '${m ~/ 60}h ${m % 60}m';

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: C.bg,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Text('proEdit.editRateTitle'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 18))),
            const SizedBox(height: 4),
            Center(child: Text(widget.categoryLabel, style: const TextStyle(color: C.muted, fontWeight: FontWeight.w700))),
            const SizedBox(height: 20),
            proField('proEdit.hourlyRate'.tr(), _rate, keyboard: TextInputType.number, hint: 'proEdit.hourlyRateHint'.tr()),
            Text('proEdit.minimumBillable'.tr(), style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink, fontSize: 14)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: kMinimumOptions.map((m) {
              final on = _minimum == m;
              return GestureDetector(
                onTap: () => setState(() => _minimum = m),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                  decoration: BoxDecoration(
                    color: on ? C.blue : C.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: on ? C.blue : C.line),
                  ),
                  child: Text(_fmt(m),
                      style: TextStyle(color: on ? Colors.white : C.ink, fontWeight: FontWeight.w700)),
                ),
              );
            }).toList()),
            const SizedBox(height: 6),
            // The pro is choosing this, not being told it. A short job billed at
            // an hour is normal trade practice, but only if they set the hour.
            Text('proEdit.minimumBillableHint'.tr(), style: const TextStyle(color: C.muted, fontSize: 12, height: 1.3)),
            const SizedBox(height: 14),
            // Says plainly that a rate change is not retroactive. A pro raising
            // their rate would otherwise reasonably expect a job already booked
            // to follow it — it does not: the booking snapshotted the rate it
            // was agreed at, which is what makes the invoice reproducible.
            Text('proEdit.rateAppliesToNew'.tr(), style: const TextStyle(color: C.muted, fontSize: 12, height: 1.3)),
            const SizedBox(height: 16),
            proSaveButton(false, _submit, label: 'common.save'.tr()),
            const SizedBox(height: 8),
          ]),
        ),
      ),
    );
  }
}
