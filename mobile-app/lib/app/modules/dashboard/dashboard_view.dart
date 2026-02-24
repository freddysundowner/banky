import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../routes/app_pages.dart';
import 'dashboard_controller.dart';

class DashboardView extends GetView<DashboardController> {
  const DashboardView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Obx(() {
        if (controller.isLoading.value && controller.member.value == null) {
          return const Center(child: CircularProgressIndicator());
        }

        return RefreshIndicator(
          onRefresh: controller.refreshDashboard,
          child: CustomScrollView(
            slivers: [
              _buildAppBar(context),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 0, 0),
                  child: _buildBalanceCarousel(),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    _buildQuickActions(),
                    const SizedBox(height: 24),
                    _buildRecentTransactions(),
                    const SizedBox(height: 24),
                    _buildActiveLoans(),
                    const SizedBox(height: 24),
                  ]),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 120,
      floating: false,
      pinned: true,
      backgroundColor: AppColors.primary,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.primary, AppColors.primaryDark],
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: Colors.white.withOpacity(0.2),
                    child: Obx(() => Text(
                      controller.member.value?.initials ?? 'U',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    )),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Hello,',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.8),
                            fontSize: 14,
                          ),
                        ),
                        Obx(() => Text(
                          controller.member.value?.firstName ?? 'Member',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        )),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Get.toNamed(Routes.notifications),
                    icon: const Icon(Icons.notifications_outlined, color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBalanceCarousel() {
    return Obx(() {
      final cards = [
        _BalanceCardData(
          label: 'Total Balance',
          amount: controller.totalBalance,
          icon: Icons.account_balance_outlined,
          gradient: [AppColors.primary, AppColors.primaryDark],
          visible: controller.showTotal,
        ),
        _BalanceCardData(
          label: 'Savings',
          amount: controller.savingsBalance.value,
          icon: Icons.savings_outlined,
          gradient: [const Color(0xFF43A047), const Color(0xFF2E7D32)],
          visible: controller.showSavings,
        ),
        _BalanceCardData(
          label: 'Share Capital',
          amount: controller.sharesBalance.value,
          icon: Icons.pie_chart_outline,
          gradient: [const Color(0xFF7B1FA2), const Color(0xFF4A148C)],
          visible: controller.showShares,
        ),
        _BalanceCardData(
          label: 'Fixed Deposits',
          amount: controller.fixedDepositBalance.value,
          icon: Icons.lock_clock_outlined,
          gradient: [const Color(0xFF0277BD), const Color(0xFF01579B)],
          visible: controller.showFixedDeposits,
        ),
        _BalanceCardData(
          label: 'Loan Balance',
          amount: controller.loanBalance.value,
          icon: Icons.account_balance_wallet_outlined,
          gradient: [const Color(0xFFE65100), const Color(0xFFBF360C)],
          visible: controller.showLoans,
        ),
      ];

      return SizedBox(
        height: 120,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: cards.length,
          separatorBuilder: (_, __) => const SizedBox(width: 12),
          padding: const EdgeInsets.only(right: 16),
          itemBuilder: (context, index) {
            final card = cards[index];
            return _buildBalanceCard(card);
          },
        ),
      );
    });
  }

  Widget _buildBalanceCard(_BalanceCardData card) {
    return Container(
      width: 230,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: card.gradient,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: card.gradient.first.withOpacity(0.35),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(card.icon, color: Colors.white, size: 20),
              ),
              Obx(() => GestureDetector(
                onTap: () => card.visible.value = !card.visible.value,
                child: Icon(
                  card.visible.value
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: Colors.white.withOpacity(0.8),
                  size: 20,
                ),
              )),
            ],
          ),
          const Spacer(),
          Text(
            card.label,
            style: TextStyle(
              color: Colors.white.withOpacity(0.8),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Obx(() => card.visible.value
              ? Text(
                  controller.formatCurrency(card.amount),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                  overflow: TextOverflow.ellipsis,
                )
              : const Text(
                  '••••••',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 4,
                  ),
                )),
        ],
      ),
    );
  }

  Widget _buildQuickActions() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _buildActionButton(
          icon: Icons.receipt_long,
          label: 'Statement',
          onTap: () => Get.toNamed(Routes.statements),
        ),
        _buildActionButton(
          icon: Icons.add_circle_outline,
          label: 'Deposit',
          onTap: () => _showDepositSheet(context: Get.context!),
        ),
        _buildActionButton(
          icon: Icons.remove_circle_outline,
          label: 'Withdraw',
          onTap: () => _showWithdrawSheet(context: Get.context!),
        ),
        _buildActionButton(
          icon: Icons.help_outline,
          label: 'Support',
          onTap: () {},
        ),
      ],
    );
  }

  void _showDepositSheet({required BuildContext context}) {
    final amountController = TextEditingController();
    final phoneController = TextEditingController(
      text: controller.member.value?.phone ?? '',
    );
    final selectedAccount = 'savings'.obs;
    final isLoading = false.obs;
    final errorMsg = ''.obs;

    const accounts = [
      {'value': 'savings', 'label': 'Savings Account'},
      {'value': 'shares', 'label': 'Share Capital'},
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 24, right: 24, top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.add_circle_outline, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                const Text('Deposit via M-Pesa',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 20),
            Obx(() => DropdownButtonFormField<String>(
              value: selectedAccount.value,
              decoration: InputDecoration(
                labelText: 'Deposit to',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              items: accounts.map((a) => DropdownMenuItem(
                value: a['value'],
                child: Text(a['label']!),
              )).toList(),
              onChanged: (v) {
                if (v != null) selectedAccount.value = v;
                errorMsg.value = '';
              },
            )),
            const SizedBox(height: 12),
            TextField(
              controller: amountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
              decoration: InputDecoration(
                labelText: 'Amount (KES)',
                prefixText: 'KES ',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneController,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'M-Pesa Phone Number',
                hintText: '07XXXXXXXX',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 8),
            Obx(() => errorMsg.value.isNotEmpty
                ? Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(errorMsg.value,
                        style: const TextStyle(color: AppColors.error, fontSize: 13)),
                  )
                : const SizedBox.shrink()),
            const SizedBox(height: 8),
            Obx(() => SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: isLoading.value
                    ? null
                    : () async {
                        final amount = double.tryParse(amountController.text.trim());
                        if (amount == null || amount <= 0) {
                          errorMsg.value = 'Enter a valid amount';
                          return;
                        }
                        errorMsg.value = '';
                        isLoading.value = true;
                        final result = await controller.deposit(
                          amount: amount,
                          accountType: selectedAccount.value,
                          phone: phoneController.text.trim().isNotEmpty
                              ? phoneController.text.trim()
                              : null,
                        );
                        isLoading.value = false;
                        if (result['success'] == true) {
                          Navigator.pop(ctx);
                          Get.snackbar('Deposit Initiated', result['message'] ?? 'Check your phone for M-Pesa prompt',
                              backgroundColor: AppColors.success,
                              colorText: Colors.white,
                              duration: const Duration(seconds: 5));
                        } else {
                          errorMsg.value = result['message'] ?? 'Deposit failed';
                        }
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: isLoading.value
                    ? const SizedBox(height: 20, width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Send M-Pesa Prompt', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            )),
          ],
        ),
      ),
    );
  }

  void _showWithdrawSheet({required BuildContext context}) {
    final amountController = TextEditingController();
    final phoneController = TextEditingController(
      text: controller.member.value?.phone ?? '',
    );
    final isLoading = false.obs;
    final errorMsg = ''.obs;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 24, right: 24, top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.remove_circle_outline, color: AppColors.warning),
                ),
                const SizedBox(width: 12),
                const Text('Withdraw via M-Pesa',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 8),
            Obx(() => Text(
              'Available: ${controller.formatCurrency(controller.savingsBalance.value)}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            )),
            const SizedBox(height: 20),
            TextField(
              controller: amountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
              decoration: InputDecoration(
                labelText: 'Amount (KES)',
                prefixText: 'KES ',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneController,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'M-Pesa Phone Number',
                hintText: '07XXXXXXXX',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 8),
            Obx(() => errorMsg.value.isNotEmpty
                ? Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(errorMsg.value,
                        style: const TextStyle(color: AppColors.error, fontSize: 13)),
                  )
                : const SizedBox.shrink()),
            const SizedBox(height: 8),
            Obx(() => SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: isLoading.value
                    ? null
                    : () async {
                        final amount = double.tryParse(amountController.text.trim());
                        if (amount == null || amount <= 0) {
                          errorMsg.value = 'Enter a valid amount';
                          return;
                        }
                        if (amount > controller.savingsBalance.value) {
                          errorMsg.value = 'Amount exceeds available balance';
                          return;
                        }
                        errorMsg.value = '';
                        isLoading.value = true;
                        final result = await controller.withdraw(
                          amount: amount,
                          phone: phoneController.text.trim().isNotEmpty
                              ? phoneController.text.trim()
                              : null,
                        );
                        isLoading.value = false;
                        if (result['success'] == true) {
                          Navigator.pop(ctx);
                          Get.snackbar('Withdrawal Successful', result['message'] ?? 'Your withdrawal has been processed',
                              backgroundColor: AppColors.success,
                              colorText: Colors.white,
                              duration: const Duration(seconds: 4));
                        } else {
                          errorMsg.value = result['message'] ?? 'Withdrawal failed';
                        }
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.warning,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: isLoading.value
                    ? const SizedBox(height: 20, width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Confirm Withdrawal', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: AppColors.primary),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAccountsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'My Accounts',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        _buildAccountCard(
          title: 'Savings Account',
          balance: controller.savingsBalance.value,
          icon: Icons.savings,
          color: AppColors.success,
        ),
        const SizedBox(height: 8),
        _buildAccountCard(
          title: 'Share Capital',
          balance: controller.sharesBalance.value,
          icon: Icons.pie_chart,
          color: AppColors.primary,
        ),
        if (controller.loanBalance.value > 0) ...[
          const SizedBox(height: 8),
          _buildAccountCard(
            title: 'Loan Balance',
            balance: controller.loanBalance.value,
            icon: Icons.account_balance_wallet,
            color: AppColors.warning,
            isLoan: true,
          ),
        ],
      ],
    );
  }

  Widget _buildAccountCard({
    required String title,
    required double balance,
    required IconData icon,
    required Color color,
    bool isLoan = false,
  }) {
    return Card(
      child: ListTile(
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: color),
        ),
        title: Text(title),
        subtitle: Text(
          controller.formatCurrency(balance),
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isLoan ? AppColors.warning : AppColors.textPrimary,
          ),
        ),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }

  Widget _buildRecentTransactions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Recent Transactions',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            TextButton(
              onPressed: () => Get.toNamed(Routes.transactions),
              child: const Text('See All'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Obx(() {
          if (controller.recentTransactions.isEmpty) {
            return Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Column(
                    children: [
                      Icon(
                        Icons.receipt_long_outlined,
                        size: 48,
                        color: AppColors.textSecondary.withOpacity(0.5),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'No transactions yet',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          return Card(
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: controller.recentTransactions.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final tx = controller.recentTransactions[index];
                return ListTile(
                  leading: Container(
                    width: 40,
                    height: 40,
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
                  title: Text(tx.typeLabel),
                  subtitle: Text(
                    DateFormat('MMM d, yyyy').format(tx.transactionDate),
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: Text(
                    '${tx.isCredit ? '+' : '-'}${controller.formatCurrency(tx.amount)}',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: tx.isCredit ? AppColors.success : AppColors.error,
                    ),
                  ),
                );
              },
            ),
          );
        }),
      ],
    );
  }

  Widget _buildActiveLoans() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Active Loans',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            TextButton(
              onPressed: () => Get.toNamed(Routes.loans),
              child: const Text('View All'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Obx(() {
          if (controller.activeLoans.isEmpty) {
            return Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Column(
                    children: [
                      Icon(
                        Icons.check_circle_outline,
                        size: 48,
                        color: AppColors.success.withOpacity(0.5),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'No active loans',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          return ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: controller.activeLoans.length,
            itemBuilder: (context, index) {
              final loan = controller.activeLoans[index];
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
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
                            Text(
                              loan.loanProductName ?? 'Loan',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: loan.isOverdue
                                    ? AppColors.error.withOpacity(0.1)
                                    : AppColors.success.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                loan.isOverdue ? 'Overdue' : loan.statusLabel,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: loan.isOverdue
                                      ? AppColors.error
                                      : AppColors.success,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Outstanding',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                Text(
                                  controller.formatCurrency(loan.outstandingBalance),
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                const Text(
                                  'Monthly',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                Text(
                                  controller.formatCurrency(loan.monthlyPayment ?? 0),
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: loan.progressPercentage / 100,
                            backgroundColor: AppColors.border,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              loan.isOverdue ? AppColors.error : AppColors.primary,
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${loan.progressPercentage.toStringAsFixed(0)}% repaid',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        }),
      ],
    );
  }
}

class _BalanceCardData {
  final String label;
  final double amount;
  final IconData icon;
  final List<Color> gradient;
  final RxBool visible;

  _BalanceCardData({
    required this.label,
    required this.amount,
    required this.icon,
    required this.gradient,
    required this.visible,
  });
}
