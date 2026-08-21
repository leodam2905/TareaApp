import Flutter
import GoogleMaps
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
    // Maps SDK needs its key before any map view is created.
    GMSServices.provideAPIKey("AIzaSyCqDnoc2Ga5hTkSXd_xHsrk2Wf7p2bo3eI")
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
    // Debug/dev builds use Apple's SANDBOX APNs; TestFlight/App Store use
    // PRODUCTION. Picking the wrong environment silently drops push delivery.
    #if DEBUG
    Messaging.messaging().setAPNSToken(deviceToken, type: .sandbox)
    #else
    Messaging.messaging().setAPNSToken(deviceToken, type: .prod)
    #endif
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
    // Only intercept REMOTE (APNs/FCM) pushes. Locally-posted notifications —
    // e.g. the chime Dart shows for a non-ring alert — must present normally,
    // otherwise they'd be suppressed here and never appear (and re-forwarding
    // them to Dart would loop).
    guard notification.request.trigger is UNPushNotificationTrigger,
          let channel = pushChannel else {
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
