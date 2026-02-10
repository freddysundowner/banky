import 'package:get/get.dart';

import '../../data/repositories/member_repository.dart';
import '../../data/repositories/payment_repository.dart';
import '../../data/repositories/statement_repository.dart';
import 'home_controller.dart';

class HomeBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<MemberRepository>(() => MemberRepository());
    Get.lazyPut<PaymentRepository>(() => PaymentRepository());
    Get.lazyPut<StatementRepository>(() => StatementRepository());
    Get.lazyPut<HomeController>(() => HomeController());
  }
}
