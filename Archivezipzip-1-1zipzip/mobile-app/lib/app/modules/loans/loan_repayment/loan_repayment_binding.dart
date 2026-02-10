import 'package:get/get.dart';

import '../../../data/repositories/payment_repository.dart';
import 'loan_repayment_controller.dart';

class LoanRepaymentBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<PaymentRepository>(() => PaymentRepository());
    Get.lazyPut<LoanRepaymentController>(() => LoanRepaymentController());
  }
}
