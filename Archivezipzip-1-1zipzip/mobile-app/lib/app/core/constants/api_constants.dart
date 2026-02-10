class ApiConstants {
  static const String baseUrl = 'https://4e554371-078a-4f91-884a-cbad8c1e5080-00-min0a6uk6fsg.janeway.replit.dev';
  
  static const String login = '/api/auth/login';
  static const String memberLogin = '/api/auth/member/login';
  static const String memberLoginVerify = '/api/auth/member/login-verify';
  static const String memberActivate = '/api/auth/member/activate';
  static const String memberVerifyOtp = '/api/auth/member/verify-otp';
  static const String memberResendOtp = '/api/auth/member/resend-otp';
  static const String logout = '/api/auth/logout';
  static const String refreshToken = '/api/auth/refresh';
  static const String me = '/api/auth/user';
  
  static const String organizations = '/api/organizations';
  static const String dashboard = '/api/dashboard';
  static const String members = '/api/members';
  static const String memberMe = '/api/members/me';
  static const String transactions = '/api/transactions';
  static const String loans = '/api/loans';
  static const String loanApplications = '/api/loan-applications';
  static const String loanRepayments = '/api/loan-repayments';
  static const String savings = '/api/savings';
  static const String shares = '/api/shares';
  static const String fixedDeposits = '/api/fixed-deposits';
  static const String statements = '/api/statements';
  static const String notifications = '/api/notifications';
  static const String mpesaPayment = '/api/mpesa/stk-push';
  static const String mpesaCallback = '/api/mpesa/callback';
  
  static const Duration connectionTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
