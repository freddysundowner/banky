class ApiConstants {
  static const String baseUrl = 'https://3e13bd8b-1f7f-48c5-bf2b-75718b4cb073-00-3fpjxxho3njqf.kirk.replit.dev';
  
  // Legacy auth endpoints (kept for backward compatibility)
  static const String memberLogin = '/api/auth/member/login';
  static const String memberLoginVerify = '/api/auth/member/login-verify';
  static const String memberActivate = '/api/auth/member/activate';
  static const String memberVerifyOtp = '/api/auth/member/verify-otp';
  static const String memberResendOtp = '/api/auth/member/resend-otp';
  static const String logout = '/api/auth/logout';

  // New Mobile Auth — /api/mobile/auth/*
  static const String _auth = '/api/mobile/auth';
  static const String mobileActivateInit = '$_auth/activate/init';
  static const String mobileActivateComplete = '$_auth/activate/complete';
  static const String mobileLogin = '$_auth/login';
  static const String mobileLoginVerify = '$_auth/login/verify';
  static const String mobileResendOtp = '$_auth/resend-otp';
  static const String mobileLogout = '$_auth/logout';

  // M-Pesa (unchanged — existing backend routes)
  static const String mpesaPayment = '/api/mpesa/stk-push';
  static const String mpesaStatusBase = '/api/mpesa/stk-push'; // append /{id}/status

  // Mobile Member API — all served from /api/mobile/
  static const String _m = '/api/mobile';

  static const String memberMe = '$_m/me';

  // Shorthand aliases used across repositories
  static const String loans = '$_m/me/loans';
  static const String notifications = '$_m/me/notifications';
  static const String statements = '$_m/me/statements';
  static const String memberDashboard = '$_m/me/dashboard';
  static const String memberBalances = '$_m/me/balances';
  static const String memberSavings = '$_m/me/savings';
  static const String memberShares = '$_m/me/shares';
  static const String memberFixedDeposits = '$_m/me/fixed-deposits';
  static const String memberTransactions = '$_m/me/transactions';
  static const String memberMiniStatement = '$_m/me/mini-statement';
  static const String memberLoans = '$_m/me/loans';
  static const String memberLoanProducts = '$_m/me/loan-products';
  static const String memberLoanApplications = '$_m/me/loan-applications';
  static const String memberNotifications = '$_m/me/notifications';
  static const String memberPayments = '$_m/me/payments';

  // Dynamic paths — use helper methods below
  static String memberLoanDetail(String loanId) => '$_m/me/loans/$loanId';
  static String memberLoanSchedule(String loanId) => '$_m/me/loans/$loanId/schedule';
  static String memberLoanRepayment(String loanId) => '$_m/me/loans/$loanId/repayments';
  static String mpesaStatus(String transactionId) => '/api/mpesa/stk-push/$transactionId/status';

  static const Duration connectionTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
