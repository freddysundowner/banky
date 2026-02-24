import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../core/theme/app_theme.dart';
import '../../home/home_controller.dart';
import 'loan_repayment_controller.dart';

class LoanRepaymentView extends GetView<LoanRepaymentController> {
  const LoanRepaymentView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Make Payment'),
      ),
      body: Obx(() {
        final loan = controller.loan.value;
        if (loan == null) {
          return const Center(child: Text('Loan not found'));
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: controller.formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Outstanding Balance',
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              controller.formatCurrency(loan.outstandingBalance),
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: AppColors.warning,
                              ),
                            ),
                          ],
                        ),
                        if (loan.monthlyPayment != null)
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Text(
                                'Monthly Due',
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                controller.formatCurrency(loan.monthlyPayment!),
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(height: 24),
                
                const Text(
                  'Payment Amount',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                
                TextFormField(
                  controller: controller.amountController,
                  validator: controller.validateAmount,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                  decoration: InputDecoration(
                    prefixText: '${Get.find<HomeController>().currencySymbol} ',
                    hintText: '0',
                  ),
                ),
                
                const SizedBox(height: 12),
                
                Wrap(
                  spacing: 8,
                  children: [
                    if (loan.monthlyPayment != null)
                      _buildQuickAmountChip(loan.monthlyPayment!, 'Monthly'),
                    _buildQuickAmountChip(loan.outstandingBalance, 'Full'),
                    if (loan.outstandingBalance > 1000)
                      _buildQuickAmountChip(1000, '1,000'),
                    if (loan.outstandingBalance > 5000)
                      _buildQuickAmountChip(5000, '5,000'),
                  ],
                ),
                
                const SizedBox(height: 24),
                
                const Text(
                  'Payment Method',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                
                ...controller.paymentMethods.map((method) => Obx(() => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: RadioListTile<String>(
                    value: method['id'] as String,
                    groupValue: controller.selectedPaymentMethod.value,
                    onChanged: (value) => controller.setPaymentMethod(value!),
                    title: Row(
                      children: [
                        Icon(method['icon'] as IconData, color: AppColors.primary),
                        const SizedBox(width: 12),
                        Text(method['name'] as String),
                      ],
                    ),
                    activeColor: AppColors.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ))),
                
                Obx(() {
                  if (controller.selectedPaymentMethod.value == 'mpesa') {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 16),
                        const Text(
                          'M-Pesa Phone Number',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: controller.phoneController,
                          validator: controller.validatePhone,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            prefixText: '+254 ',
                            hintText: '7XX XXX XXX',
                          ),
                        ),
                      ],
                    );
                  }
                  return const SizedBox.shrink();
                }),
                
                const SizedBox(height: 32),
                
                Obx(() => SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: controller.isLoading.value
                        ? null
                        : controller.processPayment,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: controller.isLoading.value
                        ? const SizedBox(
                            height: 24,
                            width: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text(
                            'Pay Now',
                            style: TextStyle(fontSize: 16),
                          ),
                  ),
                )),
                
                const SizedBox(height: 16),
                
                const Center(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.lock, size: 16, color: AppColors.textSecondary),
                      SizedBox(width: 4),
                      Text(
                        'Secure payment processing',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }

  Widget _buildQuickAmountChip(double amount, String label) {
    return ActionChip(
      label: Text(label),
      onPressed: () => controller.setQuickAmount(amount),
    );
  }
}
