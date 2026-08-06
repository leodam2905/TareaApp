import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';
import '../flavor.dart';
import '../push_service.dart';

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

  @override
  void initState() {
    super.initState();
    // Prefill the email if the user chose "Remember me" last time.
    Api.rememberedEmail().then((saved) {
      if (saved != null && saved.isNotEmpty && mounted) {
        setState(() => _email.text = saved);
      }
    });
  }

  Future<void> _submit() async {
    if (_email.text.trim().isEmpty || _password.text.isEmpty) {
      _toast('auth.enterEmailPassword'.tr());
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
        _toast(data['error']?.toString() ?? 'auth.invalidCredentials'.tr());
        return;
      }
      // Remember me: persist/clear the email once credentials are accepted
      // (works whether or not OTP follows).
      await Api.setRememberedEmail(_remember ? _email.text.trim().toLowerCase() : null);
      if (data['requiresOtp'] == true) {
        if (data['requiresPhone'] == true) {
          _toast('login.noPhone'.tr());
          return;
        }
        if (mounted) {
          context.push('/verify-otp', extra: {
            'pendingToken': data['pendingToken'],
            'role': data['role'],
            'phoneMask': data['phoneMask'],
          });
        }
        return;
      }
      await Api.setToken(data['token'].toString());
      await Api.setRole((data['role'] ?? 'CUSTOMER').toString());
      PushService.registerToken();
      if (mounted) context.go(homeRoute);
    } catch (_) {
      _toast('common.connectionError'.tr());
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
              // Hero: full-width heading, then subtitle + illustration side by side.
              // (Heading spans the full width so it never breaks mid-word when
              // the illustration narrows the column — an iOS font-width issue.)
              Text('auth.welcomeBack'.tr(),
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -1, color: C.ink, height: 1.1, leadingDistribution: TextLeadingDistribution.even)),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Text(
                        isPro
                            ? 'login.subtitlePro'.tr()
                            : 'login.subtitleCustomer'.tr(),
                        style: const TextStyle(fontSize: 15, color: C.muted, height: 1.45)),
                  ),
                  const SizedBox(width: 12),
                  Image.asset(isPro ? 'assets/images/login-illustration.png' : 'assets/images/signin-woman.png', width: 120, height: 120, fit: BoxFit.contain),
                ],
              ),
              const SizedBox(height: 16),
              // Trust pill (customer only)
              if (!isPro)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE9F9EF),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFBBE9CC)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.shield, size: 18, color: Color(0xFF16A34A)),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text('login.securePill'.tr(), overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Color(0xFF16803D), fontWeight: FontWeight.w800)),
                    ),
                  ]),
                ),
              if (!isPro) const SizedBox(height: 22),
              Text('auth.signInWithEmail'.tr(), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
              const SizedBox(height: 14),
              _field(controller: _email, hint: 'auth.email'.tr(), icon: Icons.mail_outline, keyboard: TextInputType.emailAddress),
              const SizedBox(height: 14),
              _field(
                controller: _password,
                hint: 'auth.password'.tr(),
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
                  Flexible(
                    child: GestureDetector(
                      onTap: () => setState(() => _remember = !_remember),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
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
                        Flexible(
                          child: Text('auth.rememberMe'.tr(), overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, color: Color(0xFF475569), fontWeight: FontWeight.w600)),
                        ),
                      ]),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Flexible(child: Text('auth.forgotPassword'.tr(), overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, color: C.blue, fontWeight: FontWeight.w700))),
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
                      : Text(isPro ? 'auth.login'.tr() : 'auth.signIn'.tr(), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
              if (!isPro) const SizedBox(height: 20),
              // Secure & Protected card (customer only)
              if (!isPro)
                Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(16)),
                child: Row(children: [
                  Container(width: 44, height: 44, decoration: const BoxDecoration(color: Color(0xFFEFF5FF), shape: BoxShape.circle),
                      child: const Icon(Icons.verified_user, color: C.blue, size: 22)),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('login.secureTitle'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text('login.secureDesc'.tr(), style: const TextStyle(color: C.muted, fontSize: 12.5, height: 1.35)),
                  ])),
                ]),
              ),
              if (!isPro) const SizedBox(height: 20),
              // Trust row (customer only)
              if (!isPro)
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _trust(Icons.workspace_premium_outlined, const Color(0xFF16A34A), 'login.trustVerifiedPros'.tr(), 'login.trustVerifiedProsSub'.tr(), true),
                _trust(Icons.verified_user_outlined, C.blue, 'login.trustSecurePayments'.tr(), 'login.trustSecurePaymentsSub'.tr(), true),
                _trust(Icons.headset_mic_outlined, const Color(0xFF7C3AED), 'login.trustSupport'.tr(), 'login.trustSupportSub'.tr(), false),
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
