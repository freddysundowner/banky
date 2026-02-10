import 'package:get/get.dart';
import 'otp_verify_controller.dart';

class OtpVerifyBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<OtpVerifyController>(() => OtpVerifyController());
  }
}
