import 'package:flutter/material.dart';
import 'flavor.dart';
import 'main.dart';
import 'push_service.dart';

// Entry point for the Tarea Pro (handyman) app. Same codebase as Tarea Home,
// but this flavor shows the Pro landing/auth and lands on the Pro dashboard.
void main() {
  appFlavor = Flavor.pro;
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TareaApp());
  PushService.initFirebase().then((_) => PushService.registerToken());
}
