// Weekly availability — the hours a pro is willing to work.
//
// WHY THIS SCREEN EXISTS
//
// /api/handyman/availability has been on the server all along and no Flutter
// screen ever wrote to it. The setup checklist counts availability rows, so
// `availabilityCount` stayed 0 forever: a pro could never reach 100% completion
// from the app, and the ring on the dashboard sat below full with nothing they
// could do about it. This is the missing surface.
//
// ONE SLOT PER DAY
//
// The table is uniquely keyed on (profileId, dayOfWeek), so a day has exactly
// one window. Split shifts are not expressible and the UI does not pretend
// otherwise.
//
// THE SERVER WILL NOT ACCEPT AN EMPTY WEEK
//
// POST deliberately ignores an empty list so an accidental empty save cannot
// erase saved hours. That means "no days selected" is not a state the server
// can be put into, and a screen that let a pro switch everything off and tap
// Save would report success while changing nothing. So Save is disabled with an
// explanation when no day is on, rather than lying about what happened.

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

import '../../theme.dart';
import '../../api.dart';

class ProAvailability extends StatefulWidget {
  const ProAvailability({super.key});
  @override
  State<ProAvailability> createState() => _ProAvailabilityState();
}

class _Day {
  _Day(this.weekday);
  final int weekday; // 0 = Sunday, matching the server's dayOfWeek
  bool on = false;
  int start = 8;
  int end = 17;
}

class _ProAvailabilityState extends State<ProAvailability> {
  final List<_Day> _days = List.generate(7, (i) => _Day(i));
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await Api.get('/handyman/availability');
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        final rows = body is List ? body : (body['availability'] ?? []);
        for (final r in rows) {
          final d = (r['dayOfWeek'] as num?)?.toInt();
          if (d == null || d < 0 || d > 6) continue;
          _days[d]
            ..on = true
            ..start = (r['startHour'] as num?)?.toInt() ?? 8
            ..end = (r['endHour'] as num?)?.toInt() ?? 17;
        }
      }
    } catch (_) {
      // Leave the defaults; the pro can still set hours and save.
    }
    if (mounted) setState(() => _loading = false);
  }

  bool get _anyDayOn => _days.any((d) => d.on);

  /// True when a selected day has an end at or before its start — that window
  /// describes no time at all, and the server would store it happily.
  bool get _hasInvalidWindow => _days.any((d) => d.on && d.end <= d.start);

  Future<void> _save() async {
    if (!_anyDayOn || _hasInvalidWindow) return;
    setState(() => _saving = true);
    try {
      final slots = _days
          .where((d) => d.on)
          .map((d) => {'dayOfWeek': d.weekday, 'startHour': d.start, 'endHour': d.end})
          .toList();
      final res = await Api.post('/handyman/availability', {'slots': slots});
      if (!mounted) return;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('proAvailability.saved'.tr())));
        Navigator.of(context).pop(true);
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('proAvailability.saveFailed'.tr())));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('common.connectionRetry'.tr())));
      }
    }
    if (mounted) setState(() => _saving = false);
  }

  String _hour(int h) {
    final suffix = h < 12 ? 'AM' : 'PM';
    final display = h % 12 == 0 ? 12 : h % 12;
    return '$display $suffix';
  }

  String _dayName(int weekday) =>
      'proAvailability.day.$weekday'.tr();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.white,
        foregroundColor: C.ink,
        elevation: 0,
        title: Text('proAvailability.title'.tr(),
            style: const TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  children: [
                    Text('proAvailability.subtitle'.tr(),
                        style: const TextStyle(color: C.muted, height: 1.35)),
                    const SizedBox(height: 14),
                    ..._days.map(_dayRow),
                    if (!_anyDayOn) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF4E5),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text('proAvailability.needOneDay'.tr(),
                            style: const TextStyle(color: C.ink, height: 1.35)),
                      ),
                    ],
                  ],
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: C.blue,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed:
                          (_saving || !_anyDayOn || _hasInvalidWindow) ? null : _save,
                      child: Text(
                        _saving ? 'common.saving'.tr() : 'common.save'.tr(),
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16),
                      ),
                    ),
                  ),
                ),
              ),
            ]),
    );
  }

  Widget _dayRow(_Day d) {
    final invalid = d.on && d.end <= d.start;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: C.white,
        borderRadius: BorderRadius.circular(14),
        border: invalid ? Border.all(color: C.red) : null,
      ),
      child: Column(children: [
        Row(children: [
          Expanded(
            child: Text(_dayName(d.weekday),
                style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
          ),
          Switch(
            value: d.on,
            activeThumbColor: C.blue,
            onChanged: (v) => setState(() => d.on = v),
          ),
        ]),
        if (d.on) ...[
          const SizedBox(height: 4),
          Row(children: [
            Expanded(child: _hourPicker(
              label: 'proAvailability.from'.tr(),
              value: d.start,
              onChanged: (v) => setState(() => d.start = v),
            )),
            const SizedBox(width: 12),
            Expanded(child: _hourPicker(
              label: 'proAvailability.to'.tr(),
              value: d.end,
              onChanged: (v) => setState(() => d.end = v),
            )),
          ]),
          if (invalid) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: Text('proAvailability.endAfterStart'.tr(),
                  style: const TextStyle(color: C.red, fontSize: 12.5, fontWeight: FontWeight.w700)),
            ),
          ],
        ],
      ]),
    );
  }

  Widget _hourPicker({
    required String label,
    required int value,
    required ValueChanged<int> onChanged,
  }) {
    return InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        isDense: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: value,
          isExpanded: true,
          items: [
            for (var h = 0; h < 24; h++)
              DropdownMenuItem(value: h, child: Text(_hour(h))),
          ],
          onChanged: (v) => v == null ? null : onChanged(v),
        ),
      ),
    );
  }
}
