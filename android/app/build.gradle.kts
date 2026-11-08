plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.husteread.daydayon"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.husteread.daydayon"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.1.3"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}
