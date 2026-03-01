import 'package:get/get.dart';
import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';
import '../home/home_controller.dart';

class SoftLoanController extends GetxController {
  final ApiService _api = Get.find<ApiService>();
  HomeController get homeController => Get.find<HomeController>();

  final isLoading = true.obs;
  final isApplying = false.obs;
  final hasError = false.obs;

  final enabled = false.obs;
  final eligible = false.obs;
  final limit = 0.0.obs;
  final baseAmount = 0.0.obs;
  final globalMax = 0.0.obs;
  final interestRate = 0.0.obs;
  final termMonths = 1.obs;
  final breakdown = <Map<String, dynamic>>[].obs;
  final gateFailures = <String>[].obs;

  final selectedAmount = 0.0.obs;
  final purpose = ''.obs;
  final disbursementMethod = 'mpesa'.obs;
  final disbursementPhone = ''.obs;

  @override
  void onInit() {
    super.onInit();
    loadEligibility();
  }

  Future<void> loadEligibility() async {
    isLoading.value = true;
    hasError.value = false;
    try {
      final response = await _api.get(ApiConstants.softLoanEligibility);
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        enabled.value = data['enabled'] == true;
        eligible.value = data['eligible'] == true;
        limit.value = (data['limit'] ?? 0.0).toDouble();
        baseAmount.value = (data['base_amount'] ?? 0.0).toDouble();
        globalMax.value = (data['global_max'] ?? 0.0).toDouble();
        interestRate.value = (data['interest_rate'] ?? 10.0).toDouble();
        termMonths.value = (data['term_months'] ?? 1) as int;
        breakdown.assignAll(
          (data['breakdown'] as List<dynamic>? ?? [])
              .map((e) => Map<String, dynamic>.from(e))
              .toList(),
        );
        gateFailures.assignAll(
          List<String>.from(data['gate_failures'] ?? []),
        );
        if (eligible.value && selectedAmount.value == 0) {
          selectedAmount.value = limit.value;
        }
      } else {
        hasError.value = true;
      }
    } catch (e) {
      hasError.value = true;
    } finally {
      isLoading.value = false;
    }
  }

  double get sliderMin => limit.value > 0 ? limit.value.clamp(1.0, 1000.0) : 1.0;

  double get totalInterest =>
      (selectedAmount.value * interestRate.value / 100) * termMonths.value;

  double get totalRepayment => selectedAmount.value + totalInterest;

  Future<Map<String, dynamic>?> applyForSoftLoan() async {
    if (!eligible.value || selectedAmount.value <= 0) return null;
    isApplying.value = true;
    try {
      final response = await _api.post(
        ApiConstants.softLoanApply,
        data: {
          'amount': selectedAmount.value,
          'purpose': purpose.value.isEmpty ? 'Soft Loan' : purpose.value,
          'disbursement_method': disbursementMethod.value,
          'disbursement_phone': disbursementPhone.value.isEmpty
              ? null
              : disbursementPhone.value,
        },
      );
      if (response.statusCode == 200) {
        return Map<String, dynamic>.from(response.data);
      }
    } catch (e) {
      // error surfaced by caller returning null
    } finally {
      isApplying.value = false;
    }
    return null;
  }

  String formatCurrency(double amount) =>
      homeController.formatCurrency(amount);
}
