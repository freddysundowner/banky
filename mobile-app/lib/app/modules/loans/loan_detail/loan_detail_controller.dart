import 'package:get/get.dart';

import '../../../data/models/loan_model.dart';
import '../../../data/repositories/member_repository.dart';
import '../../home/home_controller.dart';

class LoanDetailController extends GetxController {
  final MemberRepository _memberRepo = Get.find<MemberRepository>();
  HomeController get homeController => Get.find<HomeController>();

  final isLoading = false.obs;
  final Rx<LoanModel?> loan = Rx<LoanModel?>(null);
  final repaymentSchedule = <LoanRepaymentSchedule>[].obs;

  String? loanId;

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments as Map<String, dynamic>?;
    loanId = args?['loanId'];
    if (loanId != null) {
      loadLoanDetails();
    }
  }

  Future<void> loadLoanDetails() async {
    if (loanId == null) return;
    
    isLoading.value = true;
    try {
      final loanDetails = await _memberRepo.getLoanDetails(loanId!);
      if (loanDetails != null) {
        loan.value = loanDetails;
        if (loanDetails.repaymentSchedule.isNotEmpty) {
          repaymentSchedule.assignAll(loanDetails.repaymentSchedule);
        } else {
          final schedule = await _memberRepo.getLoanSchedule(loanId!);
          repaymentSchedule.assignAll(schedule);
        }
      }
    } catch (e) {
      print('Error loading loan details: $e');
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> refreshLoan() async {
    await loadLoanDetails();
  }

  int get paidInstallments => repaymentSchedule.where((s) => s.isPaid).length;
  int get totalInstallments => repaymentSchedule.length;
  
  LoanRepaymentSchedule? get nextDueInstallment {
    return repaymentSchedule.firstWhereOrNull((s) => !s.isPaid);
  }

  String formatCurrency(double amount) {
    return homeController.formatCurrency(amount);
  }
}
