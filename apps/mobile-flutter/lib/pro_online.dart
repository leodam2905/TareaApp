import 'package:flutter/foundation.dart';

/// Global "is this pro currently Online/available" flag.
///
/// The dashboard's online toggle is the source of truth (it mirrors the
/// backend `handymanProfile.isAvailable`), but the push handler needs to read
/// it from outside the widget tree to decide whether an incoming job request
/// should RING (online) or just chime (offline). Kept as a simple app-wide
/// notifier so both sides stay in sync.
class ProOnline {
  static final ValueNotifier<bool> state = ValueNotifier<bool>(false);

  static bool get isOnline => state.value;

  static void set(bool value) {
    if (state.value != value) state.value = value;
  }
}
