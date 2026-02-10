import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../../../routes/app_pages.dart';

class PinSetupController extends GetxController {
  ApiService get _api => Get.find<ApiService>();

  final pinController = TextEditingController();
  final confirmPinController = TextEditingController();
  final formKey = GlobalKey<FormState>();
  final isLoading = false.obs;
  final obscurePin = true.obs;
  final obscureConfirmPin = true.obs;

  late String accountNumber;
  late String otp;

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments as Map<String, dynamic>;
    accountNumber = args['account_number'] ?? '';
    otp = args['otp'] ?? '';
  }

  @override
  void onClose() {
    pinController.dispose();
    confirmPinController.dispose();
    super.onClose();
  }

  String? validatePin(String? value) {
    if (value == null || value.isEmpty) {
      return 'Please enter a PIN';
    }
    if (value.length != 4) {
      return 'PIN must be exactly 4 digits';
    }
    if (!RegExp(r'^\d{4}$').hasMatch(value)) {
      return 'PIN must contain only digits';
    }
    return null;
  }

  String? validateConfirmPin(String? value) {
    if (value == null || value.isEmpty) {
      return 'Please confirm your PIN';
    }
    if (value != pinController.text) {
      return 'PINs do not match';
    }
    return null;
  }

  Future<void> setupPin() async {
    if (!formKey.currentState!.validate()) return;

    isLoading.value = true;

    try {
      final response = await _api.post(
        ApiConstants.memberVerifyOtp,
        data: {
          'account_number': accountNumber,
          'otp': otp,
          'pin': pinController.text,
          'pin_confirm': confirmPinController.text,
        },
      );

      if (response.statusCode == 200) {
        Get.snackbar(
          'Success',
          'Mobile banking activated! You can now sign in.',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: Colors.green.shade100,
          colorText: Colors.green.shade900,
          margin: const EdgeInsets.all(16),
          duration: const Duration(seconds: 3),
        );
        await Future.delayed(const Duration(seconds: 1));
        Get.offAllNamed(Routes.login);
      }
    } catch (e) {
      final msg = _getErrorMessage(e);
      Get.snackbar(
        'Error',
        msg,
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.shade100,
        colorText: Colors.red.shade900,
        margin: const EdgeInsets.all(16),
      );
    } finally {
      isLoading.value = false;
    }
  }

  String _getErrorMessage(dynamic error) {
    if (error is Exception) {
      final errorStr = error.toString();
      if (errorStr.contains('expired')) return 'OTP has expired. Please start activation again.';
      if (errorStr.contains('Invalid OTP')) return 'Invalid OTP. Please start activation again.';
      if (errorStr.contains('do not match')) return 'PINs do not match.';
      if (errorStr.contains('SocketException')) return 'No internet connection';
    }
    return 'Something went wrong. Please try again.';
  }
}
