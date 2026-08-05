import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';

class _Feature {
  final IconData icon;
  final Color color;
  final String title;
  final String desc;
  const _Feature(this.icon, this.color, this.title, this.desc);
}

const _features = [
  _Feature(Icons.verified_user_outlined, C.blue, 'Verified Professionals', 'Background-checked and reviewed pros.'),
  _Feature(Icons.bolt_outlined, C.blue, 'Fast & Easy Booking', 'Book in minutes and get matched quickly.'),
  _Feature(Icons.credit_card_outlined, C.blue, 'Upfront Pricing', 'Clear, transparent pricing always.'),
  _Feature(Icons.auto_awesome_outlined, C.green, 'Diagnose Issue', 'AI identifies what you need.'),
  _Feature(Icons.sell_outlined, Color(0xFF7C3AED), 'Instant Quote', 'Get a price before you book.'),
  _Feature(Icons.workspace_premium_outlined, Color(0xFFF97316), 'Quality Focused', 'Verified pros held to a high standard.'),
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
                    child: Row(children: const [
                      Icon(Icons.shield_outlined, size: 16, color: C.blue),
                      SizedBox(width: 6),
                      Text('Trusted Pros\nIn Your Area', style: TextStyle(fontSize: 12, color: C.blue, fontWeight: FontWeight.w700)),
                    ]),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              // Heading
              RichText(
                text: const TextSpan(
                  style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900, height: 1.1, letterSpacing: -1, color: C.ink),
                  children: [
                    TextSpan(text: 'Reliable help for every job '),
                    TextSpan(text: 'around your home.', style: TextStyle(color: C.blue)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              const Text('Book trusted handymen for home repairs, installations, cleaning and more in minutes.',
                  style: TextStyle(fontSize: 15, color: C.muted, height: 1.4)),
              const SizedBox(height: 16),
              Center(child: Image.asset('assets/images/landing-house.png', height: 230, fit: BoxFit.contain)),
              const SizedBox(height: 16),
              // Feature grid
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: 0.62,
                children: _features.map(_featureCard).toList(),
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
                  child: const Text('Get Started', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
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
                  child: const Text('I already have an account', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: C.blue)),
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
        Text(f.title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: C.ink)),
        const SizedBox(height: 4),
        Text(f.desc, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: C.muted, height: 1.3)),
      ],
    );
  }
}
