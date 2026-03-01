import 'package:get/get.dart';
import 'soft_loan_controller.dart';

class SoftLoanBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<SoftLoanController>(() => SoftLoanController());
  }
}
