import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:lucy_app/config/api_config.dart';
import 'package:lucy_app/models/auth_response.dart';

class AuthService {
  static Future<AuthResponse> register({
    required String email,
    required String password,
    required String displayName,
    required String role,
  }) async {
    try {
      final uri = Uri.parse('${ApiConfig.authBaseUrl}/auth/register');
      final response = await http
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': email,
              'password': password,
              'displayName': displayName,
              'role': role,
            }),
          )
          .timeout(ApiConfig.requestTimeout);

      if (response.statusCode == 200 || response.statusCode == 201) {
        return AuthResponse.fromJson(
          jsonDecode(response.body) as Map<String, dynamic>,
        );
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['message'] as String? ?? 'Đăng ký thất bại');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Kết nối thất bại: $e');
    }
  }

  static Future<AuthResponse> login({
    required String email,
    required String password,
  }) async {
    try {
      final uri = Uri.parse('${ApiConfig.authBaseUrl}/auth/login');
      final response = await http
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': email,
              'password': password,
            }),
          )
          .timeout(ApiConfig.requestTimeout);

      if (response.statusCode == 200) {
        return AuthResponse.fromJson(
          jsonDecode(response.body) as Map<String, dynamic>,
        );
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['message'] as String? ?? 'Đăng nhập thất bại');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Kết nối thất bại: $e');
    }
  }

  static Future<Map<String, dynamic>> getMe(String token) async {
    try {
      final uri = Uri.parse('${ApiConfig.authBaseUrl}/auth/me');
      final response = await http
          .get(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(ApiConfig.requestTimeout);

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['message'] as String? ?? 'Lấy thông tin thất bại');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Kết nối thất bại: $e');
    }
  }
}
