import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
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

  static Future<http.Response> delete(String path) async =>
      http.delete(Uri.parse('$apiBase/api$path'), headers: await _headers());

  static Future<http.Response> uploadAvatar(String filePath) async {
    final t = await token();
    final req = http.MultipartRequest('POST', Uri.parse('$apiBase/api/upload/avatar'));
    if (t != null) req.headers['Authorization'] = 'Bearer $t';
    req.files.add(await http.MultipartFile.fromPath('file', filePath));
    return http.Response.fromStream(await req.send());
  }

  // Generic image upload → { url }. Used by Portfolio.
  static Future<http.Response> uploadImage(String filePath, {String folder = 'tarea/portfolio'}) async {
    final t = await token();
    final req = http.MultipartRequest('POST', Uri.parse('$apiBase/api/upload/image'));
    if (t != null) req.headers['Authorization'] = 'Bearer $t';
    req.fields['folder'] = folder;
    req.files.add(await http.MultipartFile.fromPath('file', filePath));
    return http.Response.fromStream(await req.send());
  }

  // Verification doc upload (image or PDF) → sets verificationStatus=pending.
  // The backend rejects anything that isn't image/* or application/pdf, so we
  // set the part's content type explicitly from the file extension.
  static Future<http.Response> uploadDoc(String filePath) async {
    final t = await token();
    final req = http.MultipartRequest('POST', Uri.parse('$apiBase/api/verification'));
    if (t != null) req.headers['Authorization'] = 'Bearer $t';
    final lower = filePath.toLowerCase();
    final ct = lower.endsWith('.pdf')
        ? MediaType('application', 'pdf')
        : lower.endsWith('.png')
            ? MediaType('image', 'png')
            : MediaType('image', 'jpeg');
    req.files.add(await http.MultipartFile.fromPath('file', filePath, contentType: ct));
    return http.Response.fromStream(await req.send());
  }
}
