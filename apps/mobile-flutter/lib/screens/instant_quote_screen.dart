import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../theme.dart';
import '../api.dart';
import '../service_catalog.dart';

// Category list + task/detail catalog now live in service_catalog.dart so
// Post a Job asks the exact same questions. Local aliases keep this file's code
// unchanged.
typedef _Cat = ServiceCat;
const _cats = kServiceCats;
const _tasks = kServiceTasks;

class InstantQuoteScreen extends StatefulWidget {
  const InstantQuoteScreen({super.key});
  @override
  State<InstantQuoteScreen> createState() => _InstantQuoteScreenState();
}

class _InstantQuoteScreenState extends State<InstantQuoteScreen> {
  _Cat? _cat;
  Map<String, dynamic>? _task;
  final Map<String, String> _details = {};
  final _notes = TextEditingController();
  Map<String, dynamic>? _quote;
  bool _loading = false;

  List<dynamic> get _taskDetails => (_task?['details'] as List?) ?? const [];
  bool get _allFilled => _taskDetails.every((d) => _details.containsKey(d['key']));

  Future<void> _calculate() async {
    if (_cat == null || _task == null) return;
    setState(() => _loading = true);
    try {
      final res = await Api.post('/ai/instant-quote', {
        'category': _cat!.api,
        'task': _task!['label'],
        'details': _details,
        if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
      });
      if (res.statusCode == 200) {
        setState(() => _quote = jsonDecode(res.body) as Map<String, dynamic>);
      } else {
        _toast('instantQuote.quoteFailed'.tr());
      }
    } catch (_) {
      _toast('diagnose.connectFailed'.tr());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.bg, surfaceTintColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.chevron_left, color: C.ink, size: 30), onPressed: () => context.pop()),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('instantQuote.title'.tr(), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: C.ink)),
            const SizedBox(height: 4),
            Text('instantQuote.subtitle'.tr(), style: const TextStyle(color: C.muted, fontSize: 15)),
            const SizedBox(height: 20),
            _stepDots(),
            const SizedBox(height: 20),
            if (_quote != null) _quoteCard() else ..._form(),
          ],
        ),
      ),
    );
  }

  Widget _stepDots() {
    final s1 = _cat != null, s2 = _task != null, s3 = _allFilled && _taskDetails.isNotEmpty;
    Widget dot(int n, bool active, bool done) => Container(
          width: 28, height: 28,
          decoration: BoxDecoration(color: done ? C.green : active ? C.blue : const Color(0xFFE2E8F0), shape: BoxShape.circle),
          child: Center(child: done ? const Icon(Icons.check, size: 16, color: Colors.white) : Text('$n', style: TextStyle(fontWeight: FontWeight.w900, color: active ? Colors.white : C.muted, fontSize: 12))),
        );
    Widget seg(String label, Widget d) => Expanded(child: Column(children: [d, const SizedBox(height: 4), Text(label, style: const TextStyle(fontSize: 12, color: C.muted, fontWeight: FontWeight.w700))]));
    return Row(children: [
      seg('instantQuote.stepService'.tr(), dot(1, !s1, s1)),
      seg('instantQuote.stepTask'.tr(), dot(2, s1 && !s2, s2)),
      seg('instantQuote.stepDetails'.tr(), dot(3, s2 && !s3, s3)),
    ]);
  }

  List<Widget> _form() {
    return [
      // Step 1 — Service
      Text('instantQuote.chooseService'.tr(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
      const SizedBox(height: 12),
      Wrap(spacing: 10, runSpacing: 10, children: _cats.map((c) {
        final sel = _cat?.name == c.name;
        return GestureDetector(
          onTap: () => setState(() { _cat = c; _task = null; _details.clear(); }),
          child: Container(
            width: 100,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: sel ? C.blue : C.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: sel ? C.blue : C.line),
            ),
            child: Column(children: [
              Icon(c.icon, size: 28, color: sel ? Colors.white : C.blue),
              const SizedBox(height: 6),
              Text(c.nameKey.tr(), textAlign: TextAlign.center, style: TextStyle(color: sel ? Colors.white : C.ink, fontWeight: FontWeight.w700)),
            ]),
          ),
        );
      }).toList()),
      // Step 2 — Task
      if (_cat != null) ...[
        const SizedBox(height: 22),
        Text('postjob.needTitle'.tr(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 8, children: (_tasks[_cat!.name] ?? []).map((t) {
          final sel = _task?['label'] == t['label'];
          return _chip(t['label'] as String, sel, () => setState(() { _task = t; _details.clear(); }));
        }).toList()),
      ],
      // Step 3 — Details
      if (_task != null) ...[
        const SizedBox(height: 22),
        Text('instantQuote.aFewDetails'.tr(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
        const SizedBox(height: 4),
        ..._taskDetails.map((d) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 12),
                Text(d['label'] as String, style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink)),
                const SizedBox(height: 8),
                Wrap(spacing: 8, runSpacing: 8, children: (d['options'] as List).map<Widget>((o) {
                  final sel = _details[d['key']] == o;
                  return _chip(o as String, sel, () => setState(() => _details[d['key'] as String] = o));
                }).toList()),
              ],
            )),
        const SizedBox(height: 20),
        Text('instantQuote.addMoreTitle'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
        const SizedBox(height: 2),
        Text('instantQuote.addMoreDesc'.tr(), style: const TextStyle(color: C.muted, fontSize: 13, height: 1.4)),
        const SizedBox(height: 10),
        TextField(
          controller: _notes,
          maxLines: 3,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: 'instantQuote.notesHint'.tr(),
            filled: true, fillColor: C.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: C.line)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: C.line)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: C.blue)),
          ),
        ),
      ],
      const SizedBox(height: 24),
      if (_task != null)
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
            onPressed: (_allFilled && !_loading) ? _calculate : null,
            child: _loading
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text('instantQuote.calculatePrice'.tr(), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
          ),
        ),
    ];
  }

  Widget _chip(String label, bool sel, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: sel ? C.blue : C.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: sel ? C.blue : C.line),
          ),
          child: Text(label, style: TextStyle(color: sel ? Colors.white : C.ink, fontWeight: FontWeight.w700)),
        ),
      );

  Widget _quoteCard() {
    final q = _quote!;
    final guaranteed = (q['confidence'] ?? '') == 'guaranteed';
    final includes = (q['includes'] as List?) ?? const [];
    final note = (q['note'] ?? '').toString();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(20)),
      child: Column(children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: (guaranteed ? C.green : C.amber).withValues(alpha: 0.14), borderRadius: BorderRadius.circular(20)),
          child: Text(guaranteed ? 'instantQuote.guaranteed'.tr() : 'instantQuote.estimate'.tr(), style: TextStyle(color: guaranteed ? C.green : C.amber, fontWeight: FontWeight.w800)),
        ),
        const SizedBox(height: 14),
        Text('\$${(q['minPrice'] as num?)?.round()}–${(q['maxPrice'] as num?)?.round()}',
            style: const TextStyle(fontSize: 48, fontWeight: FontWeight.w900, color: C.ink, height: 1.1)),
        if ((q['duration'] ?? '').toString().isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(q['duration'].toString(), style: const TextStyle(color: C.muted, fontWeight: FontWeight.w600)),
        ],
        if (includes.isNotEmpty) ...[
          const SizedBox(height: 20),
          Align(alignment: Alignment.centerLeft, child: Text('instantQuote.whatsIncluded'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16))),
          const SizedBox(height: 8),
          ...includes.map((it) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Icon(Icons.check_circle, color: C.green, size: 18),
                  const SizedBox(width: 8),
                  Expanded(child: Text(it.toString(), style: const TextStyle(color: C.ink, height: 1.3))),
                ]),
              )),
        ],
        if (note.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0x14F97316), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0x33F97316))),
            child: Text('📋  $note', style: const TextStyle(color: Color(0xFFB45309), fontSize: 13, height: 1.5)),
          ),
        ],
        const SizedBox(height: 18),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: C.blue, padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
            onPressed: () => context.push('/post-job'),
            child: Text('instantQuote.postThisJobArrow'.tr(), textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
          ),
        ),
        const SizedBox(height: 8),
        TextButton(onPressed: () => setState(() => _quote = null), child: Text('instantQuote.editAnswers'.tr(), style: const TextStyle(color: C.muted, fontWeight: FontWeight.w700))),
      ]),
    );
  }
}
