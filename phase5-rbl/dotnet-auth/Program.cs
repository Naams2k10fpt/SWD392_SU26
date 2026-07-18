using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);

const string issuer = "lucy-phase1";
const string audience = "lucy-clients";
string secret = Environment.GetEnvironmentVariable("LUCY_JWT_SECRET")
    ?? throw new InvalidOperationException("LUCY_JWT_SECRET is required.");

var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
string connectionString = Environment.GetEnvironmentVariable("LUCY_DB")
    ?? builder.Configuration.GetConnectionString("MariaDb")
    ?? "Server=localhost;Database=lucy_phase5;User=root;Password=;AllowUserVariables=True;";
var passwordHasher = new PasswordHasher<AppUser>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = issuer,
            ValidAudience = audience,
            IssuerSigningKey = signingKey
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new { service = "LUCY Phase 1 Auth API", status = "ready", storage = "MariaDB" }));

app.MapPost("/auth/register", async (RegisterRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.DisplayName) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new { message = "email, password and displayName are required" });
    }
    string email = request.Email.Trim().ToLowerInvariant();
    string displayName = request.DisplayName.Trim();

    await using var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync();

    if (await EmailExists(connection, email))
    {
        return Results.Conflict(new { message = "Email already registered" });
    }

    string role = NormalizeRole(request.Role);
    await EnsureRole(connection, role);

    var user = new AppUser(Guid.NewGuid(), email, displayName, role, string.Empty);
    string passwordHash = passwordHasher.HashPassword(user, request.Password);
    user = user with { PasswordHash = passwordHash };

    await using var transaction = await connection.BeginTransactionAsync();
    try
    {
        await InsertUser(connection, transaction, user);
        await AssignRole(connection, transaction, user.Id, role);
        await transaction.CommitAsync();
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }

    return Results.Created($"/users/{user.Id}", CreateAuthResponse(user));
});

app.MapPost("/auth/login", async (LoginRequest request) =>
{
    string email = request.Email.Trim().ToLowerInvariant();
    await using var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync();

    AppUser? user = await FindUserByEmail(connection, email);
    if (user is null)
    {
        return Results.Unauthorized();
    }

    PasswordVerificationResult result = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
    return result == PasswordVerificationResult.Failed
        ? Results.Unauthorized()
        : Results.Ok(CreateAuthResponse(user));
});

app.MapGet("/auth/me", (ClaimsPrincipal principal) =>
{
    return Results.Ok(new
    {
        id = principal.FindFirstValue(ClaimTypes.NameIdentifier),
        email = principal.FindFirstValue(ClaimTypes.Email),
        role = principal.FindFirstValue(ClaimTypes.Role)
    });
}).RequireAuthorization();

app.Run("http://localhost:5000");

async Task<bool> EmailExists(MySqlConnection connection, string email)
{
    await using var command = connection.CreateCommand();
    command.CommandText = "SELECT COUNT(*) FROM users WHERE email = @email";
    command.Parameters.AddWithValue("@email", email);
    object? result = await command.ExecuteScalarAsync();
    return Convert.ToInt32(result) > 0;
}

async Task EnsureRole(MySqlConnection connection, string role)
{
    await using var command = connection.CreateCommand();
    command.CommandText = "INSERT IGNORE INTO roles (name, description) VALUES (@role, @description)";
    command.Parameters.AddWithValue("@role", role);
    command.Parameters.AddWithValue("@description", $"{role} role");
    await command.ExecuteNonQueryAsync();
}

async Task InsertUser(MySqlConnection connection, MySqlTransaction transaction, AppUser user)
{
    await using var command = connection.CreateCommand();
    command.Transaction = transaction;
    command.CommandText = "INSERT INTO users (id, email, display_name, password_hash, status) VALUES (@id, @email, @displayName, @passwordHash, 'ACTIVE')";
    command.Parameters.AddWithValue("@id", user.Id.ToString());
    command.Parameters.AddWithValue("@email", user.Email);
    command.Parameters.AddWithValue("@displayName", user.DisplayName);
    command.Parameters.AddWithValue("@passwordHash", user.PasswordHash);
    await command.ExecuteNonQueryAsync();
}

async Task AssignRole(MySqlConnection connection, MySqlTransaction transaction, Guid userId, string role)
{
    await using var command = connection.CreateCommand();
    command.Transaction = transaction;
    command.CommandText = """
        INSERT INTO user_roles (user_id, role_id)
        SELECT @userId, id FROM roles WHERE name = @role
        """;
    command.Parameters.AddWithValue("@userId", userId.ToString());
    command.Parameters.AddWithValue("@role", role);
    await command.ExecuteNonQueryAsync();
}

async Task<AppUser?> FindUserByEmail(MySqlConnection connection, string email)
{
    await using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT u.id, u.email, u.display_name, u.password_hash, COALESCE(r.name, 'ANONYMOUS') AS role_name
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.email = @email
        LIMIT 1
        """;
    command.Parameters.AddWithValue("@email", email);

    await using var reader = await command.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) return null;

    return new AppUser(
        reader.GetGuid("id"),
        reader.GetString("email"),
        reader.GetString("display_name"),
        reader.GetString("role_name"),
        reader.GetString("password_hash"));
}

AuthResponse CreateAuthResponse(AppUser user)
{
    var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
    var expiresAt = DateTime.UtcNow.AddHours(2);
    var claims = new[]
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(JwtRegisteredClaimNames.Email, user.Email),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim(ClaimTypes.Name, user.DisplayName),
        new Claim(ClaimTypes.Role, user.Role)
    };

    var token = new JwtSecurityToken(issuer, audience, claims, expires: expiresAt, signingCredentials: credentials);
    string accessToken = new JwtSecurityTokenHandler().WriteToken(token);
    return new AuthResponse(accessToken, expiresAt, new UserResponse(user.Id, user.Email, user.DisplayName, user.Role));
}

static string NormalizeRole(string? role)
{
    string normalized = string.IsNullOrWhiteSpace(role) ? "ANONYMOUS" : role.Trim().ToUpperInvariant();
    return normalized is "ANONYMOUS" or "PRO" or "SUPER" ? normalized : "ANONYMOUS";
}

record RegisterRequest(string Email, string Password, string DisplayName, string? Role);
record LoginRequest(string Email, string Password);
record AppUser(Guid Id, string Email, string DisplayName, string Role, string PasswordHash);
record UserResponse(Guid Id, string Email, string DisplayName, string Role);
record AuthResponse(string AccessToken, DateTime ExpiresAt, UserResponse User);
