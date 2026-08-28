import 'package:geolocator/geolocator.dart';

/// One place that asks the OS for location.
///
/// Three screens requested permission independently, each with its own
/// slightly different check-then-request dance. Centralised so the behaviour
/// is identical everywhere, and so automated App Store screenshot capture can
/// opt out: the iOS permission alert is a native dialog that sits on top of
/// every frame and cannot be dismissed from the Flutter side, and it reappears
/// on every run because reinstalling the app resets the grant.
const _screenshotMode = bool.fromEnvironment('SCREENSHOT_MODE');

Future<LocationPermission> ensureLocationPermission() async {
  if (_screenshotMode) return LocationPermission.denied;
  var perm = await Geolocator.checkPermission();
  if (perm == LocationPermission.denied) {
    perm = await Geolocator.requestPermission();
  }
  return perm;
}

/// True when the app may read a position — callers should fall back to a
/// manually entered address rather than treating this as fatal.
bool locationGranted(LocationPermission p) =>
    p == LocationPermission.always || p == LocationPermission.whileInUse;
