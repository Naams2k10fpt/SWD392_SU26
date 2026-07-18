import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucy_app/services/auth_provider.dart';
import 'package:lucy_app/services/realtime_service.dart';
import 'package:lucy_app/config/api_config.dart';
import 'package:lucy_app/models/room.dart';

class RoomScreen extends StatefulWidget {
  const RoomScreen({super.key});

  @override
  State<RoomScreen> createState() => _RoomScreenState();
}

class _RoomScreenState extends State<RoomScreen> {
  final _roomIdController = TextEditingController();
  final _realtimeService = RealtimeService();

  bool _isConnected = false;
  bool _handRaised = false;
  bool _micEnabled = true;
  int? _latency;
  String? _error;

  Room? _roomState;

  @override
  void initState() {
    super.initState();
    _connectAndListen();
  }

  void _connectAndListen() {
    final auth = context.read<AuthProvider>();
    if (auth.token == null) return;

    _realtimeService.connect(ApiConfig.realtimeBaseUrl);

    _realtimeService.onRoomState((data) {
      if (!mounted) return;
      setState(() {
        _roomState = Room.fromJson(data);
        _error = null;
      });
    });

    _realtimeService.onLatencyResponse((ms) {
      if (!mounted) return;
      setState(() {
        _latency = ms;
      });
    });

    setState(() {
      _isConnected = true;
    });
  }

  void _joinRoom() {
    final roomId = _roomIdController.text.trim();
    if (roomId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập Room ID')),
      );
      return;
    }

    final auth = context.read<AuthProvider>();
    if (auth.user == null) return;

    _realtimeService.joinRoom(
      roomId: roomId,
      userId: auth.user!.id,
      displayName: auth.user!.displayName,
      role: auth.user!.role,
    );
  }

  void _toggleHand() {
    final roomId = _roomIdController.text.trim();
    if (roomId.isEmpty) return;

    _handRaised = !_handRaised;
    _realtimeService.toggleHand(
      roomId: roomId,
      raised: _handRaised,
    );
    setState(() {});
  }

  void _toggleMic() {
    final roomId = _roomIdController.text.trim();
    if (roomId.isEmpty) return;

    _micEnabled = !_micEnabled;
    _realtimeService.toggleMic(
      roomId: roomId,
      enabled: _micEnabled,
    );
    setState(() {});
  }

  void _ping() {
    _realtimeService.ping();
    setState(() {
      _latency = null;
    });
  }

  @override
  void dispose() {
    _realtimeService.disconnect();
    _roomIdController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final roomId = _roomIdController.text.trim();
    final hasRoomId = roomId.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('🎙️ Phòng học'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Room ID input
            TextField(
              controller: _roomIdController,
              decoration: InputDecoration(
                labelText: 'Room ID',
                hintText: 'Nhập mã phòng...',
                prefixIcon: const Icon(Icons.meeting_room),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Join button
            FilledButton.icon(
              onPressed: hasRoomId ? _joinRoom : null,
              icon: const Icon(Icons.login),
              label: const Text('Join Room'),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Connection & latency status
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (_isConnected)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Chip(
                      avatar: const Icon(Icons.wifi, size: 16),
                      label: const Text('Đã kết nối'),
                      backgroundColor:
                          theme.colorScheme.primaryContainer,
                    ),
                  ),
                if (_latency != null)
                  Chip(
                    avatar: const Icon(Icons.speed, size: 16),
                    label: Text('${_latency}ms'),
                    backgroundColor: _latency! < 100
                        ? theme.colorScheme.secondaryContainer
                        : theme.colorScheme.errorContainer,
                  ),
              ],
            ),

            // Error
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  _error!,
                  style: TextStyle(color: theme.colorScheme.error),
                  textAlign: TextAlign.center,
                ),
              ),

            const SizedBox(height: 16),

            // Control buttons (only if a room ID is entered)
            if (hasRoomId) ...[
              Row(
                children: [
                  Expanded(
                    child: _ControlButton(
                      icon: _handRaised
                          ? Icons.pan_tool
                          : Icons.pan_tool_outlined,
                      label: _handRaised ? '🖐️ Đã giơ tay' : '✋ Giơ tay',
                      selected: _handRaised,
                      onTap: _toggleHand,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ControlButton(
                      icon: _micEnabled ? Icons.mic : Icons.mic_off,
                      label: _micEnabled ? '🎤 Mic' : '🔇 Tắt mic',
                      selected: _micEnabled,
                      onTap: _toggleMic,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _ping,
                icon: const Icon(Icons.sensors),
                label: const Text('📡 Ping'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],

            // Participants list
            if (_roomState != null) ...[
              Text(
                'Participants (${_roomState!.users.length})',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              ..._roomState!.users.map((participant) {
                final handRaised =
                    _roomState!.raisedHands.contains(participant.userId);
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor:
                          theme.colorScheme.primaryContainer,
                      child: Text(
                        participant.displayName[0].toUpperCase(),
                        style: TextStyle(
                          color:
                              theme.colorScheme.onPrimaryContainer,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    title: Text(participant.displayName),
                    subtitle: Text(participant.role),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (handRaised)
                          const Padding(
                            padding: EdgeInsets.only(right: 4),
                            child: Text('✋'),
                          ),
                        Icon(
                          participant.micEnabled
                              ? Icons.mic
                              : Icons.mic_off,
                          size: 20,
                          color: participant.micEnabled
                              ? theme.colorScheme.primary
                              : theme.colorScheme.error,
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ControlButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (selected) {
      return FilledButton.icon(
        onPressed: onTap,
        icon: Icon(icon),
        label: Text(label),
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
    }

    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}
