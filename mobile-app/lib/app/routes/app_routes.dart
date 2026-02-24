part of 'app_pages.dart';

abstract class Routes {
  Routes._();
  
  static const splash = '/splash';
  static const login = '/login';
  static const activate = '/activate';
  static const otpVerify = '/otp-verify';
  static const pinSetup = '/pin-setup';
  static const home = '/home';
  static const dashboard = '/dashboard';
  static const transactions = '/transactions';
  static const loans = '/loans';
  static const loanDetail = '/loan-detail';
  static const loanRepayment = '/loan-repayment';
  static const profile = '/profile';
  static const statements = '/statements';
  static const notifications = '/notifications';
}
