import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:lucy_app/services/auth_provider.dart';
import 'package:lucy_app/services/wallet_service.dart';
import 'package:lucy_app/models/podcast_recording.dart';

class PodcastScreen extends StatefulWidget {
  const PodcastScreen({super.key});

  @override
  State<PodcastScreen> createState() => _PodcastScreenState();
}

class _PodcastScreenState extends State<PodcastScreen> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  List<PodcastRecording> _recordings = [];
  bool _loading = false;
  String? _error;
  String? _playingId;
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  @override
  void initState() {
    super.initState();
    _audioPlayer.onPositionChanged.listen((p) {
      if (mounted) setState(() => _position = p);
    });
    _audioPlayer.onDurationChanged.listen((d) {
      if (mounted) setState(() => _duration = d);
    });
    _audioPlayer.onPlayerComplete.listen((_) {
      if (mounted) setState(() { _isPlaying = false; _playingId = null; _position = Duration.zero; });
    });
    _loadRecordings();
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _togglePlay(PodcastRecording recording) async {
    if (_playingId == recording.id && _isPlaying) {
      await _audioPlayer.pause();
      setState(() => _isPlaying = false);
    } else if (_playingId == recording.id) {
      await _audioPlayer.resume();
      setState(() => _isPlaying = true);
    } else {
      final url = recording.storageUri;
      if (url.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Podcast chưa có file audio')),
          );
        }
        return;
      }
      await _audioPlayer.stop();
      await _audioPlayer.play(UrlSource(url));
      setState(() { _playingId = recording.id; _isPlaying = true; _position = Duration.zero; });
    }
  }

  Future<void> _loadRecordings() async {
    final auth = context.read<AuthProvider>();
    if (auth.token == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final recordings =
          await WalletService.getRecordings(auth.token!);
      if (!mounted) return;
      setState(() {
        _recordings = recordings;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  void _showCreateDialog() {
    final theme = Theme.of(context);
    final creatorIdController = TextEditingController();
    final roomIdController = TextEditingController();
    final titleController = TextEditingController();
    final storageUriController = TextEditingController();
    final durationController = TextEditingController();
    bool creating = false;

    showDialog(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('🎙️ Tạo Podcast mới'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: creatorIdController,
                      decoration: InputDecoration(
                        labelText: 'Creator ID',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: roomIdController,
                      decoration: InputDecoration(
                        labelText: 'Room ID',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: titleController,
                      decoration: InputDecoration(
                        labelText: 'Tiêu đề',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: storageUriController,
                      decoration: InputDecoration(
                        labelText: 'Storage URI',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: durationController,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'Thời lượng (giây)',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed:
                      creating ? null : () => Navigator.pop(dialogContext),
                  child: const Text('Hủy'),
                ),
                FilledButton(
                  onPressed: creating
                      ? null
                      : () async {
                          final creatorId =
                              creatorIdController.text.trim();
                          final roomId =
                              roomIdController.text.trim();
                          final title =
                              titleController.text.trim();
                          final storageUri =
                              storageUriController.text.trim();
                          final durationText =
                              durationController.text.trim();

                          if (creatorId.isEmpty ||
                              roomId.isEmpty ||
                              title.isEmpty ||
                              storageUri.isEmpty ||
                              durationText.isEmpty) {
                            ScaffoldMessenger.of(dialogContext)
                                .showSnackBar(
                              const SnackBar(
                                content: Text(
                                    'Vui lòng điền đầy đủ thông tin'),
                              ),
                            );
                            return;
                          }

                          final duration =
                              int.tryParse(durationText);
                          if (duration == null || duration <= 0) {
                            ScaffoldMessenger.of(dialogContext)
                                .showSnackBar(
                              const SnackBar(
                                content:
                                    Text('Thời lượng không hợp lệ'),
                              ),
                            );
                            return;
                          }

                          final auth =
                              context.read<AuthProvider>();
                          if (auth.token == null) return;

                          setDialogState(() {
                            creating = true;
                          });

                          try {
                            await WalletService.createRecording(
                              creatorId: creatorId,
                              roomId: roomId,
                              title: title,
                              storageUri: storageUri,
                              duration: duration,
                              token: auth.token!,
                            );
                            if (dialogContext.mounted) {
                              Navigator.pop(dialogContext);
                            }
                            if (mounted) {
                              ScaffoldMessenger.of(context)
                                  .showSnackBar(
                                const SnackBar(
                                  content:
                                      Text('Tạo podcast thành công!'),
                                ),
                              );
                              _loadRecordings();
                            }
                          } catch (e) {
                            if (dialogContext.mounted) {
                              ScaffoldMessenger.of(dialogContext)
                                  .showSnackBar(
                                SnackBar(
                                  content: Text(e
                                      .toString()
                                      .replaceFirst(
                                          'Exception: ', '')),
                                ),
                              );
                            }
                            setDialogState(() {
                              creating = false;
                            });
                          }
                        },
                  child: creating
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Tạo'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  String _formatDuration(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    if (h > 0) {
      return '${h}h ${m.toString().padLeft(2, '0')}m';
    }
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = context.watch<AuthProvider>().user;
    final isSuper = user?.role == 'Super';

    return Scaffold(
      appBar: AppBar(
        title: const Text('📻 Podcast'),
      ),
      bottomSheet: _playingId != null
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest,
                border: Border(top: BorderSide(color: theme.colorScheme.outlineVariant)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _duration.inSeconds > 0
                        ? Slider(
                            value: _position.inSeconds.toDouble().clamp(0, _duration.inSeconds.toDouble()),
                            max: _duration.inSeconds.toDouble().clamp(1, double.infinity),
                            onChanged: (v) => _audioPlayer.seek(Duration(seconds: v.toInt())),
                          )
                        : const LinearProgressIndicator(),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${_position.inSeconds ~/ 60}:${(_position.inSeconds % 60).toString().padLeft(2, '0')}',
                    style: theme.textTheme.bodySmall,
                  ),
                  IconButton(
                    icon: Icon(_isPlaying ? Icons.pause : Icons.play_arrow),
                    onPressed: () {
                      if (_playingId != null) {
                        final rec = _recordings.where((r) => r.id == _playingId).firstOrNull;
                        if (rec != null) _togglePlay(rec);
                      }
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () async {
                      await _audioPlayer.stop();
                      setState(() { _playingId = null; _isPlaying = false; _position = Duration.zero; });
                    },
                  ),
                ],
              ),
            )
          : null,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline,
                          size: 48, color: theme.colorScheme.error),
                      const SizedBox(height: 16),
                      Text(
                        _error!,
                        style:
                            TextStyle(color: theme.colorScheme.error),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      FilledButton.tonalIcon(
                        onPressed: _loadRecordings,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Thử lại'),
                      ),
                    ],
                  ),
                )
              : _recordings.isEmpty
                  ? RefreshIndicator(
                      onRefresh: _loadRecordings,
                      child: ListView(
                        children: [
                          SizedBox(
                            height:
                                MediaQuery.of(context).size.height *
                                    0.3,
                          ),
                          Center(
                            child: Column(
                              children: [
                                Icon(
                                  Icons.podcasts,
                                  size: 64,
                                  color: theme
                                      .colorScheme.onSurfaceVariant,
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'Chưa có bản ghi nào',
                                  style: theme.textTheme.bodyLarge
                                      ?.copyWith(
                                    color: theme.colorScheme
                                        .onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadRecordings,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _recordings.length,
                        itemBuilder: (context, index) {
                          final recording = _recordings[index];
                          return Card(
                            margin:
                                const EdgeInsets.only(bottom: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(12),
                            ),
                            child: ListTile(
                              contentPadding:
                                  const EdgeInsets.all(16),
                              leading: CircleAvatar(
                                backgroundColor: theme
                                    .colorScheme.primaryContainer,
                                child: Icon(
                                  Icons.podcasts,
                                  color: theme.colorScheme
                                      .onPrimaryContainer,
                                ),
                              ),
                              title: Text(
                                recording.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              subtitle: Padding(
                                padding:
                                    const EdgeInsets.only(top: 4),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                        'Tác giả: ${recording.creatorId}'),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Thời lượng: ${_formatDuration(recording.durationSeconds)}',
                                    ),
                                    Text(
                                      'Ngày: ${_formatDate(recording.createdAt)}',
                                      style:
                                          theme.textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                              trailing: InkWell(
                                borderRadius: BorderRadius.circular(20),
                                onTap: () => _togglePlay(recording),
                                child: _playingId == recording.id && _isPlaying
                                    ? Icon(Icons.pause_circle_filled,
                                        color: theme.colorScheme.primary, size: 36)
                                    : _playingId == recording.id
                                        ? SizedBox(
                                            width: 36,
                                            height: 36,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: theme.colorScheme.primary,
                                            ),
                                          )
                                        : Icon(Icons.play_circle_fill,
                                            color: theme.colorScheme.primary, size: 36),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
      floatingActionButton: isSuper
          ? FloatingActionButton.extended(
              onPressed: _showCreateDialog,
              icon: const Icon(Icons.add),
              label: const Text('Tạo mới'),
              backgroundColor: theme.colorScheme.primary,
              foregroundColor: theme.colorScheme.onPrimary,
            )
          : null,
    );
  }
}
