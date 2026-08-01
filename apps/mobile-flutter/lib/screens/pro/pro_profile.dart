import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme.dart';
import '../../api.dart';

class ProProfile extends StatefulWidget {
  const ProProfile({super.key});
  @override
  State<ProProfile> createState() => _ProProfileState();
}

class _ProProfileState extends State<ProProfile> {
  String _name = '';
  double _rating = 0;
  int _jobs = 0;
  num _hourly = 0;
  String _bio = '';
  List<dynamic> _services = [];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/profile');
      if (res.statusCode == 200) {
        final p = jsonDecode(res.body) as Map<String, dynamic>;
        _name = (p['name'] ?? '').toString();
        final hp = p['handymanProfile'] ?? {};
        _rating = ((hp['rating']) as num?)?.toDouble() ?? 0;
        _jobs = (hp['totalJobs'] ?? 0) as int;
        _hourly = (hp['hourlyRate'] ?? 0) as num;
        _bio = (hp['bio'] ?? '').toString();
        _services = (hp['services'] as List?) ?? [];
      }
    } catch (_) {}
    if (mounted) setState(() {});
  }

  Future<void> _logout() async {
    await Api.clearToken();
    if (mounted) context.go('/');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            const Text('Profile', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(18)),
              child: Column(children: [
                CircleAvatar(radius: 36, backgroundColor: C.surface, child: Text(_name.isNotEmpty ? _name[0].toUpperCase() : '?', style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: C.blue))),
                const SizedBox(height: 12),
                Text(_name.isEmpty ? 'Your account' : _name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
                const SizedBox(height: 6),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.star, color: Color(0xFFF59E0B), size: 18),
                  const SizedBox(width: 4),
                  Text(_rating > 0 ? '${_rating.toStringAsFixed(1)} · $_jobs jobs' : 'New pro', style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink)),
                ]),
              ]),
            ),
            const SizedBox(height: 16),
            Row(children: [
              _stat(_hourly > 0 ? '\$${_hourly.round()}/hr' : '—', 'Rate'),
              _stat('$_jobs', 'Jobs'),
              _stat(_rating > 0 ? _rating.toStringAsFixed(1) : 'New', 'Rating'),
            ]),
            if (_bio.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Text('About', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
              const SizedBox(height: 8),
              Text(_bio, style: const TextStyle(color: C.muted, height: 1.5)),
            ],
            if (_services.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Text('Services', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: _services.map<Widget>((sv) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(12)),
                    child: Text((sv['title'] ?? sv['category'] ?? 'Service').toString(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w600)),
                  )).toList()),
            ],
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFFECACA)), padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                onPressed: _logout,
                child: const Text('Log out', style: TextStyle(color: C.red, fontWeight: FontWeight.w800, fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stat(String value, String label) => Expanded(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4), padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
          child: Column(children: [
            Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: C.muted, fontSize: 12)),
          ]),
        ),
      );
}
