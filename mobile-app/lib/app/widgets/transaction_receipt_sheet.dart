import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../core/theme/app_theme.dart';
import '../data/models/transaction_model.dart';
import '../modules/home/home_controller.dart';

class TransactionReceiptSheet extends StatelessWidget {
  final TransactionModel tx;

  const TransactionReceiptSheet({super.key, required this.tx});

  static void show(TransactionModel tx) {
    Get.bottomSheet(
      TransactionReceiptSheet(tx: tx),
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
    );
  }

  @override
  Widget build(BuildContext context) {
    final homeCtrl = Get.find<HomeController>();
    final isCredit = tx.isCredit;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),

          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: isCredit
                  ? AppColors.success.withOpacity(0.1)
                  : AppColors.error.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
              color: isCredit ? AppColors.success : AppColors.error,
              size: 36,
            ),
          ),
          const SizedBox(height: 12),

          Text(
            tx.typeLabel,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${isCredit ? '+' : '-'}${homeCtrl.formatCurrency(tx.amount)}',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: isCredit ? AppColors.success : AppColors.error,
            ),
          ),
          const SizedBox(height: 4),
          _StatusBadge(status: tx.status),
          const SizedBox(height: 20),

          Container(
            margin: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                _ReceiptRow(
                  label: 'Date',
                  value: DateFormat('dd MMM yyyy, h:mm a').format(tx.transactionDate),
                ),
                _Divider(),
                _ReceiptRow(
                  label: 'Account',
                  value: _formatAccountType(tx.accountType),
                ),
                if (tx.referenceNumber != null && tx.referenceNumber!.isNotEmpty) ...[
                  _Divider(),
                  _ReceiptRow(
                    label: 'Reference',
                    value: tx.referenceNumber!,
                    copyable: true,
                  ),
                ],
                if (tx.paymentMethod != null && tx.paymentMethod!.isNotEmpty) ...[
                  _Divider(),
                  _ReceiptRow(
                    label: 'Method',
                    value: tx.paymentMethod!.replaceAll('_', ' ').toUpperCase(),
                  ),
                ],
                if (tx.description != null && tx.description!.isNotEmpty) ...[
                  _Divider(),
                  _ReceiptRow(
                    label: 'Description',
                    value: tx.description!,
                  ),
                ],
                if (tx.balanceBefore != null) ...[
                  _Divider(),
                  _ReceiptRow(
                    label: 'Balance Before',
                    value: homeCtrl.formatCurrency(tx.balanceBefore!),
                  ),
                ],
                if (tx.balanceAfter != null) ...[
                  _Divider(),
                  _ReceiptRow(
                    label: 'Balance After',
                    value: homeCtrl.formatCurrency(tx.balanceAfter!),
                    bold: true,
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Get.back(),
                child: const Text('Close'),
              ),
            ),
          ),
          SizedBox(height: MediaQuery.of(context).padding.bottom + 12),
        ],
      ),
    );
  }

  String _formatAccountType(AccountType type) {
    switch (type) {
      case AccountType.savings:
        return 'Savings Account';
      case AccountType.shares:
        return 'Shares Account';
      case AccountType.loan:
        return 'Loan Account';
      case AccountType.fixedDeposit:
        return 'Fixed Deposit';
    }
  }
}

class _StatusBadge extends StatelessWidget {
  final TransactionStatus status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label;
    switch (status) {
      case TransactionStatus.completed:
        bg = AppColors.success.withOpacity(0.1);
        fg = AppColors.success;
        label = 'Completed';
        break;
      case TransactionStatus.pending:
        bg = Colors.orange.withOpacity(0.1);
        fg = Colors.orange;
        label = 'Pending';
        break;
      case TransactionStatus.failed:
        bg = AppColors.error.withOpacity(0.1);
        fg = AppColors.error;
        label = 'Failed';
        break;
      case TransactionStatus.reversed:
        bg = Colors.grey.withOpacity(0.15);
        fg = Colors.grey;
        label = 'Reversed';
        break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(color: fg, fontSize: 13, fontWeight: FontWeight.w600)),
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  final String label;
  final String value;
  final bool copyable;
  final bool bold;

  const _ReceiptRow({
    required this.label,
    required this.value,
    this.copyable = false,
    this.bold = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: bold ? FontWeight.bold : FontWeight.w500,
              ),
              textAlign: TextAlign.right,
            ),
          ),
          if (copyable) ...[
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: value));
                Get.snackbar(
                  'Copied',
                  'Reference copied to clipboard',
                  snackPosition: SnackPosition.BOTTOM,
                  duration: const Duration(seconds: 2),
                );
              },
              child: const Icon(Icons.copy, size: 16, color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Divider(height: 1, thickness: 1, color: Colors.grey.shade200);
  }
}
