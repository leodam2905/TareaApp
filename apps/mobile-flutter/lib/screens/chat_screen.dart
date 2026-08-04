import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';
import '../api.dart';

class ChatScreen extends StatefulWidget {
  final Map<String, dynamic> data; // { bookingId, name }
  const ChatScreen({super.key, required this.data});
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  List<dynamic> _messages = [];
  bool _loading = true;
  bool _sending = false;
  String _me = '';
  final _input = TextEditingController();
  final _scroll = ScrollController();

  String get _bookingId => (widget.data['bookingId'] ?? '').toString();
  String get _title => (widget.data['name'] ?? 'Chat').toString();

  @override
  void initState() {
    super.initState();
    _loadMe();
    _load();
  }

  Future<void> _loadMe() async {
    try {
      final res = await Api.get('/profile');
      if (res.statusCode == 200) _me = (jsonDecode(res.body)['id'] ?? '').toString();
    } catch (_) {}
  }

  Future<void> _load() async {
    try {
      final res = await Api.get('/bookings/$_bookingId/messages');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        _messages = d is List ? d : (d['messages'] ?? []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
    _scrollToEnd();
  }

  void _scrollToEnd() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
      });

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    _input.clear();
    try {
      final res = await Api.post('/bookings/$_bookingId/messages', {'content': text});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await _load();
      } else {
        _input.text = text;
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not send. Try again.')));
      }
    } catch (_) {
      _input.text = text;
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not connect. Try again.')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.white, surfaceTintColor: Colors.transparent, elevation: 0.5,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: C.ink), onPressed: () => context.pop()),
        title: Text(_title, style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 18)),
      ),
      body: Column(children: [
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _messages.isEmpty
                  ? const Center(child: Text('No messages yet. Say hello 👋', style: TextStyle(color: C.muted)))
                  : ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.all(16),
                      itemCount: _messages.length,
                      itemBuilder: (_, i) => _bubble(_messages[i]),
                    ),
        ),
        _composer(),
      ]),
    );
  }

  Widget _bubble(dynamic m) {
    final mine = (m['senderId'] ?? m['sender']?['id'] ?? '').toString() == _me;
    final text = (m['content'] ?? '').toString();
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
        decoration: BoxDecoration(
          color: mine ? C.blue : C.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16), topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(mine ? 16 : 4), bottomRight: Radius.circular(mine ? 4 : 16),
          ),
        ),
        child: Text(text, style: TextStyle(color: mine ? Colors.white : C.ink, height: 1.35)),
      ),
    );
  }

  Widget _composer() => SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          decoration: const BoxDecoration(color: C.white, border: Border(top: BorderSide(color: C.line))),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _input,
                minLines: 1, maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(
                  hintText: 'Message…', filled: true, fillColor: C.bg,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: _send,
              child: Container(
                width: 44, height: 44,
                decoration: const BoxDecoration(color: C.blue, shape: BoxShape.circle),
                child: _sending
                    ? const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send, color: Colors.white, size: 20),
              ),
            ),
          ]),
        ),
      );
}
