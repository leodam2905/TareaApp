import 'package:flutter/widgets.dart';

// Shared route observer so screens (e.g. the dashboard, which stays alive in the
// shell's IndexedStack) can refresh via RouteAware.didPopNext when a pushed
// route above them — like Post a Job — is popped.
final routeObserver = RouteObserver<PageRoute<dynamic>>();
