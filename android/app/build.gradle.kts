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
        versionCode = 3
        versionName = "0.1.6"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}
