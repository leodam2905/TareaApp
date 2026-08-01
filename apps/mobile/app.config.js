// Fail loudly instead of silently defaulting. A missing APP_VARIANT used to
// default to "customer", which meant an `eas update` run without it published a
// customer JS bundle onto the shared channel and hijacked the Tarea Pro app into
// customer mode. Require it explicitly for every build/update/dev command.
const APP_VARIANT = process.env.APP_VARIANT;
if (APP_VARIANT !== "customer" && APP_VARIANT !== "handyman") {
  throw new Error(
    `APP_VARIANT must be "customer" or "handyman" (got: ${APP_VARIANT ?? "undefined"}).\n` +
    `Use the paired npm scripts so variant + branch always match:\n` +
    `  npm run update:pro       npm run update:customer\n` +
    `  npm run start:pro        npm run start:customer\n` +
    `Or prefix manually, e.g.  APP_VARIANT=handyman eas update --branch production-handyman`
  );
}
const IS_HANDYMAN = APP_VARIANT === "handyman";

// Location usage description differs by app: the Pro app shares the handyman's
// position with the customer en route; the Home app uses location to find pros
// and jobs near the customer.
const LOCATION_USAGE = IS_HANDYMAN
  ? "Tarea Pro uses your location to share your position with the customer while you're on the way, and to match you with nearby jobs."
  : "Tarea uses your location to show trusted pros and available services near you.";

export default {
  expo: {
    name: IS_HANDYMAN ? "Tarea Pro" : "Tarea",
    slug: "tarea",
    version: "1.0.2",
    runtimeVersion: { policy: "appVersion" },
    updates: {
      url: "https://u.expo.dev/3a6f73e3-7b6a-4a56-ae3d-cfbe407bd26b",
      // Wait briefly on launch for a new OTA and apply it this launch, so an
      // update shows on a single reopen (no double relaunch needed).
      fallbackToCacheTimeout: 8000,
    },
    scheme: IS_HANDYMAN ? "tareapro" : "tarea",
    orientation: "portrait",
    icon: IS_HANDYMAN ? "./assets/icon-pro.png" : "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: IS_HANDYMAN ? "./assets/splash-pro.png" : "./assets/splash-home.png",
      resizeMode: "contain",
      backgroundColor: "#FFFFFF",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: IS_HANDYMAN ? "com.taptarea.handyman" : "com.taptarea.customer",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Tarea uses your photo library so you can attach images to your account — for example, choosing a profile photo, uploading portfolio images of your past work to show customers, or selecting a photo of your ID or license during Pro verification.",
        NSCameraUsageDescription: "Tarea uses your camera to take photos for your account — for example, capturing your ID and license for Pro verification, or photographing completed work to share with the customer.",
        NSLocationWhenInUseUsageDescription: LOCATION_USAGE,
        ITSAppUsesNonExemptEncryption: false,
      },
      buildNumber: "14",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: IS_HANDYMAN ? "./assets/adaptive-icon-pro.png" : "./assets/adaptive-icon-home.png",
        backgroundColor: "#FFFFFF",
      },
      package: IS_HANDYMAN ? "com.taptarea.handyman" : "com.taptarea.customer",
      googleServicesFile: "./google-services.json",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
      ],
      config: {
        googleMaps: {
          apiKey: "AIzaSyCqDnoc2Ga5hTkSXd_xHsrk2Wf7p2bo3eI",
        },
      },
      versionCode: 6,
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-splash-screen",
        {
          image: IS_HANDYMAN ? "./assets/splash-pro.png" : "./assets/splash-home.png",
          backgroundColor: "#FFFFFF",
          imageWidth: 240,
          resizeMode: "contain",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Tarea uses your photo library so you can attach images to your account — for example, choosing a profile photo, uploading portfolio images of your work, or selecting a photo of your ID or license for verification.",
          cameraPermission: "Tarea uses your camera to take photos for your account — for example, capturing your ID and license for verification, or photographing completed work to share with the customer.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#0F172A",
          sounds: [],
        },
      ],
      "expo-video",
      [
        "expo-location",
        {
          locationWhenInUsePermission: LOCATION_USAGE,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appVariant: APP_VARIANT,
      eas: {
        projectId: "3a6f73e3-7b6a-4a56-ae3d-cfbe407bd26b",
      },
      router: {},
    },
    owner: "leodam",
  },
};
