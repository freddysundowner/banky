import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../data/models/transaction_model.dart';
import '../../data/repositories/member_repository.dart';
import '../home/home_controller.dart';

class TransactionsController extends GetxController {
  final MemberRepository _memberRepo = Get.find<MemberRepository>();
  HomeController get homeController => Get.find<HomeController>();

  final isLoading = false.obs;
  final isLoadingMore = false.obs;
  final transactions = <TransactionModel>[].obs;
  
  final selectedAccountType = Rxn<String>();
  final selectedTransactionType = Rxn<String>();
  final startDate = Rxn<DateTime>();
  final endDate = Rxn<DateTime>();
  
  int currentPage = 1;
  bool hasMore = true;
  final int pageSize = 20;

  final accountTypes = ['savings', 'shares', 'loan'];
  final transactionTypes = ['deposit', 'withdrawal', 'transfer', 'repayment'];

  @override
  void onInit() {
    super.onInit();
    loadTransactions();
  }

  Future<void> loadTransactions({bool refresh = false}) async {
    if (refresh) {
      currentPage = 1;
      hasMore = true;
      transactions.clear();
    }

    if (!hasMore && !refresh) return;

    isLoading.value = transactions.isEmpty;
    isLoadingMore.value = transactions.isNotEmpty;

    try {
      final result = await _memberRepo.getTransactions(
        page: currentPage,
        limit: pageSize,
        accountType: selectedAccountType.value,
        transactionType: selectedTransactionType.value,
        startDate: startDate.value,
        endDate: endDate.value,
      );

      if (result.length < pageSize) {
        hasMore = false;
      }

      if (refresh) {
        transactions.assignAll(result);
      } else {
        transactions.addAll(result);
      }
      
      currentPage++;
    } catch (e) {
      print('Error loading transactions: $e');
      Get.snackbar(
        'Error',
        'Failed to load transactions',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.shade100,
        colorText: Colors.red.shade900,
      );
    } finally {
      isLoading.value = false;
      isLoadingMore.value = false;
    }
  }

  Future<void> refreshTransactions() async {
    await loadTransactions(refresh: true);
  }

  void loadMore() {
    if (!isLoadingMore.value && hasMore) {
      loadTransactions();
    }
  }

  void setAccountFilter(String? type) {
    selectedAccountType.value = type;
    loadTransactions(refresh: true);
  }

  void setTransactionTypeFilter(String? type) {
    selectedTransactionType.value = type;
    loadTransactions(refresh: true);
  }

  void setDateRange(DateTime? start, DateTime? end) {
    startDate.value = start;
    endDate.value = end;
    loadTransactions(refresh: true);
  }

  void clearFilters() {
    selectedAccountType.value = null;
    selectedTransactionType.value = null;
    startDate.value = null;
    endDate.value = null;
    loadTransactions(refresh: true);
  }

  bool get hasActiveFilters =>
      selectedAccountType.value != null ||
      selectedTransactionType.value != null ||
      startDate.value != null ||
      endDate.value != null;

  String formatCurrency(double amount) {
    return homeController.formatCurrency(amount);
  }
}
