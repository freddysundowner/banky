import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../constants/api_constants.dart';
import '../../routes/app_pages.dart';
import 'storage_service.dart';
import 'api_service.dart';

/// Idle timeout: 5 minutes of no user interaction.
const Duration _kIdleTimeout = Duration(minutes: 5);

/// Background timeout: app in background for more than 2 minutes.
const Duration _kBackgroundTimeout = Duration(minutes: 2);

/// Routes where timeout is intentionally not enforced.
const _kAuthRoutes = {Routes.splash, Routes.login, Routes.activate, Routes.otpVerify, Routes.pinSetup};

class SessionTimeoutService extends GetxService with WidgetsBindingObserver {
  StorageService get _storage => Get.find<StorageService>();

  DateTime _lastActivity = DateTime.now();
  DateTime? _backgroundedAt;
  Timer? _idleTimer;

  Future<SessionTimeoutService> init() async {
    WidgetsBinding.instance.addObserver(this);
    _startIdleTimer();
    return this;
  }

  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    _idleTimer?.cancel();
    super.onClose();
  }

  // Called by the root Listener on every pointer event.
  void recordActivity() {
    _lastActivity = DateTime.now();
  }

  // Check whether the current route is an auth screen (no timeout needed there).
  bool get _isOnAuthScreen {
    final current = Get.currentRoute;
    return _kAuthRoutes.contains(current);
  }

  // Returns true only if there is an active session token.
  Future<bool> get _isLoggedIn async {
    final token = await _storage.getToken();
    return token != null && token.isNotEmpty;
  }

  void _startIdleTimer() {
    _idleTimer?.cancel();
    // Check every 30 seconds so we don't overshoot the timeout by much.
    _idleTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      if (_isOnAuthScreen) return;
      if (!await _isLoggedIn) return;

      final idleDuration = DateTime.now().difference(_lastActivity);
      if (idleDuration >= _kIdleTimeout) {
        await _expireSession(reason: 'idle');
      }
    });
  }

  // AppLifecycleObserver — called when app goes to/from background.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) async {
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        _backgroundedAt = DateTime.now();
        break;

      case AppLifecycleState.resumed:
        final bg = _backgroundedAt;
        _backgroundedAt = null;
        if (bg == null) return;
        if (_isOnAuthScreen) return;
        if (!await _isLoggedIn) return;

        final away = DateTime.now().difference(bg);
        if (away >= _kBackgroundTimeout) {
          await _expireSession(reason: 'background');
        } else {
          // Reset idle clock — the user just came back.
          _lastActivity = DateTime.now();
        }
        break;

      case AppLifecycleState.inactive:
        break;
    }
  }

  Future<void> _expireSession({required String reason}) async {
    // Best-effort server-side logout (don't block on it).
    try {
      await Get.find<ApiService>().post(ApiConstants.mobileLogout);
    } catch (_) {}

    await _storage.clearAll();

    // Reset idle timer after clearing.
    _lastActivity = DateTime.now();

    final message = reason == 'background'
        ? 'You were away for too long. Please log in again.'
        : 'Your session expired due to inactivity. Please log in again.';

    Get.offAllNamed(Routes.login);

    // Small delay so the login route is fully pushed before the snackbar.
    await Future.delayed(const Duration(milliseconds: 300));
    Get.snackbar(
      'Session Expired',
      message,
      snackPosition: SnackPosition.BOTTOM,
      backgroundColor: Colors.orange.shade100,
      colorText: Colors.orange.shade900,
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 5),
    );
  }
}
