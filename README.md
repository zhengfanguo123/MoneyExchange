# MoneyExchange

An Android travel expense tracking app.

Features:
- Select travel country.
- Enter total travel budget in KRW.
- Add expenses in local currency with automatic conversion to KRW.
- Deduct converted amount from remaining budget.
- Maintain list of expenses with notes, showing local amount, KRW amount, and remaining budget.

## Running the app

### Prerequisites
- JDK 17 or later
- Android SDK (install via [Android Studio](https://developer.android.com/studio) or command line tools)
- Gradle 8.0+ or the Gradle wrapper

### Using Visual Studio Code on Windows
1. Install the "Android" and "Gradle for Java" extensions from the VS Code marketplace.
2. Open this project folder in VS Code.
3. From the integrated terminal run `gradle wrapper` once to generate the wrapper files.
4. Build and install the debug version on a connected device or emulator:
   ```
   ./gradlew installDebug
   ```
5. VS Code's debugger can attach to the running app if you create a debug configuration for the Android process.

### Running on an Android phone
1. Enable **Developer options** and **USB debugging** on the device.
2. Connect the phone to your PC via USB.
3. Run `./gradlew installDebug` to build and deploy the app, or use Android Studio's **Run** button.
4. The app appears on the device as `MoneyExchange` and is ready for testing.

### Packaging an APK in Android Studio
1. Open the project in [Android Studio](https://developer.android.com/studio) and let it sync.
2. From the menu bar choose **Build > Build Bundle(s)/APK(s) > Build APK(s)**.
3. When the build finishes, click **locate** in the notification or browse to `app/build/outputs/apk/debug/app-debug.apk`.
4. For a release build select **Build > Build Bundle(s)/APK(s) > Build Bundle(s)** and sign the bundle or APK as needed.

### Running an APK in Android Studio
1. Start an emulator from **Tools > Device Manager** or connect an Android device with USB debugging enabled.
2. In Device Manager press **Install APK**, then select the generated APK file, or drag the APK onto a running emulator window.
3. Android Studio installs the APK on the selected device and launches the `MoneyExchange` app.

