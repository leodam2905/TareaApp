import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});
  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  List<dynamic> _favs = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/favorites');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        _favs = d is List ? d : (d['favorites'] ?? []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _remove(String userId) async {
    try {
      final res = await Api.delete('/favorites/$userId');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setState(() => _favs.removeWhere((f) => ((f['handyman'] ?? f)['id'] ?? '').toString() == userId));
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.bg, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30), onPressed: () => context.pop()),
        title: Text('profile.savedPros'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _favs.isEmpty
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.favorite_border, size: 56, color: C.muted),
                  const SizedBox(height: 12),
                  Text('favorites.noneTitle'.tr(), style: const TextStyle(color: C.muted, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text('favorites.noneDesc'.tr(), style: const TextStyle(color: C.muted)),
                ]))
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: _favs.length,
                  itemBuilder: (_, i) {
                    final f = _favs[i] as Map;
                    final h = (f['handyman'] ?? f) as Map;
                    final name = (h['name'] ?? 'Pro').toString();
                    final hp = h['handymanProfile'] ?? {};
                    final rating = hp['rating'];
                    return GestureDetector(
                      onTap: () => context.push('/handyman-detail', extra: h.cast<String, dynamic>()).then((_) { if (mounted) _load(); }),
                      child: Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
                      child: Row(children: [
                        CircleAvatar(radius: 26, backgroundColor: C.surface,
                            child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(fontWeight: FontWeight.w900, color: C.blue, fontSize: 22))),
                        const SizedBox(width: 14),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(name, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                          Row(children: [
                            const Icon(Icons.star, size: 14, color: Color(0xFFF59E0B)),
                            const SizedBox(width: 3),
                            Text(rating != null ? (rating as num).toStringAsFixed(1) : 'browse.newRating'.tr(), style: const TextStyle(color: C.muted)),
                          ]),
                        ])),
                        IconButton(icon: const Icon(Icons.favorite, color: C.red), onPressed: () => _remove((h['id'] ?? '').toString())),
                      ]),
                    ),
                    );
                  },
                ),
    );
  }
}
