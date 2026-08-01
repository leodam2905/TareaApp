import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme.dart';

class _Step {
  final String n, title, desc;
  const _Step(this.n, this.title, this.desc);
}

const _steps = [
  _Step('1', 'Create your Pro profile', 'Add your services, rate, and availability in minutes.'),
  _Step('2', 'Get matched with jobs', 'Receive nearby job requests and apply with one tap.'),
  _Step('3', 'Do the work, get paid fast', 'Finish the job and cash out to your bank quickly.'),
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
                  child: Row(children: const [
                    Icon(Icons.verified, size: 15, color: Color(0xFF16A34A)),
                    SizedBox(width: 4),
                    Text('Verified Pros', style: TextStyle(color: Color(0xFF16A34A), fontSize: 12, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ]),
              const SizedBox(height: 20),
              RichText(
                text: const TextSpan(
                  style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900, height: 1.15, letterSpacing: -0.5, color: C.ink),
                  children: [
                    TextSpan(text: 'Join Tarea and '),
                    TextSpan(text: 'get local jobs, fast payouts', style: TextStyle(color: C.blue)),
                    TextSpan(text: ' and build your '),
                    TextSpan(text: 'reputation.', style: TextStyle(color: C.blue)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              const Text('More jobs. Fair pay. Real growth. All in one place for pros like you.',
                  style: TextStyle(fontSize: 15, color: C.muted, height: 1.4)),
              const SizedBox(height: 16),
              ClipRRect(borderRadius: BorderRadius.circular(20), child: Image.asset('assets/images/pro-hero.png', height: 200, width: double.infinity, fit: BoxFit.cover)),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 18), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  onPressed: () => context.go('/register'),
                  child: const Text('Join Tarea as a Pro  →', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFBFD4FF)), padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  onPressed: () => context.go('/login'),
                  child: const Text('Log in', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: C.blue)),
                ),
              ),
              const SizedBox(height: 24),
              const Text('How it works', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
              const SizedBox(height: 12),
              ..._steps.map((s) => Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        width: 34, height: 34,
                        decoration: BoxDecoration(color: const Color(0xFFEFF5FF), borderRadius: BorderRadius.circular(10)),
                        child: Center(child: Text(s.n, style: const TextStyle(color: C.blue, fontWeight: FontWeight.w900))),
                      ),
                      const SizedBox(width: 14),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(s.title, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                        const SizedBox(height: 2),
                        Text(s.desc, style: const TextStyle(color: C.muted, height: 1.35)),
                      ])),
                    ]),
                  )),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
