import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../data/models/transaction_model.dart';
import '../../widgets/transaction_receipt_sheet.dart';
import '../home/home_controller.dart';
import 'statements_controller.dart';

class StatementsView extends GetView<StatementsController> {
  const StatementsView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Statements'),
        actions: [
          IconButton(
            onPressed: controller.getMiniStatement,
            icon: const Icon(Icons.receipt),
            tooltip: 'Mini Statement',
          ),
        ],
      ),
      body: Column(
        children: [
          _buildFilterCard(context),
          const SizedBox(height: 8),
          Expanded(child: _buildTransactionList()),
        ],
      ),
    );
  }

  Widget _buildFilterCard(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Account Type',
              style: TextStyle(fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 8),
            Obx(() => SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: controller.accountTypes.map((type) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(type.capitalize!),
                    selected: controller.selectedAccountType.value == type,
                    onSelected: (_) => controller.setAccountType(type),
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: controller.selectedAccountType.value == type
                          ? Colors.white
                          : AppColors.textPrimary,
                    ),
                  ),
                )).toList(),
              ),
            )),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('From', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 12)),
                      const SizedBox(height: 4),
                      Obx(() => InkWell(
                        onTap: () => controller.selectStartDate(context),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today, size: 16),
                              const SizedBox(width: 6),
                              Text(
                                controller.startDate.value != null
                                    ? DateFormat('MMM d, yy').format(controller.startDate.value!)
                                    : 'Select',
                                style: const TextStyle(fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      )),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('To', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 12)),
                      const SizedBox(height: 4),
                      Obx(() => InkWell(
                        onTap: () => controller.selectEndDate(context),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today, size: 16),
                              const SizedBox(width: 6),
                              Text(
                                controller.endDate.value != null
                                    ? DateFormat('MMM d, yy').format(controller.endDate.value!)
                                    : 'Select',
                                style: const TextStyle(fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      )),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Obx(() => ElevatedButton.icon(
                  onPressed: controller.isGenerating.value ? null : controller.generateStatement,
                  icon: controller.isGenerating.value
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)),
                        )
                      : const Icon(Icons.download, size: 18),
                  label: Text(controller.isGenerating.value ? '...' : 'PDF'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                )),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionList() {
    final homeCtrl = Get.find<HomeController>();
    return Obx(() {
      if (controller.isLoading.value) {
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
                'No transactions in this period',
                style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 4),
              const Text(
                'Try selecting a different date range',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
            ],
          ),
        );
      }

      return RefreshIndicator(
        onRefresh: controller.loadStatements,
        child: ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: controller.transactions.length,
          itemBuilder: (context, index) {
            final tx = controller.transactions[index];
            final showDateHeader = index == 0 ||
                !_isSameDay(tx.transactionDate, controller.transactions[index - 1].transactionDate);

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (showDateHeader) ...[
                  if (index > 0) const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Text(
                      _formatDateHeader(tx.transactionDate),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
                Card(
                  margin: const EdgeInsets.only(bottom: 6),
                  child: ListTile(
                    onTap: () => TransactionReceiptSheet.show(tx),
                    leading: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: tx.isCredit
                            ? AppColors.success.withOpacity(0.1)
                            : AppColors.error.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        tx.isCredit ? Icons.arrow_downward : Icons.arrow_upward,
                        color: tx.isCredit ? AppColors.success : AppColors.error,
                        size: 20,
                      ),
                    ),
                    title: Text(
                      tx.typeLabel,
                      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                    ),
                    subtitle: Text(
                      '${tx.accountType.name.capitalize!} • ${DateFormat('h:mm a').format(tx.transactionDate)}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                    trailing: Text(
                      '${tx.isCredit ? '+' : '-'}${homeCtrl.formatCurrency(tx.amount)}',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: tx.isCredit ? AppColors.success : AppColors.error,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      );
    });
  }

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  String _formatDateHeader(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final dateOnly = DateTime(date.year, date.month, date.day);
    if (dateOnly == today) return 'Today';
    if (dateOnly == yesterday) return 'Yesterday';
    return DateFormat('EEEE, MMMM d').format(date);
  }
}
