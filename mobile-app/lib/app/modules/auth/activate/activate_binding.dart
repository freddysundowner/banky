import 'package:get/get.dart';
import 'activate_controller.dart';

class ActivateBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<ActivateController>(() => ActivateController());
  }
}
