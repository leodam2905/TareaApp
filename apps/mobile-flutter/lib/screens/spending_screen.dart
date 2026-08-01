import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';
import '../api.dart';

class SpendingScreen extends StatefulWidget {
  const SpendingScreen({super.key});
  @override
  State<SpendingScreen> createState() => _SpendingScreenState();
}

class _SpendingScreenState extends State<SpendingScreen> {
  List<dynamic> _done = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/bookings?role=customer');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        final all = d is List ? d : (d['bookings'] ?? []);
        _done = (all as List).where((b) => b['status'] == 'COMPLETED').toList();
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  num get _total => _done.fold<num>(0, (s, b) => s + ((b['totalPrice'] ?? 0) as num));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.bg, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30), onPressed: () => context.pop()),
        title: const Text('Spending Report', style: TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(color: C.blue, borderRadius: BorderRadius.circular(20)),
                  child: Column(children: [
                    const Text('Total spent', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text('\$${_total.round()}', style: const TextStyle(color: Colors.white, fontSize: 44, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    Text('${_done.length} completed job${_done.length == 1 ? '' : 's'}', style: const TextStyle(color: Colors.white70)),
                  ]),
                ),
                const SizedBox(height: 20),
                if (_done.isEmpty)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: Text('No completed jobs yet.', style: TextStyle(color: C.muted))))
                else ...[
                  const Text('History', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
                  const SizedBox(height: 10),
                  ..._done.map((b) {
                    final service = (b['service']?['title'] ?? b['category'] ?? 'Service').toString();
                    final name = (b['handyman']?['name'] ?? '').toString();
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(14)),
                      child: Row(children: [
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(service, style: const TextStyle(fontWeight: FontWeight.w800, color: C.ink)),
                          if (name.isNotEmpty) Text(name, style: const TextStyle(color: C.muted, fontSize: 13)),
                        ])),
                        Text('\$${((b['totalPrice'] ?? 0) as num).round()}', style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                      ]),
                    );
                  }),
                ],
              ],
            ),
    );
  }
}
