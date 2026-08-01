import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Talks to the SAME backend as the React Native app.
const String apiBase = 'https://taptarea.com';

const _storage = FlutterSecureStorage();

class Api {
  static Future<String?> token() => _storage.read(key: 'tarea_token');
  static Future<void> setToken(String t) => _storage.write(key: 'tarea_token', value: t);
  static Future<String?> role() => _storage.read(key: 'tarea_role');
  static Future<void> setRole(String r) => _storage.write(key: 'tarea_role', value: r);
  static Future<void> clearToken() async {
    await _storage.delete(key: 'tarea_token');
    await _storage.delete(key: 'tarea_role');
  }

  static Future<Map<String, String>> _headers() async {
    final t = await token();
    return {
      'Content-Type': 'application/json',
      if (t != null) 'Authorization': 'Bearer $t',
    };
  }

  static Future<http.Response> get(String path) async =>
      http.get(Uri.parse('$apiBase/api$path'), headers: await _headers());

  static Future<http.Response> post(String path, Map<String, dynamic> body) async =>
      http.post(Uri.parse('$apiBase/api$path'), headers: await _headers(), body: jsonEncode(body));

  static Future<http.Response> patch(String path, Map<String, dynamic> body) async =>
      http.patch(Uri.parse('$apiBase/api$path'), headers: await _headers(), body: jsonEncode(body));
}
