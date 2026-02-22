#!/bin/bash
# NEXUS APK Build Script
# Run this on a machine with Android Studio OR JDK 17+ and Android SDK installed
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "=== NEXUS APK Builder ==="

# 1. Build React app (if node_modules not present)
if [ ! -d node_modules ]; then
  echo "[*] Installing JS dependencies..."
  npm install --legacy-peer-deps
fi

echo "[*] Building React app..."
npm run build

# 2. Sync to Android
echo "[*] Syncing to Android..."
npx cap sync android

# 3. Build debug APK
echo "[*] Building APK..."
cd android
chmod +x gradlew

# Try to find ANDROID_HOME if not set
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  POSSIBLE=(
    "$HOME/Android/Sdk"
    "$HOME/Library/Android/sdk"
    "/usr/lib/android-sdk"
    "/opt/android-sdk"
    "/usr/local/lib/android/sdk"
  )
  for p in "${POSSIBLE[@]}"; do
    if [ -d "$p" ]; then
      export ANDROID_HOME="$p"
      export ANDROID_SDK_ROOT="$p"
      echo "[*] Found SDK at $p"
      break
    fi
  done
fi

if [ -z "$ANDROID_HOME" ]; then
  echo "[!] ANDROID_HOME not set. Set it to your Android SDK path."
  echo "    e.g.: export ANDROID_HOME=~/Android/Sdk && ./BUILD_APK.sh"
  exit 1
fi

./gradlew assembleDebug

APK="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK" ]; then
  cp "$APK" ../NEXUS.apk
  echo ""
  echo "=== BUILD SUCCESSFUL ==="
  echo "APK: $(realpath ../NEXUS.apk)"
  echo ""
  echo "Install with:"
  echo "  adb install ../NEXUS.apk"
  echo "  OR copy NEXUS.apk to your Android device and open it"
else
  echo "[!] APK not found at expected path"
  find . -name "*.apk" 2>/dev/null
fi
