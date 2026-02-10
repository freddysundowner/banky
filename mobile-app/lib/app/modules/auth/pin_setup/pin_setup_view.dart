import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../core/theme/app_theme.dart';
import 'pin_setup_controller.dart';

class PinSetupView extends GetView<PinSetupController> {
  const PinSetupView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Get.back(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: controller.formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),

                Center(
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Icon(
                      Icons.pin_outlined,
                      size: 48,
                      color: AppColors.primary,
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                const Text(
                  'Set Your PIN',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 8),

                const Text(
                  'Create a 4-digit PIN to secure\nyour mobile banking access.',
                  style: TextStyle(
                    fontSize: 15,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 40),

                Obx(() => TextFormField(
                  controller: controller.pinController,
                  validator: controller.validatePin,
                  keyboardType: TextInputType.number,
                  obscureText: controller.obscurePin.value,
                  maxLength: 4,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                  ],
                  decoration: InputDecoration(
                    labelText: 'Enter PIN',
                    hintText: '4-digit PIN',
                    prefixIcon: const Icon(Icons.lock_outline),
                    counterText: '',
                    suffixIcon: IconButton(
                      icon: Icon(
                        controller.obscurePin.value
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                      onPressed: () => controller.obscurePin.toggle(),
                    ),
                  ),
                )),

                const SizedBox(height: 16),

                Obx(() => TextFormField(
                  controller: controller.confirmPinController,
                  validator: controller.validateConfirmPin,
                  keyboardType: TextInputType.number,
                  obscureText: controller.obscureConfirmPin.value,
                  maxLength: 4,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                  ],
                  decoration: InputDecoration(
                    labelText: 'Confirm PIN',
                    hintText: 'Re-enter your PIN',
                    prefixIcon: const Icon(Icons.lock_outline),
                    counterText: '',
                    suffixIcon: IconButton(
                      icon: Icon(
                        controller.obscureConfirmPin.value
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                      onPressed: () => controller.obscureConfirmPin.toggle(),
                    ),
                  ),
                )),

                const SizedBox(height: 32),

                Obx(() => ElevatedButton(
                  onPressed: controller.isLoading.value ? null : controller.setupPin,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(56),
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
                          'Activate',
                          style: TextStyle(fontSize: 16),
                        ),
                )),

                const SizedBox(height: 16),

                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.amber.shade800, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Keep your PIN confidential. Never share it with anyone.',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.amber.shade900,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
