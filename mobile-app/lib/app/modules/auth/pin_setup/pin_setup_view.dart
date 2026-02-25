import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../core/theme/app_theme.dart';
import 'pin_setup_controller.dart';

class PinSetupView extends StatefulWidget {
  const PinSetupView({super.key});

  @override
  State<PinSetupView> createState() => _PinSetupViewState();
}

class _PinSetupViewState extends State<PinSetupView> {
  final _pinController = TextEditingController();
  final _confirmController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  late final PinSetupController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = Get.find<PinSetupController>();
  }

  @override
  void dispose() {
    _pinController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      _ctrl.setupPin(_pinController.text);
    }
  }

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
            key: _formKey,
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
                  'Set Your Password',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 8),

                const Text(
                  'Create a 6-digit password to secure\nyour mobile banking access.',
                  style: TextStyle(
                    fontSize: 15,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 40),

                Obx(() => TextFormField(
                  controller: _pinController,
                  validator: _ctrl.validatePin,
                  keyboardType: TextInputType.number,
                  obscureText: _ctrl.obscurePin.value,
                  maxLength: 6,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(6),
                  ],
                  decoration: InputDecoration(
                    labelText: 'Enter 6-digit Password',
                    hintText: '6-digit password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    counterText: '',
                    suffixIcon: IconButton(
                      icon: Icon(
                        _ctrl.obscurePin.value
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                      onPressed: () => _ctrl.obscurePin.toggle(),
                    ),
                  ),
                )),

                const SizedBox(height: 16),

                Obx(() => TextFormField(
                  controller: _confirmController,
                  validator: (v) => _ctrl.validateConfirmPin(v, _pinController.text),
                  keyboardType: TextInputType.number,
                  obscureText: _ctrl.obscureConfirmPin.value,
                  maxLength: 6,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(6),
                  ],
                  decoration: InputDecoration(
                    labelText: 'Confirm Password',
                    hintText: 'Re-enter your 6-digit password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    counterText: '',
                    suffixIcon: IconButton(
                      icon: Icon(
                        _ctrl.obscureConfirmPin.value
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                      onPressed: () => _ctrl.obscureConfirmPin.toggle(),
                    ),
                  ),
                )),

                const SizedBox(height: 32),

                Obx(() => ElevatedButton(
                  onPressed: _ctrl.isLoading.value ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(56),
                  ),
                  child: _ctrl.isLoading.value
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'Activate Mobile Banking',
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
                          'Keep your 6-digit password confidential. Never share it with anyone, including staff.',
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
