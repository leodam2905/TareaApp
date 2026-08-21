import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

import 'api.dart';

/// Publishable key. Public by design — it is shipped in every client and can
/// only create tokens, never move money. The secret key lives in Secret
/// Manager and is never in the app.
const stripePublishableKey = String.fromEnvironment(
  'STRIPE_PUBLISHABLE_KEY',
  defaultValue: 'pk_live_51TWf7zGua4dfcnJ9',
);

/// Saves a card at the moment of hiring — no charge.
///
/// WHY A CARD IS TAKEN HERE AND NOT CHARGED
///
/// The final amount is not known at hire: the pro confirms materials, time
/// extensions happen, tips come later. So the card is stored now, an
/// authorization hold is placed when the Pro accepts, and the capture happens
/// at completion (see apps/web/lib/payment-hold.ts). Charging up front would
/// mean refunding the difference on most jobs.
///
/// Card details are collected by Stripe's own PaymentSheet and never touch
/// this app. That is not a preference — Stripe refuses publishable-key card
/// tokenization on this account, because handling raw card numbers would move
/// the platform from PCI SAQ-A to SAQ-D. The same restriction is why the payout
/// card form was deleted (see pro_payout_methods.dart).
class PaymentMethods {
  /// Ensures the customer has a card on file, prompting only if they do not.
  ///
  /// Returns true when a card is saved and the caller may proceed with the
  /// booking. Returns false if the customer dismissed the sheet or it failed —
  /// in which case no booking should be created, so nobody is hired against a
  /// payment method that does not exist.
  static Future<bool> ensureCardOnFile(BuildContext context) async {
    try {
      final res = await Api.post('/stripe/setup-intent', {});
      if (res.statusCode < 200 || res.statusCode >= 300) return false;
      final body = jsonDecode(res.body) as Map<String, dynamic>;

      if (body['alreadySaved'] == true) return true;

      final clientSecret = (body['clientSecret'] ?? '').toString();
      if (clientSecret.isEmpty) return false;

      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          setupIntentClientSecret: clientSecret,
          merchantDisplayName: 'Tarea',
          customerId: (body['customerId'] ?? '').toString().isEmpty
              ? null
              : body['customerId'].toString(),
          // Says plainly that nothing is being charged yet.
          primaryButtonLabel: 'Save card',
        ),
      );
      await Stripe.instance.presentPaymentSheet();
      return true;
    } on StripeException {
      // Includes the customer simply closing the sheet, which is not an error
      // worth shouting about — they just do not get a booking.
      return false;
    } catch (_) {
      return false;
    }
  }
}
