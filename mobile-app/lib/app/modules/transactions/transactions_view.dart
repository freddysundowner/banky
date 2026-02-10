import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import 'transactions_controller.dart';

class TransactionsView extends GetView<TransactionsController> {
  const TransactionsView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Transactions'),
        actions: [
          Obx(() => controller.hasActiveFilters
              ? IconButton(
                  onPressed: controller.clearFilters,
                  icon: const Icon(Icons.filter_alt_off),
                  tooltip: 'Clear filters',
                )
              : const SizedBox.shrink()),
          IconButton(
            onPressed: () => _showFilterSheet(context),
            icon: const Icon(Icons.filter_list),
          ),
        ],
      ),
      body: Column(
        children: [
          Obx(() {
            if (controller.hasActiveFilters) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: AppColors.primary.withOpacity(0.1),
                child: Row(
                  children: [
                    const Icon(Icons.filter_alt, size: 16, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _buildFilterText(),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: controller.clearFilters,
                      child: const Text('Clear'),
                    ),
                  ],
                ),
              );
            }
            return const SizedBox.shrink();
          }),
          
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value && controller.transactions.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }

              if (controller.transactions.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.receipt_long_outlined,
                        size: 64,
                        color: AppColors.textSecondary.withOpacity(0.5),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'No transactions found',
                        style: TextStyle(
                          fontSize: 18,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      if (controller.hasActiveFilters) ...[
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: controller.clearFilters,
                          child: const Text('Clear filters'),
                        ),
                      ],
                    ],
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: controller.refreshTransactions,
                child: NotificationListener<ScrollNotification>(
                  onNotification: (notification) {
                    if (notification is ScrollEndNotification) {
                      if (notification.metrics.extentAfter < 200) {
                        controller.loadMore();
                      }
                    }
                    return false;
                  },
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: controller.transactions.length + (controller.isLoadingMore.value ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == controller.transactions.length) {
                        return const Center(
                          child: Padding(
                            padding: EdgeInsets.all(16),
                            child: CircularProgressIndicator(),
                          ),
                        );
                      }

                      final tx = controller.transactions[index];
                      final showDateHeader = index == 0 ||
                          !_isSameDay(
                            tx.transactionDate,
                            controller.transactions[index - 1].transactionDate,
                          );

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (showDateHeader) ...[
                            if (index > 0) const SizedBox(height: 16),
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Text(
                                _formatDateHeader(tx.transactionDate),
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ],
                          Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              leading: Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: tx.isCredit
                                      ? AppColors.success.withOpacity(0.1)
                                      : AppColors.error.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(
                                  tx.isCredit
                                      ? Icons.arrow_downward
                                      : Icons.arrow_upward,
                                  color: tx.isCredit
                                      ? AppColors.success
                                      : AppColors.error,
                                ),
                              ),
                              title: Text(
                                tx.typeLabel,
                                style: const TextStyle(fontWeight: FontWeight.w500),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (tx.description != null)
                                    Text(
                                      tx.description!,
                                      style: const TextStyle(fontSize: 12),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  Text(
                                    DateFormat('h:mm a').format(tx.transactionDate),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '${tx.isCredit ? '+' : '-'}${controller.formatCurrency(tx.amount)}',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: tx.isCredit
                                          ? AppColors.success
                                          : AppColors.error,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.border,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      tx.statusLabel,
                                      style: const TextStyle(
                                        fontSize: 10,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  void _showFilterSheet(BuildContext context) {
    Get.bottomSheet(
      Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Filter Transactions',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  onPressed: () => Get.back(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text('Account Type', style: TextStyle(fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            Obx(() => Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('All'),
                  selected: controller.selectedAccountType.value == null,
                  onSelected: (_) => controller.setAccountFilter(null),
                ),
                ...controller.accountTypes.map((type) => ChoiceChip(
                  label: Text(type.capitalize!),
                  selected: controller.selectedAccountType.value == type,
                  onSelected: (_) => controller.setAccountFilter(type),
                )),
              ],
            )),
            const SizedBox(height: 16),
            const Text('Transaction Type', style: TextStyle(fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            Obx(() => Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('All'),
                  selected: controller.selectedTransactionType.value == null,
                  onSelected: (_) => controller.setTransactionTypeFilter(null),
                ),
                ...controller.transactionTypes.map((type) => ChoiceChip(
                  label: Text(type.capitalize!),
                  selected: controller.selectedTransactionType.value == type,
                  onSelected: (_) => controller.setTransactionTypeFilter(type),
                )),
              ],
            )),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Get.back(),
                child: const Text('Apply Filters'),
              ),
            ),
          ],
        ),
      ),
      isScrollControlled: true,
    );
  }

  String _buildFilterText() {
    final filters = <String>[];
    if (controller.selectedAccountType.value != null) {
      filters.add(controller.selectedAccountType.value!.capitalize!);
    }
    if (controller.selectedTransactionType.value != null) {
      filters.add(controller.selectedTransactionType.value!.capitalize!);
    }
    return 'Filters: ${filters.join(", ")}';
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  String _formatDateHeader(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final dateOnly = DateTime(date.year, date.month, date.day);

    if (dateOnly == today) {
      return 'Today';
    } else if (dateOnly == yesterday) {
      return 'Yesterday';
    } else {
      return DateFormat('EEEE, MMMM d').format(date);
    }
  }
}
