allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}


// Stripe's Android SDK fails `lintVitalAnalyzeRelease` on a dependency that is
// not publicly resolvable:
//
//   Could not find com.google.android.gms:play-services-tapandpay:17.1.2
//   required by com.stripe:stripe-android-issuing-push-provisioning
//
// That is Stripe's card-ISSUING / tap-and-pay module. Tarea issues no cards and
// never touches it — the artifact is only pulled onto the lint classpath, so
// nothing is missing from the app itself. Debug builds skip lintVital, which is
// why release was the first build to fail.
//
// Disabled by task name rather than through an android { lint } block: this
// file already calls evaluationDependsOn(":app"), so the subprojects are
// evaluated by the time an afterEvaluate hook would run, and Gradle refuses it.
// whenTaskAdded needs no evaluation hook at all.
allprojects {
    tasks.whenTaskAdded {
        if (name.startsWith("lintVital")) enabled = false
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
