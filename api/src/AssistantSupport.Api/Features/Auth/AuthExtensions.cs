using System.Security.Claims;
using AssistantSupport.Api.Domain;

namespace AssistantSupport.Api.Features.Auth;

public static class AuthPolicies
{
    /// <summary>Exige o perfil Admin (área /admin e /api/admin/*).</summary>
    public const string Admin = "Admin";
}

public static class AuthConstants
{
    public const string SessionCookie = "as_session";

    /// <summary>Cookie legível pelo JS: o Angular copia o valor para o header abaixo (padrão do HttpClient).</summary>
    public const string XsrfCookie = "XSRF-TOKEN";
    public const string XsrfHeader = "X-XSRF-TOKEN";

    public const string LoginRateLimit = "login";
}

public static class ClaimsPrincipalExtensions
{
    public static int? GetUserId(this ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public static ClaimsPrincipal ToPrincipal(this User user, string scheme)
    {
        var identity = new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        ], scheme);

        return new ClaimsPrincipal(identity);
    }
}

public static class EmailNormalizer
{
    public static string Normalize(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();
}
