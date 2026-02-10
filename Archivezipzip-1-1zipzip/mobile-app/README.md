# BANKY Mobile App

A Flutter mobile application for BANKY Sacco/Bank members built with GetX state management.

## Features

### Phase 1 (Core Features)
- **Member Login** - Secure authentication with organization code
- **Dashboard** - View savings & shares balance at a glance
- **Transaction History** - Browse all transactions with filters
- **Loan Management** - View active loans and repayment schedule
- **Profile** - View and update personal information

### Phase 2 (Advanced Features)
- **M-Pesa Loan Repayment** - Pay loans directly via M-Pesa STK Push
- **Push Notifications** - Receive payment reminders and alerts
- **Statement Downloads** - Generate and download account statements

## Tech Stack

- **Framework**: Flutter 3.x
- **State Management**: GetX
- **HTTP Client**: Dio
- **Local Storage**: GetStorage + Flutter Secure Storage
- **Push Notifications**: Firebase Cloud Messaging
- **PDF Generation**: pdf + printing packages

## Project Structure

```
lib/
├── main.dart                    # App entry point
└── app/
    ├── core/
    │   ├── bindings/           # Initial dependency injection
    │   ├── constants/          # API endpoints, app constants
    │   ├── services/           # API, storage, notification services
    │   └── theme/              # App theming
    ├── data/
    │   ├── models/             # Data models
    │   └── repositories/       # Data repositories
    ├── modules/
    │   ├── splash/             # Splash screen
    │   ├── auth/login/         # Login screen
    │   ├── home/               # Home with bottom navigation
    │   ├── dashboard/          # Dashboard view
    │   ├── transactions/       # Transaction history
    │   ├── loans/              # Loans list, detail, repayment
    │   ├── profile/            # User profile
    │   ├── statements/         # Statement generation
    │   └── notifications/      # Push notifications
    └── routes/                 # App routing
```

## Setup Instructions

### Prerequisites
- Flutter SDK 3.0+ installed ([flutter.dev](https://flutter.dev/docs/get-started/install))
- Android Studio or VS Code with Flutter extensions
- For iOS: Xcode 14+ on macOS

### Installation

1. **Download the mobile-app folder** from Replit

2. **Navigate to the project**
   ```bash
   cd mobile-app
   ```

3. **Install dependencies**
   ```bash
   flutter pub get
   ```

4. **Configure API URL**
   Edit `lib/app/core/constants/api_constants.dart`:
   ```dart
   static const String baseUrl = 'https://your-backend-url.com';
   ```

5. **Setup Firebase (for push notifications)**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Add Android app with package name `com.banky.mobile`
   - Add iOS app with bundle ID `com.banky.mobile`
   - Download `google-services.json` → `android/app/`
   - Download `GoogleService-Info.plist` → `ios/Runner/`

6. **Run the app**
   ```bash
   flutter run
   ```

## Building for Production

### Android APK
```bash
flutter build apk --release
```
Output: `build/app/outputs/flutter-apk/app-release.apk`

### Android App Bundle (for Play Store)
```bash
flutter build appbundle --release
```
Output: `build/app/outputs/bundle/release/app-release.aab`

### iOS (requires macOS)
```bash
flutter build ios --release
```
Then open `ios/Runner.xcworkspace` in Xcode to archive and distribute.

## Configuration

### Changing App Name & Icons

1. **App Name**: Edit `pubspec.yaml` and Android/iOS config files
2. **App Icon**: Replace assets in:
   - `android/app/src/main/res/mipmap-*/`
   - `ios/Runner/Assets.xcassets/AppIcon.appiconset/`

### Theming

Edit `lib/app/core/theme/app_theme.dart` to customize:
- Primary/secondary colors
- Typography
- Component styles

## API Integration

The app connects to the BANKY backend API. Key endpoints:

| Feature | Endpoint |
|---------|----------|
| Login | POST `/api/auth/member/login` |
| Member Profile | GET `/api/members/me` |
| Transactions | GET `/api/members/me/transactions` |
| Loans | GET `/api/members/me/loans` |
| M-Pesa Payment | POST `/api/mpesa/stk-push` |
| Statements | POST `/api/statements` |

## Offline Support

The app caches:
- Member profile data
- Recent transactions
- Organization details

For full offline support, consider implementing:
- SQLite local database
- Sync queue for offline actions

## Troubleshooting

### Common Issues

1. **"flutter: command not found"**
   - Install Flutter SDK and add to PATH

2. **Gradle build fails on Android**
   - Run `flutter clean` then `flutter pub get`
   - Update Gradle version in `android/gradle/wrapper/gradle-wrapper.properties`

3. **iOS build fails**
   - Run `cd ios && pod install --repo-update`
   - Open in Xcode and fix signing issues

4. **API connection errors**
   - Verify `baseUrl` in api_constants.dart
   - Check backend is running and accessible

## License

Proprietary - BANKY Sacco Management System
