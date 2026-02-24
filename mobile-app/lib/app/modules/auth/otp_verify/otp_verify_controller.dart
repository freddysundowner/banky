import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/storage_service.dart';
import '../../../routes/app_pages.dart';

class OtpVerifyController extends GetxController {
  ApiService get _api => Get.find<ApiService>();
  StorageService get _storage => Get.find<StorageService>();

  final otpControllers = List.generate(6, (_) => TextEditingController());
  final focusNodes = List.generate(6, (_) => FocusNode());

  final isLoading = false.obs;
  final isResending = false.obs;
  final errorMessage = ''.obs;
  final resendCountdown = 0.obs;

  // Login OTP expiry countdown (only active for login flow)
  final otpExpirySeconds = 0.obs;
  final otpExpired = false.obs;

  late String maskedPhone;
  late String flow;

  // Activation-specific args
  String idNumber = '';
  String memberName = '';
  String organizationName = '';

  // Shared device args (both flows)
  String deviceId = '';
  String deviceName = '';

  Timer? _resendTimer;
  Timer? _expiryTimer;

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments as Map<String, dynamic>;
    maskedPhone = args['masked_phone'] ?? '';
    flow = args['flow'] ?? 'activation';
    idNumber = args['id_number'] ?? '';
    memberName = args['member_name'] ?? '';
    organizationName = args['organization_name'] ?? '';
    deviceId = args['device_id'] ?? '';
    deviceName = args['device_name'] ?? '';
    _startResendTimer();
    if (flow == 'login') {
      final seconds = (args['otp_expires_seconds'] as num?)?.toInt() ?? 180;
      _startExpiryTimer(seconds);
    }
  }

  @override
  void onClose() {
    for (final c in otpControllers) {
      c.dispose();
    }
    for (final f in focusNodes) {
      f.dispose();
    }
    _resendTimer?.cancel();
    _expiryTimer?.cancel();
    super.onClose();
  }

  void _startResendTimer() {
    resendCountdown.value = 60;
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (resendCountdown.value > 0) {
        resendCountdown.value--;
      } else {
        timer.cancel();
      }
    });
  }

  void _startExpiryTimer(int seconds) {
    otpExpired.value = false;
    otpExpirySeconds.value = seconds;
    _expiryTimer?.cancel();
    _expiryTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (otpExpirySeconds.value > 0) {
        otpExpirySeconds.value--;
      } else {
        otpExpired.value = true;
        timer.cancel();
      }
    });
  }

  String get expiryDisplay {
    final s = otpExpirySeconds.value;
    final m = s ~/ 60;
    final secs = s % 60;
    return '${m.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  String get otpValue => otpControllers.map((c) => c.text).join();

  void onOtpChanged(int index, String value) {
    if (value.length == 1 && index < 5) {
      focusNodes[index + 1].requestFocus();
    }
    if (value.isEmpty && index > 0) {
      focusNodes[index - 1].requestFocus();
    }
    if (otpValue.length == 6) {
      verifyOtp();
    }
  }

  Future<void> verifyOtp() async {
    if (flow == 'login' && otpExpired.value) {
      Get.snackbar(
        'OTP Expired',
        'Your OTP has expired. Please request a new one.',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.orange.shade100,
        colorText: Colors.orange.shade900,
        margin: const EdgeInsets.all(16),
      );
      return;
    }

    final otp = otpValue;
    if (otp.length != 6) {
      errorMessage.value = 'Please enter the complete 6-digit OTP';
      return;
    }

    errorMessage.value = '';
    isLoading.value = true;

    try {
      if (flow == 'activation') {
        // OTP is verified server-side at activate/complete — pass it forward
        isLoading.value = false;
        Get.toNamed(
          Routes.pinSetup,
          arguments: {
            'id_number': idNumber,
            'otp': otp,
            'device_id': deviceId,
            'device_name': deviceName,
          },
        );
        return;
      }

      // login flow
      final response = await _api.post(
        ApiConstants.mobileLoginVerify,
        data: {
          'device_id': deviceId,
          'otp': otp,
          if (deviceName.isNotEmpty) 'device_name': deviceName,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['access_token'] != null) {
          await _storage.saveToken(data['access_token'] as String);
        }
        // Persist org so the API interceptor sends X-Organization-Id on all requests,
        // enabling O(1) tenant routing for logout and future member API calls.
        if (data['org_id'] != null) {
          _storage.saveOrganization({
            'id': data['org_id'] as String,
            'name': data['org_name'] ?? '',
          });
        }
        Get.offAllNamed(Routes.home);
      }
    } catch (e) {
      errorMessage.value = _getErrorMessage(e);
      Get.snackbar(
        'Error',
        errorMessage.value,
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.shade100,
        colorText: Colors.red.shade900,
        margin: const EdgeInsets.all(16),
      );
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> resendOtp() async {
    if (resendCountdown.value > 0) return;

    isResending.value = true;
    try {
      final response = await _api.post(
        ApiConstants.mobileResendOtp,
        data: flow == 'activation'
            ? {'id_number': idNumber}
            : {'device_id': deviceId},
      );
      clearOtp();
      _startResendTimer();
      if (flow == 'login') {
        final newExpiry = (response.data['otp_expires_seconds'] as num?)?.toInt() ?? 180;
        _startExpiryTimer(newExpiry);
      }
      Get.snackbar(
        'OTP Resent',
        'A new OTP has been sent to $maskedPhone',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.green.shade100,
        colorText: Colors.green.shade900,
        margin: const EdgeInsets.all(16),
      );
    } catch (e) {
      Get.snackbar(
        'Error',
        'Failed to resend OTP. Please try again.',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.shade100,
        colorText: Colors.red.shade900,
        margin: const EdgeInsets.all(16),
      );
    } finally {
      isResending.value = false;
    }
  }

  void clearOtp() {
    for (final c in otpControllers) {
      c.clear();
    }
    focusNodes[0].requestFocus();
  }

  String _getErrorMessage(dynamic error) {
    if (error is Exception) {
      final errorStr = error.toString();
      if (errorStr.contains('expired')) return 'OTP has expired. Please request a new one.';
      if (errorStr.contains('Invalid OTP')) return 'Invalid OTP. Please try again.';
      if (errorStr.contains('401')) return 'Invalid OTP. Please try again.';
      if (errorStr.contains('SocketException')) return 'No internet connection';
    }
    return 'Something went wrong. Please try again.';
  }
}
