import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';

class _Feature {
  final IconData icon;
  final Color color;
  // Translation key stems under landing.* — resolved with .tr() at build time
  // (a const list can't call .tr(), so store the keys, not the text).
  final String titleKey;
  final String descKey;
  const _Feature(this.icon, this.color, this.titleKey, this.descKey);
}

const _features = [
  _Feature(Icons.verified_user_outlined, C.blue, 'landing.verifiedPros', 'landing.verifiedProsDesc'),
  _Feature(Icons.bolt_outlined, C.blue, 'landing.fastBooking', 'landing.fastBookingDesc'),
  _Feature(Icons.credit_card_outlined, C.blue, 'landing.upfrontPricing', 'landing.upfrontPricingDesc'),
  _Feature(Icons.auto_awesome_outlined, C.green, 'landing.diagnose', 'landing.diagnoseDesc'),
  _Feature(Icons.sell_outlined, Color(0xFF7C3AED), 'landing.instantQuote', 'landing.instantQuoteDesc'),
  _Feature(Icons.workspace_premium_outlined, Color(0xFFF97316), 'landing.qualityFocused', 'landing.qualityFocusedDesc'),
];

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 8),
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(children: [
                    Image.asset('assets/images/tarea-home-mark.png', width: 34, height: 34),
                    const SizedBox(width: 8),
                    const Text('Tarea', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink)),
                  ]),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(14)),
                    child: Row(children: [
                      const Icon(Icons.shield_outlined, size: 16, color: C.blue),
                      const SizedBox(width: 6),
                      Text('landing.badge'.tr(), style: const TextStyle(fontSize: 12, color: C.blue, fontWeight: FontWeight.w700)),
                    ]),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              // Heading
              RichText(
                text: TextSpan(
                  style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, height: 1.1, letterSpacing: -1, color: C.ink),
                  children: [
                    TextSpan(text: 'landing.headline1'.tr()),
                    TextSpan(text: 'landing.headline2'.tr(), style: const TextStyle(color: C.blue)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text('landing.subtitle'.tr(),
                  style: const TextStyle(fontSize: 15, color: C.muted, height: 1.4)),
              const SizedBox(height: 16),
              // Portrait hero (611x780). The previous art was landscape 853x520,
              // so height 230 filled the width; at that height a portrait image
              // renders ~180px wide and reads as small. 300 gives it presence
              // without pushing the CTAs off the first scroll.
              Center(child: Image.asset('assets/images/landing-hero.png', height: 300, fit: BoxFit.contain)),
              const SizedBox(height: 16),
              // Feature grid — rows sized to their tallest card, so a longer
              // description (e.g. 3 lines on iOS) can't overflow into the next
              // row. A fixed childAspectRatio grid caused exactly that overlap.
              Column(
                children: [
                  for (int i = 0; i < _features.length; i += 3) ...[
                    if (i > 0) const SizedBox(height: 20),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (int j = i; j < i + 3; j++) ...[
                          if (j > i) const SizedBox(width: 8),
                          Expanded(
                            child: j < _features.length
                                ? _featureCard(_features[j])
                                : const SizedBox.shrink(),
                          ),
                        ],
                      ],
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),
              // CTAs
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: C.blue,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: () => context.go('/register'),
                  child: Text('auth.getStarted'.tr(), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFBFD4FF)),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: () => context.go('/login'),
                  child: Text('auth.haveAccount'.tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: C.blue)),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _featureCard(_Feature f) {
    return Column(
      children: [
        Container(
          width: 56, height: 56,
          decoration: BoxDecoration(color: f.color.withOpacity(0.12), shape: BoxShape.circle),
          child: Icon(f.icon, color: f.color, size: 26),
        ),
        const SizedBox(height: 8),
        Text(f.titleKey.tr(), textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: C.ink)),
        const SizedBox(height: 4),
        Text(f.descKey.tr(), textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: C.muted, height: 1.3)),
      ],
    );
  }
}
