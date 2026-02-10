import 'package:get/get.dart';
import '../../data/repositories/auth_repository.dart';
import 'splash_controller.dart';

class SplashBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<AuthRepository>(() => AuthRepository(), fenix: true);
    Get.lazyPut<SplashController>(() => SplashController());
  }
}
