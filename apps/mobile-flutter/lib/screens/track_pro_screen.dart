import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../api.dart';
import '../masked_call.dart';
import '../theme.dart';

/// Shows where the pro is while they are on the way.
///
/// WHAT THIS DELIBERATELY DOES NOT CLAIM
///
/// The pro's position comes from `PATCH /bookings/:id/location`, pushed by a
/// Timer in the pro app every 25 seconds — and only while that app is in the
/// foreground. iOS suspends a backgrounded app, so a pro who pockets their
/// phone stops reporting. The app has no background-location permission on
/// either platform (no UIBackgroundModes `location`, no
/// ACCESS_BACKGROUND_LOCATION), so this cannot be fixed here.
///
/// A map that renders a stale pin as though it were live is worse than no map:
/// it looks precise while being wrong. So the age of the fix is always shown,
/// and once it is clearly old the screen says so plainly rather than implying
/// the pro is parked where the pin sits.
///
/// For the same reason there is no ETA and no route line. Both need the
/// Directions API — a real per-call cost against a position we cannot trust to
/// be current. Distance is derived from the coordinates we already have, and
/// is described as a distance, not a time.
class TrackProScreen extends StatefulWidget {
  final Map<String, dynamic> booking;
  const TrackProScreen({super.key, required this.booking});

  @override
  State<TrackProScreen> createState() => _TrackProScreenState();
}

class _TrackProScreenState extends State<TrackProScreen> with WidgetsBindingObserver {
  GoogleMapController? _map;
  Timer? _poll;

  double? _proLat, _proLng;
  DateTime? _fixedAt;
  bool _loading = true;

  /// A position older than this is not presented as a live location.
  static const _staleAfter = Duration(minutes: 2);

  Map<String, dynamic> get _b => widget.booking;
  String get _id => (_b['id'] ?? '').toString();
  String get _proName => (_b['handyman']?['name'] ?? _b['handymanName'] ?? '').toString();

  // A Booking stores an address, not coordinates, so the destination is
  // geocoded server-side and asked for once when the screen opens.
  double? _destLat, _destLng;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _poll = Timer.periodic(const Duration(seconds: 20), (_) => _load());
  }

  @override
  void dispose() {
    _poll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _map?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Polling stops while backgrounded, so catch up on the way back in.
    if (state == AppLifecycleState.resumed) _load();
  }

  Future<void> _load() async {
    try {
        // Ask for the destination only until we have it — one geocode per view.
      final wantDest = _destLat == null;
      final res = await Api.get('/bookings/$_id/location${wantDest ? '?destination=1' : ''}');
      if (res.statusCode == 200) {
        final d = jsonDecode(res.body) as Map<String, dynamic>;
        final dest = d['destination'];
        if (dest is Map) {
          _destLat = (dest['lat'] as num?)?.toDouble();
          _destLng = (dest['lng'] as num?)?.toDouble();
        }
        final lat = (d['lat'] as num?)?.toDouble();
        final lng = (d['lng'] as num?)?.toDouble();
        // Only treat it as a new fix when the position actually moved —
        // otherwise every poll would reset the age and a frozen pin would
        // look permanently fresh.
        if (lat != null && lng != null && (lat != _proLat || lng != _proLng)) {
          _proLat = lat;
          _proLng = lng;
          _fixedAt = DateTime.now();
        }
      }
    } catch (_) {
      // A failed poll changes nothing on screen; the next one may succeed.
    }
    if (mounted) setState(() => _loading = false);
  }

  /// Straight-line distance. Honest about being "away", not "minutes away".
  double? get _milesAway {
    final dLat = _destLat, dLng = _destLng;
    if (_proLat == null || _proLng == null || dLat == null || dLng == null) return null;
    const earthMiles = 3958.8;
    final p = math.pi / 180;
    final a = 0.5 -
        math.cos((dLat - _proLat!) * p) / 2 +
        math.cos(_proLat! * p) * math.cos(dLat * p) * (1 - math.cos((dLng - _proLng!) * p)) / 2;
    return earthMiles * 2 * math.asin(math.sqrt(a));
  }

  bool get _isStale =>
      _fixedAt == null || DateTime.now().difference(_fixedAt!) > _staleAfter;

  String get _ageLabel {
    if (_fixedAt == null) return 'track.noFix'.tr();
    final mins = DateTime.now().difference(_fixedAt!).inMinutes;
    if (mins < 1) return 'track.justNow'.tr();
    return 'track.updatedAgo'.tr(args: ['$mins']);
  }

  Set<Marker> get _markers => {
        if (_proLat != null && _proLng != null)
          Marker(
            markerId: const MarkerId('pro'),
            position: LatLng(_proLat!, _proLng!),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
            infoWindow: InfoWindow(title: _proName),
          ),
        if (_destLat != null && _destLng != null)
          Marker(
            markerId: const MarkerId('destination'),
            position: LatLng(_destLat!, _destLng!),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
            infoWindow: InfoWindow(title: 'track.yourAddress'.tr()),
          ),
      };

  CameraPosition get _initialCamera {
    final lat = _proLat ?? _destLat ?? 34.0522;
    final lng = _proLng ?? _destLng ?? -118.2437;
    return CameraPosition(target: LatLng(lat, lng), zoom: 13);
  }

  @override
  Widget build(BuildContext context) {
    final miles = _milesAway;
    final haveMap = (_proLat != null && _proLng != null) || (_destLat != null && _destLng != null);

    return Scaffold(
      backgroundColor: C.bg,
      appBar: AppBar(
        backgroundColor: C.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: C.ink),
          onPressed: () => context.pop(),
        ),
        title: Text('track.title'.tr(),
            style: const TextStyle(color: C.ink, fontWeight: FontWeight.w900, fontSize: 18)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              Expanded(
                child: haveMap
                    ? GoogleMap(
                        initialCameraPosition: _initialCamera,
                        markers: _markers,
                        myLocationEnabled: false,
                        myLocationButtonEnabled: false,
                        zoomControlsEnabled: false,
                        onMapCreated: (c) => _map = c,
                      )
                    : Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text('track.noLocationYet'.tr(),
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: C.muted, height: 1.4)),
                        ),
                      ),
              ),
              _sheet(miles),
            ]),
    );
  }

  Widget _sheet(double? miles) => Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        decoration: const BoxDecoration(
          color: C.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (miles != null)
            Text('track.milesAway'.tr(args: [miles.toStringAsFixed(1)]),
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: C.ink)),
          const SizedBox(height: 6),
          // The age of the fix sits next to the distance, always. Without it a
          // frozen pin reads as a pro who has stopped moving.
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(_isStale ? Icons.schedule : Icons.circle,
                size: _isStale ? 15 : 10, color: _isStale ? C.muted : const Color(0xFF16A34A)),
            const SizedBox(width: 6),
            Flexible(
              child: Text(_ageLabel,
                  style: TextStyle(color: _isStale ? C.muted : const Color(0xFF16A34A), fontSize: 13, fontWeight: FontWeight.w600)),
            ),
          ]),
          if (_isStale && _fixedAt != null) ...[
            const SizedBox(height: 8),
            Text('track.staleNote'.tr(),
                textAlign: TextAlign.center,
                style: const TextStyle(color: C.muted, fontSize: 12, height: 1.35)),
          ],
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48), side: const BorderSide(color: C.blue)),
                onPressed: () => context.push('/chat', extra: {'bookingId': _id, 'name': _proName}),
                icon: const Icon(Icons.chat_bubble_outline, size: 18, color: C.blue),
                label: Text('track.message'.tr(),
                    style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                    backgroundColor: C.blue, minimumSize: const Size.fromHeight(48)),
                // Goes through the Twilio proxy, so neither party sees the
                // other's real number.
                onPressed: () => startMaskedCall(context, _id),
                icon: const Icon(Icons.call, size: 18, color: Colors.white),
                label: Text('track.call'.tr(),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              ),
            ),
          ]),
        ]),
      );
}
