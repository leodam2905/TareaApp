package com.taptarea.tarea

import io.flutter.embedding.android.FlutterFragmentActivity

// FlutterFragmentActivity, not FlutterActivity: Stripe's Android
// PaymentSheet is a DialogFragment and needs a FragmentActivity host.
class MainActivity : FlutterFragmentActivity()
