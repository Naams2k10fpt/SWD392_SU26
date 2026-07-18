class RoomParticipant {
  final String participantId;
  final String userId;
  final String displayName;
  final String role;
  final bool micEnabled;
  final DateTime joinedAt;

  RoomParticipant({
    required this.participantId,
    required this.userId,
    required this.displayName,
    required this.role,
    required this.micEnabled,
    required this.joinedAt,
  });

  factory RoomParticipant.fromJson(Map<String, dynamic> json) {
    return RoomParticipant(
      participantId: json['participantId'] as String,
      userId: json['userId'] as String,
      displayName: json['displayName'] as String,
      role: json['role'] as String,
      micEnabled: json['micEnabled'] as bool? ?? false,
      joinedAt: DateTime.parse(json['joinedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'participantId': participantId,
      'userId': userId,
      'displayName': displayName,
      'role': role,
      'micEnabled': micEnabled,
      'joinedAt': joinedAt.toIso8601String(),
    };
  }
}

class Room {
  final String roomId;
  final DateTime createdAt;
  final List<RoomParticipant> users;
  final List<String> raisedHands;

  Room({
    required this.roomId,
    required this.createdAt,
    required this.users,
    required this.raisedHands,
  });

  factory Room.fromJson(Map<String, dynamic> json) {
    return Room(
      roomId: json['roomId'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      users: (json['users'] as List<dynamic>)
          .map((e) => RoomParticipant.fromJson(e as Map<String, dynamic>))
          .toList(),
      raisedHands: (json['raisedHands'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'roomId': roomId,
      'createdAt': createdAt.toIso8601String(),
      'users': users.map((e) => e.toJson()).toList(),
      'raisedHands': raisedHands,
    };
  }
}
