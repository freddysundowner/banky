import 'package:get/get.dart';

import '../modules/splash/splash_binding.dart';
import '../modules/splash/splash_view.dart';
import '../modules/auth/login/login_binding.dart';
import '../modules/auth/login/login_view.dart';
import '../modules/auth/activate/activate_binding.dart';
import '../modules/auth/activate/activate_view.dart';
import '../modules/auth/otp_verify/otp_verify_binding.dart';
import '../modules/auth/otp_verify/otp_verify_view.dart';
import '../modules/auth/pin_setup/pin_setup_binding.dart';
import '../modules/auth/pin_setup/pin_setup_view.dart';
import '../modules/home/home_binding.dart';
import '../modules/home/home_view.dart';
import '../modules/dashboard/dashboard_binding.dart';
import '../modules/dashboard/dashboard_view.dart';
import '../modules/transactions/transactions_binding.dart';
import '../modules/transactions/transactions_view.dart';
import '../modules/loans/loans_binding.dart';
import '../modules/loans/loans_view.dart';
import '../modules/loans/loan_detail/loan_detail_binding.dart';
import '../modules/loans/loan_detail/loan_detail_view.dart';
import '../modules/loans/loan_repayment/loan_repayment_binding.dart';
import '../modules/loans/loan_repayment/loan_repayment_view.dart';
import '../modules/profile/profile_binding.dart';
import '../modules/profile/profile_view.dart';
import '../modules/statements/statements_binding.dart';
import '../modules/statements/statements_view.dart';
import '../modules/notifications/notifications_binding.dart';
import '../modules/notifications/notifications_view.dart';

part 'app_routes.dart';

class AppPages {
  AppPages._();

  static const initial = Routes.splash;

  static final routes = [
    GetPage(
      name: Routes.splash,
      page: () => const SplashView(),
      binding: SplashBinding(),
    ),
    GetPage(
      name: Routes.login,
      page: () => const LoginView(),
      binding: LoginBinding(),
    ),
    GetPage(
      name: Routes.activate,
      page: () => const ActivateView(),
      binding: ActivateBinding(),
    ),
    GetPage(
      name: Routes.otpVerify,
      page: () => const OtpVerifyView(),
      binding: OtpVerifyBinding(),
    ),
    GetPage(
      name: Routes.pinSetup,
      page: () => const PinSetupView(),
      binding: PinSetupBinding(),
    ),
    GetPage(
      name: Routes.home,
      page: () => const HomeView(),
      binding: HomeBinding(),
    ),
    GetPage(
      name: Routes.dashboard,
      page: () => const DashboardView(),
      binding: DashboardBinding(),
    ),
    GetPage(
      name: Routes.transactions,
      page: () => const TransactionsView(),
      binding: TransactionsBinding(),
    ),
    GetPage(
      name: Routes.loans,
      page: () => const LoansView(),
      binding: LoansBinding(),
    ),
    GetPage(
      name: Routes.loanDetail,
      page: () => const LoanDetailView(),
      binding: LoanDetailBinding(),
    ),
    GetPage(
      name: Routes.loanRepayment,
      page: () => const LoanRepaymentView(),
      binding: LoanRepaymentBinding(),
    ),
    GetPage(
      name: Routes.profile,
      page: () => const ProfileView(),
      binding: ProfileBinding(),
    ),
    GetPage(
      name: Routes.statements,
      page: () => const StatementsView(),
      binding: StatementsBinding(),
    ),
    GetPage(
      name: Routes.notifications,
      page: () => const NotificationsView(),
      binding: NotificationsBinding(),
    ),
  ];
}
