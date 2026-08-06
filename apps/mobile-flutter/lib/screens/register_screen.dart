import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';
import '../flavor.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _showPw = false;
  bool _agreed = false;
  bool _loading = false;

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty || _email.text.trim().isEmpty || _phone.text.trim().isEmpty || _password.text.isEmpty) {
      return _toast('register.allRequired'.tr());
    }
    if (_password.text.length < 8) return _toast('register.passwordMin'.tr());
    if (_password.text != _confirm.text) return _toast('register.passwordsMismatch'.tr());
    if (!_agreed) return _toast('register.acceptTerms'.tr());
    setState(() => _loading = true);
    try {
      final res = await Api.post('/auth/register', {
        'name': _name.text.trim(),
        'email': _email.text.trim().toLowerCase(),
        'phone': _phone.text.trim(),
        'password': _password.text,
        'role': signupRole,
        'accountType': 'INDIVIDUAL',
      });
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return _toast(data['error']?.toString() ?? 'register.createFailed'.tr());
      }
      if (data['token'] != null) {
        await Api.setToken(data['token'].toString());
        await Api.setRole((data['role'] ?? signupRole).toString());
        if (mounted) context.go(homeRoute);
      } else {
        if (mounted) context.push('/verify-otp', extra: {'pendingToken': data['pendingToken'], 'role': data['role'] ?? 'CUSTOMER'});
      }
    } catch (_) {
      _toast('common.connectionRetry'.tr());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFEAF2FF),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Hero
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    IconButton(padding: EdgeInsets.zero, alignment: Alignment.centerLeft,
                        icon: const Icon(Icons.arrow_back, color: C.ink), onPressed: () => context.canPop() ? context.pop() : context.go('/')),
                    const SizedBox(height: 8),
                    Row(children: [
                      Image.asset('assets/images/tarea-home-mark.png', width: 34, height: 34),
                      const SizedBox(width: 8),
                      const Text('Tarea', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink)),
                    ]),
                    const SizedBox(height: 16),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: RichText(
                            text: TextSpan(
                              style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, height: 1.05, letterSpacing: -1, color: C.ink),
                              children: [TextSpan(text: 'register.heroLine1'.tr()), TextSpan(text: 'register.heroLine2'.tr(), style: const TextStyle(color: C.blue))],
                            ),
                          ),
                        ),
                        Image.asset('assets/images/signup-illustration.png', width: 130, height: 150, fit: BoxFit.contain),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('register.subtitle'.tr(), style: const TextStyle(fontSize: 14, color: Color(0xFF5B6472), height: 1.4)),
                  ],
                ),
              ),
              // Form card
              Container(
                width: double.infinity,
                decoration: const BoxDecoration(color: C.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('register.title'.tr(), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: C.ink)),
                    const SizedBox(height: 12),
                    ClipRRect(borderRadius: BorderRadius.circular(4), child: const LinearProgressIndicator(value: 0.33, minHeight: 6, backgroundColor: Color(0xFFE2E8F0), color: C.blue)),
                    const SizedBox(height: 20),
                    _field(_name, 'register.fullName'.tr(), Icons.person_outline, cap: TextCapitalization.words),
                    const SizedBox(height: 12),
                    _field(_email, 'auth.email'.tr(), Icons.mail_outline, keyboard: TextInputType.emailAddress),
                    const SizedBox(height: 12),
                    _field(_phone, 'register.phone'.tr(), Icons.call_outlined, keyboard: TextInputType.phone),
                    const SizedBox(height: 12),
                    _field(_password, 'register.createPassword'.tr(), Icons.lock_outline, obscure: !_showPw,
                        trailing: IconButton(icon: Icon(_showPw ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: C.muted), onPressed: () => setState(() => _showPw = !_showPw))),
                    const SizedBox(height: 12),
                    _field(_confirm, 'register.confirmPassword'.tr(), Icons.lock_outline, obscure: !_showPw),
                    const SizedBox(height: 16),
                    GestureDetector(
                      onTap: () => setState(() => _agreed = !_agreed),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 22, height: 22, margin: const EdgeInsets.only(top: 1),
                          decoration: BoxDecoration(color: _agreed ? C.blue : Colors.transparent, borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: _agreed ? C.blue : const Color(0xFFCBD5E1), width: 1.5)),
                          child: _agreed ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text.rich(TextSpan(style: const TextStyle(color: C.muted, height: 1.4), children: [
                          TextSpan(text: 'register.agreePrefix'.tr()),
                          TextSpan(text: 'common.termsOfService'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w700)),
                          TextSpan(text: 'register.agreeMiddle'.tr()),
                          TextSpan(text: 'common.privacyPolicy'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w700)),
                        ]))),
                      ]),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 18),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                        onPressed: _loading ? null : _submit,
                        child: _loading
                            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : Text('auth.signUp'.tr(), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Center(
                      child: GestureDetector(
                        onTap: () => context.go('/login'),
                        child: Text.rich(TextSpan(style: const TextStyle(color: C.muted), children: [
                          TextSpan(text: 'register.alreadyPrefix'.tr()),
                          TextSpan(text: 'auth.login'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
                        ])),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String hint, IconData icon, {bool obscure = false, TextInputType? keyboard, TextCapitalization cap = TextCapitalization.none, Widget? trailing}) => Container(
        decoration: BoxDecoration(border: Border.all(color: C.line), borderRadius: BorderRadius.circular(14)),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(children: [
          Icon(icon, size: 20, color: C.muted),
          const SizedBox(width: 12),
          Expanded(child: TextField(controller: c, obscureText: obscure, keyboardType: keyboard, textCapitalization: cap, autocorrect: false,
              decoration: InputDecoration(hintText: hint, hintStyle: const TextStyle(color: C.muted), border: InputBorder.none, isCollapsed: true, contentPadding: const EdgeInsets.symmetric(vertical: 18)))),
          if (trailing != null) trailing,
        ]),
      );
}
