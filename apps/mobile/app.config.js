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
        NSPhotoLibraryUsageDescription: "Tarea uses your photo library so you can attach images to your account — for example, choosing a profile photo, uploading portfolio images of your past work to show customers, or selecting a photo of your ID or license during Pro verification.",
        NSCameraUsageDescription: "Tarea uses your camera to take photos for your account — for example, capturing your ID and license for Pro verification, or photographing completed work to share with the customer.",
        NSLocationWhenInUseUsageDescription: "Tarea uses your location to share your position with the customer while on the way.",
        ITSAppUsesNonExemptEncryption: false,
      },
      buildNumber: "6",
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
