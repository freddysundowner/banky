import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../../../routes/app_pages.dart';

class LoginController extends GetxController {
  ApiService get _api => Get.find<ApiService>();

  final accountNumberController = TextEditingController();
  final pinController = TextEditingController();
  
  final formKey = GlobalKey<FormState>();
  
  final isLoading = false.obs;
  final obscurePin = true.obs;
  final errorMessage = ''.obs;

  @override
  void onClose() {
    accountNumberController.dispose();
    pinController.dispose();
    super.onClose();
  }

  void togglePinVisibility() {
    obscurePin.value = !obscurePin.value;
  }

  Future<void> login() async {
    if (!formKey.currentState!.validate()) return;
    
    errorMessage.value = '';
    isLoading.value = true;

    try {
      final response = await _api.post(
        ApiConstants.memberLogin,
        data: {
          'account_number': accountNumberController.text.trim(),
          'pin': pinController.text,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        Get.toNamed(
          Routes.otpVerify,
          arguments: {
            'account_number': accountNumberController.text.trim(),
            'masked_phone': data['masked_phone'],
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

  String? validateAccountNumber(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Please enter your account number';
    }
    return null;
  }

  String? validatePin(String? value) {
    if (value == null || value.isEmpty) {
      return 'Please enter your PIN';
    }
    if (value.length != 4 || !RegExp(r'^\d{4}$').hasMatch(value)) {
      return 'PIN must be 4 digits';
    }
    return null;
  }

  String _getErrorMessage(dynamic error) {
    if (error is Exception) {
      final errorStr = error.toString();
      if (errorStr.contains('401')) return 'Invalid account number or PIN';
      if (errorStr.contains('400')) {
        if (errorStr.contains('not activated')) return 'Mobile banking not activated. Please activate first.';
      }
      if (errorStr.contains('403')) return 'Account is not active. Contact administrator.';
      if (errorStr.contains('SocketException')) return 'No internet connection';
    }
    return 'Something went wrong. Please try again.';
  }
}
