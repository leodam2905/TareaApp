import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../api.dart';
import '../../theme.dart';

// The Independent Contractor Agreement — the sixth onboarding step.
//
// The agreement step in the setup checklist used to open /pro/certifications,
// the document-upload screen. That was not a mislinked button: there was no ICA
// screen at all, and nothing in the app ever called /handyman/ica. Since
// bookability requires icaSignedAt, no pro could finish onboarding in the app.
//
// THE TEXT IS NOT IN THIS FILE, DELIBERATELY.
//
// It is fetched from GET /handyman/ica, which serves apps/web/lib/ica-text.ts —
// the same source the web onboarding renders. Pasting a contract into Dart
// would mean a legal edit on the web silently leaves pros here signing an older
// agreement. It is also why nothing here is translated: the app ships in four
// languages, but this contract is governed by California law and its
// arbitration, PAGA and liability clauses are drafted in English. Only the
// surrounding UI is localised.

class ProIca extends StatefulWidget {
  const ProIca({super.key});
  @override
  State<ProIca> createState() => _ProIcaState();
}

class _ProIcaState extends State<ProIca> {
  final _scroll = ScrollController();
  Map<String, dynamic>? _doc;
  bool _loading = true;
  bool _signed = false;
  String? _signedAt;
  bool _reachedEnd = false;
  bool _accepted = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_reachedEnd || !_scroll.hasClients) return;
    // 24px of slack — an exact equality never fires on some devices.
    if (_scroll.offset >= _scroll.position.maxScrollExtent - 24) {
      setState(() => _reachedEnd = true);
    }
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await Api.get('/handyman/ica');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        setState(() {
          _doc = (data['document'] as Map?)?.cast<String, dynamic>();
          _signed = data['signed'] == true;
          _signedAt = data['signedAt']?.toString();
          _loading = false;
        });
        // A very short document may not scroll at all; then there is nothing to
        // reach, and gating the checkbox on scrolling would deadlock the step.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || !_scroll.hasClients) return;
          if (_scroll.position.maxScrollExtent <= 0) setState(() => _reachedEnd = true);
        });
      } else {
        setState(() { _loading = false; _error = 'common.connectionRetry'.tr(); });
      }
    } catch (_) {
      setState(() { _loading = false; _error = 'common.connectionRetry'.tr(); });
    }
  }

  Future<void> _sign() async {
    setState(() => _busy = true);
    try {
      final res = await Api.post('/handyman/ica', {});
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('proIca.signedToast'.tr())));
        Navigator.of(context).pop(true);
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('proIca.signFailed'.tr())));
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('common.connectionRetry'.tr())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(title: Text('proIca.title'.tr())),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _retry()
              : Column(children: [
                  Expanded(child: _document()),
                  _footer(),
                ]),
    );
  }

  Widget _retry() => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(_error!, style: const TextStyle(color: C.muted)),
          const SizedBox(height: 12),
          FilledButton(onPressed: _load, child: Text('common.retry'.tr())),
        ]),
      );

  Widget _document() {
    final d = _doc;
    if (d == null) return _retry();
    final parties = (d['parties'] as Map?)?.cast<String, dynamic>() ?? const {};
    final execution = (d['execution'] as Map?)?.cast<String, dynamic>() ?? const {};

    return Scrollbar(
      controller: _scroll,
      child: SingleChildScrollView(
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text((d['title'] ?? '').toString(),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: C.ink)),
          const SizedBox(height: 6),
          Text((d['subtitle'] ?? '').toString(),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, color: C.muted, height: 1.4)),
          const SizedBox(height: 16),

          // Parties
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE2E8F0)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text((parties['heading'] ?? '').toString(),
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: C.ink)),
              const SizedBox(height: 6),
              for (final r in (parties['rows'] as List? ?? const []))
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: _rich((r as Map)['lead']?.toString(), r['text']?.toString() ?? '', size: 12),
                ),
              const SizedBox(height: 6),
              Text((parties['note'] ?? '').toString(),
                  style: const TextStyle(fontSize: 12, color: C.muted, height: 1.45)),
            ]),
          ),
          const SizedBox(height: 14),

          for (final b in (d['preamble'] as List? ?? const [])) _block(b),

          for (final s in (d['sections'] as List? ?? const [])) ...[
            const SizedBox(height: 14),
            Text('${(s as Map)['number']}. ${s['heading']}',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: C.ink)),
            const SizedBox(height: 6),
            for (final b in (s['blocks'] as List? ?? const [])) _block(b),
          ],

          const SizedBox(height: 18),
          const Divider(),
          const SizedBox(height: 10),
          Text((execution['heading'] ?? '').toString(),
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: C.ink)),
          const SizedBox(height: 6),
          Text((execution['note'] ?? '').toString(),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, color: C.muted, height: 1.5)),
          const SizedBox(height: 10),
          Center(
            child: Column(children: [
              Text((execution['signatureName'] ?? '').toString(),
                  style: const TextStyle(fontSize: 19, fontStyle: FontStyle.italic, color: C.blue)),
              const SizedBox(height: 2),
              Text((execution['signatureTitle'] ?? '').toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 11, color: C.muted)),
              Text((execution['signatureNote'] ?? '').toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 11, color: C.muted)),
            ]),
          ),
          const SizedBox(height: 10),
          Text((execution['footer'] ?? '').toString(),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 10, color: C.muted, height: 1.4)),
        ]),
      ),
    );
  }

  Widget _block(dynamic raw) {
    final b = (raw as Map).cast<String, dynamic>();
    switch ((b['kind'] ?? 'p').toString()) {
      case 'label':
        return Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text((b['text'] ?? '').toString(),
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: C.ink)),
        );
      case 'bullets':
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final it in (b['items'] as List? ?? const []))
              Padding(
                padding: const EdgeInsets.only(bottom: 4, left: 4),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('•  ', style: TextStyle(color: C.muted, height: 1.5)),
                  Expanded(
                    child: _rich((it as Map)['lead']?.toString(), it['text']?.toString() ?? ''),
                  ),
                ]),
              ),
          ]),
        );
      case 'caps':
        final warn = (b['tone'] ?? '').toString() == 'warn';
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: _rich(
            b['lead']?.toString(),
            (b['text'] ?? '').toString(),
            size: 11,
            color: warn ? const Color(0xFFB45309) : C.muted,
            weight: warn ? FontWeight.w700 : FontWeight.w400,
          ),
        );
      default:
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: _rich(b['lead']?.toString(), (b['text'] ?? '').toString()),
        );
    }
  }

  /// A paragraph with an optional bold lead-in, matching the web's <strong>.
  Widget _rich(String? lead, String text,
      {double size = 13, Color color = C.muted, FontWeight weight = FontWeight.w400}) {
    return RichText(
      text: TextSpan(
        style: TextStyle(fontSize: size, color: color, height: 1.5, fontWeight: weight),
        children: [
          if (lead != null && lead.isNotEmpty)
            TextSpan(
              text: '$lead ',
              style: TextStyle(fontWeight: FontWeight.w800, color: C.ink, fontSize: size),
            ),
          TextSpan(text: text),
        ],
      ),
    );
  }

  Widget _footer() {
    if (_signed) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        ),
        child: Row(children: [
          const Icon(Icons.verified_outlined, color: C.green, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _signedAt == null
                  ? 'proIca.alreadySigned'.tr()
                  : 'proIca.signedOn'.tr(args: [_fmt(_signedAt!)]),
              style: const TextStyle(fontWeight: FontWeight.w700, color: C.ink, fontSize: 13),
            ),
          ),
        ]),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        if (!_reachedEnd)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.south, size: 14, color: C.muted),
              const SizedBox(width: 6),
              Text('proIca.scrollToEnd'.tr(),
                  style: const TextStyle(fontSize: 12, color: C.muted)),
            ]),
          ),
        Opacity(
          opacity: _reachedEnd ? 1 : 0.45,
          child: InkWell(
            onTap: _reachedEnd ? () => setState(() => _accepted = !_accepted) : null,
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Checkbox(
                value: _accepted,
                onChanged: _reachedEnd ? (v) => setState(() => _accepted = v ?? false) : null,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text('proIca.accept'.tr(),
                      style: const TextStyle(fontSize: 12.5, color: C.ink, height: 1.4)),
                ),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: C.blue,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: (_reachedEnd && _accepted && !_busy) ? _sign : null,
            child: _busy
                ? const SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text('proIca.signContinue'.tr(),
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
          ),
        ),
      ]),
    );
  }

  String _fmt(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    return DateFormat.yMMMd().format(d.toLocal());
  }
}
