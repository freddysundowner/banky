import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/theme/app_theme.dart';
import '../../../routes/app_pages.dart';
import 'activate_controller.dart';

class ActivateView extends StatefulWidget {
  const ActivateView({super.key});

  @override
  State<ActivateView> createState() => _ActivateViewState();
}

class _ActivateViewState extends State<ActivateView> {
  final _idController = TextEditingController();
  final _codeController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  late final ActivateController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = Get.find<ActivateController>();
  }

  @override
  void dispose() {
    _idController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      _ctrl.activate(_idController.text, _codeController.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 48),

                Center(
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Icon(
                      Icons.phonelink_lock_outlined,
                      size: 48,
                      color: Colors.white,
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                const Text(
                  'Activate Mobile Banking',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 8),

                const Text(
                  'Enter your ID number and the activation code provided by your branch to get started.',
                  style: TextStyle(
                    fontSize: 15,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 40),

                TextFormField(
                  controller: _idController,
                  validator: _ctrl.validateIdNumber,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'ID Number',
                    hintText: 'Enter your national ID number',
                    prefixIcon: Icon(Icons.badge_outlined),
                  ),
                ),

                const SizedBox(height: 16),

                TextFormField(
                  controller: _codeController,
                  validator: _ctrl.validateActivationCode,
                  keyboardType: TextInputType.text,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    labelText: 'Activation Code',
                    hintText: 'Enter the code from your branch (e.g. ABCD1234)',
                    prefixIcon: Icon(Icons.vpn_key_outlined),
                  ),
                ),

                const SizedBox(height: 8),

                const Text(
                  'Your branch staff will give you this code when they activate your mobile banking.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),

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
                          'Continue',
                          style: TextStyle(fontSize: 16),
                        ),
                )),

                const SizedBox(height: 24),

                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Already activated? ',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    TextButton(
                      onPressed: () => Get.offAllNamed(Routes.login),
                      child: const Text('Sign In'),
                    ),
                  ],
                ),

                Obx(() => _ctrl.isDemoMode.value
                    ? Column(
                        children: [
                          const SizedBox(height: 16),
                          const Divider(),
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.amber.shade50,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.amber.shade200),
                            ),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.science_outlined,
                                        color: Colors.amber.shade700, size: 20),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Demo Mode Active',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: Colors.amber.shade800,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Skip activation and explore the app instantly with a demo account.',
                                  style: TextStyle(
                                    color: Colors.amber.shade900,
                                    fontSize: 13,
                                    height: 1.4,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                Obx(() => SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton.icon(
                                    onPressed: _ctrl.isDemoLoading.value
                                        ? null
                                        : _ctrl.demoLogin,
                                    icon: _ctrl.isDemoLoading.value
                                        ? const SizedBox(
                                            height: 18,
                                            width: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              valueColor:
                                                  AlwaysStoppedAnimation<Color>(
                                                      Colors.white),
                                            ),
                                          )
                                        : const Icon(Icons.play_arrow_rounded),
                                    label: Text(
                                      _ctrl.isDemoLoading.value
                                          ? 'Loading...'
                                          : 'Try Demo',
                                      style: const TextStyle(fontSize: 15),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.amber.shade600,
                                      foregroundColor: Colors.white,
                                      minimumSize: const Size.fromHeight(48),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  ),
                                )),
                              ],
                            ),
                          ),
                        ],
                      )
                    : const SizedBox.shrink()),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
