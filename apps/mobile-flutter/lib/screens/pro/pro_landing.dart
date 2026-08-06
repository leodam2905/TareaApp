import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';

class _Step {
  final IconData icon;
  final String titleKey, descKey;
  const _Step(this.icon, this.titleKey, this.descKey);
}

const _steps = [
  _Step(Icons.person_outline, 'pro.step1Title', 'pro.step1Desc'),
  _Step(Icons.list_alt_outlined, 'pro.step2Title', 'pro.step2Desc'),
  _Step(Icons.check_circle_outline, 'pro.step3Title', 'pro.step3Desc'),
];

class _Trust {
  final IconData icon;
  final String labelKey;
  const _Trust(this.icon, this.labelKey);
}

const _trust = [
  _Trust(Icons.verified_user_outlined, 'pro.trustVerified'),
  _Trust(Icons.headset_mic_outlined, 'pro.trustSupport'),
  _Trust(Icons.lock_outline, 'pro.trustSafe'),
];

class ProLanding extends StatelessWidget {
  const ProLanding({super.key});

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
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Row(children: [
                  Image.asset('assets/images/tarea-home-mark.png', width: 34, height: 34),
                  const SizedBox(width: 8),
                  const Text('Tarea', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink)),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: C.blue, borderRadius: BorderRadius.circular(8)),
                    child: const Text('PRO', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w900)),
                  ),
                ]),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: const Color(0xFFECFDF3), borderRadius: BorderRadius.circular(12)),
                  child: Row(children: [
                    const Icon(Icons.verified, size: 15, color: Color(0xFF16A34A)),
                    const SizedBox(width: 4),
                    Text('pro.verifiedPros'.tr(), style: const TextStyle(color: Color(0xFF16A34A), fontSize: 12, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ]),
              const SizedBox(height: 20),
              RichText(
                text: TextSpan(
                  style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, height: 1.15, letterSpacing: -0.5, color: C.ink),
                  children: [
                    TextSpan(text: 'pro.joinHeadline1'.tr()),
                    TextSpan(text: 'pro.joinHeadline2'.tr(), style: const TextStyle(color: C.blue)),
                    TextSpan(text: 'pro.joinHeadline3'.tr()),
                    TextSpan(text: 'pro.joinHeadline4'.tr(), style: const TextStyle(color: C.blue)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text('pro.joinSubtitle'.tr(),
                  style: const TextStyle(fontSize: 15, color: C.muted, height: 1.4)),
              const SizedBox(height: 16),
              ClipRRect(borderRadius: BorderRadius.circular(20), child: Image.asset('assets/images/pro-hero.png', height: 200, width: double.infinity, fit: BoxFit.cover)),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 18), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  onPressed: () => context.go('/register'),
                  child: Text('pro.joinCta'.tr(), textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFBFD4FF)), padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  onPressed: () => context.go('/login'),
                  child: Text('auth.login'.tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: C.blue)),
                ),
              ),
              const SizedBox(height: 24),
              Text('pro.howItWorks'.tr(), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: _steps.map((s) => Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Column(children: [
                          Container(
                            width: 56, height: 56,
                            decoration: const BoxDecoration(color: Color(0xFFEFF5FF), shape: BoxShape.circle),
                            child: Icon(s.icon, color: C.blue, size: 26),
                          ),
                          const SizedBox(height: 8),
                          Text(s.titleKey.tr(), textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink, fontSize: 13)),
                          const SizedBox(height: 4),
                          Text(s.descKey.tr(), textAlign: TextAlign.center, style: const TextStyle(color: C.muted, fontSize: 12, height: 1.35)),
                        ]),
                      ),
                    )).toList(),
              ),
              const SizedBox(height: 24),
              // Trust row
              Container(
                padding: const EdgeInsets.symmetric(vertical: 18),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(16)),
                child: Row(
                  children: List.generate(_trust.length, (i) {
                    final t = _trust[i];
                    return Expanded(
                      child: Container(
                        decoration: i < _trust.length - 1 ? const BoxDecoration(border: Border(right: BorderSide(color: C.line))) : null,
                        child: Column(children: [
                          Icon(t.icon, color: C.blue, size: 24),
                          const SizedBox(height: 6),
                          Text(t.labelKey.tr(), textAlign: TextAlign.center, style: const TextStyle(color: C.ink, fontSize: 12, fontWeight: FontWeight.w700, height: 1.3)),
                        ]),
                      ),
                    );
                  }),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
