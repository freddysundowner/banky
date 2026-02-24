import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../constants/api_constants.dart';
import 'api_service.dart';
import 'storage_service.dart';
import '../../routes/app_pages.dart';

class DemoService {
  static final ApiService _api = Get.find<ApiService>();
  static final StorageService _storage = Get.find<StorageService>();

  static Future<bool> checkDemoStatus() async {
    try {
      final response = await _api.get(ApiConstants.mobileDemoStatus);
      if (response.statusCode == 200) {
        return response.data['demo'] == true;
      }
    } catch (_) {}
    return false;
  }

  static Future<void> demoLogin({required RxBool isLoading}) async {
    isLoading.value = true;

    try {
      final response =
          await _api.post(ApiConstants.mobileDemoLogin, data: {});

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['access_token'] != null) {
          await _storage.saveToken(data['access_token'] as String);
        }
        if (data['org_id'] != null) {
          _storage.saveOrganization({
            'id': data['org_id'] as String,
            'name': data['org_name'] ?? '',
          });
        }
        Get.offAllNamed(Routes.home);
      }
    } catch (e) {
      Get.snackbar(
        'Error',
        'Demo login failed. Please try again.',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.shade100,
        colorText: Colors.red.shade900,
        margin: const EdgeInsets.all(16),
      );
    } finally {
      isLoading.value = false;
    }
  }
}
