import 'dart:convert';
import 'package:http/http.dart' as http;

// Client-side Stripe tokenization for payout methods. Raw bank/card details go
// straight to Stripe with the PUBLISHABLE key (safe to embed) — they never
// touch the Tarea backend. The returned token is exchanged for an external
// account server-side via /handyman/payout-methods.
const String _publishableKey =
    'pk_live_51TWf7zGua4dfcnJ9ZIIVfje6IJGveoQZthhDr54jxVYLwGM5xTbdhAC4hY2Z0SiOHXPRJwmAPOpFXom7YZIRsXZd000tuovwCs';

class StripeTokenResult {
  final String? id;
  final String? error;
  const StripeTokenResult({this.id, this.error});
}

class StripeTokens {
  static Future<StripeTokenResult> bankAccount({
    required String routingNumber,
    required String accountNumber,
    required String accountHolderName,
  }) =>
      _token({
        'bank_account[country]': 'US',
        'bank_account[currency]': 'usd',
        'bank_account[routing_number]': routingNumber,
        'bank_account[account_number]': accountNumber,
        'bank_account[account_holder_name]': accountHolderName,
        'bank_account[account_holder_type]': 'individual',
      });

  static Future<StripeTokenResult> card({
    required String number,
    required String expMonth,
    required String expYear,
    required String cvc,
    String name = '',
  }) =>
      _token({
        'card[number]': number,
        'card[exp_month]': expMonth,
        'card[exp_year]': expYear,
        'card[cvc]': cvc,
        'card[currency]': 'usd',
        if (name.isNotEmpty) 'card[name]': name,
      });

  static Future<StripeTokenResult> _token(Map<String, String> body) async {
    if (_publishableKey.isEmpty || _publishableKey.contains('placeholder')) {
      return const StripeTokenResult(error: 'Payments are not configured.');
    }
    try {
      final res = await http.post(
        Uri.parse('https://api.stripe.com/v1/tokens'),
        headers: {
          'Authorization': 'Bearer $_publishableKey',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body,
      );
      final data = jsonDecode(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return StripeTokenResult(id: (data['id'] ?? '').toString());
      }
      return StripeTokenResult(error: (data['error']?['message'] ?? 'Could not validate your details.').toString());
    } catch (_) {
      return const StripeTokenResult(error: 'Network error. Please try again.');
    }
  }
}
