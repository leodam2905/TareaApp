import 'dart:convert';
import 'package:flutter/material.dart';
import '../../theme.dart';
import '../../api.dart';
import '../../avatar_util.dart';
import 'pro_widgets.dart';

class ProReviews extends StatefulWidget {
  const ProReviews({super.key});
  @override
  State<ProReviews> createState() => _ProReviewsState();
}

class _ProReviewsState extends State<ProReviews> {
  List<dynamic> _reviews = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/reviews/received');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        _reviews = d is List ? d : (d['reviews'] ?? []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  double get _avg => _reviews.isEmpty
      ? 0
      : _reviews.map((r) => (r['rating'] ?? 0) as num).reduce((a, b) => a + b) / _reviews.length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: proBar(context, 'Reviews'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _reviews.isEmpty
              ? const Center(child: Text('No reviews yet.', style: TextStyle(color: C.muted)))
              : ListView(padding: const EdgeInsets.all(20), children: [
                  Row(children: [
                    Text(_avg.toStringAsFixed(1), style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: C.ink)),
                    const SizedBox(width: 12),
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _stars(_avg.round()),
                      const SizedBox(height: 4),
                      Text('${_reviews.length} review${_reviews.length == 1 ? '' : 's'}', style: const TextStyle(color: C.muted)),
                    ]),
                  ]),
                  const SizedBox(height: 20),
                  ..._reviews.map(_reviewCard),
                ]),
    );
  }

  Widget _stars(int n) => Row(mainAxisSize: MainAxisSize.min, children: List.generate(5, (i) =>
      Icon(i < n ? Icons.star : Icons.star_border, color: const Color(0xFFF59E0B), size: 18)));

  Widget _reviewCard(dynamic r) {
    final author = r['author'] ?? {};
    final name = (author['name'] ?? 'Customer').toString();
    final comment = (r['comment'] ?? '').toString();
    final reply = (r['handymanReply'] ?? '').toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          roundAvatar(url: (author['avatarUrl'] ?? '').toString(), radius: 18),
          const SizedBox(width: 10),
          Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink))),
          _stars((r['rating'] ?? 0) as int),
        ]),
        if (comment.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(comment, style: const TextStyle(color: C.ink, height: 1.4)),
        ],
        if (reply.isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Your reply', style: TextStyle(fontWeight: FontWeight.w800, color: C.muted, fontSize: 12)),
              const SizedBox(height: 4),
              Text(reply, style: const TextStyle(color: C.ink, height: 1.4)),
            ]),
          ),
        ],
      ]),
    );
  }
}
