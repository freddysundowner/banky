import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../routes/app_pages.dart';
import 'loan_detail_controller.dart';

class LoanDetailView extends GetView<LoanDetailController> {
  const LoanDetailView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Loan Details'),
      ),
      body: Obx(() {
        if (controller.isLoading.value && controller.loan.value == null) {
          return const Center(child: CircularProgressIndicator());
        }

        final loan = controller.loan.value;
        if (loan == null) {
          return const Center(child: Text('Loan not found'));
        }

        return RefreshIndicator(
          onRefresh: controller.refreshLoan,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildLoanHeader(loan),
                const SizedBox(height: 24),
                _buildProgressSection(loan),
                const SizedBox(height: 24),
                _buildLoanDetails(loan),
                const SizedBox(height: 24),
                _buildRepaymentSchedule(),
                const SizedBox(height: 80),
              ],
            ),
          ),
        );
      }),
      bottomSheet: Obx(() {
        final loan = controller.loan.value;
        if (loan == null || !loan.isActive) return const SizedBox.shrink();
        
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 10,
                offset: const Offset(0, -5),
              ),
            ],
          ),
          child: SafeArea(
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Get.toNamed(
                  Routes.loanRepayment,
                  arguments: {'loan': loan},
                ),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: const Text('Make Payment'),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildLoanHeader(loan) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        loan.loanProductName ?? 'Loan',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (loan.loanNumber != null)
                        Text(
                          '#${loan.loanNumber}',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: loan.isOverdue
                        ? AppColors.error.withOpacity(0.1)
                        : loan.isActive
                            ? AppColors.success.withOpacity(0.1)
                            : AppColors.textSecondary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    loan.isOverdue ? 'Overdue' : loan.statusLabel,
                    style: TextStyle(
                      color: loan.isOverdue
                          ? AppColors.error
                          : loan.isActive
                              ? AppColors.success
                              : AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
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
                        fontSize: 28,
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
                        'Monthly Payment',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        controller.formatCurrency(loan.monthlyPayment!),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressSection(loan) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Repayment Progress',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  controller.formatCurrency(loan.amountPaid),
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
                Text(
                  controller.formatCurrency(loan.totalAmount),
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: loan.progressPercentage / 100,
                minHeight: 12,
                backgroundColor: AppColors.border,
                valueColor: AlwaysStoppedAnimation<Color>(
                  loan.isOverdue ? AppColors.error : AppColors.success,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${loan.progressPercentage.toStringAsFixed(1)}% Complete',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                Obx(() => Text(
                  '${controller.paidInstallments}/${controller.totalInstallments} Installments',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                )),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoanDetails(loan) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Loan Information',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            _buildDetailRow('Principal Amount', controller.formatCurrency(loan.principalAmount)),
            _buildDetailRow('Interest Rate', '${loan.interestRate}% p.a.'),
            _buildDetailRow('Loan Term', '${loan.termMonths} months'),
            _buildDetailRow('Total Repayable', controller.formatCurrency(loan.totalAmount)),
            if (loan.disbursementDate != null)
              _buildDetailRow('Disbursed On', DateFormat('MMM d, yyyy').format(loan.disbursementDate!)),
            if (loan.maturityDate != null)
              _buildDetailRow('Maturity Date', DateFormat('MMM d, yyyy').format(loan.maturityDate!)),
            if (loan.nextPaymentDate != null)
              _buildDetailRow('Next Payment', DateFormat('MMM d, yyyy').format(loan.nextPaymentDate!)),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: AppColors.textSecondary),
          ),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildRepaymentSchedule() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Repayment Schedule',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        Obx(() {
          if (controller.repaymentSchedule.isEmpty) {
            return const Card(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                  child: Text(
                    'No schedule available',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ),
              ),
            );
          }

          return Card(
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: controller.repaymentSchedule.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final installment = controller.repaymentSchedule[index];
                final isOverdue = !installment.isPaid && 
                    installment.dueDate.isBefore(DateTime.now());

                return ListTile(
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: installment.isPaid
                          ? AppColors.success.withOpacity(0.1)
                          : isOverdue
                              ? AppColors.error.withOpacity(0.1)
                              : AppColors.border,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: installment.isPaid
                          ? const Icon(Icons.check, color: AppColors.success, size: 20)
                          : Text(
                              '${installment.installmentNumber}',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: isOverdue
                                    ? AppColors.error
                                    : AppColors.textSecondary,
                              ),
                            ),
                    ),
                  ),
                  title: Text(
                    DateFormat('MMM d, yyyy').format(installment.dueDate),
                    style: TextStyle(
                      fontWeight: FontWeight.w500,
                      color: isOverdue ? AppColors.error : null,
                    ),
                  ),
                  subtitle: Text(
                    installment.isPaid 
                        ? 'Paid' 
                        : isOverdue 
                            ? 'Overdue' 
                            : 'Pending',
                    style: TextStyle(
                      fontSize: 12,
                      color: installment.isPaid
                          ? AppColors.success
                          : isOverdue
                              ? AppColors.error
                              : AppColors.textSecondary,
                    ),
                  ),
                  trailing: Text(
                    controller.formatCurrency(installment.totalAmount),
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                );
              },
            ),
          );
        }),
      ],
    );
  }
}
