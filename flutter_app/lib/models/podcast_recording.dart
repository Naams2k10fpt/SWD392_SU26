class PodcastRecording {
  final String id;
  final String creatorId;
  final String roomId;
  final String title;
  final String storageUri;
  final int durationSeconds;
  final DateTime createdAt;

  PodcastRecording({
    required this.id,
    required this.creatorId,
    required this.roomId,
    required this.title,
    required this.storageUri,
    required this.durationSeconds,
    required this.createdAt,
  });

  factory PodcastRecording.fromJson(Map<String, dynamic> json) {
    return PodcastRecording(
      id: json['id'] as String,
      creatorId: json['creatorId'] as String,
      roomId: json['roomId'] as String,
      title: json['title'] as String,
      storageUri: json['storageUri'] as String,
      durationSeconds: json['durationSeconds'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'creatorId': creatorId,
      'roomId': roomId,
      'title': title,
      'storageUri': storageUri,
      'durationSeconds': durationSeconds,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}
