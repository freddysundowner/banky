import 'package:dio/dio.dart';
import 'package:get/get.dart' hide Response, FormData, MultipartFile;

import '../constants/api_constants.dart';
import '../../routes/app_pages.dart';
import 'storage_service.dart';

class ApiService extends GetxService {
  late Dio _dio;
  final StorageService _storage = Get.find<StorageService>();

  Future<ApiService> init() async {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: ApiConstants.connectionTimeout,
      receiveTimeout: ApiConstants.receiveTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }

        final org = _storage.getOrganization();
        if (org != null && org['id'] != null) {
          options.headers['X-Organization-Id'] = org['id'];
        }

        return handler.next(options);
      },
      onResponse: (response, handler) {
        return handler.next(response);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Mobile auth uses OTP-based sessions with no refresh token.
          // On 401 (expired or revoked session), clear all local auth state
          // and force the user back to the login screen.
          await _storage.clearAll();
          Get.offAllNamed(Routes.login);
        }
        return handler.next(error);
      },
    ));

    return this;
  }

  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    return await _dio.get(path, queryParameters: queryParameters);
  }

  Future<Response> post(String path, {dynamic data}) async {
    return await _dio.post(path, data: data);
  }

  Future<Response> put(String path, {dynamic data}) async {
    return await _dio.put(path, data: data);
  }

  Future<Response> patch(String path, {dynamic data}) async {
    return await _dio.patch(path, data: data);
  }

  Future<Response> delete(String path, {dynamic data}) async {
    return await _dio.delete(path, data: data);
  }

  Future<Response> download(String path, String savePath) async {
    return await _dio.download(path, savePath);
  }
}
