import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../data/models/member_model.dart';
import '../../data/models/organization_model.dart';
import '../../data/repositories/auth_repository.dart';
import '../../routes/app_pages.dart';

class ProfileController extends GetxController {
  final AuthRepository _authRepo = Get.find<AuthRepository>();

  final isLoading = false.obs;
  final isEditing = false.obs;
  
  final Rx<MemberModel?> member = Rx<MemberModel?>(null);
  final Rx<OrganizationModel?> organization = Rx<OrganizationModel?>(null);
  
  final phoneController = TextEditingController();
  final addressController = TextEditingController();
  final formKey = GlobalKey<FormState>();

  @override
  void onInit() {
    super.onInit();
    loadProfile();
  }

  @override
  void onClose() {
    phoneController.dispose();
    addressController.dispose();
    super.onClose();
  }

  Future<void> loadProfile() async {
    isLoading.value = true;
    try {
      member.value = _authRepo.getCachedMember();
      organization.value = await _authRepo.getCurrentOrganization();
      
      final freshMember = await _authRepo.getCurrentMember();
      if (freshMember != null) {
        member.value = freshMember;
        phoneController.text = freshMember.phone ?? '';
        addressController.text = freshMember.address ?? '';
      }
    } catch (e) {
      print('Error loading profile: $e');
    } finally {
      isLoading.value = false;
    }
  }

  void toggleEdit() {
    isEditing.value = !isEditing.value;
    if (!isEditing.value) {
      phoneController.text = member.value?.phone ?? '';
      addressController.text = member.value?.address ?? '';
    }
  }

  Future<void> saveProfile() async {
    if (!formKey.currentState!.validate()) return;
    
    isLoading.value = true;
    try {
      final result = await _authRepo.updateProfile(
        phone: phoneController.text.isNotEmpty ? phoneController.text : null,
        address: addressController.text.isNotEmpty ? addressController.text : null,
      );

      if (result['success']) {
        member.value = MemberModel.fromJson(result['data']);
        isEditing.value = false;
        Get.snackbar(
          'Success',
          'Profile updated successfully',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: Colors.green.shade100,
          colorText: Colors.green.shade900,
        );
      } else {
        Get.snackbar(
          'Error',
          result['message'] ?? 'Failed to update profile',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: Colors.red.shade100,
          colorText: Colors.red.shade900,
        );
      }
    } catch (e) {
      Get.snackbar(
        'Error',
        'An error occurred. Please try again.',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.shade100,
        colorText: Colors.red.shade900,
      );
    } finally {
      isLoading.value = false;
    }
  }

  void showChangePasswordDialog() {
    final currentPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    Get.dialog(
      AlertDialog(
        title: const Text('Change Password'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: currentPasswordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Current Password'),
                validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: newPasswordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'New Password'),
                validator: (v) {
                  if (v?.isEmpty ?? true) return 'Required';
                  if (v!.length < 6) return 'Min 6 characters';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: confirmPasswordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirm Password'),
                validator: (v) {
                  if (v != newPasswordController.text) return 'Passwords don\'t match';
                  return null;
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Get.back(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (formKey.currentState!.validate()) {
                Get.back();
                await changePassword(
                  currentPasswordController.text,
                  newPasswordController.text,
                );
              }
            },
            child: const Text('Change'),
          ),
        ],
      ),
    );
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    isLoading.value = true;
    try {
      final result = await _authRepo.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );

      if (result['success']) {
        Get.snackbar(
          'Success',
          'Password changed successfully',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: Colors.green.shade100,
          colorText: Colors.green.shade900,
        );
      } else {
        Get.snackbar(
          'Error',
          result['message'] ?? 'Failed to change password',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: Colors.red.shade100,
          colorText: Colors.red.shade900,
        );
      }
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> logout() async {
    final confirmed = await Get.dialog<bool>(
      AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Get.back(result: false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Get.back(result: true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _authRepo.logout();
      Get.offAllNamed(Routes.login);
    }
  }
}
