package com.lucy.lms;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class LmsApplication {
    public static void main(String[] args) throws SQLException {
        String jdbcUrl = System.getenv().getOrDefault("LUCY_JDBC_URL", "jdbc:mysql://localhost:3306/lucy_phase5");
        String user = System.getenv().getOrDefault("LUCY_DB_USER", "root");
        String password = System.getenv().getOrDefault("LUCY_DB_PASSWORD", "");

        try (Connection connection = DriverManager.getConnection(jdbcUrl, user, password)) {
            seedDemoData(connection);

            StageTransitionEngine transitionEngine = new StageTransitionEngine(List.of(
                    new WarmUpState(),
                    new GuidedPracticeState(),
                    new PeerExchangeState(),
                    new ReflectionState()
            ));

            MentorDashboard dashboard = MentorDashboard.load(connection, "mentor-pro-1");
            DashboardSummary summary = dashboard.refreshSummary(connection, transitionEngine, Instant.now());
            System.out.println(summary.toReport());
        }
    }

    private static void seedDemoData(Connection connection) throws SQLException {
        try (PreparedStatement insertPin = connection.prepareStatement("""
                INSERT IGNORE INTO mentor_material_pins (material_title, language_code, stage_number, level_number)
                VALUES (?, ?, ?, ?)
                """)) {
            insertPin.setString(1, "English Stage 1 Speaking Drill");
            insertPin.setString(2, "en");
            insertPin.setInt(3, 1);
            insertPin.setInt(4, 1);
            insertPin.executeUpdate();

            insertPin.setString(1, "Japanese Stage 1 Listening");
            insertPin.setString(2, "ja");
            insertPin.setInt(3, 1);
            insertPin.setInt(4, 1);
            insertPin.executeUpdate();
        }

        upsertLearner(connection, "anon-level-1-demo", "Anonymous Level 1", 1, SubLevel.WARM_UP, Instant.now().minus(Duration.ofMinutes(11)));
        upsertLearner(connection, "anon-level-4-demo", "Anonymous Level 4", 4, SubLevel.GUIDED_PRACTICE, Instant.now().minus(Duration.ofMinutes(3)));
    }

    private static void upsertLearner(Connection connection, String uid, String displayName, int level, SubLevel subLevel, Instant startedAt) throws SQLException {
        try (PreparedStatement exists = connection.prepareStatement("SELECT COUNT(*) FROM learner_progress WHERE anonymous_uid = ?")) {
            exists.setString(1, uid);
            try (ResultSet resultSet = exists.executeQuery()) {
                resultSet.next();
                if (resultSet.getInt(1) > 0) {
                    return;
                }
            }
        }

        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO learner_progress (anonymous_uid, display_name, language_code, stage_number, level_number, sub_level, sub_level_started_at)
                VALUES (?, ?, 'en', 1, ?, ?, ?)
                """)) {
            statement.setString(1, uid);
            statement.setString(2, displayName);
            statement.setInt(3, level);
            statement.setString(4, subLevel.name());
            statement.setTimestamp(5, Timestamp.from(startedAt));
            statement.executeUpdate();
        }
    }
}

enum SubLevel {
    WARM_UP,
    GUIDED_PRACTICE,
    PEER_EXCHANGE,
    REFLECTION
}

record LearningMaterial(String id, String title, String languageCode, int stage) { }

record LearnerProgress(String id, String displayName, int level, SubLevel subLevel, Instant subLevelStartedAt) {
    LearnerProgress moveTo(SubLevel nextSubLevel, Instant now) {
        return new LearnerProgress(id, displayName, level, nextSubLevel, now);
    }
}

interface SubLevelState {
    SubLevel current();
    SubLevel next();
    boolean shouldTransition(LearnerProgress progress, Instant now);
}

abstract class TenMinuteSubLevelState implements SubLevelState {
    @Override
    public boolean shouldTransition(LearnerProgress progress, Instant now) {
        return progress.subLevel() == current()
                && Duration.between(progress.subLevelStartedAt(), now).compareTo(Duration.ofMinutes(10)) >= 0;
    }
}

class WarmUpState extends TenMinuteSubLevelState {
    public SubLevel current() { return SubLevel.WARM_UP; }
    public SubLevel next() { return SubLevel.GUIDED_PRACTICE; }
}

class GuidedPracticeState extends TenMinuteSubLevelState {
    public SubLevel current() { return SubLevel.GUIDED_PRACTICE; }
    public SubLevel next() { return SubLevel.PEER_EXCHANGE; }
}

class PeerExchangeState extends TenMinuteSubLevelState {
    public SubLevel current() { return SubLevel.PEER_EXCHANGE; }
    public SubLevel next() { return SubLevel.REFLECTION; }
}

class ReflectionState extends TenMinuteSubLevelState {
    public SubLevel current() { return SubLevel.REFLECTION; }
    public SubLevel next() { return SubLevel.WARM_UP; }
}

class StageTransitionEngine {
    private final List<SubLevelState> states;

    StageTransitionEngine(List<SubLevelState> states) {
        this.states = List.copyOf(states);
    }

    LearnerProgress advanceIfDue(LearnerProgress progress, Instant now) {
        return states.stream()
                .filter(state -> state.shouldTransition(progress, now))
                .findFirst()
                .map(state -> progress.moveTo(state.next(), now))
                .orElse(progress);
    }
}

class MentorDashboard {
    private final String mentorId;
    private final List<LearningMaterial> pinnedMaterials;
    private final List<LearnerProgress> learners;

    MentorDashboard(String mentorId, List<LearningMaterial> pinnedMaterials, List<LearnerProgress> learners) {
        this.mentorId = mentorId;
        this.pinnedMaterials = new ArrayList<>(pinnedMaterials);
        this.learners = new ArrayList<>(learners);
    }

    static MentorDashboard load(Connection connection, String mentorId) throws SQLException {
        return new MentorDashboard(mentorId, loadPinnedMaterials(connection), loadLearners(connection));
    }

    DashboardSummary refreshSummary(Connection connection, StageTransitionEngine transitionEngine, Instant now) throws SQLException {
        List<LearnerProgress> refreshedLearners = new ArrayList<>();
        for (LearnerProgress progress : learners) {
            LearnerProgress refreshed = transitionEngine.advanceIfDue(progress, now);
            if (refreshed.subLevel() != progress.subLevel()) {
                persistTransition(connection, progress, refreshed);
            }
            refreshedLearners.add(refreshed);
        }
        learners.clear();
        learners.addAll(refreshedLearners);
        return new DashboardSummary(mentorId, pinnedMaterials, refreshedLearners);
    }

    private static List<LearningMaterial> loadPinnedMaterials(Connection connection) throws SQLException {
        List<LearningMaterial> materials = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT id, material_title, language_code, stage_number
                FROM mentor_material_pins
                ORDER BY pinned_at
                """)) {
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    materials.add(new LearningMaterial(
                            resultSet.getString("id"),
                            resultSet.getString("material_title"),
                            resultSet.getString("language_code"),
                            resultSet.getInt("stage_number")));
                }
            }
        }
        return materials;
    }

    private static List<LearnerProgress> loadLearners(Connection connection) throws SQLException {
        List<LearnerProgress> progress = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT id, display_name, level_number, sub_level, sub_level_started_at
                FROM learner_progress
                ORDER BY updated_at
                """)) {
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    progress.add(new LearnerProgress(
                            resultSet.getString("id"),
                            resultSet.getString("display_name"),
                            resultSet.getInt("level_number"),
                            SubLevel.valueOf(resultSet.getString("sub_level")),
                            resultSet.getTimestamp("sub_level_started_at").toInstant()));
                }
            }
        }
        return progress;
    }

    private static void persistTransition(Connection connection, LearnerProgress before, LearnerProgress after) throws SQLException {
        try (PreparedStatement updateProgress = connection.prepareStatement("""
                UPDATE learner_progress
                SET sub_level = ?, sub_level_started_at = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """)) {
            updateProgress.setString(1, after.subLevel().name());
            updateProgress.setTimestamp(2, Timestamp.from(after.subLevelStartedAt()));
            updateProgress.setString(3, before.id());
            updateProgress.executeUpdate();
        }

        try (PreparedStatement insertEvent = connection.prepareStatement("""
                INSERT INTO lms_transition_events (learner_progress_id, from_sub_level, to_sub_level, pattern_name)
                VALUES (?, ?, ?, 'State Pattern')
                """)) {
            insertEvent.setString(1, before.id());
            insertEvent.setString(2, before.subLevel().name());
            insertEvent.setString(3, after.subLevel().name());
            insertEvent.executeUpdate();
        }
    }
}

record DashboardSummary(String mentorId, List<LearningMaterial> pinnedMaterials, List<LearnerProgress> learners) {
    String toReport() {
        StringBuilder builder = new StringBuilder();
        builder.append("Mentor dashboard: ").append(mentorId).append(System.lineSeparator());
        builder.append("Storage: MariaDB").append(System.lineSeparator());
        builder.append("Pinned materials: ").append(pinnedMaterials.size()).append(System.lineSeparator());
        for (LearningMaterial material : pinnedMaterials) {
            builder.append("- ").append(material.title()).append(" [").append(material.languageCode()).append("]").append(System.lineSeparator());
        }
        builder.append("Learners: ").append(learners.size()).append(System.lineSeparator());
        for (LearnerProgress learner : learners) {
            builder.append("- ").append(learner.displayName()).append(" level ").append(learner.level()).append(" -> ").append(learner.subLevel()).append(System.lineSeparator());
        }
        return builder.toString();
    }
}
