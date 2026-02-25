import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/demo_service.dart';
import '../../../core/services/storage_service.dart';
import '../../../routes/app_pages.dart';

class ActivateController extends GetxController {
  ApiService get _api => Get.find<ApiService>();
  StorageService get _storage => Get.find<StorageService>();

  final isLoading = false.obs;
  final isDemoLoading = false.obs;
  final errorMessage = ''.obs;
  final isDemoMode = false.obs;

  @override
  void onInit() {
    super.onInit();
    _checkDemoStatus();
    _storage.prewarmDeviceInfo();
  }

  Future<void> _checkDemoStatus() async {
    isDemoMode.value = await DemoService.checkDemoStatus();
  }

  Future<void> demoLogin() async {
    await DemoService.demoLogin(isLoading: isDemoLoading);
  }

  String? validateIdNumber(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Please enter your ID number';
    }
    return null;
  }

  String? validateActivationCode(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Please enter the activation code from your branch';
    }
    if (value.trim().length < 4) {
      return 'Activation code is too short';
    }
    return null;
  }

  Future<void> activate(String idNumber, String activationCode) async {
    errorMessage.value = '';
    isLoading.value = true;

    try {
      final deviceId = await _storage.getOrCreateDeviceId();
      final deviceName = await _storage.getDeviceName();

      final response = await _api.post(
        ApiConstants.mobileActivateInit,
        data: {
          'id_number': idNumber.trim().toUpperCase(),
          'activation_code': activationCode.trim().toUpperCase(),
          'device_id': deviceId,
          'device_name': deviceName,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        Get.toNamed(
          Routes.otpVerify,
          arguments: {
            'id_number': idNumber.trim().toUpperCase(),
            'masked_phone': data['masked_phone'],
            'member_name': data['member_name'],
            'organization_name': data['organization_name'],
            'flow': 'activation',
            'device_id': deviceId,
            'device_name': deviceName,
          },
        );
      }
    } catch (e) {
      final msg = _getErrorMessage(e);
      errorMessage.value = msg;
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
      if (errorStr.contains('404')) return 'ID number not found. Please check and try again.';
      if (errorStr.contains('400')) {
        if (errorStr.contains('expired')) return 'Activation code has expired. Contact your branch for a new one.';
        if (errorStr.contains('not been activated')) return 'Mobile banking has not been activated for this account. Contact your branch.';
        if (errorStr.contains('Invalid activation')) return 'Invalid activation code. Please check and try again.';
      }
      if (errorStr.contains('403')) return 'Account is not active. Contact administrator.';
      if (errorStr.contains('SocketException')) return 'No internet connection';
    }
    return 'Something went wrong. Please try again.';
  }
}
