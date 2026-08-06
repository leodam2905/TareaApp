import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../theme.dart';
import '../../api.dart';
import '../../avatar_util.dart';

class ProProfile extends StatefulWidget {
  const ProProfile({super.key});
  @override
  State<ProProfile> createState() => _ProProfileState();
}

class _ProProfileState extends State<ProProfile> {
  String _name = '';
  String _avatar = '';
  String _city = '';
  String _state = '';
  double _rating = 0;
  int _jobs = 0;
  int _reviews = 0;
  int _pct = 0;
  bool _verified = false;
  bool _licensed = false;
  bool _available = false;
  bool _busy = false;
  List<dynamic> _services = [];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await Api.get('/profile');
      if (res.statusCode == 200) {
        final p = jsonDecode(res.body) as Map<String, dynamic>;
        _name = (p['name'] ?? '').toString();
        _avatar = (p['avatarUrl'] ?? '').toString();
        _city = (p['city'] ?? '').toString();
        _state = (p['state'] ?? '').toString();
        _verified = p['isVerified'] == true;
        final hp = p['handymanProfile'] ?? {};
        _rating = ((hp['rating']) as num?)?.toDouble() ?? 0;
        _jobs = (hp['totalJobs'] ?? 0) as int;
        _available = hp['isAvailable'] == true;
        _licensed = (hp['licenseDocUrl'] != null && hp['insuranceDocUrl'] != null);
        _services = (hp['services'] as List?) ?? [];
        _city = _city.isEmpty ? (hp['city'] ?? '').toString() : _city;
        _state = _state.isEmpty ? (hp['state'] ?? '').toString() : _state;
      }
    } catch (_) {}
    try {
      final r = await Api.get('/reviews/received');
      if (r.statusCode == 200) {
        final d = jsonDecode(r.body);
        _reviews = (d is List ? d : (d['reviews'] ?? [])).length;
      }
    } catch (_) {}
    try {
      final c = await Api.get('/handyman/checklist');
      if (c.statusCode == 200) {
        final cj = jsonDecode(c.body);
        if (cj is Map && cj.isNotEmpty) {
          final done = cj.values.where((v) => v == true || (v is String && v.isNotEmpty)).length;
          _pct = (done / cj.length * 100).round();
        }
      }
    } catch (_) {}
    if (mounted) setState(() {});
  }

  void _menu() {
    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.logout, color: C.red), title: Text('settings.logout'.tr(), style: const TextStyle(color: C.red, fontWeight: FontWeight.w700)),
              onTap: () async { Navigator.pop(context); await Api.clearToken(); if (mounted) context.go('/'); }),
        ]),
      ),
    );
  }

  Future<void> _signOut() async {
    await Api.clearToken();
    if (mounted) context.go('/');
  }

  Future<void> _deleteAccount() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('profile.deleteTitle'.tr()),
        content: Text('profile.deleteBody'.tr()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text('common.cancel'.tr())),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text('common.delete'.tr(), style: const TextStyle(color: C.red, fontWeight: FontWeight.w800))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final res = await Api.delete('/account');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await Api.clearToken();
        if (mounted) context.go('/');
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('profile.deleteFailed'.tr())));
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('common.connectionRetry'.tr())));
    }
  }

  Future<void> _toggleAvailable(bool next) async {
    setState(() { _available = next; _busy = true; });
    try {
      final res = await Api.patch('/profile', {'isAvailable': next});
      if (res.statusCode < 200 || res.statusCode >= 300) setState(() => _available = !next);
    } catch (_) { setState(() => _available = !next); }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final place = [_city, _state].where((e) => e.isNotEmpty).join(', ');
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          // Blue header
          Container(
            color: C.blue,
            padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 12, bottom: 14, left: 20, right: 20),
            child: Row(children: [
              const SizedBox(width: 24),
              Expanded(child: Text('proProfile.title'.tr(), textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900))),
              GestureDetector(onTap: _menu, child: const Icon(Icons.settings_outlined, color: Colors.white)),
            ]),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
              children: [
                // Identity
                Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                  GestureDetector(
                    onTap: () async { final u = await pickAndUploadAvatar(context); if (u != null && mounted) setState(() => _avatar = u); },
                    child: Stack(clipBehavior: Clip.none, children: [
                      roundAvatar(url: _avatar, radius: 44),
                      Positioned(right: -2, bottom: -2, child: Container(
                        width: 28, height: 28,
                        decoration: BoxDecoration(color: C.blue, shape: BoxShape.circle, border: Border.all(color: C.white, width: 3)),
                        child: const Icon(Icons.camera_alt, size: 13, color: Colors.white),
                      )),
                    ]),
                  ),
                  const SizedBox(width: 16),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_name.isEmpty ? 'proProfile.yourName'.tr() : _name, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink)),
                    const SizedBox(height: 4),
                    Row(children: [
                      const Icon(Icons.work_outline, size: 16, color: C.muted),
                      const SizedBox(width: 6),
                      Text(_licensed ? 'proProfile.licensedHandyman'.tr() : 'dashboard.handyman'.tr(), style: const TextStyle(color: C.muted, fontWeight: FontWeight.w600)),
                    ]),
                    if (place.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Row(children: [
                        const Icon(Icons.location_on_outlined, size: 16, color: C.muted),
                        const SizedBox(width: 6),
                        Flexible(child: Text(place, style: const TextStyle(color: C.muted, fontWeight: FontWeight.w600))),
                      ]),
                    ],
                  ])),
                ]),
                const SizedBox(height: 14),
                // Badges
                Row(children: [
                  _badge(Icons.verified, const Color(0xFF16A34A), 'proProfile.verified'.tr(), _verified),
                  Container(width: 1, height: 20, color: C.line),
                  _badge(Icons.badge_outlined, C.blue, 'proProfile.licensed'.tr(), _licensed),
                  Container(width: 1, height: 20, color: C.line),
                  _badge(Icons.shield_outlined, C.blue, 'proProfile.insured'.tr(), _licensed),
                ]),
                const SizedBox(height: 18),
                // Stats
                Row(children: [
                  Expanded(child: Column(children: [
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      const Icon(Icons.star, color: Color(0xFFF59E0B), size: 22),
                      const SizedBox(width: 6),
                      Text(_rating > 0 ? _rating.toStringAsFixed(1) : 'browse.newRating'.tr(), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink)),
                    ]),
                    Text('proProfile.reviews'.tr(args: ['$_reviews']), style: const TextStyle(color: C.muted)),
                  ])),
                  Container(width: 1, height: 44, color: C.line),
                  Expanded(child: Column(children: [
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      const Icon(Icons.work, color: C.blue, size: 20),
                      const SizedBox(width: 6),
                      Text('$_jobs', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: C.ink)),
                    ]),
                    Text('proProfile.completedJobs'.tr(), style: const TextStyle(color: C.muted)),
                  ])),
                ]),
                const SizedBox(height: 18),
                // Edit Profile
                SizedBox(width: double.infinity, child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(side: const BorderSide(color: C.blue), padding: const EdgeInsets.symmetric(vertical: 15), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                  onPressed: () => context.push('/pro/edit-profile').then((_) { if (mounted) _load(); }),
                  icon: const Icon(Icons.edit_outlined, size: 18, color: C.blue),
                  label: Text('editProfile.title'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800, fontSize: 16)),
                )),
                const SizedBox(height: 16),
                // Profile completeness
                _card(Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('proProfile.percentComplete'.tr(args: ['$_pct']), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 17)),
                    const SizedBox(height: 12),
                    ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: _pct / 100, minHeight: 8, backgroundColor: const Color(0xFFE2E8F0), color: C.blue)),
                  ])),
                  const SizedBox(width: 16),
                  SizedBox(width: 56, height: 56, child: Stack(alignment: Alignment.center, children: [
                    SizedBox(width: 56, height: 56, child: CircularProgressIndicator(value: _pct / 100, strokeWidth: 5, backgroundColor: const Color(0xFFE2E8F0), color: C.blue)),
                    Text('$_pct%', style: const TextStyle(fontWeight: FontWeight.w900, color: C.blue, fontSize: 13)),
                  ])),
                ])),
                const SizedBox(height: 14),
                // Available toggle
                _card(Row(children: [
                  Container(width: 44, height: 44, decoration: const BoxDecoration(color: Color(0xFF16A34A), shape: BoxShape.circle), child: const Icon(Icons.check, color: Colors.white)),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('proProfile.availableForJobs'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 16)),
                    Text('proProfile.availableDesc'.tr(), style: const TextStyle(color: C.muted, fontSize: 13, height: 1.3)),
                  ])),
                  Switch(value: _available, activeColor: C.blue, onChanged: _busy ? null : _toggleAvailable),
                ])),
                const SizedBox(height: 14),
                // Services
                _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text('proProfile.services'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 17)),
                    GestureDetector(onTap: () => context.push('/pro/services').then((_) { if (mounted) _load(); }), child: Text('common.edit'.tr(), style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800))),
                  ]),
                  const SizedBox(height: 14),
                  _services.isEmpty
                      ? Text('proProfile.noServices'.tr(), style: const TextStyle(color: C.muted))
                      : Row(children: _services.take(3).map<Widget>((sv) => Expanded(child: Row(children: [
                          Icon(_svcIcon((sv['category'] ?? '').toString()), color: C.blue, size: 22),
                          const SizedBox(width: 6),
                          Flexible(child: Text(_pretty((sv['category'] ?? sv['title'] ?? '').toString()), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.ink, fontWeight: FontWeight.w600, fontSize: 13))),
                        ]))).toList()),
                ])),
                const SizedBox(height: 14),
                // 2x2 grid
                Row(children: [
                  _tile(Icons.location_on, 'proProfile.serviceArea'.tr(), place.isEmpty ? 'proProfile.setYourArea'.tr() : 'proProfile.areaSurrounding'.tr(args: [place]), () => context.push('/pro/service-area').then((_) { if (mounted) _load(); })),
                  _tile(Icons.photo_library_outlined, 'proProfile.portfolio'.tr(), 'proProfile.portfolioSub'.tr(), () => context.push('/pro/portfolio')),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  _tile(Icons.verified_user_outlined, 'proProfile.certifications'.tr(), 'proProfile.certificationsSub'.tr(), () => context.push('/pro/certifications').then((_) { if (mounted) _load(); })),
                  _tile(Icons.star_outline, 'proProfile.reviewsTile'.tr(), 'proProfile.reviewsSub'.tr(args: ['$_reviews', _rating > 0 ? _rating.toStringAsFixed(1) : 'browse.newRating'.tr()]), () => context.push('/pro/reviews')),
                ]),
                const SizedBox(height: 22),
                // Account
                Text('proProfile.account'.tr(), style: const TextStyle(fontWeight: FontWeight.w900, color: C.muted, fontSize: 13, letterSpacing: 0.3)),
                const SizedBox(height: 10),
                SizedBox(width: double.infinity, child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(side: const BorderSide(color: C.line), padding: const EdgeInsets.symmetric(vertical: 15), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                  onPressed: _signOut,
                  icon: const Icon(Icons.logout, size: 18, color: C.ink),
                  label: Text('proProfile.signOut'.tr(), style: const TextStyle(color: C.ink, fontWeight: FontWeight.w800, fontSize: 16)),
                )),
                const SizedBox(height: 10),
                SizedBox(width: double.infinity, child: TextButton.icon(
                  style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13)),
                  onPressed: _deleteAccount,
                  icon: const Icon(Icons.delete_outline, size: 18, color: C.red),
                  label: Text('settings.deleteAccount'.tr(), style: const TextStyle(color: C.red, fontWeight: FontWeight.w800, fontSize: 15)),
                )),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _badge(IconData icon, Color color, String label, bool active) => Expanded(
        child: Opacity(
          opacity: active ? 1 : 0.4,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, color: color, size: 17),
            const SizedBox(width: 5),
            Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 13))),
          ]),
        ),
      );

  Widget _card(Widget child) => Container(
        width: double.infinity, padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
        child: child,
      );

  Widget _tile(IconData icon, String title, String sub, VoidCallback onTap) => Expanded(
        child: GestureDetector(
          onTap: onTap,
          child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4), padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: C.white, borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            Container(width: 40, height: 40, decoration: BoxDecoration(color: C.blue.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(20)), child: Icon(icon, color: C.blue, size: 20)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900, color: C.ink, fontSize: 14)),
              Text(sub, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted, fontSize: 12, height: 1.2)),
            ])),
          ]),
        ),
        ),
      );

  IconData _svcIcon(String c) {
    switch (c.toUpperCase()) {
      case 'PLUMBING': return Icons.water_drop_outlined;
      case 'ELECTRICAL': return Icons.bolt_outlined;
      case 'PAINTING': return Icons.format_paint_outlined;
      case 'CARPENTRY': return Icons.handyman_outlined;
      case 'CLEANING': return Icons.auto_awesome_outlined;
      default: return Icons.build_outlined;
    }
  }

  String _pretty(String c) => c.isEmpty ? 'proProfile.serviceFallback'.tr() : c[0].toUpperCase() + c.substring(1).toLowerCase().replaceAll('_', ' ');
}
