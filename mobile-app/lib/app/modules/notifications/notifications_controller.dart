import 'package:get/get.dart';

import '../../core/services/api_service.dart';
import '../../core/constants/api_constants.dart';

class NotificationsController extends GetxController {
  final ApiService _api = Get.find<ApiService>();

  final isLoading = false.obs;
  final notifications = <Map<String, dynamic>>[].obs;

  @override
  void onInit() {
    super.onInit();
    loadNotifications();
  }

  Future<void> loadNotifications() async {
    isLoading.value = true;
    try {
      final response = await _api.get(ApiConstants.notifications);
      if (response.statusCode == 200) {
        final data = response.data['items'] ?? response.data;
        notifications.assignAll(List<Map<String, dynamic>>.from(data));
      }
    } catch (e) {
      print('Error loading notifications: $e');
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> refreshNotifications() async {
    await loadNotifications();
  }

  Future<void> markAsRead(String notificationId) async {
    try {
      await _api.patch('${ApiConstants.notifications}/$notificationId/read');
      final index = notifications.indexWhere((n) => n['id'].toString() == notificationId);
      if (index != -1) {
        notifications[index] = {...notifications[index], 'is_read': true};
        notifications.refresh();
      }
    } catch (e) {
      print('Error marking notification as read: $e');
    }
  }

  Future<void> markAllAsRead() async {
    try {
      await _api.post('${ApiConstants.notifications}/read-all');
      for (var i = 0; i < notifications.length; i++) {
        notifications[i] = {...notifications[i], 'is_read': true};
      }
      notifications.refresh();
    } catch (e) {
      print('Error marking all as read: $e');
    }
  }

  int get unreadCount => notifications.where((n) => !(n['is_read'] ?? false)).length;
}
