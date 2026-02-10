import 'package:get/get.dart';
import 'loans_controller.dart';

class LoansBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<LoansController>(() => LoansController());
  }
}
