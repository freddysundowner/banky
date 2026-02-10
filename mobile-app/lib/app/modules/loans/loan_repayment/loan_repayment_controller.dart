import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../data/models/loan_model.dart';
import '../../../data/repositories/payment_repository.dart';
import '../../home/home_controller.dart';

class LoanRepaymentController extends GetxController {
  final PaymentRepository _paymentRepo = Get.find<PaymentRepository>();
  HomeController get homeController => Get.find<HomeController>();

  final formKey = GlobalKey<FormState>();
  final amountController = TextEditingController();
  final phoneController = TextEditingController();
  
  final isLoading = false.obs;
  final selectedPaymentMethod = 'mpesa'.obs;
  final Rx<LoanModel?> loan = Rx<LoanModel?>(null);

  final paymentMethods = [
    {'id': 'mpesa', 'name': 'M-Pesa', 'icon': Icons.phone_android},
    {'id': 'bank', 'name': 'Bank Transfer', 'icon': Icons.account_balance},
  ];

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments as Map<String, dynamic>?;
    if (args?['loan'] != null) {
      loan.value = args!['loan'] as LoanModel;
      amountController.text = (loan.value?.monthlyPayment ?? 0).toStringAsFixed(0);
    }
  }

  @override
  void onClose() {
    amountController.dispose();
    phoneController.dispose();
    super.onClose();
  }

  void setPaymentMethod(String method) {
    selectedPaymentMethod.value = method;
  }

  void setQuickAmount(double amount) {
    amountController.text = amount.toStringAsFixed(0);
  }

  Future<void> processPayment() async {
    if (!formKey.currentState!.validate()) return;
    if (loan.value == null) return;

    isLoading.value = true;

    try {
      final amount = double.parse(amountController.text);
      
      if (selectedPaymentMethod.value == 'mpesa') {
        if (phoneController.text.isEmpty) {
          Get.snackbar(
            'Error',
            'Please enter your M-Pesa phone number',
            snackPosition: SnackPosition.BOTTOM,
            backgroundColor: Colors.red.shade100,
            colorText: Colors.red.shade900,
          );
          isLoading.value = false;
          return;
        }

        final result = await _paymentRepo.initiateMpesaPayment(
          phoneNumber: phoneController.text,
          amount: amount,
          loanId: loan.value!.id,
        );

        if (result['success']) {
          Get.dialog(
            AlertDialog(
              title: const Text('M-Pesa Request Sent'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.phone_android,
                    size: 64,
                    color: AppColors.success,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Please check your phone for the M-Pesa prompt and enter your PIN to complete the payment.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Amount: ${formatCurrency(amount)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
              actions: [
                ElevatedButton(
                  onPressed: () {
                    Get.back();
                    Get.back(result: true);
                  },
                  child: const Text('Done'),
                ),
              ],
            ),
            barrierDismissible: false,
          );
        } else {
          Get.snackbar(
            'Payment Failed',
            result['message'] ?? 'Failed to initiate payment',
            snackPosition: SnackPosition.BOTTOM,
            backgroundColor: Colors.red.shade100,
            colorText: Colors.red.shade900,
          );
        }
      } else {
        Get.dialog(
          AlertDialog(
            title: const Text('Bank Transfer'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Please transfer to:'),
                const SizedBox(height: 16),
                _buildBankDetail('Bank', 'Example Bank'),
                _buildBankDetail('Account', '1234567890'),
                _buildBankDetail('Name', 'BANKY Sacco'),
                _buildBankDetail('Amount', formatCurrency(amount)),
                _buildBankDetail('Reference', loan.value!.loanNumber ?? loan.value!.id),
                const SizedBox(height: 16),
                const Text(
                  'Your payment will be reflected within 24-48 hours.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
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

  Widget _buildBankDetail(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondary)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  String? validateAmount(String? value) {
    if (value == null || value.isEmpty) {
      return 'Please enter an amount';
    }
    final amount = double.tryParse(value);
    if (amount == null || amount <= 0) {
      return 'Please enter a valid amount';
    }
    if (loan.value != null && amount > loan.value!.outstandingBalance) {
      return 'Amount exceeds outstanding balance';
    }
    return null;
  }

  String? validatePhone(String? value) {
    if (selectedPaymentMethod.value != 'mpesa') return null;
    if (value == null || value.isEmpty) {
      return 'Please enter your M-Pesa number';
    }
    if (value.length < 10) {
      return 'Please enter a valid phone number';
    }
    return null;
  }

  String formatCurrency(double amount) {
    return homeController.formatCurrency(amount);
  }
}

class AppColors {
  static const Color success = Color(0xFF22C55E);
  static const Color textSecondary = Color(0xFF64748B);
}
