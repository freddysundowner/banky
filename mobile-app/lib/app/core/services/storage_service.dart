import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class StorageService extends GetxService {
  late GetStorage _box;
  late FlutterSecureStorage _secureStorage;

  static const String tokenKey = 'auth_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userKey = 'user_data';
  static const String organizationKey = 'organization_data';
  static const String memberKey = 'member_data';
  static const String themeKey = 'theme_mode';
  static const String onboardingKey = 'onboarding_complete';
  static const String fcmTokenKey = 'fcm_token';
  static const String deviceIdKey = 'device_id';

  Future<StorageService> init() async {
    _box = GetStorage();
    _secureStorage = const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
      iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    );
    return this;
  }

  Future<void> saveToken(String token) async {
    await _secureStorage.write(key: tokenKey, value: token);
  }

  Future<String?> getToken() async {
    return await _secureStorage.read(key: tokenKey);
  }

  Future<void> saveRefreshToken(String token) async {
    await _secureStorage.write(key: refreshTokenKey, value: token);
  }

  Future<String?> getRefreshToken() async {
    return await _secureStorage.read(key: refreshTokenKey);
  }

  Future<void> clearTokens() async {
    await _secureStorage.delete(key: tokenKey);
    await _secureStorage.delete(key: refreshTokenKey);
  }

  void saveUser(Map<String, dynamic> user) {
    _box.write(userKey, user);
  }

  Map<String, dynamic>? getUser() {
    return _box.read<Map<String, dynamic>>(userKey);
  }

  void saveMember(Map<String, dynamic> member) {
    _box.write(memberKey, member);
  }

  Map<String, dynamic>? getMember() {
    return _box.read<Map<String, dynamic>>(memberKey);
  }

  void saveOrganization(Map<String, dynamic> org) {
    _box.write(organizationKey, org);
  }

  Map<String, dynamic>? getOrganization() {
    return _box.read<Map<String, dynamic>>(organizationKey);
  }

  void saveThemeMode(String mode) {
    _box.write(themeKey, mode);
  }

  String? getThemeMode() {
    return _box.read<String>(themeKey);
  }

  void setOnboardingComplete(bool complete) {
    _box.write(onboardingKey, complete);
  }

  bool isOnboardingComplete() {
    return _box.read<bool>(onboardingKey) ?? false;
  }

  void saveFcmToken(String token) {
    _box.write(fcmTokenKey, token);
  }

  String? getFcmToken() {
    return _box.read<String>(fcmTokenKey);
  }

  /// Returns the real hardware device ID.
  /// On Android: Android ID (stable per device + app signing key).
  /// On iOS: identifierForVendor (stable per vendor, resets on reinstall).
  /// The value is cached in secure storage after the first read so subsequent
  /// calls are fast and the ID survives app updates.
  Future<String> getOrCreateDeviceId() async {
    final cached = await _secureStorage.read(key: deviceIdKey);
    if (cached != null && cached.isNotEmpty) return cached;

    String id = '';
    try {
      final deviceInfo = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final info = await deviceInfo.androidInfo;
        id = info.id; // Android ID — hex string, unique per device + signing key
      } else if (Platform.isIOS) {
        final info = await deviceInfo.iosInfo;
        id = info.identifierForVendor ?? '';
      }
    } catch (_) {}

    if (id.isEmpty) {
      // Fallback: generate a stable random ID and persist it
      id = DateTime.now().microsecondsSinceEpoch.toRadixString(16);
    }

    await _secureStorage.write(key: deviceIdKey, value: id);
    return id;
  }

  Future<void> clearAll() async {
    await clearTokens();
    await _box.erase();
  }
}
