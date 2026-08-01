import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';
import '../api.dart';
import '../flavor.dart';

class VerifyOtpScreen extends StatefulWidget {
  final Map<String, dynamic> data;
  const VerifyOtpScreen({super.key, required this.data});
  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen> {
  final _code = TextEditingController();
  bool _loading = false;

  String get _pendingToken => (widget.data['pendingToken'] ?? '').toString();

  Future<void> _verify() async {
    if (_code.text.trim().length != 6) return _toast('Enter the 6-digit code');
    setState(() => _loading = true);
    try {
      final res = await Api.post('/auth/verify-otp', {'pendingToken': _pendingToken, 'code': _code.text.trim()});
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode < 200 || res.statusCode >= 300) return _toast(data['error']?.toString() ?? 'Invalid code');
      await Api.setToken(data['token'].toString());
      await Api.setRole((data['role'] ?? signupRole).toString());
      if (mounted) context.go(homeRoute);
    } catch (_) {
      _toast('Could not connect. Try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    try {
      await Api.post('/auth/resend-otp', {'pendingToken': _pendingToken});
      _toast('A new code was sent.');
    } catch (_) {}
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.white,
      appBar: AppBar(
        backgroundColor: C.white, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: C.ink), onPressed: () => context.canPop() ? context.pop() : context.go('/')),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            Container(width: 64, height: 64, decoration: const BoxDecoration(color: Color(0xFFEFF5FF), shape: BoxShape.circle), child: const Icon(Icons.sms_outlined, color: C.blue, size: 30)),
            const SizedBox(height: 20),
            const Text('Verify your phone', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 8),
            const Text('Enter the 6-digit code we sent to your phone number.', style: TextStyle(fontSize: 15, color: C.muted, height: 1.5)),
            const SizedBox(height: 24),
            TextField(
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, letterSpacing: 12, color: C.ink),
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(
                counterText: '',
                hintText: '••••••',
                hintStyle: const TextStyle(color: Color(0xFFCBD5E1), letterSpacing: 12),
                filled: true, fillColor: C.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 18), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                onPressed: _loading ? null : _verify,
                child: _loading
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Verify', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
              ),
            ),
            const SizedBox(height: 16),
            Center(child: GestureDetector(onTap: _resend, child: const Text.rich(TextSpan(style: TextStyle(color: C.muted), children: [
              TextSpan(text: "Didn't get a code? "),
              TextSpan(text: 'Resend', style: TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
            ])))),
          ],
        ),
      ),
    );
  }
}
