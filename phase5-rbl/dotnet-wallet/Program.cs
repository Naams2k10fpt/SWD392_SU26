using System.Net.Http.Json;
using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

string connectionString = Environment.GetEnvironmentVariable("LUCY_DB")
    ?? builder.Configuration.GetConnectionString("MariaDb")
    ?? "Server=localhost;Database=lucy_phase5;User=root;Password=;AllowUserVariables=True;";
connectionString = new MySqlConnectionStringBuilder(connectionString) { SslMode = MySqlSslMode.None, AllowPublicKeyRetrieval = true }.ConnectionString;
string authBaseUrl = Environment.GetEnvironmentVariable("AUTH_BASE_URL") ?? "http://localhost:5000";
using var authClient = new HttpClient { BaseAddress = new Uri($"{authBaseUrl.TrimEnd('/')}/") };

var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();

app.MapGet("/health", () => Results.Ok(new { service = "RBL Phase 4 Wallet API", status = "ready", storage = "MariaDB" }));

app.MapGet("/wallets/{userId}", async (string userId) =>
{
    await using var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync();
    WalletAccount wallet = await GetOrCreateWallet(connection, userId);
    return Results.Ok(wallet);
});

app.MapPost("/wallets/{userId}/top-up", async (string userId, TopUpRequest request) =>
{
    if (request.Amount <= 0) return Results.BadRequest(new { message = "Amount must be positive" });

    await using var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync();
    await using var transaction = await connection.BeginTransactionAsync();

    try
    {
        WalletAccount wallet = await GetOrCreateWallet(connection, userId, transaction);
        wallet = await UpdateWalletBalance(connection, transaction, wallet.Id, request.Amount);
        await InsertWalletTransaction(connection, transaction, wallet.Id, "TOP_UP", request.Amount, request.ProviderReference);
        await transaction.CommitAsync();
        return Results.Ok(new WalletTransactionResponse(wallet, "top-up committed to MariaDB ledger"));
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
});

app.MapPost("/gifts", async (GiftRequest request, HttpRequest httpRequest) =>
{
    if (request.Amount <= 0) return Results.BadRequest(new { message = "Gift amount must be positive" });
    AuthenticatedUser? authenticatedUser = await Authenticate(authClient, httpRequest.Headers.Authorization.ToString());
    if (authenticatedUser is null) return Results.Unauthorized();
    if (!string.Equals(authenticatedUser.Role, "ANONYMOUS", StringComparison.OrdinalIgnoreCase)
        || !string.Equals(authenticatedUser.Id, request.FromUserId, StringComparison.OrdinalIgnoreCase))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    await using var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync();
    await using var transaction = await connection.BeginTransactionAsync();

    try
    {
        if (!await CanGift(connection, transaction, request))
        {
            await transaction.RollbackAsync();
            return Results.BadRequest(new { message = "Recipient must be a PRO or SUPER user in the same room" });
        }
        WalletAccount sender = await GetOrCreateWallet(connection, request.FromUserId, transaction);
        WalletAccount receiver = await GetOrCreateWallet(connection, request.ToCreatorId, transaction);
        if (sender.Balance < request.Amount)
        {
            await transaction.RollbackAsync();
            return Results.BadRequest(new { message = "Insufficient wallet balance" });
        }

        sender = await UpdateWalletBalance(connection, transaction, sender.Id, -request.Amount);
        receiver = await UpdateWalletBalance(connection, transaction, receiver.Id, request.Amount);
        await InsertWalletTransaction(connection, transaction, sender.Id, "GIFT_SENT", -request.Amount, null);
        await InsertWalletTransaction(connection, transaction, receiver.Id, "GIFT_RECEIVED", request.Amount, null);
        GiftTransaction gift = await InsertGift(connection, transaction, sender.Id, receiver.Id, request);
        await transaction.CommitAsync();

        return Results.Created($"/gifts/{gift.Id}", new { transaction = gift, realtimeEvent = "gift:sent", syncRisk = "Broadcast over Node Socket.IO after wallet commit; add idempotency before production." });
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
});

app.MapGet("/gifts", async () =>
{
    await using var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync();
    return Results.Ok(await ListGifts(connection));
});

app.MapPost("/podcasts/recordings", async (PodcastRecordingRequest request, HttpRequest httpRequest) =>
{
    AuthenticatedUser? authenticatedUser = await Authenticate(authClient, httpRequest.Headers.Authorization.ToString());
    if (authenticatedUser is null) return Results.Unauthorized();
    if (!CanManagePodcasts(authenticatedUser) || !string.Equals(authenticatedUser.Id, request.CreatorId, StringComparison.OrdinalIgnoreCase))
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 255 || string.IsNullOrWhiteSpace(request.RoomId)
        || string.IsNullOrWhiteSpace(request.StorageUri) || request.DurationSeconds < 1)
        return Results.BadRequest(new { message = "Valid title, room, storage URI and duration are required" });

    await using var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync();
    PodcastRecordingMetadata recording = await InsertPodcastRecording(connection, request);
    return Results.Created($"/podcasts/recordings/{recording.Id}", recording);
});

app.MapGet("/podcasts/recordings", async () =>
{
    await using var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync();
    return Results.Ok(await ListPodcastRecordings(connection));
});

app.MapPut("/podcasts/recordings/{id}", async (string id, PodcastUpdateRequest request, HttpRequest httpRequest) =>
{
    AuthenticatedUser? authenticatedUser = await Authenticate(authClient, httpRequest.Headers.Authorization.ToString());
    if (authenticatedUser is null) return Results.Unauthorized();
    if (!CanManagePodcasts(authenticatedUser)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    string title = request.Title?.Trim() ?? string.Empty;
    if (title.Length is < 1 or > 255) return Results.BadRequest(new { message = "Title must contain 1 to 255 characters" });

    await using var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync();
    await using var command = connection.CreateCommand();
    command.CommandText = "UPDATE podcast_recordings SET title = @title WHERE id = @id";
    command.Parameters.AddWithValue("@title", title);
    command.Parameters.AddWithValue("@id", id);
    if (await command.ExecuteNonQueryAsync() == 0) return Results.NotFound(new { message = "Podcast not found" });
    return Results.Ok(new { id, title });
});

app.MapDelete("/podcasts/recordings/{id}", async (string id, HttpRequest httpRequest) =>
{
    AuthenticatedUser? authenticatedUser = await Authenticate(authClient, httpRequest.Headers.Authorization.ToString());
    if (authenticatedUser is null) return Results.Unauthorized();
    if (!CanManagePodcasts(authenticatedUser)) return Results.StatusCode(StatusCodes.Status403Forbidden);

    await using var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync();
    await using var command = connection.CreateCommand();
    // ponytail: metadata-only delete; remove the storage object when one service owns file lifecycle.
    command.CommandText = "DELETE FROM podcast_recordings WHERE id = @id";
    command.Parameters.AddWithValue("@id", id);
    if (await command.ExecuteNonQueryAsync() == 0) return Results.NotFound();
    return Results.NoContent();
});

app.Run(Environment.GetEnvironmentVariable("WALLET_URL") ?? "http://localhost:5041");

static async Task<WalletAccount> GetOrCreateWallet(MySqlConnection connection, string ownerId, MySqlTransaction? transaction = null)
{
    WalletAccount? existing = await FindWallet(connection, ownerId, transaction);
    if (existing is not null) return existing;

    await using var command = connection.CreateCommand();
    command.Transaction = transaction;
    command.CommandText = "INSERT INTO wallet_accounts (external_owner_id, balance, currency_code) VALUES (@ownerId, 0, 'VND')";
    command.Parameters.AddWithValue("@ownerId", ownerId);
    await command.ExecuteNonQueryAsync();

    return await FindWallet(connection, ownerId, transaction) ?? throw new InvalidOperationException("Wallet insert failed");
}

static async Task<AuthenticatedUser?> Authenticate(HttpClient client, string authorization)
{
    if (string.IsNullOrWhiteSpace(authorization)) return null;
    try
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "auth/me");
        request.Headers.TryAddWithoutValidation("Authorization", authorization);
        using HttpResponseMessage response = await client.SendAsync(request);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<AuthenticatedUser>()
            : null;
    }
    catch (HttpRequestException)
    {
        return null;
    }
}

static bool CanManagePodcasts(AuthenticatedUser user) => user.Role.Equals("PRO", StringComparison.OrdinalIgnoreCase)
    || user.Role.Equals("SUPER", StringComparison.OrdinalIgnoreCase);

static async Task<bool> CanGift(MySqlConnection connection, MySqlTransaction transaction, GiftRequest request)
{
    await using var command = connection.CreateCommand();
    command.Transaction = transaction;
    command.CommandText = """
        SELECT EXISTS (
            SELECT 1
            FROM users recipient
            JOIN user_roles ur ON ur.user_id = recipient.id
            JOIN roles r ON r.id = ur.role_id
            WHERE recipient.id = @recipientId
              AND r.name IN ('PRO', 'SUPER')
              AND (
                @roomId = '' OR (
                    EXISTS (
                        SELECT 1 FROM realtime_room_participants sender_participant
                        JOIN realtime_rooms sender_room ON sender_room.id = sender_participant.room_id
                        WHERE sender_participant.anonymous_uid = @senderId
                          AND sender_participant.left_at IS NULL
                          AND sender_room.room_code = @roomId
                    )
                    AND EXISTS (
                        SELECT 1 FROM realtime_room_participants recipient_participant
                        JOIN realtime_rooms recipient_room ON recipient_room.id = recipient_participant.room_id
                        WHERE recipient_participant.anonymous_uid = @recipientId
                          AND recipient_participant.left_at IS NULL
                          AND recipient_room.room_code = @roomId
                    )
                )
              )
        )
        """;
    command.Parameters.AddWithValue("@senderId", request.FromUserId);
    command.Parameters.AddWithValue("@recipientId", request.ToCreatorId);
    command.Parameters.AddWithValue("@roomId", request.RoomId?.Trim() ?? string.Empty);
    return Convert.ToInt32(await command.ExecuteScalarAsync()) == 1;
}

static async Task<WalletAccount?> FindWallet(MySqlConnection connection, string ownerId, MySqlTransaction? transaction = null)
{
    await using var command = connection.CreateCommand();
    command.Transaction = transaction;
    command.CommandText = "SELECT id, external_owner_id, balance, currency_code FROM wallet_accounts WHERE external_owner_id = @ownerId";
    command.Parameters.AddWithValue("@ownerId", ownerId);
    await using var reader = await command.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) return null;
    return new WalletAccount(reader.GetGuid("id").ToString(), reader.GetString("external_owner_id"), reader.GetDecimal("balance"), reader.GetString("currency_code"));
}

static async Task<WalletAccount> UpdateWalletBalance(MySqlConnection connection, MySqlTransaction transaction, string walletId, decimal delta)
{
    await using (var command = connection.CreateCommand())
    {
        command.Transaction = transaction;
        command.CommandText = "UPDATE wallet_accounts SET balance = balance + @delta WHERE id = @walletId";
        command.Parameters.AddWithValue("@delta", delta);
        command.Parameters.AddWithValue("@walletId", walletId);
        await command.ExecuteNonQueryAsync();
    }

    await using var select = connection.CreateCommand();
    select.Transaction = transaction;
    select.CommandText = "SELECT id, external_owner_id, balance, currency_code FROM wallet_accounts WHERE id = @walletId";
    select.Parameters.AddWithValue("@walletId", walletId);
    await using var reader = await select.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) throw new InvalidOperationException("Wallet not found after balance update");
    return new WalletAccount(reader.GetGuid("id").ToString(), reader.GetString("external_owner_id"), reader.GetDecimal("balance"), reader.GetString("currency_code"));
}

static async Task InsertWalletTransaction(MySqlConnection connection, MySqlTransaction transaction, string walletId, string type, decimal amount, string? providerReference)
{
    await using var command = connection.CreateCommand();
    command.Transaction = transaction;
    command.CommandText = "INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, provider_reference, status) VALUES (@walletId, @type, @amount, @providerReference, 'COMMITTED')";
    command.Parameters.AddWithValue("@walletId", walletId);
    command.Parameters.AddWithValue("@type", type);
    command.Parameters.AddWithValue("@amount", amount);
    command.Parameters.AddWithValue("@providerReference", providerReference is null ? DBNull.Value : providerReference);
    await command.ExecuteNonQueryAsync();
}

static async Task<GiftTransaction> InsertGift(MySqlConnection connection, MySqlTransaction transaction, string fromWalletId, string toWalletId, GiftRequest request)
{
    string id = Guid.NewGuid().ToString();
    await using var command = connection.CreateCommand();
    command.Transaction = transaction;
    command.CommandText = """
        INSERT INTO gift_transactions (id, from_wallet_id, to_wallet_id, room_code, amount, message, realtime_event)
        VALUES (@id, @fromWalletId, @toWalletId, @roomCode, @amount, @message, 'gift:sent')
        """;
    command.Parameters.AddWithValue("@id", id);
    command.Parameters.AddWithValue("@fromWalletId", fromWalletId);
    command.Parameters.AddWithValue("@toWalletId", toWalletId);
    command.Parameters.AddWithValue("@roomCode", string.IsNullOrWhiteSpace(request.RoomId) ? DBNull.Value : request.RoomId);
    command.Parameters.AddWithValue("@amount", request.Amount);
    command.Parameters.AddWithValue("@message", request.Message ?? (object)DBNull.Value);
    await command.ExecuteNonQueryAsync();
    return new GiftTransaction(id, request.FromUserId, request.ToCreatorId, request.FromUserId, request.ToCreatorId, request.RoomId ?? "", request.Amount, request.Message ?? "", DateTimeOffset.UtcNow);
}

static async Task<List<GiftTransaction>> ListGifts(MySqlConnection connection)
{
    var gifts = new List<GiftTransaction>();
    await using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT g.id, sender.external_owner_id AS from_user_id, receiver.external_owner_id AS to_creator_id,
               COALESCE(sender_user.display_name, sender.external_owner_id) AS from_display_name,
               COALESCE(receiver_user.display_name, receiver.external_owner_id) AS to_display_name,
               g.room_code, g.amount, g.message, g.created_at
        FROM gift_transactions g
        JOIN wallet_accounts sender ON sender.id = g.from_wallet_id
        JOIN wallet_accounts receiver ON receiver.id = g.to_wallet_id
        LEFT JOIN users sender_user ON sender_user.id = sender.external_owner_id
        LEFT JOIN users receiver_user ON receiver_user.id = receiver.external_owner_id
        ORDER BY g.created_at DESC
        """;
    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        gifts.Add(new GiftTransaction(
            reader.GetGuid("id").ToString(),
            reader.GetString("from_user_id"),
            reader.GetString("to_creator_id"),
            reader.GetString("from_display_name"),
            reader.GetString("to_display_name"),
            reader.IsDBNull(reader.GetOrdinal("room_code")) ? string.Empty : reader.GetString("room_code"),
            reader.GetDecimal("amount"),
            reader.IsDBNull(reader.GetOrdinal("message")) ? string.Empty : reader.GetString("message"),
            reader.GetDateTime("created_at")));
    }
    return gifts;
}

static async Task<PodcastRecordingMetadata> InsertPodcastRecording(MySqlConnection connection, PodcastRecordingRequest request)
{
    string id = Guid.NewGuid().ToString();
    await using var command = connection.CreateCommand();
    command.CommandText = """
        INSERT INTO podcast_recordings (id, creator_external_id, room_code, title, storage_uri, duration_seconds)
        VALUES (@id, @creatorId, @roomCode, @title, @storageUri, @durationSeconds)
        """;
    command.Parameters.AddWithValue("@id", id);
    command.Parameters.AddWithValue("@creatorId", request.CreatorId);
    command.Parameters.AddWithValue("@roomCode", request.RoomId);
    command.Parameters.AddWithValue("@title", request.Title);
    command.Parameters.AddWithValue("@storageUri", request.StorageUri);
    command.Parameters.AddWithValue("@durationSeconds", request.DurationSeconds);
    await command.ExecuteNonQueryAsync();
    return new PodcastRecordingMetadata(id, request.CreatorId, request.CreatorId, request.RoomId, request.Title, request.StorageUri, request.DurationSeconds, DateTimeOffset.UtcNow);
}

static async Task<List<PodcastRecordingMetadata>> ListPodcastRecordings(MySqlConnection connection)
{
    var recordings = new List<PodcastRecordingMetadata>();
    await using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT p.id, p.creator_external_id, COALESCE(u.display_name, p.creator_external_id) AS creator_display_name,
               p.room_code, p.title, p.storage_uri, p.duration_seconds, p.created_at
        FROM podcast_recordings p
        LEFT JOIN users u ON u.id = p.creator_external_id
        ORDER BY p.created_at DESC
        """;
    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        recordings.Add(new PodcastRecordingMetadata(
            reader.GetGuid("id").ToString(),
            reader.GetString("creator_external_id"),
            reader.GetString("creator_display_name"),
            reader.GetString("room_code"),
            reader.GetString("title"),
            reader.GetString("storage_uri"),
            reader.GetInt32("duration_seconds"),
            reader.GetDateTime("created_at")));
    }
    return recordings;
}

record WalletAccount(string Id, string UserId, decimal Balance, string CurrencyCode);
record TopUpRequest(decimal Amount, string ProviderReference);
record WalletTransactionResponse(WalletAccount Wallet, string Message);
record GiftRequest(string FromUserId, string ToCreatorId, string RoomId, decimal Amount, string Message);
record GiftTransaction(string Id, string FromUserId, string ToCreatorId, string FromDisplayName, string ToDisplayName, string RoomId, decimal Amount, string Message, DateTimeOffset CreatedAt);
record AuthenticatedUser(string Id, string Email, string Role);
record PodcastRecordingRequest(string CreatorId, string RoomId, string Title, string StorageUri, int DurationSeconds);
record PodcastUpdateRequest(string Title);
record PodcastRecordingMetadata(string Id, string CreatorId, string CreatorDisplayName, string RoomId, string Title, string StorageUri, int DurationSeconds, DateTimeOffset CreatedAt);
