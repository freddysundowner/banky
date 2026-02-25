import 'package:get/get.dart';

import '../../core/services/storage_service.dart';
import '../../data/repositories/auth_repository.dart';
import '../../routes/app_pages.dart';

class SplashController extends GetxController {
  @override
  void onInit() {
    super.onInit();
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    try {
      final storage = Get.find<StorageService>();

      // Pre-warm device info during splash delay so login is instant.
      await Future.wait([
        Future.delayed(const Duration(seconds: 2)),
        storage.getOrCreateDeviceId(),
        storage.getDeviceName(),
      ]);

      final AuthRepository authRepo = Get.find<AuthRepository>();
      final isLoggedIn = await authRepo.isLoggedIn();

      if (isLoggedIn) {
        final member = await authRepo.getCurrentMember();
        if (member != null) {
          Get.offAllNamed(Routes.home);
        } else {
          Get.offAllNamed(Routes.login);
        }
      } else {
        Get.offAllNamed(Routes.login);
      }
    } catch (e) {
      print('Splash error: $e');
      Get.offAllNamed(Routes.login);
    }
  }
}
