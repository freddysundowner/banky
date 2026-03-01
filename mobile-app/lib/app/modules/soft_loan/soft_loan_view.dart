import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../core/theme/app_theme.dart';
import 'soft_loan_controller.dart';

class SoftLoanView extends GetView<SoftLoanController> {
  const SoftLoanView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Soft Loan'),
      ),
      body: Obx(() {
        if (controller.isLoading.value) {
          return const Center(child: CircularProgressIndicator());
        }

        if (controller.hasError.value) {
          return _buildError();
        }

        if (!controller.enabled.value) {
          return _buildUnavailable();
        }

        return RefreshIndicator(
          onRefresh: controller.loadEligibility,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildLimitCard(),
                const SizedBox(height: 20),
                if (!controller.eligible.value) ...[
                  _buildGateFailures(),
                ] else ...[
                  _buildAmountSelector(),
                  const SizedBox(height: 20),
                  _buildSummaryCard(),
                  const SizedBox(height: 20),
                  _buildPurposeField(),
                  const SizedBox(height: 20),
                  _buildApplyButton(),
                ],
                const SizedBox(height: 24),
                _buildBreakdown(),
              ],
            ),
          ),
        );
      }),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.cloud_off, size: 64, color: AppColors.textSecondary.withOpacity(0.4)),
            const SizedBox(height: 16),
            const Text(
              'Could not load soft loan data',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text(
              'Check your connection and try again.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: controller.loadEligibility,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUnavailable() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.flash_off, size: 64, color: AppColors.textSecondary.withOpacity(0.4)),
            const SizedBox(height: 16),
            const Text(
              'Soft loans not available',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text(
              'This organisation has not enabled soft loans yet.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLimitCard() {
    final eligible = controller.eligible.value;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: eligible
              ? [AppColors.primary, AppColors.primaryDark]
              : [AppColors.textSecondary, const Color(0xFF475569)],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.flash_on, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(
                'Soft Loan Limit',
                style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            controller.formatCurrency(controller.limit.value),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 36,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            eligible
                ? 'You are eligible — 1 month term, ${controller.interestRate.value.toStringAsFixed(1)}% interest'
                : 'You are not yet eligible',
            style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildGateFailures() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.error.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.info_outline, color: AppColors.error, size: 18),
              const SizedBox(width: 8),
              const Text(
                'Requirements not met',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...controller.gateFailures.map(
            (msg) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.close, color: AppColors.error, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(msg, style: const TextStyle(fontSize: 14)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmountSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'How much do you need?',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 12),
        Obx(() {
          final sliderMin = controller.sliderMin;
          final sliderMax = controller.limit.value;
          if (sliderMax <= sliderMin) {
            return Center(
              child: Text(
                controller.formatCurrency(sliderMax),
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            );
          }
          return Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    controller.formatCurrency(sliderMin),
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  Text(
                    controller.formatCurrency(sliderMax),
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Slider(
                value: controller.selectedAmount.value.clamp(sliderMin, sliderMax),
                min: sliderMin,
                max: sliderMax,
                divisions: ((sliderMax - sliderMin) / 500).floor().clamp(1, 200),
                activeColor: AppColors.primary,
                onChanged: (val) => controller.selectedAmount.value = val,
              ),
              Text(
                controller.formatCurrency(controller.selectedAmount.value),
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ],
          );
        }),
      ],
    );
  }

  Widget _buildSummaryCard() {
    return Obx(() => Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withOpacity(0.15)),
      ),
      child: Column(
        children: [
          _summaryRow('Principal', controller.formatCurrency(controller.selectedAmount.value)),
          _summaryRow(
            'Interest (${controller.interestRate.value.toStringAsFixed(1)}% for 1 month)',
            controller.formatCurrency(controller.totalInterest),
          ),
          const Divider(height: 20),
          _summaryRow(
            'Total Repayment',
            controller.formatCurrency(controller.totalRepayment),
            bold: true,
          ),
          const SizedBox(height: 4),
          _summaryRow('Due in', '1 month', bold: false),
        ],
      ),
    ));
  }

  Widget _summaryRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: AppColors.textSecondary,
              fontWeight: bold ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: bold ? FontWeight.bold : FontWeight.w500,
              fontSize: bold ? 16 : 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPurposeField() {
    return TextField(
      decoration: const InputDecoration(
        labelText: 'Purpose (optional)',
        hintText: 'e.g. Emergency, School fees...',
        border: OutlineInputBorder(),
        prefixIcon: Icon(Icons.edit_note),
      ),
      onChanged: (val) => controller.purpose.value = val,
    );
  }

  Widget _buildApplyButton() {
    return Obx(() => SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: controller.isApplying.value || controller.selectedAmount.value <= 0
            ? null
            : _handleApply,
        style: ElevatedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: controller.isApplying.value
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : const Text(
                'Get Loan Instantly',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
      ),
    ));
  }

  Future<void> _handleApply() async {
    final result = await controller.applyForSoftLoan();
    if (result != null && result['success'] == true) {
      Get.dialog(
        AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.success.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle, color: AppColors.success, size: 48),
              ),
              const SizedBox(height: 16),
              const Text(
                'Loan Approved!',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                controller.formatCurrency(result['amount']?.toDouble() ?? 0),
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Ref: ${result['application_number']}',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 8),
              const Text(
                'Your soft loan has been approved. Disbursement will be processed shortly.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Get.back();
                    Get.back();
                  },
                  child: const Text('Done'),
                ),
              ),
            ],
          ),
        ),
        barrierDismissible: false,
      );
    } else {
      Get.snackbar(
        'Failed',
        result?['detail'] ?? 'Could not process your loan. Please try again.',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: AppColors.error.withOpacity(0.9),
        colorText: Colors.white,
      );
    }
  }

  Widget _buildBreakdown() {
    if (controller.breakdown.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Your Limit Breakdown',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 4),
        const Text(
          'Repay on time to increase your limit',
          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 12),
        ...controller.breakdown.map((item) {
          final qualifies = item['qualifies'] == true;
          final contribution = (item['contribution'] ?? 0.0).toDouble();
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: qualifies
                  ? AppColors.success.withOpacity(0.05)
                  : AppColors.border.withOpacity(0.3),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: qualifies
                    ? AppColors.success.withOpacity(0.2)
                    : AppColors.border,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  qualifies ? Icons.check_circle : Icons.radio_button_unchecked,
                  color: qualifies ? AppColors.success : AppColors.textSecondary,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item['formula'] ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                      if (item['description'] != null)
                        Text(
                          item['description'],
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
                Text(
                  qualifies
                      ? '+${controller.formatCurrency(contribution)}'
                      : controller.formatCurrency(contribution),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: qualifies ? AppColors.success : AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
