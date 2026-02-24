import 'package:get/get.dart';

import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';

class PaymentRepository {
  final ApiService _api = Get.find<ApiService>();

  Future<Map<String, dynamic>> initiateMpesaPayment({
    required String phoneNumber,
    required double amount,
    required String loanId,
    String? description,
  }) async {
    try {
      final response = await _api.post(
        ApiConstants.mpesaPayment,
        data: {
          'phone_number': phoneNumber,
          'amount': amount,
          'loan_id': loanId,
          'description': description ?? 'Loan Repayment',
          'payment_type': 'loan_repayment',
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {
          'success': true,
          'data': response.data,
          'message': 'Please check your phone for M-Pesa prompt',
        };
      }
      
      return {
        'success': false,
        'message': response.data['message'] ?? 'Payment initiation failed',
      };
    } catch (e) {
      return {
        'success': false,
        'message': _getErrorMessage(e),
      };
    }
  }

  Future<Map<String, dynamic>> checkPaymentStatus(String transactionId) async {
    try {
      final response = await _api.get(
        '${ApiConstants.mpesaPayment}/$transactionId/status',
      );

      if (response.statusCode == 200) {
        return {
          'success': true,
          'status': response.data['status'],
          'data': response.data,
        };
      }
      
      return {
        'success': false,
        'message': 'Failed to check payment status',
      };
    } catch (e) {
      return {
        'success': false,
        'message': _getErrorMessage(e),
      };
    }
  }

  Future<Map<String, dynamic>> makeLoanRepayment({
    required String loanId,
    required double amount,
    required String paymentMethod,
    String? phoneNumber,
    String? reference,
  }) async {
    try {
      if (paymentMethod == 'mpesa' && phoneNumber != null) {
        return await initiateMpesaPayment(
          phoneNumber: phoneNumber,
          amount: amount,
          loanId: loanId,
        );
      }

      final response = await _api.post(
        '${ApiConstants.loans}/$loanId/repayments',
        data: {
          'amount': amount,
          'payment_method': paymentMethod,
          'reference': reference,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {
          'success': true,
          'data': response.data,
          'message': 'Payment recorded successfully',
        };
      }
      
      return {
        'success': false,
        'message': response.data['message'] ?? 'Payment failed',
      };
    } catch (e) {
      return {
        'success': false,
        'message': _getErrorMessage(e),
      };
    }
  }

  Future<Map<String, dynamic>> initiateDeposit({
    required double amount,
    String accountType = 'savings',
    String? phoneNumber,
    String? description,
  }) async {
    try {
      final body = <String, dynamic>{'amount': amount, 'account_type': accountType};
      if (phoneNumber != null) body['phone_number'] = phoneNumber;
      if (description != null) body['description'] = description;

      final response = await _api.post(ApiConstants.memberDeposit, data: body);

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': response.data, 'message': response.data['message'] ?? 'M-Pesa prompt sent'};
      }
      return {'success': false, 'message': response.data['detail'] ?? 'Deposit failed'};
    } catch (e) {
      return {'success': false, 'message': _getErrorMessage(e)};
    }
  }

  Future<Map<String, dynamic>> requestWithdrawal({
    required double amount,
    String accountType = 'savings',
    String? description,
  }) async {
    try {
      final response = await _api.post(
        ApiConstants.memberWithdraw,
        data: {'amount': amount, 'account_type': accountType, if (description != null) 'description': description},
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': response.data, 'message': response.data['message'] ?? 'Withdrawal successful'};
      }
      return {'success': false, 'message': response.data['detail'] ?? 'Withdrawal failed'};
    } catch (e) {
      return {'success': false, 'message': _getErrorMessage(e)};
    }
  }

  Future<List<Map<String, dynamic>>> getPaymentHistory({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _api.get(
        '${ApiConstants.memberMe}/payments',
        queryParameters: {'page': page, 'limit': limit},
      );

      if (response.statusCode == 200) {
        return List<Map<String, dynamic>>.from(response.data['items'] ?? response.data);
      }
    } catch (e) {
      print('Error getting payment history: $e');
    }
    return [];
  }

  String _getErrorMessage(dynamic error) {
    if (error is Exception) {
      final errorStr = error.toString();
      if (errorStr.contains('400')) {
        return 'Invalid payment details';
      } else if (errorStr.contains('402')) {
        return 'Insufficient funds';
      } else if (errorStr.contains('SocketException')) {
        return 'No internet connection';
      }
    }
    return 'Payment failed. Please try again.';
  }
}
