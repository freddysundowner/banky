import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/demo_service.dart';
import '../../../core/services/storage_service.dart';
import '../../../routes/app_pages.dart';

class LoginController extends GetxController {
  ApiService get _api => Get.find<ApiService>();
  StorageService get _storage => Get.find<StorageService>();

  final pinController = TextEditingController();

  final formKey = GlobalKey<FormState>();

  final isLoading = false.obs;
  final isDemoLoading = false.obs;
  final obscurePin = true.obs;
  final errorMessage = ''.obs;
  final isDemoMode = false.obs;

  @override
  void onInit() {
    super.onInit();
    _checkDemoStatus();
  }

  @override
  void onClose() {
    pinController.dispose();
    super.onClose();
  }

  Future<void> _checkDemoStatus() async {
    isDemoMode.value = await DemoService.checkDemoStatus();
  }

  Future<void> demoLogin() async {
    await DemoService.demoLogin(isLoading: isDemoLoading);
  }

  void togglePinVisibility() {
    obscurePin.value = !obscurePin.value;
  }

  Future<void> login() async {
    if (!formKey.currentState!.validate()) return;

    errorMessage.value = '';
    isLoading.value = true;

    try {
      final deviceId = await _storage.getOrCreateDeviceId();
      final deviceName = await _storage.getDeviceName();

      final response = await _api.post(
        ApiConstants.mobileLogin,
        data: {
          'device_id': deviceId,
          'password': pinController.text,
          'device_name': deviceName,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        Get.toNamed(
          Routes.otpVerify,
          arguments: {
            'device_id': deviceId,
            'device_name': deviceName,
            'masked_phone': data['masked_phone'],
            'otp_expires_seconds': data['otp_expires_seconds'] ?? 180,
            'flow': 'login',
          },
        );
      }
    } catch (e) {
      final msg = _getErrorMessage(e);
      errorMessage.value = msg;
      Get.snackbar(
        'Login Failed',
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

  String? validatePin(String? value) {
    if (value == null || value.isEmpty) {
      return 'Please enter your password';
    }
    if (value.length != 6 || !RegExp(r'^\d{6}$').hasMatch(value)) {
      return 'Password must be 6 digits';
    }
    return null;
  }

  String _getErrorMessage(dynamic error) {
    if (error is Exception) {
      final errorStr = error.toString();
      if (errorStr.contains('401')) return 'Invalid password. Please try again.';
      if (errorStr.contains('404')) return 'Device not registered. Please activate mobile banking first.';
      if (errorStr.contains('403')) return 'Account is not active. Contact administrator.';
      if (errorStr.contains('SocketException')) return 'No internet connection';
    }
    return 'Something went wrong. Please try again.';
  }
}
