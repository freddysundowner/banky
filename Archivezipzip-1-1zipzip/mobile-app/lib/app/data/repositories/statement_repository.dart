import 'package:get/get.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';

import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';

class StatementRepository {
  final ApiService _api = Get.find<ApiService>();

  Future<List<Map<String, dynamic>>> getAvailableStatements() async {
    try {
      final response = await _api.get('${ApiConstants.statements}/available');
      if (response.statusCode == 200) {
        return List<Map<String, dynamic>>.from(response.data);
      }
    } catch (e) {
      print('Error getting available statements: $e');
    }
    return [];
  }

  Future<Map<String, dynamic>> requestStatement({
    required String accountType,
    required DateTime startDate,
    required DateTime endDate,
    String format = 'pdf',
  }) async {
    try {
      final response = await _api.post(
        ApiConstants.statements,
        data: {
          'account_type': accountType,
          'start_date': startDate.toIso8601String(),
          'end_date': endDate.toIso8601String(),
          'format': format,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {
          'success': true,
          'data': response.data,
          'message': 'Statement requested successfully',
        };
      }
      
      return {
        'success': false,
        'message': response.data['message'] ?? 'Failed to request statement',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  Future<Map<String, dynamic>> downloadStatement(String statementId) async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      final filePath = '${dir.path}/statements/statement_$statementId.pdf';
      
      final file = File(filePath);
      if (!await file.parent.exists()) {
        await file.parent.create(recursive: true);
      }

      final response = await _api.download(
        '${ApiConstants.statements}/$statementId/download',
        filePath,
      );

      if (response.statusCode == 200) {
        return {
          'success': true,
          'filePath': filePath,
          'message': 'Statement downloaded successfully',
        };
      }
      
      return {
        'success': false,
        'message': 'Failed to download statement',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Download failed. Please try again.',
      };
    }
  }

  Future<Map<String, dynamic>> generateMiniStatement() async {
    try {
      final response = await _api.get('${ApiConstants.memberMe}/mini-statement');
      if (response.statusCode == 200) {
        return {
          'success': true,
          'data': response.data,
        };
      }
      
      return {
        'success': false,
        'message': 'Failed to generate mini statement',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  Future<List<Map<String, dynamic>>> getStatementHistory({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _api.get(
        '${ApiConstants.statements}/history',
        queryParameters: {'page': page, 'limit': limit},
      );

      if (response.statusCode == 200) {
        return List<Map<String, dynamic>>.from(response.data['items'] ?? response.data);
      }
    } catch (e) {
      print('Error getting statement history: $e');
    }
    return [];
  }
}
