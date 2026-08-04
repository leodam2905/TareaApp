import Flutter
import UIKit
import UserNotifications
import FirebaseMessaging

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  // Bridge to Dart for foreground pushes. FlutterFire's onMessage does not fire
  // under Flutter's UIScene lifecycle, so we deliver foreground notifications to
  // Dart ourselves via this channel.
  private var pushChannel: FlutterMethodChannel?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    // Ensure iOS requests an APNs device token; without it getToken() stays nil.
    application.registerForRemoteNotifications()
    // Own the notification-center delegate so we reliably get foreground
    // willPresent callbacks (the scene lifecycle otherwise leaves this unset).
    UNUserNotificationCenter.current().delegate = self
    return result
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "TareaPushChannel") {
      pushChannel = FlutterMethodChannel(
        name: "tarea/push", binaryMessenger: registrar.messenger())
    }
  }

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    // Dev/ad-hoc builds register with Apple's SANDBOX APNs.
    Messaging.messaging().setAPNSToken(deviceToken, type: .sandbox)
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  // Foreground notification arrived while the app is open. Forward the payload to
  // Dart (which rings if the pro is Online, or shows a local chime otherwise) and
  // suppress the default system banner so Dart fully controls presentation.
  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    guard let channel = pushChannel else {
      completionHandler([.banner, .sound, .badge])
      return
    }
    let userInfo = notification.request.content.userInfo
    let aps = userInfo["aps"] as? [String: Any]
    let alert = aps?["alert"] as? [String: Any]
    let args: [String: Any] = [
      "title": (alert?["title"] as? String) ?? "",
      "body": (alert?["body"] as? String) ?? "",
      "type": (userInfo["type"] as? String) ?? "",
      "screen": (userInfo["screen"] as? String) ?? "",
    ]
    channel.invokeMethod("foregroundPush", arguments: args)
    completionHandler([])
  }
}
