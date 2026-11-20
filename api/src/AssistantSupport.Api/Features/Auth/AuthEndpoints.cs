using AssistantSupport.Api.Data;
using AssistantSupport.Api.Domain;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AssistantSupport.Api.Features.Auth;

public record LoginRequest(string? Email, string? Password);
public record SessionUserDto(int Id, string Name, string Email, UserRole Role);
public record SessionDto(SessionUserDto? User);

public static class AuthEndpoints
{
    private const string Scheme = CookieAuthenticationDefaults.AuthenticationScheme;

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("/auth").AllowAnonymous();

        // Estado da sessão. Sempre emite o token CSRF: o front chama isto ao abrir.
        g.MapGet("/session", async (HttpContext http, AppDbContext db, IAntiforgery antiforgery, CancellationToken ct) =>
        {
            SessionUserDto? user = null;
            var id = http.User.GetUserId();

            if (id is not null)
            {
                user = await db.Users
                    .AsNoTracking()
                    .Where(u => u.Id == id && u.IsActive)
                    .Select(u => new SessionUserDto(u.Id, u.Name, u.Email, u.Role))
                    .FirstOrDefaultAsync(ct);
            }

            IssueXsrfToken(http, antiforgery);
            return Results.Ok(new SessionDto(user));
        });

        g.MapPost("/login", async (
            LoginRequest request,
            HttpContext http,
            AppDbContext db,
            IPasswordHasher<User> hasher,
            IAntiforgery antiforgery,
            ILoggerFactory loggers,
            CancellationToken ct) =>
        {
            var email = EmailNormalizer.Normalize(request.Email);
            var password = request.Password ?? string.Empty;

            if (email.Length == 0 || password.Length == 0)
                return Results.Json(new { error = "Informe e-mail e senha." }, statusCode: 400);

            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

            // Mesmo custo de hash com ou sem usuário: não revela quais e-mails existem.
            var result = user is null
                ? VerifyDummy(hasher, password)
                : hasher.VerifyHashedPassword(user, user.PasswordHash, password);

            if (user is null || result == PasswordVerificationResult.Failed || !user.IsActive)
            {
                loggers.CreateLogger("Auth").LogInformation("Falha de login para {Email}.", email);
                return Results.Json(new { error = "E-mail ou senha inválidos." }, statusCode: 401);
            }

            if (result == PasswordVerificationResult.SuccessRehashNeeded)
            {
                user.PasswordHash = hasher.HashPassword(user, password);
                await db.SaveChangesAsync(ct);
            }

            var principal = user.ToPrincipal(Scheme);
            await http.SignInAsync(Scheme, principal);

            // O token CSRF é vinculado à identidade: reemite para o usuário recém-autenticado.
            http.User = principal;
            IssueXsrfToken(http, antiforgery);

            return Results.Ok(new SessionDto(new SessionUserDto(user.Id, user.Name, user.Email, user.Role)));
        }).RequireRateLimiting(AuthConstants.LoginRateLimit);

        g.MapPost("/logout", async (HttpContext http, IAntiforgery antiforgery) =>
        {
            await http.SignOutAsync(Scheme);
            http.User = new ClaimsPrincipal(new ClaimsIdentity());
            IssueXsrfToken(http, antiforgery);
            return Results.NoContent();
        });

        return api;
    }

    private static void IssueXsrfToken(HttpContext http, IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(http);
        http.Response.Cookies.Append(AuthConstants.XsrfCookie, tokens.RequestToken!, new CookieOptions
        {
            HttpOnly = false,
            SameSite = SameSiteMode.Strict,
            Secure = http.Request.IsHttps,
            Path = "/"
        });
    }

    private static readonly Lazy<string> DummyHash = new(() =>
        new PasswordHasher<User>().HashPassword(new User(), Guid.NewGuid().ToString()));

    private static PasswordVerificationResult VerifyDummy(IPasswordHasher<User> hasher, string password)
    {
        hasher.VerifyHashedPassword(new User(), DummyHash.Value, password);
        return PasswordVerificationResult.Failed;
    }
}
