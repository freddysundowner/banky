import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
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
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildGenerateCard(context),
            const SizedBox(height: 24),
            _buildStatementHistory(),
          ],
        ),
      ),
    );
  }

  Widget _buildGenerateCard(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Generate Statement',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            
            const Text(
              'Account Type',
              style: TextStyle(
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Obx(() => Wrap(
              spacing: 8,
              children: controller.accountTypes.map((type) => ChoiceChip(
                label: Text(type.capitalize!),
                selected: controller.selectedAccountType.value == type,
                onSelected: (_) => controller.setAccountType(type),
                selectedColor: AppColors.primary,
                labelStyle: TextStyle(
                  color: controller.selectedAccountType.value == type
                      ? Colors.white
                      : AppColors.textPrimary,
                ),
              )).toList(),
            )),
            
            const SizedBox(height: 16),
            
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'From',
                        style: TextStyle(fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 8),
                      Obx(() => InkWell(
                        onTap: () => controller.selectStartDate(context),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today, size: 20),
                              const SizedBox(width: 8),
                              Text(
                                controller.startDate.value != null
                                    ? DateFormat('MMM d, yyyy').format(controller.startDate.value!)
                                    : 'Select',
                              ),
                            ],
                          ),
                        ),
                      )),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'To',
                        style: TextStyle(fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 8),
                      Obx(() => InkWell(
                        onTap: () => controller.selectEndDate(context),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today, size: 20),
                              const SizedBox(width: 8),
                              Text(
                                controller.endDate.value != null
                                    ? DateFormat('MMM d, yyyy').format(controller.endDate.value!)
                                    : 'Select',
                              ),
                            ],
                          ),
                        ),
                      )),
                    ],
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 20),
            
            Obx(() => SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: controller.isGenerating.value
                    ? null
                    : controller.generateStatement,
                icon: controller.isGenerating.value
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Icon(Icons.description),
                label: Text(
                  controller.isGenerating.value ? 'Generating...' : 'Generate Statement',
                ),
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildStatementHistory() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Recent Statements',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        Obx(() {
          if (controller.isLoading.value && controller.statements.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (controller.statements.isEmpty) {
            return Card(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Center(
                  child: Column(
                    children: [
                      Icon(
                        Icons.description_outlined,
                        size: 48,
                        color: AppColors.textSecondary.withOpacity(0.5),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'No statements yet',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Generate your first statement above',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
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
              itemCount: controller.statements.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final statement = controller.statements[index];
                return ListTile(
                  leading: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.description,
                      color: AppColors.primary,
                    ),
                  ),
                  title: Text(
                    '${(statement['account_type'] as String?)?.capitalize ?? 'Account'} Statement',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  subtitle: Text(
                    statement['period'] ?? 
                    '${statement['start_date']} - ${statement['end_date']}',
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: IconButton(
                    onPressed: () => controller.downloadStatement(
                      statement['id'].toString(),
                    ),
                    icon: const Icon(Icons.download),
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
