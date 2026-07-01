const IS_HANDYMAN = process.env.APP_VARIANT === "handyman";

export default {
  expo: {
    name: IS_HANDYMAN ? "Tarea Pro" : "Tarea",
    slug: "tarea",
    version: "1.0.0",
    scheme: IS_HANDYMAN ? "tareapro" : "tarea",
    orientation: "portrait",
    icon: IS_HANDYMAN ? "./assets/icon-pro.png" : "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#0F172A",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: IS_HANDYMAN ? "com.taptarea.handyman" : "com.taptarea.customer",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Allow Tarea to access your photos to upload profile and document images.",
        NSCameraUsageDescription: "Allow Tarea to use your camera to take ID and document photos.",
        NSLocationWhenInUseUsageDescription: "Tarea uses your location to share your position with the customer while on the way.",
        ITSAppUsesNonExemptEncryption: false,
      },
      buildNumber: "2",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0F172A",
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
      versionCode: 1,
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-image-picker",
        {
          photosPermission: "Allow Tarea to access your photos.",
          cameraPermission: "Allow Tarea to use your camera.",
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
          locationWhenInUsePermission: "Tarea uses your location to share your position with the customer while on the way.",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appVariant: process.env.APP_VARIANT ?? "customer",
      eas: {
        projectId: "3a6f73e3-7b6a-4a56-ae3d-cfbe407bd26b",
      },
      router: {},
    },
    owner: "leodam",
  },
};
