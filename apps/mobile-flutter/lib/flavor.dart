/// Which app this build is — Tarea Home (customer) or Tarea Pro (handyman).
/// Set once at startup by the entry point (main.dart vs main_pro.dart),
/// mirroring the React Native APP_VARIANT split.
enum Flavor { home, pro }

Flavor appFlavor = Flavor.home;

bool get isPro => appFlavor == Flavor.pro;

/// Role a new sign-up creates in this flavor.
String get signupRole => isPro ? 'HANDYMAN' : 'CUSTOMER';

/// Where a logged-in user lands in this flavor.
String get homeRoute => isPro ? '/pro-home' : '/home';
