using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

string connectionString = Environment.GetEnvironmentVariable("LUCY_DB")
    ?? builder.Configuration.GetConnectionString("MariaDb")
    ?? "Server=localhost;Database=lucy_phase5;User=root;Password=;AllowUserVariables=True;";
connectionString = new MySqlConnectionStringBuilder(connectionString) { SslMode = MySqlSslMode.None, AllowPublicKeyRetrieval = true }.ConnectionString;

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

app.MapPost("/gifts", async (GiftRequest request) =>
{
    if (request.Amount <= 0) return Results.BadRequest(new { message = "Gift amount must be positive" });

    await using var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync();
    await using var transaction = await connection.BeginTransactionAsync();

    try
    {
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

app.MapPost("/podcasts/recordings", async (PodcastRecordingRequest request) =>
{
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
    return new GiftTransaction(id, request.FromUserId, request.ToCreatorId, request.RoomId ?? "", request.Amount, request.Message ?? "", DateTimeOffset.UtcNow);
}

static async Task<List<GiftTransaction>> ListGifts(MySqlConnection connection)
{
    var gifts = new List<GiftTransaction>();
    await using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT g.id, sender.external_owner_id AS from_user_id, receiver.external_owner_id AS to_creator_id,
               g.room_code, g.amount, g.message, g.created_at
        FROM gift_transactions g
        JOIN wallet_accounts sender ON sender.id = g.from_wallet_id
        JOIN wallet_accounts receiver ON receiver.id = g.to_wallet_id
        ORDER BY g.created_at DESC
        """;
    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        gifts.Add(new GiftTransaction(
            reader.GetGuid("id").ToString(),
            reader.GetString("from_user_id"),
            reader.GetString("to_creator_id"),
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
    return new PodcastRecordingMetadata(id, request.CreatorId, request.RoomId, request.Title, request.StorageUri, request.DurationSeconds, DateTimeOffset.UtcNow);
}

static async Task<List<PodcastRecordingMetadata>> ListPodcastRecordings(MySqlConnection connection)
{
    var recordings = new List<PodcastRecordingMetadata>();
    await using var command = connection.CreateCommand();
    command.CommandText = "SELECT id, creator_external_id, room_code, title, storage_uri, duration_seconds, created_at FROM podcast_recordings ORDER BY created_at DESC";
    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        recordings.Add(new PodcastRecordingMetadata(
            reader.GetGuid("id").ToString(),
            reader.GetString("creator_external_id"),
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
record GiftTransaction(string Id, string FromUserId, string ToCreatorId, string RoomId, decimal Amount, string Message, DateTimeOffset CreatedAt);
record PodcastRecordingRequest(string CreatorId, string RoomId, string Title, string StorageUri, int DurationSeconds);
record PodcastRecordingMetadata(string Id, string CreatorId, string RoomId, string Title, string StorageUri, int DurationSeconds, DateTimeOffset CreatedAt);
