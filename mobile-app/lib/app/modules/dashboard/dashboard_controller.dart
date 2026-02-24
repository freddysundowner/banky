import 'dart:async';
import 'package:get/get.dart';

import '../../data/models/member_model.dart';
import '../../data/models/transaction_model.dart';
import '../../data/models/loan_model.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/member_repository.dart';
import '../../data/repositories/payment_repository.dart';
import '../../core/services/api_service.dart';
import '../home/home_controller.dart';
import '../transactions/transactions_controller.dart';

class DashboardController extends GetxController {
  final AuthRepository _authRepo = Get.find<AuthRepository>();
  final MemberRepository _memberRepo = Get.find<MemberRepository>();
  final PaymentRepository _paymentRepo = Get.find<PaymentRepository>();
  final ApiService _api = Get.find<ApiService>();

  HomeController get homeController => Get.find<HomeController>();

  final isLoading = false.obs;
  final isRefreshing = false.obs;
  final demoMode = false.obs;
  
  final Rx<MemberModel?> member = Rx<MemberModel?>(null);
  final recentTransactions = <TransactionModel>[].obs;
  final activeLoans = <LoanModel>[].obs;
  
  final savingsBalance = 0.0.obs;
  final sharesBalance = 0.0.obs;
  final loanBalance = 0.0.obs;
  final fixedDepositBalance = 0.0.obs;

  final showSavings = false.obs;
  final showShares = false.obs;
  final showFixedDeposits = false.obs;
  final showLoans = false.obs;

  @override
  void onInit() {
    super.onInit();
    loadDashboard();
  }

  Future<void> loadDashboard() async {
    isLoading.value = true;
    try {
      member.value = _authRepo.getCachedMember();

      try {
        final brandingRes = await _api.get('/api/public/branding');
        if (brandingRes.statusCode == 200 && brandingRes.data is Map) {
          demoMode.value = brandingRes.data['demo_mode'] == true;
        }
      } catch (_) {}
      
      final freshMember = await _memberRepo.getMemberDetails();
      if (freshMember != null) {
        member.value = freshMember;
        savingsBalance.value = freshMember.savingsBalance;
        sharesBalance.value = freshMember.sharesBalance;
        loanBalance.value = freshMember.loanBalance;
      }

      final balances = await _memberRepo.getAccountBalances();
      if (balances.isNotEmpty) {
        savingsBalance.value = (balances['savings'] ?? 0).toDouble();
        sharesBalance.value = (balances['shares'] ?? 0).toDouble();
        loanBalance.value = (balances['loans'] ?? 0).toDouble();
        fixedDepositBalance.value = (balances['fixed_deposits'] ?? 0).toDouble();
      }

      final transactions = await _memberRepo.getTransactions(limit: 5);
      recentTransactions.assignAll(transactions);

      final loans = await _memberRepo.getLoans(activeOnly: true);
      activeLoans.assignAll(loans);
    } catch (e) {
      print('Error loading dashboard: $e');
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> refreshDashboard() async {
    isRefreshing.value = true;
    await loadDashboard();
    isRefreshing.value = false;
  }

  double get totalBalance => savingsBalance.value + sharesBalance.value + fixedDepositBalance.value;
  double get netWorth => totalBalance - loanBalance.value;

  String formatCurrency(double amount) {
    return homeController.formatCurrency(amount);
  }

  Future<Map<String, dynamic>> deposit({
    required double amount,
    String accountType = 'savings',
    String? phone,
  }) async {
    final result = await _paymentRepo.initiateDeposit(
      amount: amount,
      accountType: accountType,
      phoneNumber: phone,
    );
    if (result['success'] == true) {
      await refreshDashboard();
      Future.delayed(const Duration(seconds: 6), () {
        try { Get.find<TransactionsController>().loadTransactions(refresh: true); } catch (_) {}
        refreshDashboard();
      });
    }
    return result;
  }

  Future<Map<String, dynamic>> withdraw({
    required double amount,
    String accountType = 'savings',
    String? phone,
  }) async {
    final result = await _paymentRepo.requestWithdrawal(
      amount: amount,
      accountType: accountType,
      phoneNumber: phone,
    );
    if (result['success'] == true) {
      await refreshDashboard();
    }
    return result;
  }

  double balanceForAccount(String accountType) {
    switch (accountType) {
      case 'shares': return sharesBalance.value;
      default: return savingsBalance.value;
    }
  }
}
