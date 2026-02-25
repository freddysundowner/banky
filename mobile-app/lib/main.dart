import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

import 'app/routes/app_pages.dart';
import 'app/core/theme/app_theme.dart';
import 'app/core/bindings/initial_binding.dart';
import 'app/core/services/storage_service.dart';
import 'app/core/services/api_service.dart';
import 'app/core/services/session_timeout_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await GetStorage.init();
  await Get.putAsync(() => StorageService().init());
  await Get.putAsync(() => ApiService().init());
  await Get.putAsync(() => SessionTimeoutService().init());

  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );

  runApp(const BankyApp());
}

class BankyApp extends StatelessWidget {
  const BankyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) {
        try {
          Get.find<SessionTimeoutService>().recordActivity();
        } catch (_) {}
      },
      child: GetMaterialApp(
        title: 'BANKY',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.system,
        initialBinding: InitialBinding(),
        initialRoute: AppPages.initial,
        getPages: AppPages.routes,
        defaultTransition: Transition.cupertino,
      ),
    );
  }
}
