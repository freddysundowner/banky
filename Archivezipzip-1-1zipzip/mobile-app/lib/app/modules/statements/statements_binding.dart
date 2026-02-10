import 'package:get/get.dart';

import '../../data/repositories/statement_repository.dart';
import 'statements_controller.dart';

class StatementsBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<StatementRepository>(() => StatementRepository());
    Get.lazyPut<StatementsController>(() => StatementsController());
  }
}
