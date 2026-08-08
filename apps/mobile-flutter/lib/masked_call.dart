import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';

/// Places a masked call for a booking.
///
/// The server assigns a proxy number that reaches the other party and bridges
/// the two legs, so neither side's real number ever reaches the other device —
/// the app only ever dials the proxy.
Future<void> startMaskedCall(BuildContext context, String bookingId) async {
  // Capture the messenger up front so we never touch BuildContext after an await.
  final messenger = ScaffoldMessenger.of(context);
  void toast(String m) => messenger.showSnackBar(SnackBar(content: Text(m)));

  try {
    final res = await Api.post('/bookings/$bookingId/call', {});

    if (res.statusCode >= 200 && res.statusCode < 300) {
      final number = (jsonDecode(res.body)['proxyNumber'] ?? '').toString();
      if (number.isEmpty) {
        toast('call.unavailable'.tr());
        return;
      }
      if (!await launchUrl(Uri.parse('tel:$number'))) toast('call.unavailable'.tr());
      return;
    }

    // 422 = this user has no phone on file; the bridge identifies callers by
    // caller ID, so they must add one before they can be connected.
    toast(res.statusCode == 422 ? 'call.addPhone'.tr() : 'call.unavailable'.tr());
  } catch (_) {
    toast('common.connectionRetry'.tr());
  }
}
