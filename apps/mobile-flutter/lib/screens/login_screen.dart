import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';
import '../api.dart';
import '../flavor.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _remember = true;
  bool _showPw = false;
  bool _loading = false;

  Future<void> _submit() async {
    if (_email.text.trim().isEmpty || _password.text.isEmpty) {
      _toast('Please enter your email and password');
      return;
    }
    setState(() => _loading = true);
    try {
      final res = await Api.post('/auth/login', {
        'email': _email.text.trim().toLowerCase(),
        'password': _password.text,
      });
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode != 200) {
        _toast(data['error']?.toString() ?? 'Invalid credentials');
        return;
      }
      if (data['requiresOtp'] == true) {
        _toast('This account needs an OTP — use a review test account for now.');
        return;
      }
      await Api.setToken(data['token'].toString());
      await Api.setRole((data['role'] ?? 'CUSTOMER').toString());
      if (mounted) context.go(homeRoute);
    } catch (_) {
      _toast('Could not connect. Check your internet connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toast(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

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
              IconButton(
                padding: EdgeInsets.zero,
                alignment: Alignment.centerLeft,
                icon: const Icon(Icons.chevron_left, size: 30, color: C.ink),
                onPressed: () => context.canPop() ? context.pop() : context.go('/'),
              ),
              // Hero: heading + woman
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('Welcome back!',
                            style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -1, color: C.ink, height: 1.05)),
                        SizedBox(height: 12),
                        Text('Sign in to your Tarea account to book trusted pros for your home.',
                            style: TextStyle(fontSize: 15, color: C.muted, height: 1.45)),
                      ],
                    ),
                  ),
                  Image.asset('assets/images/signin-woman.png', width: 132, height: 132, fit: BoxFit.contain),
                ],
              ),
              const SizedBox(height: 16),
              // Trust pill
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE9F9EF),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFBBE9CC)),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: const [
                  Icon(Icons.shield, size: 18, color: Color(0xFF16A34A)),
                  SizedBox(width: 8),
                  Text('Secure • Private • Trusted',
                      style: TextStyle(color: Color(0xFF16803D), fontWeight: FontWeight.w800)),
                ]),
              ),
              const SizedBox(height: 22),
              const Text('Sign in with email', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
              const SizedBox(height: 14),
              _field(controller: _email, hint: 'Email address', icon: Icons.mail_outline, keyboard: TextInputType.emailAddress),
              const SizedBox(height: 14),
              _field(
                controller: _password,
                hint: 'Password',
                icon: Icons.lock_outline,
                obscure: !_showPw,
                trailing: IconButton(
                  icon: Icon(_showPw ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: C.muted),
                  onPressed: () => setState(() => _showPw = !_showPw),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  GestureDetector(
                    onTap: () => setState(() => _remember = !_remember),
                    child: Row(children: [
                      Container(
                        width: 22, height: 22,
                        decoration: BoxDecoration(
                          color: _remember ? C.blue : Colors.transparent,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: _remember ? C.blue : const Color(0xFFCBD5E1), width: 1.5),
                        ),
                        child: _remember ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
                      ),
                      const SizedBox(width: 8),
                      const Text('Remember me', style: TextStyle(color: Color(0xFF475569), fontWeight: FontWeight.w600)),
                    ]),
                  ),
                  const Text('Forgot password?', style: TextStyle(color: C.blue, fontWeight: FontWeight.w700)),
                ],
              ),
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: C.blue,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Sign In', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 20),
              // Secure & Protected card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(16)),
                child: Row(children: [
                  Container(width: 44, height: 44, decoration: const BoxDecoration(color: Color(0xFFEFF5FF), shape: BoxShape.circle),
                      child: const Icon(Icons.verified_user, color: C.blue, size: 22)),
                  const SizedBox(width: 12),
                  const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Secure & Protected', style: TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 15)),
                    SizedBox(height: 2),
                    Text('Your information is encrypted and never shared with third parties.', style: TextStyle(color: C.muted, fontSize: 12.5, height: 1.35)),
                  ])),
                ]),
              ),
              const SizedBox(height: 20),
              // Trust row
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _trust(Icons.workspace_premium_outlined, const Color(0xFF16A34A), 'Verified Pros', 'Background checked', true),
                _trust(Icons.verified_user_outlined, C.blue, 'Secure Payments', 'Safe and encrypted', true),
                _trust(Icons.headset_mic_outlined, const Color(0xFF7C3AED), '24/7 Support', "We're here to help", false),
              ]),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscure = false,
    TextInputType? keyboard,
    Widget? trailing,
  }) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: C.line),
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(children: [
        Icon(icon, size: 20, color: C.muted),
        const SizedBox(width: 12),
        Expanded(
          child: TextField(
            controller: controller,
            obscureText: obscure,
            keyboardType: keyboard,
            autocorrect: false,
            enableSuggestions: false,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(color: C.muted),
              border: InputBorder.none,
              isCollapsed: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 18),
            ),
          ),
        ),
        if (trailing != null) trailing,
      ]),
    );
  }

  Widget _trust(IconData icon, Color color, String title, String sub, bool divider) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          decoration: divider ? const BoxDecoration(border: Border(right: BorderSide(color: C.line))) : null,
          child: Column(children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 6),
            FittedBox(fit: BoxFit.scaleDown, child: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink, fontSize: 12.5))),
            const SizedBox(height: 2),
            Text(sub, textAlign: TextAlign.center, style: const TextStyle(color: C.muted, fontSize: 11, height: 1.3)),
          ]),
        ),
      );
}
