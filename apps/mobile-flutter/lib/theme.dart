import 'package:flutter/material.dart';

/// Brand tokens — mirror the React Native light theme.
class C {
  static const blue = Color(0xFF2563EB);
  static const ink = Color(0xFF0F172A);
  static const muted = Color(0xFF64748B);
  static const surface = Color(0xFFF1F5F9);
  static const line = Color(0xFFE2E8F0);
  static const green = Color(0xFF10B981);
  static const amber = Color(0xFFF59E0B);
  static const red = Color(0xFFEF4444);
  static const bg = Color(0xFFF6F8FC);
  static const white = Color(0xFFFFFFFF);
}

ThemeData buildTheme() {
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: C.white,
    colorScheme: ColorScheme.fromSeed(
      seedColor: C.blue,
      primary: C.blue,
      surface: C.white,
    ),
    fontFamily: '.SF Pro Text', // system font, like the RN app
    textTheme: const TextTheme(
      displaySmall: TextStyle(color: C.ink, fontWeight: FontWeight.w900, letterSpacing: -1),
      headlineMedium: TextStyle(color: C.ink, fontWeight: FontWeight.w800),
      titleLarge: TextStyle(color: C.ink, fontWeight: FontWeight.w800),
      bodyLarge: TextStyle(color: C.ink),
      bodyMedium: TextStyle(color: C.muted),
    ),
  );
}
