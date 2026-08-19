import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing: per-flavor upload keystores (customer / handyman), loaded
// from android/key.properties (gitignored). Falls back to debug signing when
// the file isn't present (e.g. CI without secrets, or a fresh checkout).
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasKeystores = keystorePropertiesFile.exists()
if (hasKeystores) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.taptarea.tarea"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Overridden per flavor below.
        applicationId = "com.taptarea.handyman"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasKeystores) {
            create("customer") {
                storeFile = rootProject.file(keystoreProperties["customerStoreFile"] as String)
                storePassword = keystoreProperties["customerStorePassword"] as String
                keyAlias = keystoreProperties["customerKeyAlias"] as String
                keyPassword = keystoreProperties["customerKeyPassword"] as String
            }
            create("handyman") {
                storeFile = rootProject.file(keystoreProperties["handymanStoreFile"] as String)
                storePassword = keystoreProperties["handymanStorePassword"] as String
                keyAlias = keystoreProperties["handymanKeyAlias"] as String
                keyPassword = keystoreProperties["handymanKeyPassword"] as String
            }
        }
    }

    flavorDimensions += "app"
    productFlavors {
        create("home") {
            dimension = "app"
            applicationId = "com.taptarea.customer"
            manifestPlaceholders["appName"] = "Tarea"
            manifestPlaceholders["deepLinkScheme"] = "tarea"
            if (hasKeystores) signingConfig = signingConfigs.getByName("customer")
        }
        create("pro") {
            dimension = "app"
            applicationId = "com.taptarea.handyman"
            manifestPlaceholders["appName"] = "Tarea Pro"
            manifestPlaceholders["deepLinkScheme"] = "tareapro"
            if (hasKeystores) signingConfig = signingConfigs.getByName("handyman")
        }
    }

    buildTypes {
        release {
            // Release signing comes from the per-flavor upload keystores above.
            // Only fall back to debug keys when no keystore is configured.
            if (!hasKeystores) {
                signingConfig = signingConfigs.getByName("debug")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
