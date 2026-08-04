import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';
import '../api.dart';

class _Urgency {
  final String value, label, desc;
  final IconData icon;
  final Color color;
  const _Urgency(this.value, this.label, this.desc, this.icon, this.color);
}

const _urgencies = [
  _Urgency('STANDARD', 'Standard', 'Within a few days', Icons.schedule, C.blue),
  _Urgency('SOON', 'Soon', 'Within 24–48 hours', Icons.schedule, C.amber),
  _Urgency('URGENT', 'Urgent', 'As soon as possible', Icons.bolt, C.red),
];

const _categories = [
  'Plumbing', 'Electrical', 'Painting', 'Assembly', 'Cleaning', 'HVAC',
  'Roofing', 'Landscaping', 'Moving', 'Appliance', 'Laundry', 'General',
];

const _steps = ['Details', 'Schedule', 'Location', 'Review'];

class PostJobScreen extends StatefulWidget {
  final Map<String, dynamic>? directed;
  const PostJobScreen({super.key, this.directed});
  @override
  State<PostJobScreen> createState() => _PostJobScreenState();
}

class _PostJobScreenState extends State<PostJobScreen> {
  int _step = 0;
  String _urgency = 'STANDARD';
  String _category = '';

  bool get _isDirected => widget.directed != null;
  String get _proName => (widget.directed?['proName'] ?? 'the pro').toString().split(' ').first;

  @override
  void initState() {
    super.initState();
    final d = widget.directed;
    if (d != null && (d['category'] ?? '').toString().isNotEmpty) {
      final cat = d['category'].toString();
      _category = cat.isNotEmpty ? cat[0].toUpperCase() + cat.substring(1).toLowerCase() : '';
    }
  }
  final _desc = TextEditingController();
  DateTime? _date;
  TimeOfDay? _time;
  final _address = TextEditingController();
  final _city = TextEditingController();
  bool _submitting = false;
  Map<String, dynamic>? _estimate;
  bool _aiLoading = false;

  // AI fixes a fair price from the job details (called on the Review step),
  // mirroring the RN flow — the price is set by AI before you post.
  Future<void> _fetchAiPrice() async {
    if (_desc.text.trim().isEmpty || _aiLoading) return;
    setState(() => _aiLoading = true);
    try {
      final res = await Api.post('/ai/price-estimate', {
        'category': _category.toUpperCase(),
        'description': _desc.text.trim(),
        'city': _city.text.trim(),
        'urgent': _urgency == 'URGENT',
      });
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body) as Map<String, dynamic>;
        if (d['price'] != null || (d['min'] != null && d['max'] != null)) {
          setState(() => _estimate = d);
        }
      }
    } catch (_) {/* price stays open if AI unavailable */}
    if (mounted) setState(() => _aiLoading = false);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: _date ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (d != null) setState(() => _date = d);
  }

  Future<void> _pickTime() async {
    final t = await showTimePicker(context: context, initialTime: _time ?? TimeOfDay.now());
    if (t != null) setState(() => _time = t);
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      if (_isDirected) {
        // Directed booking — request goes to one specific pro.
        final price = _estimate?['price'] ?? _estimate?['min'] ?? widget.directed?['serviceMin'];
        await Api.post('/bookings', {
          'handymanUserId': widget.directed?['handymanId'],
          if (widget.directed?['serviceId'] != null) 'serviceId': widget.directed?['serviceId'],
          'scheduledAt': (_date ?? DateTime.now().add(const Duration(days: 1))).toIso8601String(),
          'address': _address.text.trim(),
          'city': _city.text.trim(),
          if (price != null) 'totalPrice': price,
          'description': _desc.text.trim(),
        });
      } else {
        await Api.post('/job-requests', {
          'category': _category.toUpperCase(),
          'description': _desc.text.trim(),
          'urgency': _urgency,
          'scheduledAt': _date?.toIso8601String(),
          'address': _address.text.trim(),
          'city': _city.text.trim(),
        });
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_isDirected ? 'Request sent to $_proName!' : 'Job posted!')));
        context.go('/home');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not post job.')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _next() {
    if (_step < 3) {
      setState(() => _step++);
      if (_step == 3) _fetchAiPrice();
    } else {
      _submit();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _circleBtn(Icons.chevron_left, () => _step > 0 ? setState(() => _step--) : (context.canPop() ? context.pop() : context.go('/home'))),
                  Flexible(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(_isDirected ? 'Request $_proName' : 'Post a Job',
                            maxLines: 1, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink)),
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Draft saved'))),
                    child: const Text('Save Draft', style: TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: Text('Tell us what you need and get matched with trusted pros.',
                  textAlign: TextAlign.center, style: TextStyle(color: C.muted, fontSize: 15)),
            ),
            const SizedBox(height: 16),
            _stepper(),
            const SizedBox(height: 16),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _stepBody(),
              ),
            ),
            // Continue / Accept
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: C.blue,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                      ),
                      onPressed: _submitting ? null : _next,
                      child: _submitting
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(_step < 3 ? 'Continue' : (_isDirected ? 'Send request to $_proName' : 'Accept estimate & post job'),
                                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                                const SizedBox(width: 10),
                                Container(
                                  width: 30, height: 30,
                                  decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                                  child: const Icon(Icons.arrow_forward, size: 18, color: C.blue),
                                ),
                              ],
                            ),
                    ),
                  ),
                  if (_step == 3) ...[
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        GestureDetector(
                          onTap: () => setState(() => _step = 0),
                          child: const Text('Edit details', style: TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
                        ),
                        const Text('Request an in-person quote', style: TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _circleBtn(IconData icon, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: C.white, shape: BoxShape.circle, border: Border.all(color: C.line)),
          child: Icon(icon, color: C.ink),
        ),
      );

  Widget _stepper() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: List.generate(_steps.length, (i) {
          final active = i == _step;
          final done = i < _step;
          return Expanded(
            child: Column(
              children: [
                Row(
                  children: [
                    if (i > 0) Expanded(child: Container(height: 2, color: done || active ? C.blue : C.line)),
                    Container(
                      width: 34, height: 34,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: active || done ? C.blue : C.white,
                        border: Border.all(color: active || done ? C.blue : C.line, width: 2),
                      ),
                      child: Center(
                        child: done
                            ? const Icon(Icons.check, size: 18, color: Colors.white)
                            : Text('${i + 1}', style: TextStyle(color: active ? Colors.white : C.muted, fontWeight: FontWeight.w800)),
                      ),
                    ),
                    if (i < _steps.length - 1) Expanded(child: Container(height: 2, color: done ? C.blue : C.line)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(_steps[i], style: TextStyle(fontSize: 13, color: active ? C.blue : C.muted, fontWeight: FontWeight.w800)),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _stepBody() {
    switch (_step) {
      case 0:
        return _details();
      case 1:
        return _schedule();
      case 2:
        return _location();
      default:
        return _review();
    }
  }

  Widget _card(List<Widget> children) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(18)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
      );

  Widget _details() {
    return Column(
      children: [
        _card([
          const Text('How urgent is this?', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
          const SizedBox(height: 14),
          Row(
            children: _urgencies.map((u) {
              final sel = _urgency == u.value;
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _urgency = u.value),
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: sel ? const Color(0xFFEFF5FF) : C.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: sel ? C.blue : C.line, width: sel ? 2 : 1),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(u.icon, color: u.color, size: 22),
                        const SizedBox(height: 10),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(u.label, maxLines: 1, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: C.ink)),
                        ),
                        const SizedBox(height: 4),
                        Text(u.desc, style: const TextStyle(fontSize: 12, color: C.muted, height: 1.2)),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ]),
        _card([
          const Text('What do you need?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: C.ink)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8, runSpacing: 8,
            children: _categories.map((c) {
              final sel = _category == c;
              return GestureDetector(
                onTap: () => setState(() => _category = c),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                  decoration: BoxDecoration(
                    color: sel ? C.blue : C.surface,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(c, style: TextStyle(color: sel ? Colors.white : C.ink, fontWeight: FontWeight.w700)),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _desc,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: 'Describe the job…',
              filled: true, fillColor: C.surface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            ),
          ),
        ]),
      ],
    );
  }

  Widget _schedule() {
    return _card([
      const Text('When do you need it?', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
      const SizedBox(height: 6),
      const Text('Pick a preferred date and time — you can adjust with your pro later.',
          style: TextStyle(color: C.muted, height: 1.4)),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: _pickerPill(Icons.calendar_today_outlined,
            _date == null ? 'Date' : '${_date!.month}/${_date!.day}/${_date!.year}', _pickDate)),
        const SizedBox(width: 12),
        Expanded(child: _pickerPill(Icons.access_time,
            _time == null ? 'Time' : _time!.format(context), _pickTime)),
      ]),
    ]);
  }

  Widget _pickerPill(IconData icon, String label, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
          decoration: BoxDecoration(border: Border.all(color: C.line), borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            Icon(icon, size: 18, color: C.muted),
            const SizedBox(width: 10),
            Text(label, style: const TextStyle(fontSize: 15, color: C.ink, fontWeight: FontWeight.w600)),
          ]),
        ),
      );

  Widget _location() {
    return _card([
      const Text('Where is the job?', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: C.ink)),
      const SizedBox(height: 16),
      _input(_address, 'Street address', Icons.location_on_outlined),
      const SizedBox(height: 12),
      _input(_city, 'City', Icons.location_city_outlined),
    ]);
  }

  Widget _input(TextEditingController c, String hint, IconData icon) => Container(
        decoration: BoxDecoration(border: Border.all(color: C.line), borderRadius: BorderRadius.circular(14)),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(children: [
          Icon(icon, size: 20, color: C.muted),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: c,
              decoration: InputDecoration(
                hintText: hint, border: InputBorder.none, isCollapsed: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 18),
              ),
            ),
          ),
        ]),
      );

  int _n(dynamic v) => (v is num) ? v.round() : 0;

  Color _confColor(String label) {
    final l = label.toLowerCase();
    if (l.startsWith('high')) return C.green;
    if (l.startsWith('med')) return C.amber;
    return C.red;
  }

  String _weekday(DateTime d) {
    const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${wd[d.weekday - 1]}, ${mo[d.month - 1]} ${d.day}';
  }

  Widget _review() {
    if (_aiLoading) {
      return _card([
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 40),
          child: Center(
            child: Column(children: [
              CircularProgressIndicator(),
              SizedBox(height: 14),
              Text('Calculating a fair price…', style: TextStyle(color: C.muted)),
            ]),
          ),
        ),
      ]);
    }
    final e = _estimate;
    if (e == null) {
      return _card([
        const Text('Add a description on the Details step so Tarea can estimate your price.',
            style: TextStyle(color: C.muted, height: 1.4)),
      ]);
    }
    final fixed = e['isFixed'] == true && e['price'] != null;
    final priceText = fixed ? '\$${_n(e['price'])}' : '\$${_n(e['min'])}–\$${_n(e['max'])}';
    final bd = (e['breakdown'] as Map?) ?? const {};
    final confLabel = (e['confidenceLabel'] ?? 'Medium').toString();
    final confPct = _n(e['confidence']);
    final included = (e['included'] as List?) ?? const [];

    return _card([
      Center(child: Text(priceText, style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: C.blue))),
      Center(
        child: Text(fixed ? 'Fixed price' : 'Estimated range',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: C.muted)),
      ),
      const SizedBox(height: 16),
      Container(
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(14)),
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(children: [
          Expanded(child: _splitCell('Labor & service', '\$${_n(bd['labor'])}')),
          Container(width: 1, height: 40, color: C.line),
          Expanded(child: _splitCell('Materials & furniture', '\$${_n(bd['materials'])}')),
        ]),
      ),
      const SizedBox(height: 16),
      const Divider(color: C.line, height: 1),
      const SizedBox(height: 14),
      Row(children: [
        Expanded(child: _statCell('Estimated work time', (e['workTime'] ?? '—').toString())),
        Expanded(child: _statCell('Minimum appointment', '${_n(e['minWindow'])} hours')),
      ]),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: _statCell('Earliest availability', _date != null ? _weekday(_date!) : 'Flexible')),
        Expanded(child: _statCell('Confidence', '$confLabel — $confPct%', color: _confColor(confLabel))),
      ]),
      if (included.isNotEmpty) ...[
        const SizedBox(height: 18),
        const Text('Included', style: TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 15)),
        const SizedBox(height: 10),
        ...included.map((it) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.check_circle, color: C.green, size: 20),
                const SizedBox(width: 10),
                Expanded(child: Text(it.toString(), style: const TextStyle(color: C.ink, height: 1.3))),
              ]),
            )),
      ],
    ]);
  }

  Widget _splitCell(String label, String value) => Column(children: [
        Text(label, textAlign: TextAlign.center, style: const TextStyle(color: C.muted, fontSize: 13)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: C.ink)),
      ]);

  Widget _statCell(String label, String value, {Color color = C.ink}) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: C.muted, fontSize: 13)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: color)),
        ],
      );
}
