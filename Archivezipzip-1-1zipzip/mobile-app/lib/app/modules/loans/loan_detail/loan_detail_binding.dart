import 'package:get/get.dart';
import 'loan_detail_controller.dart';

class LoanDetailBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<LoanDetailController>(() => LoanDetailController());
  }
}
