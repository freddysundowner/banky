import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../data/models/member_model.dart';
import '../../data/models/organization_model.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/member_repository.dart';
import '../../routes/app_pages.dart';
import '../transactions/transactions_controller.dart';
import '../statements/statements_controller.dart';
import '../loans/loans_controller.dart';

class HomeController extends GetxController {
  final AuthRepository _authRepo = Get.find<AuthRepository>();
  final MemberRepository _memberRepo = Get.find<MemberRepository>();

  final currentIndex = 0.obs;
  final isLoading = false.obs;
  
  final Rx<MemberModel?> member = Rx<MemberModel?>(null);
  final Rx<OrganizationModel?> organization = Rx<OrganizationModel?>(null);
  
  final savingsBalance = 0.0.obs;
  final sharesBalance = 0.0.obs;
  final loanBalance = 0.0.obs;
  final unreadNotifications = 0.obs;

  @override
  void onInit() {
    super.onInit();
    loadInitialData();
  }

  Future<void> loadInitialData() async {
    isLoading.value = true;
    try {
      member.value = _authRepo.getCachedMember();
      organization.value = await _authRepo.getCurrentOrganization();
      
      final freshMember = await _memberRepo.getMemberDetails();
      if (freshMember != null) {
        member.value = freshMember;
        savingsBalance.value = freshMember.savingsBalance;
        sharesBalance.value = freshMember.sharesBalance;
        loanBalance.value = freshMember.loanBalance;
      }
    } catch (e) {
      print('Error loading initial data: $e');
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> refreshData() async {
    await loadInitialData();
  }

  void onNavTap(int index) {
    currentIndex.value = index;
    if (index == 1) {
      try { Get.find<TransactionsController>().loadTransactions(refresh: true); } catch (_) {}
    }
    if (index == 2) {
      try { Get.find<LoansController>().loadLoans(); } catch (_) {}
    }
  }

  void navigateToDashboard() {
    currentIndex.value = 0;
  }

  void navigateToTransactions() {
    Get.toNamed(Routes.transactions);
  }

  void navigateToLoans() {
    Get.toNamed(Routes.loans);
  }

  void navigateToProfile() {
    Get.toNamed(Routes.profile);
  }

  void navigateToStatements() {
    Get.toNamed(Routes.statements);
  }

  void navigateToNotifications() {
    Get.toNamed(Routes.notifications);
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
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
            ),
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

  String get currencySymbol => organization.value?.currencySymbol ?? '\$';
  
  String formatCurrency(double amount) {
    final formatted = amount.toStringAsFixed(2).replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (Match m) => '${m[1]},',
    );
    return '$currencySymbol $formatted';
  }
}
