$ErrorActionPreference = "Continue"

# DayDayOn Kotlin Android APK 离线确定性构建脚本
# 使用本地 Android SDK (build-tools 36.0.0 + android-36) 与 Gradle 内置 Kotlin 编译器 (2.3.20)
# 固化持久化签名密钥库 android/keystore/daydayon-release.jks（受 .gitignore 保护不入库），保证后续版本永久支持覆盖安装。

$RepoRoot = Split-Path -Parent $PSScriptRoot
$AppMain = Join-Path $PSScriptRoot "app\src\main"
$BuildDir = Join-Path $PSScriptRoot "app\build\offline-apk"
$KeystoreDir = Join-Path $PSScriptRoot "keystore"
$KeystorePath = Join-Path $KeystoreDir "daydayon-release.jks"
$LegacyKeystorePath = Join-Path $BuildDir "daydayon-signing.jks"
$OutApkDir = Join-Path $RepoRoot "download\apk"
$TempApk = Join-Path $RepoRoot "temp\DayDayOn.apk"

$SdkRoot = "D:\Android\SdkMain"
$BuildTools = Join-Path $SdkRoot "build-tools\37.0.0"
$AndroidJar = Join-Path $SdkRoot "platforms\android-36\android.jar"

$GradleLib = "C:\Users\AIMFl\.gradle\wrapper\dists\gradle-9.5.0-bin\bvnork1r7n8i6kp5cnkibsc9q\gradle-9.5.0\lib"
$KotlinCompilerJar = Join-Path $GradleLib "kotlin-compiler-embeddable-2.3.20.jar"
$KotlinStdlibJar = Join-Path $GradleLib "kotlin-stdlib-2.3.20.jar"

New-Item -ItemType Directory -Force -Path $KeystoreDir | Out-Null
if ((-not (Test-Path $KeystorePath)) -and (Test-Path $LegacyKeystorePath)) {
  Copy-Item $LegacyKeystorePath $KeystorePath -Force
}

if (Test-Path $BuildDir) {
  Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Force -Path "$BuildDir\compiled_res", "$BuildDir\gen", "$BuildDir\classes", "$BuildDir\dex", $OutApkDir | Out-Null

Write-Host "[1/6] aapt2 compile resources..."
& "$BuildTools\aapt2.exe" compile --dir "$AppMain\res" -o "$BuildDir\compiled_res\res.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Write-Host "[2/6] aapt2 link resources & generate R.java..."
& "$BuildTools\aapt2.exe" link `
  -I $AndroidJar `
  --manifest "$AppMain\AndroidManifest.xml" `
  --java "$BuildDir\gen" `
  -o "$BuildDir\unsigned-unaligned.apk" `
  "$BuildDir\compiled_res\res.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "[3/6] javac R.java..."
$RJavaFiles = Get-ChildItem -Path "$BuildDir\gen" -Recurse -Filter "*.java" | Select-Object -ExpandProperty FullName
& javac --release 17 -cp $AndroidJar -d "$BuildDir\classes" $RJavaFiles
if ($LASTEXITCODE -ne 0) { throw "javac R.java failed" }

Write-Host "[4/6] kotlinc Kotlin sources..."
$KtFiles = Get-ChildItem -Path "$AppMain\kotlin" -Recurse -Filter "*.kt" | Select-Object -ExpandProperty FullName
$KotlinCp = "$AndroidJar;$KotlinStdlibJar;$BuildDir\classes"
& java -cp "$GradleLib\*" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler `
  -jvm-target 17 `
  -no-stdlib `
  -cp $KotlinCp `
  -d "$BuildDir\classes" `
  $KtFiles
if ($LASTEXITCODE -ne 0) { throw "kotlinc failed" }

Write-Host "[5/6] d8 dexing classes + kotlin-stdlib..."
$ClassFiles = Get-ChildItem -Path "$BuildDir\classes" -Recurse -Filter "*.class" | Select-Object -ExpandProperty FullName
& "$BuildTools\d8.bat" `
  --min-api 26 `
  --lib $AndroidJar `
  --output "$BuildDir\dex" `
  $ClassFiles `
  $KotlinStdlibJar
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

& jar -uf "$BuildDir\unsigned-unaligned.apk" -C "$BuildDir\dex" classes.dex
if ($LASTEXITCODE -ne 0) { throw "jar update failed" }

& "$BuildTools\zipalign.exe" -f -p 4 "$BuildDir\unsigned-unaligned.apk" "$BuildDir\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

Write-Host "[6/6] apksigner signing DayDayOn.apk with persistent keystore..."
if (-not (Test-Path $KeystorePath)) {
  & keytool -genkeypair `
    -keystore $KeystorePath `
    -storepass "daydayon123" `
    -keypass "daydayon123" `
    -alias "daydayon" `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname "CN=DayDayOn, OU=DayDayOn, O=Husteread, L=Wuhan, ST=Hubei, C=CN"
  if ($LASTEXITCODE -ne 0) { throw "keytool failed" }
}

$FinalApk = Join-Path $OutApkDir "DayDayOn.apk"
& "$BuildTools\apksigner.bat" sign `
  --ks $KeystorePath `
  --ks-pass pass:daydayon123 `
  --key-pass pass:daydayon123 `
  --ks-key-alias daydayon `
  --out $FinalApk `
  "$BuildDir\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

if (Test-Path (Split-Path -Parent $TempApk)) {
  Copy-Item $FinalApk $TempApk -Force
}

$Hash = (Get-FileHash -Algorithm SHA256 $FinalApk).Hash.ToLower()
$Size = (Get-Item $FinalApk).Length
Write-Host "Successfully built DayDayOn.apk! Size=$Size bytes, SHA256=$Hash"
