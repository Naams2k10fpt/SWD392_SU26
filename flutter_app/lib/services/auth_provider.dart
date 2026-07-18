import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lucy_app/models/user.dart';
import 'package:lucy_app/services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  static const String _tokenKey = 'auth_token';

  String? _token;
  User? _user;
  bool _loading = false;
  String? _error;

  String? get token => _token;
  User? get user => _user;
  bool get loading => _loading;
  bool get isLoggedIn => _token != null;
  String? get error => _error;

  Future<bool> login({
    required String email,
    required String password,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await AuthService.login(
        email: email,
        password: password,
      );

      _token = response.accessToken;
      _user = response.user;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, response.accessToken);

      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String displayName,
    required String role,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await AuthService.register(
        email: email,
        password: password,
        displayName: displayName,
        role: role,
      );

      _token = response.accessToken;
      _user = response.user;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, response.accessToken);

      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    final savedToken = prefs.getString(_tokenKey);

    if (savedToken != null) {
      _token = savedToken;
      try {
        final userData = await AuthService.getMe(savedToken);
        _user = User.fromJson(userData);
      } catch (_) {
        _token = null;
        _user = null;
        await prefs.remove(_tokenKey);
      }
    }

    notifyListeners();
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    _error = null;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);

    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
