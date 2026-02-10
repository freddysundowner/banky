import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../../../routes/app_pages.dart';

class ActivateController extends GetxController {
  ApiService get _api => Get.find<ApiService>();

  final accountNumberController = TextEditingController();
  final formKey = GlobalKey<FormState>();
  final isLoading = false.obs;
  final errorMessage = ''.obs;

  @override
  void onClose() {
    accountNumberController.dispose();
    super.onClose();
  }

  String? validateAccountNumber(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Please enter your account number';
    }
    return null;
  }

  Future<void> activate() async {
    if (!formKey.currentState!.validate()) return;

    errorMessage.value = '';
    isLoading.value = true;

    try {
      final response = await _api.post(
        ApiConstants.memberActivate,
        data: {'account_number': accountNumberController.text.trim()},
      );

      if (response.statusCode == 200) {
        final data = response.data;
        Get.toNamed(
          Routes.otpVerify,
          arguments: {
            'account_number': accountNumberController.text.trim(),
            'masked_phone': data['masked_phone'],
            'member_name': data['member_name'],
            'organization_name': data['organization_name'],
            'flow': 'activation',
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
      if (errorStr.contains('404')) return 'Account number not found';
      if (errorStr.contains('400')) {
        if (errorStr.contains('already activated')) return 'Mobile banking already activated. Please login.';
        if (errorStr.contains('No phone')) return 'No phone number on file. Contact your Sacco.';
      }
      if (errorStr.contains('403')) return 'Account is not active. Contact administrator.';
      if (errorStr.contains('SocketException')) return 'No internet connection';
    }
    return 'Something went wrong. Please try again.';
  }
}
