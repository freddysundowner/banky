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
  static const String _deviceIdCacheKey = 'device_id_cache';
  static const String deviceNameKey = 'device_name';

  // In-memory caches — survive the entire app session, zero I/O cost
  String? _deviceIdMemCache;
  String? _deviceNameMemCache;

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
  /// Cache hierarchy (fastest first):
  ///   1. In-memory cache (instant, same session)
  ///   2. GetStorage cache (fast, survives restarts — avoids EncryptedSharedPreferences read)
  ///   3. FlutterSecureStorage (authoritative, written on first registration)
  ///   4. DeviceInfoPlugin (fallback on very first launch)
  Future<String> getOrCreateDeviceId() async {
    // 1. In-memory
    if (_deviceIdMemCache != null && _deviceIdMemCache!.isNotEmpty) {
      return _deviceIdMemCache!;
    }

    // 2. GetStorage (fast, avoids slow Keystore read on every cold start)
    final fastCache = _box.read<String>(_deviceIdCacheKey);
    if (fastCache != null && fastCache.isNotEmpty) {
      _deviceIdMemCache = fastCache;
      return fastCache;
    }

    // 3. Secure storage (existing registrations already stored here)
    try {
      final secure = await _secureStorage.read(key: deviceIdKey);
      if (secure != null && secure.isNotEmpty) {
        _deviceIdMemCache = secure;
        _box.write(_deviceIdCacheKey, secure);
        return secure;
      }
    } catch (_) {}

    // 4. Generate fresh ID from hardware
    String id = '';
    try {
      final deviceInfo = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final info = await deviceInfo.androidInfo;
        id = info.id;
      } else if (Platform.isIOS) {
        final info = await deviceInfo.iosInfo;
        id = info.identifierForVendor ?? '';
      }
    } catch (_) {}

    if (id.isEmpty) {
      id = DateTime.now().microsecondsSinceEpoch.toRadixString(16);
    }

    _deviceIdMemCache = id;
    _box.write(_deviceIdCacheKey, id);
    await _secureStorage.write(key: deviceIdKey, value: id);
    return id;
  }

  /// Returns a human-readable device name, e.g. "Samsung Galaxy S21" or "iPhone 13".
  /// Cache hierarchy: in-memory → GetStorage → DeviceInfoPlugin.
  Future<String> getDeviceName() async {
    // 1. In-memory
    if (_deviceNameMemCache != null && _deviceNameMemCache!.isNotEmpty) {
      return _deviceNameMemCache!;
    }

    // 2. GetStorage
    final cached = _box.read<String>(deviceNameKey);
    if (cached != null && cached.isNotEmpty) {
      _deviceNameMemCache = cached;
      return cached;
    }

    // 3. DeviceInfoPlugin
    String name = 'Unknown Device';
    try {
      final deviceInfo = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final info = await deviceInfo.androidInfo;
        final rawBrand = info.brand;
        final brand = rawBrand.isNotEmpty
            ? rawBrand[0].toUpperCase() + rawBrand.substring(1)
            : 'Android';
        name = '$brand ${info.model}';
      } else if (Platform.isIOS) {
        final info = await deviceInfo.iosInfo;
        name = '${info.name} (${info.model})';
      }
    } catch (_) {}

    _deviceNameMemCache = name;
    _box.write(deviceNameKey, name);
    return name;
  }

  /// Pre-warms both device ID and device name into the in-memory cache.
  /// Call this early (splash, onInit) so the values are instant when needed.
  Future<void> prewarmDeviceInfo() async {
    await Future.wait([
      getOrCreateDeviceId(),
      getDeviceName(),
    ]);
  }

  Future<void> clearAll() async {
    _deviceIdMemCache = null;
    _deviceNameMemCache = null;
    await clearTokens();
    await _box.erase();
  }
}
