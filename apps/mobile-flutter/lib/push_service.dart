import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api.dart';
import 'flavor.dart';
import 'pro_online.dart';
import 'incoming_job.dart';
import 'main.dart' show appRouter;
import 'screens/pro/pro_shell.dart';

// Background isolate handler. Required entry point; the OS shows the banner.
@pragma('vm:entry-point')
Future<void> _firebaseBgHandler(RemoteMessage message) async {}

const _channel = AndroidNotificationChannel(
  'tarea_default',
  'Notifications',
  description: 'Booking updates and reminders',
  importance: Importance.high,
);

// Dedicated channel for incoming job requests — plays a loud custom ringtone
// so pros notice a new job even from across the room. On Android O+ the sound
// is baked into the channel at creation, so this must exist before any job
// notification is shown.
const _jobChannel = AndroidNotificationChannel(
  // Bump the id whenever the sound changes — channels are immutable once
  // created, so a new id is the only way existing installs pick up a new tone.
  'tarea_jobs_v2',
  'New Job Requests',
  description: 'A customer has requested you for a job',
  importance: Importance.max,
  sound: RawResourceAndroidNotificationSound('job_ring'),
  playSound: true,
);

// A job-request push carries this type in its data payload.
bool _isJobRequest(Map<String, dynamic> data) =>
    (data['type'] ?? '').toString() == 'booking_request' ||
    (data['screen'] ?? '').toString() == 'FindJobs';

final _local = FlutterLocalNotificationsPlugin();

class PushService {
  static bool _ready = false;
  static const _fgChannel = MethodChannel('tarea/push');

  // Handle a foreground push (from FlutterFire on Android, or the native
  // AppDelegate bridge on iOS). Rings full-screen if the pro is Online, else
  // shows a normal local notification (chime).
  static void _handleForeground(Map<String, dynamic> data) {
    final job = _isJobRequest(data);
    final title = (data['title'] ?? '').toString().isEmpty
        ? 'New Job Request'
        : data['title'].toString();
    final body = (data['body'] ?? '').toString();

    if (isPro && job && ProOnline.isOnline) {
      IncomingJobRing.start({...data, 'title': title, 'body': body});
      return;
    }

    final ch = job ? _jobChannel : _channel;
    _local.show(
      title.hashCode,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          ch.id, ch.name,
          channelDescription: ch.description,
          importance: job ? Importance.max : Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          sound: job ? const RawResourceAndroidNotificationSound('job_ring') : null,
        ),
        iOS: DarwinNotificationDetails(
          sound: job ? 'job_ring.caf' : null,
          presentAlert: true,
          presentBanner: true,
          presentSound: true,
        ),
      ),
      payload: jsonEncode(data),
    );
  }

  /// Initialize Firebase + local notifications. Guarded so a platform without
  /// config doesn't crash the app — push just no-ops.
  static Future<void> initFirebase() async {
    if (_ready) return;
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(_firebaseBgHandler);
      await _initLocal();

      // Android: FlutterFire delivers foreground messages here.
      FirebaseMessaging.onMessage.listen((m) {
        final n = m.notification;
        _handleForeground({
          ...m.data,
          'title': n?.title ?? '',
          'body': n?.body ?? '',
        });
      });

      // iOS: onMessage does not fire under the UIScene lifecycle, so the native
      // AppDelegate forwards foreground notifications over this channel instead.
      _fgChannel.setMethodCallHandler((call) async {
        if (call.method == 'foregroundPush') {
          _handleForeground((call.arguments as Map).cast<String, dynamic>());
        }
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
    final android = _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await android?.createNotificationChannel(_channel);
    await android?.createNotificationChannel(_jobChannel);
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
