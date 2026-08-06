import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';

class ReferEarnScreen extends StatefulWidget {
  const ReferEarnScreen({super.key});
  @override
  State<ReferEarnScreen> createState() => _ReferEarnScreenState();
}

class _ReferEarnScreenState extends State<ReferEarnScreen> {
  String _code = '';
  int _referred = 0;
  bool _loading = true;
  bool _copied = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/referrals/my-code');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body) as Map<String, dynamic>;
        _code = (d['code'] ?? '').toString();
        _referred = (d['referredCount'] ?? 0) as int;
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.bg, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30), onPressed: () => context.pop()),
        title: Text('profile.referEarn'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [C.blue, Color(0xFF7C3AED)]),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(children: [
                    const Icon(Icons.card_giftcard, color: Colors.white, size: 40),
                    const SizedBox(height: 12),
                    Text('referEarn.give'.tr(), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    Text('referEarn.shareDesc'.tr(),
                        textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, height: 1.4)),
                  ]),
                ),
                const SizedBox(height: 20),
                Text('referEarn.yourCode'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
                  decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: C.line)),
                  child: Row(children: [
                    Expanded(child: Text(_code.isEmpty ? '—' : _code, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: C.ink, letterSpacing: 2))),
                    TextButton.icon(
                      onPressed: _code.isEmpty ? null : () {
                        Clipboard.setData(ClipboardData(text: _code));
                        setState(() => _copied = true);
                      },
                      icon: Icon(_copied ? Icons.check : Icons.copy, size: 18, color: C.blue),
                      label: Text(_copied ? 'referEarn.copied'.tr() : 'referEarn.copy'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
                    ),
                  ]),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
                  child: Row(children: [
                    const Icon(Icons.people_outline, color: C.blue),
                    const SizedBox(width: 12),
                    Expanded(child: Text('referEarn.friendsReferred'.tr(), style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink))),
                    Text('$_referred', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
                  ]),
                ),
              ],
            ),
    );
  }
}
