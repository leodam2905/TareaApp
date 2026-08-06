import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';
import '../avatar_util.dart';

// Conversations are per-booking. This lists the customer's bookings (each with
// a pro) as chat threads.
class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});
  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  List<dynamic> _bookings = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/bookings?role=customer');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        final list = (d is List ? d : (d['bookings'] ?? [])) as List;
        // Only bookings with a real pro (skip anything without a handyman).
        _bookings = list.where((b) => (b['handyman']?['name'] ?? '').toString().isNotEmpty).toList();
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: Text('messages.title'.tr(), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: C.ink)),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _bookings.isEmpty
                    ? Center(
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          const Icon(Icons.chat_bubble_outline, size: 56, color: C.muted),
                          const SizedBox(height: 12),
                          Text('messages.noConversations'.tr(), style: const TextStyle(color: C.muted, fontSize: 16, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 4),
                          Text('messages.bookToChat'.tr(), style: const TextStyle(color: C.muted)),
                        ]),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: _bookings.length,
                        separatorBuilder: (_, __) => const Divider(height: 1, color: C.line, indent: 76),
                        itemBuilder: (_, i) => _row(_bookings[i]),
                      ),
          ),
        ]),
      ),
    );
  }

  Widget _row(dynamic b) {
    final h = b['handyman'] ?? {};
    final name = (h['name'] ?? 'Pro').toString();
    final service = (b['service']?['title'] ?? b['category'] ?? 'Service').toString();
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(vertical: 6),
      leading: roundAvatar(url: (h['avatarUrl'] ?? '').toString(), radius: 24),
      title: Text(name, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink)),
      subtitle: Text(service, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted)),
      trailing: const Icon(Icons.chevron_right, color: C.muted),
      onTap: () => context.push('/chat', extra: {'bookingId': (b['id'] ?? '').toString(), 'name': name}),
    );
  }
}
