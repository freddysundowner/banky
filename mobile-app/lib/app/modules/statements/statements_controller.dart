import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:share_plus/share_plus.dart';

import '../../data/models/transaction_model.dart';
import '../../data/repositories/member_repository.dart';
import '../../data/repositories/statement_repository.dart';

class StatementsController extends GetxController {
  final StatementRepository _statementRepo = Get.find<StatementRepository>();
  final MemberRepository _memberRepo = Get.find<MemberRepository>();

  final isLoading = false.obs;
  final isGenerating = false.obs;
  final transactions = <TransactionModel>[].obs;

  final selectedAccountType = 'all'.obs;
  final startDate = Rxn<DateTime>();
  final endDate = Rxn<DateTime>();

  final accountTypes = ['savings', 'shares', 'loan', 'all'];

  @override
  void onInit() {
    super.onInit();
    final now = DateTime.now();
    startDate.value = DateTime(now.year, now.month - 1, now.day);
    endDate.value = now;
    loadStatements();
  }

  Future<void> loadStatements() async {
    isLoading.value = true;
    try {
      final result = await _memberRepo.getTransactions(
        limit: 200,
        accountType: selectedAccountType.value == 'all' ? null : selectedAccountType.value,
        startDate: startDate.value,
        endDate: endDate.value,
      );
      transactions.assignAll(result);
    } catch (e) {
      print('Error loading statement transactions: $e');
    } finally {
      isLoading.value = false;
    }
  }

  void setAccountType(String type) {
    selectedAccountType.value = type;
    loadStatements();
  }

  Future<void> selectStartDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: startDate.value ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      startDate.value = picked;
      loadStatements();
    }
  }

  Future<void> selectEndDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: endDate.value ?? DateTime.now(),
      firstDate: startDate.value ?? DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      endDate.value = picked;
      loadStatements();
    }
  }

  Future<void> generateStatement() async {
    if (startDate.value == null || endDate.value == null) {
      Get.snackbar(
        'Error',
        'Please select date range',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.shade100,
        colorText: Colors.red.shade900,
      );
      return;
    }

    isGenerating.value = true;
    try {
      final result = await _statementRepo.requestStatement(
        accountType: selectedAccountType.value,
        startDate: startDate.value!,
        endDate: endDate.value!,
      );

      if (result['success'] == true) {
        final statementId = result['data']?['id'];
        if (statementId != null) {
          await downloadStatement(statementId.toString());
        } else {
          Get.snackbar(
            'Success',
            'Statement generated successfully',
            snackPosition: SnackPosition.BOTTOM,
            backgroundColor: Colors.green.shade100,
            colorText: Colors.green.shade900,
          );
        }
      } else {
        Get.snackbar(
          'Error',
          result['message'] ?? 'Failed to generate statement',
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
      isGenerating.value = false;
    }
  }

  Future<void> downloadStatement(String statementId) async {
    isLoading.value = true;
    try {
      final result = await _statementRepo.downloadStatement(statementId);

      if (result['success'] == true) {
        Get.snackbar(
          'Downloaded',
          'Statement saved to ${result['filePath']}',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: Colors.green.shade100,
          colorText: Colors.green.shade900,
          mainButton: TextButton(
            onPressed: () => shareStatement(result['filePath']),
            child: const Text('Share'),
          ),
        );
      } else {
        Get.snackbar(
          'Error',
          result['message'] ?? 'Download failed',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: Colors.red.shade100,
          colorText: Colors.red.shade900,
        );
      }
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> shareStatement(String filePath) async {
    await Share.shareXFiles([XFile(filePath)], text: 'My Account Statement');
  }

  Future<void> getMiniStatement() async {
    isLoading.value = true;
    try {
      final result = await _statementRepo.generateMiniStatement();

      if (result['success'] == true) {
        _showMiniStatementDialog(result['data']);
      } else {
        Get.snackbar(
          'Error',
          result['message'] ?? 'Failed to get mini statement',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: Colors.red.shade100,
          colorText: Colors.red.shade900,
        );
      }
    } finally {
      isLoading.value = false;
    }
  }

  void _showMiniStatementDialog(Map<String, dynamic> data) {
    Get.dialog(
      AlertDialog(
        title: const Text('Mini Statement'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (data['balance'] != null)
                Text(
                  'Current Balance: KSh ${data['balance']}',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              const SizedBox(height: 16),
              if (data['transactions'] != null)
                ...List.generate(
                  (data['transactions'] as List).length,
                  (index) {
                    final tx = data['transactions'][index];
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(tx['type'] ?? ''),
                                Text(
                                  tx['date'] ?? '',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            'KSh ${tx['amount']}',
                            style: TextStyle(
                              color: tx['is_credit'] == true
                                  ? Colors.green
                                  : Colors.red,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Get.back(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
