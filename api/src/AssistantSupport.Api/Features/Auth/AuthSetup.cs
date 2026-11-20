using System.Security.Claims;
using System.Threading.RateLimiting;
using AssistantSupport.Api.Data;
using AssistantSupport.Api.Domain;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Features.Auth;

/// <summary>
/// Sessão por cookie HttpOnly (mesma origem via nginx) + proteção CSRF por header.
/// O Angular lê o cookie XSRF-TOKEN e envia X-XSRF-TOKEN em POST/PUT/DELETE.
/// </summary>
public static class AuthSetup
{
    public static IServiceCollection AddAppAuth(this IServiceCollection services, IConfiguration config, string storagePath)
    {
        services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();

        // Chaves que cifram o cookie de sessão e os tokens CSRF. Persistidas no volume
        // para que reiniciar o container não derrube as sessões.
        var keysPath = config["DataProtection:KeysPath"] ?? Path.Combine(storagePath, "keys");
        services.AddDataProtection()
            .SetApplicationName("AssistantSupport")
            .PersistKeysToFileSystem(new DirectoryInfo(keysPath));

        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(o =>
            {
                o.Cookie.Name = AuthConstants.SessionCookie;
                o.Cookie.HttpOnly = true;
                o.Cookie.SameSite = SameSiteMode.Strict;
                o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                o.ExpireTimeSpan = TimeSpan.FromHours(config.GetValue("Auth:SessionHours", 8));
                o.SlidingExpiration = true;

                // API: nada de redirect para página de login, só o status.
                o.Events.OnRedirectToLogin = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                o.Events.OnRedirectToAccessDenied = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
                o.Events.OnValidatePrincipal = ValidatePrincipalAsync;
            });

        services.AddAuthorizationBuilder()
            .AddPolicy(AuthPolicies.Admin, p => p.RequireRole(nameof(UserRole.Admin)))
            // Tudo exige login, salvo o que for marcado com AllowAnonymous.
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        services.AddAntiforgery(o =>
        {
            o.HeaderName = AuthConstants.XsrfHeader;
            o.Cookie.HttpOnly = true;
            o.Cookie.SameSite = SameSiteMode.Strict;
            o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        });

        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.AddPolicy(AuthConstants.LoginRateLimit, ctx => RateLimitPartition.GetFixedWindowLimiter(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
        });

        // O nginx informa IP e esquema originais (rate limit por IP e cookie Secure atrás de HTTPS).
        services.Configure<ForwardedHeadersOptions>(o =>
        {
            o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            o.KnownIPNetworks.Clear();
            o.KnownProxies.Clear();
        });

        return services;
    }

    public static WebApplication UseAppAuth(this WebApplication app)
    {
        app.UseForwardedHeaders();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseAntiforgery();
        app.UseRateLimiter();

        // Valida o token CSRF em toda requisição que altera estado sob /api.
        app.Use(async (ctx, next) =>
        {
            var method = ctx.Request.Method;
            var unsafeMethod = !(HttpMethods.IsGet(method) || HttpMethods.IsHead(method)
                                 || HttpMethods.IsOptions(method) || HttpMethods.IsTrace(method));

            if (unsafeMethod && ctx.Request.Path.StartsWithSegments("/api"))
            {
                // Endpoints com formulário (upload) já foram validados pelo UseAntiforgery.
                var valid = ctx.Features.Get<IAntiforgeryValidationFeature>()?.IsValid
                            ?? await ctx.RequestServices.GetRequiredService<IAntiforgery>().IsRequestValidAsync(ctx);

                if (!valid)
                {
                    ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await ctx.Response.WriteAsJsonAsync(new
                    {
                        error = "Sessão expirada ou requisição inválida. Recarregue a página.",
                        code = "csrf"
                    });
                    return;
                }
            }

            await next();
        });

        return app;
    }

    /// <summary>
    /// A cada requisição confere se o usuário segue ativo e atualiza nome/perfil:
    /// desativar ou rebaixar alguém vale na hora, sem esperar o cookie expirar.
    /// </summary>
    private static async Task ValidatePrincipalAsync(CookieValidatePrincipalContext ctx)
    {
        var id = ctx.Principal?.GetUserId();
        if (id is null)
        {
            ctx.RejectPrincipal();
            return;
        }

        var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);

        if (user is null || !user.IsActive)
        {
            ctx.RejectPrincipal();
            await ctx.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }

        var current = ctx.Principal!;
        if (!current.IsInRole(user.Role.ToString())
            || current.Identity?.Name != user.Name
            || current.FindFirstValue(ClaimTypes.Email) != user.Email)
        {
            ctx.ReplacePrincipal(user.ToPrincipal(CookieAuthenticationDefaults.AuthenticationScheme));
            ctx.ShouldRenew = true;
        }
    }
}
