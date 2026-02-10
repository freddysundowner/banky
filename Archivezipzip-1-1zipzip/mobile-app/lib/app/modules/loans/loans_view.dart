import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../routes/app_pages.dart';
import 'loans_controller.dart';

class LoansView extends GetView<LoansController> {
  const LoansView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('My Loans'),
      ),
      body: Obx(() {
        if (controller.isLoading.value && controller.loans.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        return RefreshIndicator(
          onRefresh: controller.refreshLoans,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      _buildSummaryCard(),
                      const SizedBox(height: 16),
                      _buildFilterChips(),
                    ],
                  ),
                ),
              ),
              _buildLoansList(),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildSummaryCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.warning, Color(0xFFD97706)],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Total Outstanding',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.8),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Obx(() => Text(
                    controller.formatCurrency(controller.totalOutstanding),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                  )),
                ],
              ),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Obx(() => Text(
                      controller.activeLoansCount.toString(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    )),
                    Text(
                      'Active',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Obx(() => Row(
        children: controller.filters.map((filter) {
          final isSelected = controller.selectedFilter.value == filter;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(filter.capitalize!),
              selected: isSelected,
              onSelected: (_) => controller.setFilter(filter),
              selectedColor: AppColors.primary,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : AppColors.textPrimary,
              ),
            ),
          );
        }).toList(),
      )),
    );
  }

  Widget _buildLoansList() {
    return Obx(() {
      final loans = controller.filteredLoans;
      
      if (loans.isEmpty) {
        return SliverFillRemaining(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.check_circle_outline,
                  size: 64,
                  color: AppColors.success.withOpacity(0.5),
                ),
                const SizedBox(height: 16),
                const Text(
                  'No loans found',
                  style: TextStyle(
                    fontSize: 18,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        );
      }

      return SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) {
              final loan = loans[index];
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: InkWell(
                  onTap: () => Get.toNamed(
                    Routes.loanDetail,
                    arguments: {'loanId': loan.id},
                  ),
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
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
                                      fontWeight: FontWeight.w600,
                                      fontSize: 16,
                                    ),
                                  ),
                                  if (loan.loanNumber != null)
                                    Text(
                                      '#${loan.loanNumber}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            _buildStatusBadge(loan),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: _buildLoanStat(
                                'Principal',
                                controller.formatCurrency(loan.principalAmount),
                              ),
                            ),
                            Expanded(
                              child: _buildLoanStat(
                                'Outstanding',
                                controller.formatCurrency(loan.outstandingBalance),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _buildLoanStat(
                                'Interest Rate',
                                '${loan.interestRate}%',
                              ),
                            ),
                            Expanded(
                              child: _buildLoanStat(
                                'Term',
                                '${loan.termMonths} months',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: loan.progressPercentage / 100,
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
                              '${loan.progressPercentage.toStringAsFixed(1)}% repaid',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            if (loan.nextPaymentDate != null)
                              Text(
                                'Next: ${DateFormat('MMM d').format(loan.nextPaymentDate!)}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                          ],
                        ),
                        if (loan.isActive) ...[
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              onPressed: () => Get.toNamed(
                                Routes.loanRepayment,
                                arguments: {'loan': loan},
                              ),
                              child: const Text('Make Payment'),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            },
            childCount: loans.length,
          ),
        ),
      );
    });
  }

  Widget _buildStatusBadge(loan) {
    Color bgColor;
    Color textColor;
    
    if (loan.isOverdue) {
      bgColor = AppColors.error.withOpacity(0.1);
      textColor = AppColors.error;
    } else if (loan.status.name == 'completed') {
      bgColor = AppColors.success.withOpacity(0.1);
      textColor = AppColors.success;
    } else if (loan.isActive) {
      bgColor = AppColors.primary.withOpacity(0.1);
      textColor = AppColors.primary;
    } else {
      bgColor = AppColors.warning.withOpacity(0.1);
      textColor = AppColors.warning;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        loan.isOverdue ? 'Overdue' : loan.statusLabel,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: textColor,
        ),
      ),
    );
  }

  Widget _buildLoanStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
