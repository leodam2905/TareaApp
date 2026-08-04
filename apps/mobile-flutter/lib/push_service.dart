import 'dart:convert';
import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api.dart';
import 'flavor.dart';
import 'main.dart' show appRouter;
import 'screens/pro/pro_shell.dart';

// Background isolate handler. Required entry point; the OS shows the banner.
@pragma('vm:entry-point')
Future<void> _firebaseBgHandler(RemoteMessage message) async {}

const _channel = AndroidNotificationChannel(
  'tarea_default',
  'Notifications',
  description: 'Booking updates, job requests and reminders',
  importance: Importance.high,
);

final _local = FlutterLocalNotificationsPlugin();

class PushService {
  static bool _ready = false;

  /// Initialize Firebase + local notifications. Guarded so a platform without
  /// config doesn't crash the app — push just no-ops.
  static Future<void> initFirebase() async {
    if (_ready) return;
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(_firebaseBgHandler);
      await _initLocal();

      // Foreground messages: show a local banner (FCM won't auto-display these).
      FirebaseMessaging.onMessage.listen((m) {
        final n = m.notification;
        if (n == null) return;
        _local.show(
          n.hashCode,
          n.title,
          n.body,
          NotificationDetails(
            android: AndroidNotificationDetails(
              _channel.id, _channel.name,
              channelDescription: _channel.description,
              importance: Importance.high, priority: Priority.high,
              icon: '@mipmap/ic_launcher',
            ),
            iOS: const DarwinNotificationDetails(),
          ),
          payload: jsonEncode(m.data),
        );
      });

      FirebaseMessaging.onMessageOpenedApp.listen((m) => _handleTap(m.data));

      _ready = true;

      // getInitialMessage() can hang indefinitely on iOS (waits on the APNs
      // token) — never await it in the init path or registration never runs.
      FirebaseMessaging.instance.getInitialMessage().then((initial) {
        if (initial != null) _handleTap(initial.data);
      }).catchError((_) {});
    } catch (_) {
      _ready = false;
    }
  }

  static Future<void> _initLocal() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings();
    await _local.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: (resp) {
        if (resp.payload != null && resp.payload!.isNotEmpty) {
          try {
            _handleTap((jsonDecode(resp.payload!) as Map).cast<String, dynamic>());
          } catch (_) {}
        }
      },
    );
    await _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);
  }

  // Route a notification tap to a sensible screen based on its data payload.
  static void _handleTap(Map<String, dynamic> data) {
    final screen = (data['screen'] ?? '').toString();
    final type = (data['type'] ?? '').toString();
    try {
      if (isPro && (screen == 'FindJobs' || type == 'booking_request')) {
        appRouter.go(homeRoute);
        Future.delayed(const Duration(milliseconds: 350), () => ProShell.go?.call(1));
      } else {
        appRouter.push('/notifications');
      }
    } catch (_) {}
  }

  /// Request permission, fetch the FCM token, and register it with the backend.
  static Future<void> registerToken() async {
    if (!_ready) return;
    if (await Api.token() == null) return;
    try {
      final fm = FirebaseMessaging.instance;
      await fm.requestPermission(alert: true, badge: true, sound: true);
      // iOS: the FCM token isn't available until Apple's APNs token is set,
      // which happens asynchronously after permission is granted.
      if (Platform.isIOS) {
        String? apns;
        for (int i = 0; i < 15 && apns == null; i++) {
          apns = await fm.getAPNSToken();
          if (apns == null) await Future.delayed(const Duration(seconds: 1));
        }
      }
      final token = await fm.getToken();
      if (token != null) {
        await Api.post('/push-token', {'token': token});
      }
      fm.onTokenRefresh.listen((t) async {
        if (await Api.token() != null) {
          await Api.post('/push-token', {'token': t});
        }
      });
    } catch (_) {}
  }
}
