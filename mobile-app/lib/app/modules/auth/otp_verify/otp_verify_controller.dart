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

  late String maskedPhone;
  late String flow;

  // Activation-specific args
  String accountNumber = '';
  String memberName = '';
  String organizationName = '';

  // Shared device args (both flows)
  String deviceId = '';
  String deviceName = '';

  Timer? _resendTimer;

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments as Map<String, dynamic>;
    maskedPhone = args['masked_phone'] ?? '';
    flow = args['flow'] ?? 'activation';
    accountNumber = args['account_number'] ?? '';
    memberName = args['member_name'] ?? '';
    organizationName = args['organization_name'] ?? '';
    deviceId = args['device_id'] ?? '';
    deviceName = args['device_name'] ?? '';
    _startResendTimer();
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
            'account_number': accountNumber,
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
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['access_token'] != null) {
          await _storage.saveToken(data['access_token'] as String);
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
      // Resend is done by re-posting to the same init endpoint with same args
      // The backend will re-generate and resend the OTP SMS
      if (flow == 'activation') {
        await _api.post(
          ApiConstants.mobileActivateInit,
          data: {
            'account_number': accountNumber,
            'device_id': deviceId,
            'resend': true,
          },
        );
      } else {
        await _api.post(
          ApiConstants.memberResendOtp,
          data: {
            'device_id': deviceId,
          },
        );
      }
      _startResendTimer();
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
