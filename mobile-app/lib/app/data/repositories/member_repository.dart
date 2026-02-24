import 'package:get/get.dart';

import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';
import '../models/member_model.dart';
import '../models/transaction_model.dart';
import '../models/loan_model.dart';

class MemberRepository {
  final ApiService _api = Get.find<ApiService>();

  Future<Map<String, dynamic>?> getMemberDetailsRaw() async {
    try {
      final response = await _api.get(ApiConstants.memberMe);
      if (response.statusCode == 200) {
        return Map<String, dynamic>.from(response.data);
      }
    } catch (e) {
      print('Error getting member details: $e');
    }
    return null;
  }

  Future<MemberModel?> getMemberDetails() async {
    final raw = await getMemberDetailsRaw();
    if (raw != null) {
      return MemberModel.fromJson(raw);
    }
    return null;
  }

  Future<Map<String, dynamic>> getDashboardData() async {
    try {
      final response = await _api.get('${ApiConstants.memberMe}/dashboard');
      if (response.statusCode == 200) {
        return response.data;
      }
    } catch (e) {
      print('Error getting dashboard: $e');
    }
    return {};
  }

  Future<List<TransactionModel>> getTransactions({
    int page = 1,
    int limit = 20,
    String? accountType,
    String? transactionType,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      
      if (accountType != null) queryParams['account_type'] = accountType;
      if (transactionType != null) queryParams['transaction_type'] = transactionType;
      if (startDate != null) queryParams['start_date'] = startDate.toIso8601String();
      if (endDate != null) queryParams['end_date'] = endDate.toIso8601String();

      final response = await _api.get(
        '${ApiConstants.memberMe}/transactions',
        queryParameters: queryParams,
      );
      
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data['items'] ?? response.data;
        return data.map((json) => TransactionModel.fromJson(json)).toList();
      }
    } catch (e) {
      print('Error getting transactions: $e');
    }
    return [];
  }

  Future<List<LoanModel>> getLoans({bool activeOnly = false}) async {
    try {
      final response = await _api.get('${ApiConstants.memberMe}/loans');
      
      if (response.statusCode == 200) {
        final raw = response.data;
        final List<dynamic> data = (raw is Map) ? (raw['items'] ?? raw['loans'] ?? []) : (raw as List<dynamic>);
        final all = data.map((json) => LoanModel.fromJson(json as Map<String, dynamic>)).toList();
        if (activeOnly) {
          return all.where((l) => l.isActive).toList();
        }
        return all;
      }
    } catch (e) {
      print('Error getting loans: $e');
    }
    return [];
  }

  Future<LoanModel?> getLoanDetails(String loanId) async {
    try {
      final response = await _api.get('${ApiConstants.loans}/$loanId');
      if (response.statusCode == 200) {
        return LoanModel.fromJson(response.data);
      }
    } catch (e) {
      print('Error getting loan details: $e');
    }
    return null;
  }

  Future<List<LoanRepaymentSchedule>> getLoanSchedule(String loanId) async {
    try {
      final response = await _api.get('${ApiConstants.loans}/$loanId/schedule');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        return data.map((json) => LoanRepaymentSchedule.fromJson(json)).toList();
      }
    } catch (e) {
      print('Error getting loan schedule: $e');
    }
    return [];
  }

  Future<Map<String, dynamic>> getAccountBalances() async {
    try {
      final response = await _api.get('${ApiConstants.memberMe}/balances');
      if (response.statusCode == 200) {
        return response.data;
      }
    } catch (e) {
      print('Error getting balances: $e');
    }
    return {};
  }

  Future<Map<String, dynamic>> getSavingsAccount() async {
    try {
      final response = await _api.get('${ApiConstants.memberMe}/savings');
      if (response.statusCode == 200) {
        return response.data;
      }
    } catch (e) {
      print('Error getting savings: $e');
    }
    return {};
  }

  Future<Map<String, dynamic>> getSharesAccount() async {
    try {
      final response = await _api.get('${ApiConstants.memberMe}/shares');
      if (response.statusCode == 200) {
        return response.data;
      }
    } catch (e) {
      print('Error getting shares: $e');
    }
    return {};
  }

  Future<List<Map<String, dynamic>>> getFixedDeposits() async {
    try {
      final response = await _api.get('${ApiConstants.memberMe}/fixed-deposits');
      if (response.statusCode == 200) {
        return List<Map<String, dynamic>>.from(response.data);
      }
    } catch (e) {
      print('Error getting fixed deposits: $e');
    }
    return [];
  }
}
