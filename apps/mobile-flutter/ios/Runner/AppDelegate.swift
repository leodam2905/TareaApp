import Flutter
import UIKit
import FirebaseMessaging

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    // Ensure iOS actually requests an APNs device token. Without this the
    // token is never issued, so getAPNSToken()/getToken() stay null and the
    // device never registers for push.
    application.registerForRemoteNotifications()
    return result
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }

  // Explicitly forward the APNs device token to Firebase Messaging. On the
  // newer Flutter iOS template, automatic swizzling can miss this, leaving
  // getAPNSToken()/getToken() null so the device never registers for push.
  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    // Dev/ad-hoc builds register with Apple's SANDBOX APNs. Tell Firebase
    // explicitly so it doesn't try to deliver via production (which silently
    // fails). Switch to .prod for TestFlight / App Store builds.
    Messaging.messaging().setAPNSToken(deviceToken, type: .sandbox)
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }
}
