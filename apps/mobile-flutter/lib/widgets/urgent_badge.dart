import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';

// Blinking red "URGENT" pill for urgent posted jobs — shown on the customer
// dashboard and the pro find-jobs list to draw attention.
class UrgentBadge extends StatefulWidget {
  const UrgentBadge({super.key});
  @override
  State<UrgentBadge> createState() => _UrgentBadgeState();
}

class _UrgentBadgeState extends State<UrgentBadge> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 650))..repeat(reverse: true);

  @override
  void dispose() { _c.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 1, end: 0.25).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: C.red, borderRadius: BorderRadius.circular(8)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.bolt, size: 12, color: Colors.white),
          const SizedBox(width: 3),
          Text('postjob.urgencyUrgent'.tr().toUpperCase(),
              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.3)),
        ]),
      ),
    );
  }
}
