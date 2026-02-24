import 'package:get/get.dart';

import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';
import '../../core/services/storage_service.dart';
import '../models/member_model.dart';
import '../models/organization_model.dart';

class AuthRepository {
  ApiService get _api => Get.find<ApiService>();
  StorageService get _storage => Get.find<StorageService>();

  Future<Map<String, dynamic>> login({
    required String accountNumber,
    required String password,
  }) async {
    try {
      final response = await _api.post(
        ApiConstants.memberLogin,
        data: {
          'account_number': accountNumber,
          'password': password,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        
        await _storage.saveToken(data['access_token']);
        if (data['refresh_token'] != null) {
          await _storage.saveRefreshToken(data['refresh_token']);
        }
        
        if (data['member'] != null) {
          _storage.saveMember(data['member']);
        }
        
        if (data['organization'] != null) {
          _storage.saveOrganization(data['organization']);
        }
        
        return {'success': true, 'data': data};
      }
      
      return {'success': false, 'message': 'Login failed'};
    } catch (e) {
      return {'success': false, 'message': _getErrorMessage(e)};
    }
  }

  Future<MemberModel?> getCurrentMember() async {
    try {
      final response = await _api.get(ApiConstants.memberMe);
      if (response.statusCode == 200) {
        final member = MemberModel.fromJson(response.data);
        _storage.saveMember(response.data);
        return member;
      }
    } catch (e) {
      print('Error getting current member: $e');
    }
    return null;
  }

  Future<OrganizationModel?> getCurrentOrganization() async {
    final orgData = _storage.getOrganization();
    if (orgData != null) {
      return OrganizationModel.fromJson(orgData);
    }
    return null;
  }

  void updateOrganizationCache(Map<String, dynamic> orgJson) {
    final cached = _storage.getOrganization();
    if (cached != null) {
      cached.addAll(orgJson);
      _storage.saveOrganization(cached);
    } else {
      _storage.saveOrganization(orgJson);
    }
  }

  MemberModel? getCachedMember() {
    final data = _storage.getMember();
    if (data != null) {
      return MemberModel.fromJson(data);
    }
    return null;
  }

  Future<bool> isLoggedIn() async {
    final token = await _storage.getToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> logout() async {
    try {
      await _api.post(ApiConstants.logout);
    } catch (e) {
      print('Logout API error: $e');
    } finally {
      await _storage.clearAll();
    }
  }

  Future<Map<String, dynamic>> updateProfile({
    String? phone,
    String? address,
  }) async {
    try {
      final response = await _api.patch(
        ApiConstants.memberMe,
        data: {
          if (phone != null) 'phone': phone,
          if (address != null) 'address': address,
        },
      );

      if (response.statusCode == 200) {
        _storage.saveMember(response.data);
        return {'success': true, 'data': response.data};
      }
      
      return {'success': false, 'message': 'Update failed'};
    } catch (e) {
      return {'success': false, 'message': _getErrorMessage(e)};
    }
  }

  Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final response = await _api.post(
        '${ApiConstants.memberMe}/change-password',
        data: {
          'current_password': currentPassword,
          'new_password': newPassword,
        },
      );

      if (response.statusCode == 200) {
        return {'success': true, 'message': 'Password changed successfully'};
      }
      
      return {'success': false, 'message': 'Failed to change password'};
    } catch (e) {
      return {'success': false, 'message': _getErrorMessage(e)};
    }
  }

  String _getErrorMessage(dynamic error) {
    if (error is Exception) {
      final errorStr = error.toString();
      if (errorStr.contains('401')) {
        return 'Invalid credentials';
      } else if (errorStr.contains('404')) {
        return 'Account not found';
      } else if (errorStr.contains('SocketException')) {
        return 'No internet connection';
      }
    }
    return 'An error occurred. Please try again.';
  }
}
