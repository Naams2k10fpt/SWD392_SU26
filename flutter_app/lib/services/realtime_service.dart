import 'package:socket_io_client/socket_io_client.dart' as IO;

class RealtimeService {
  late IO.Socket _socket;
  bool _connected = false;

  bool get isConnected => _connected;

  void connect(String url) {
    if (_connected) return;

    _socket = IO.io(url, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
    });

    _socket.onConnect((_) {
      _connected = true;
    });

    _socket.onDisconnect((_) {
      _connected = false;
    });

    _socket.connect();
  }

  void joinRoom({
    required String roomId,
    required String userId,
    required String displayName,
    required String role,
  }) {
    _socket.emit('room:join', {
      'roomId': roomId,
      'userId': userId,
      'displayName': displayName,
      'role': role,
    });
  }

  void toggleHand({
    required String roomId,
    required bool raised,
  }) {
    _socket.emit('hand:raise', {
      'roomId': roomId,
      'raised': raised,
    });
  }

  void toggleMic({
    required String roomId,
    required bool enabled,
  }) {
    _socket.emit('mic:toggle', {
      'roomId': roomId,
      'enabled': enabled,
    });
  }

  void ping() {
    _socket.emit('latency:ping', {
      'clientSentAt': DateTime.now().millisecondsSinceEpoch,
    });
  }

  void onRoomState(void Function(Map<String, dynamic>) callback) {
    _socket.on('room:state', (data) {
      callback(data as Map<String, dynamic>);
    });
  }

  void onLatencyResponse(void Function(int) callback) {
    _socket.on('latency:pong', (data) {
      final serverSentAt = data['serverSentAt'] as int;
      final now = DateTime.now().millisecondsSinceEpoch;
      callback(now - serverSentAt);
    });
  }

  void disconnect() {
    if (_connected) {
      _socket.disconnect();
      _connected = false;
    }
  }
}
