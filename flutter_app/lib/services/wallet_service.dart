import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:lucy_app/config/api_config.dart';
import 'package:lucy_app/models/wallet.dart';
import 'package:lucy_app/models/gift_transaction.dart';
import 'package:lucy_app/models/podcast_recording.dart';

class WalletService {
  static Future<Wallet> getWallet({
    required String userId,
    required String token,
  }) async {
    try {
      final uri = Uri.parse('${ApiConfig.walletBaseUrl}/wallets/$userId');
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
        return Wallet.fromJson(
          jsonDecode(response.body) as Map<String, dynamic>,
        );
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['message'] as String? ?? 'Lấy ví thất bại');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Kết nối thất bại: $e');
    }
  }

  static Future<Wallet> topUp({
    required String userId,
    required double amount,
    required String providerRef,
    required String token,
  }) async {
    try {
      final uri =
          Uri.parse('${ApiConfig.walletBaseUrl}/wallets/$userId/top-up');
      final response = await http
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'amount': amount,
              'providerRef': providerRef,
            }),
          )
          .timeout(ApiConfig.requestTimeout);

      if (response.statusCode == 200) {
        return Wallet.fromJson(
          jsonDecode(response.body) as Map<String, dynamic>,
        );
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['message'] as String? ?? 'Nạp tiền thất bại');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Kết nối thất bại: $e');
    }
  }

  static Future<GiftTransaction> sendGift({
    required String fromUserId,
    required String toCreatorId,
    required double amount,
    required String message,
    required String token,
  }) async {
    try {
      final uri = Uri.parse('${ApiConfig.walletBaseUrl}/gifts');
      final response = await http
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'fromUserId': fromUserId,
              'toCreatorId': toCreatorId,
              'amount': amount,
              'message': message,
            }),
          )
          .timeout(ApiConfig.requestTimeout);

      if (response.statusCode == 200 || response.statusCode == 201) {
        return GiftTransaction.fromJson(
          jsonDecode(response.body) as Map<String, dynamic>,
        );
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['message'] as String? ?? 'Gửi quà thất bại');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Kết nối thất bại: $e');
    }
  }

  static Future<List<GiftTransaction>> getGifts(String token) async {
    try {
      final uri = Uri.parse('${ApiConfig.walletBaseUrl}/gifts');
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
        final list = jsonDecode(response.body) as List<dynamic>;
        return list
            .map((e) =>
                GiftTransaction.fromJson(e as Map<String, dynamic>))
            .toList();
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['message'] as String? ?? 'Lấy danh sách quà thất bại');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Kết nối thất bại: $e');
    }
  }

  static Future<List<PodcastRecording>> getRecordings(String token) async {
    try {
      final uri =
          Uri.parse('${ApiConfig.walletBaseUrl}/podcasts/recordings');
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
        final list = jsonDecode(response.body) as List<dynamic>;
        return list
            .map((e) =>
                PodcastRecording.fromJson(e as Map<String, dynamic>))
            .toList();
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(
          body['message'] as String? ?? 'Lấy bản ghi thất bại');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Kết nối thất bại: $e');
    }
  }

  static Future<PodcastRecording> createRecording({
    required String creatorId,
    required String roomId,
    required String title,
    required String storageUri,
    required int duration,
    required String token,
  }) async {
    try {
      final uri =
          Uri.parse('${ApiConfig.walletBaseUrl}/podcasts/recordings');
      final response = await http
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'creatorId': creatorId,
              'roomId': roomId,
              'title': title,
              'storageUri': storageUri,
              'durationSeconds': duration,
            }),
          )
          .timeout(ApiConfig.requestTimeout);

      if (response.statusCode == 200 || response.statusCode == 201) {
        return PodcastRecording.fromJson(
          jsonDecode(response.body) as Map<String, dynamic>,
        );
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(
          body['message'] as String? ?? 'Tạo bản ghi thất bại');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Kết nối thất bại: $e');
    }
  }
}
