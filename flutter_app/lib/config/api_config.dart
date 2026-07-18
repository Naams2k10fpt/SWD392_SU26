class ApiConfig {
  static const String authBaseUrl = 'http://10.0.2.2:5000';
  static const String walletBaseUrl = 'http://10.0.2.2:5040';
  static const String realtimeBaseUrl = 'http://10.0.2.2:3020';

  static const Duration requestTimeout = Duration(seconds: 30);
  static const Duration socketReconnectDelay = Duration(seconds: 3);
}
