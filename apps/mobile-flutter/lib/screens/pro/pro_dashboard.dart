import 'dart:convert';
import 'package:flutter/material.dart';
import '../../theme.dart';
import '../../api.dart';

class ProDashboard extends StatefulWidget {
  const ProDashboard({super.key});
  @override
  State<ProDashboard> createState() => _ProDashboardState();
}

class _ProDashboardState extends State<ProDashboard> {
  String _name = '';
  double _rating = 0;
  int _totalJobs = 0;
  num _totalEarnings = 0;
  num _pendingEarnings = 0;
  bool _available = false;
  List<dynamic> _upcoming = [];
  bool _busy = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final p = await Api.get('/profile');
      if (p.statusCode == 200) {
        final pj = jsonDecode(p.body) as Map<String, dynamic>;
        _name = (pj['name'] ?? '').toString();
        final hp = pj['handymanProfile'] ?? {};
        _rating = ((hp['rating']) as num?)?.toDouble() ?? 0;
        _totalJobs = (hp['totalJobs'] ?? 0) as int;
        _available = hp['isAvailable'] == true;
      }
    } catch (_) {}
    try {
      final e = await Api.get('/handyman/earnings');
      if (e.statusCode == 200) {
        final ej = jsonDecode(e.body) as Map<String, dynamic>;
        _totalEarnings = (ej['totalEarnings'] ?? 0) as num;
        _pendingEarnings = (ej['pendingEarnings'] ?? 0) as num;
      }
    } catch (_) {}
    try {
      final b = await Api.get('/bookings?role=handyman');
      if (b.statusCode == 200) {
        final all = jsonDecode(b.body);
        final list = all is List ? all : (all['bookings'] ?? []);
        _upcoming = (list as List).where((x) => ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].contains(x['status'])).take(4).toList();
      }
    } catch (_) {}
    if (mounted) setState(() {});
  }

  Future<void> _toggleOnline() async {
    final next = !_available;
    setState(() { _available = next; _busy = true; });
    try {
      final res = await Api.patch('/profile', {'isAvailable': next});
      if (res.statusCode < 200 || res.statusCode >= 300) setState(() => _available = !next);
    } catch (_) { setState(() => _available = !next); }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Welcome back${_name.isEmpty ? '' : ', ${_name.split(' ').first}'}',
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink)),
                    const Text("Here's what's happening with your business today.", style: TextStyle(color: C.muted)),
                  ]),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Online toggle
            GestureDetector(
              onTap: _busy ? null : _toggleOnline,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                decoration: BoxDecoration(
                  color: _available ? const Color(0xFFECFDF3) : C.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _available ? const Color(0xFF16A34A) : C.line),
                ),
                child: Row(children: [
                  Container(width: 12, height: 12, decoration: BoxDecoration(color: _available ? const Color(0xFF16A34A) : const Color(0xFF94A3B8), shape: BoxShape.circle)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(_available ? "You're Online" : "You're Offline",
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: _available ? const Color(0xFF16A34A) : C.ink)),
                      Text(_available ? 'Nearby customers can find and book you.' : 'Go online to receive jobs.', style: const TextStyle(color: C.muted, fontSize: 13)),
                    ]),
                  ),
                  Switch(value: _available, activeColor: const Color(0xFF16A34A), onChanged: _busy ? null : (_) => _toggleOnline()),
                ]),
              ),
            ),
            const SizedBox(height: 16),
            // Stats
            Row(children: [
              _stat('\$${_totalEarnings.round()}', 'Earned', C.green),
              _stat('\$${_pendingEarnings.round()}', 'Pending', C.amber),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              _stat('$_totalJobs', 'Jobs done', C.blue),
              _stat(_rating > 0 ? _rating.toStringAsFixed(1) : 'New', 'Rating', const Color(0xFF7C3AED)),
            ]),
            const SizedBox(height: 24),
            const Text('Upcoming Jobs', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 12),
            if (_upcoming.isEmpty)
              Container(
                width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 24), alignment: Alignment.center,
                decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
                child: const Text('No upcoming jobs.', style: TextStyle(color: C.muted)),
              )
            else
              ..._upcoming.map(_jobRow),
          ],
        ),
      ),
    );
  }

  Widget _stat(String value, String label, Color color) => Expanded(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: color)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: C.muted, fontSize: 13)),
          ]),
        ),
      );

  Widget _jobRow(dynamic b) {
    final service = (b['service']?['title'] ?? b['category'] ?? 'Job').toString();
    final customer = (b['customer']?['name'] ?? 'Customer').toString();
    final price = (b['totalPrice'] ?? 0) as num;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(service, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
          Text(customer, style: const TextStyle(color: C.muted, fontSize: 13)),
        ])),
        Text('\$${price.round()}', style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
      ]),
    );
  }
}
