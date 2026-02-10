import 'package:get/get.dart';

import '../../data/models/loan_model.dart';
import '../../data/repositories/member_repository.dart';
import '../home/home_controller.dart';

class LoansController extends GetxController {
  final MemberRepository _memberRepo = Get.find<MemberRepository>();
  HomeController get homeController => Get.find<HomeController>();

  final isLoading = false.obs;
  final loans = <LoanModel>[].obs;
  final selectedFilter = 'all'.obs;

  final filters = ['all', 'active', 'completed', 'pending'];

  @override
  void onInit() {
    super.onInit();
    loadLoans();
  }

  Future<void> loadLoans() async {
    isLoading.value = true;
    try {
      final result = await _memberRepo.getLoans();
      loans.assignAll(result);
    } catch (e) {
      print('Error loading loans: $e');
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> refreshLoans() async {
    await loadLoans();
  }

  List<LoanModel> get filteredLoans {
    if (selectedFilter.value == 'all') {
      return loans;
    }
    return loans.where((loan) {
      switch (selectedFilter.value) {
        case 'active':
          return loan.isActive;
        case 'completed':
          return loan.status == LoanStatus.completed;
        case 'pending':
          return loan.status == LoanStatus.pending || loan.status == LoanStatus.approved;
        default:
          return true;
      }
    }).toList();
  }

  void setFilter(String filter) {
    selectedFilter.value = filter;
  }

  int get activeLoansCount => loans.where((l) => l.isActive).length;
  double get totalOutstanding => loans.where((l) => l.isActive).fold(0.0, (sum, l) => sum + l.outstandingBalance);

  String formatCurrency(double amount) {
    return homeController.formatCurrency(amount);
  }
}
