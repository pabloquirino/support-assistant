using AssistantSupport.Api.Domain;
using AssistantSupport.Api.Features.Auth;
using AssistantSupport.Api.Features.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Data.Seed;

/// <summary>
/// Cria o primeiro administrador a partir de Admin:Email / Admin:Password
/// (ADMIN_EMAIL / ADMIN_PASSWORD no compose). Só age enquanto não existir nenhum admin,
/// então trocar as variáveis depois não altera a senha de ninguém.
/// </summary>
public class AdminSeeder(AppDbContext db, IPasswordHasher<User> hasher, IConfiguration config, ILogger<AdminSeeder> logger)
{
    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (await db.Users.AnyAsync(u => u.Role == UserRole.Admin, ct))
            return;

        var email = EmailNormalizer.Normalize(config["Admin:Email"]);
        var password = config["Admin:Password"] ?? string.Empty;
        var name = string.IsNullOrWhiteSpace(config["Admin:Name"]) ? "Administrador" : config["Admin:Name"]!.Trim();

        if (email.Length == 0 || password.Length == 0)
        {
            logger.LogWarning(
                "Nenhum administrador cadastrado. Defina ADMIN_EMAIL e ADMIN_PASSWORD e reinicie a API para criar o primeiro.");
            return;
        }

        var invalid = UserRules.ValidateEmail(email) ?? UserRules.ValidatePassword(password);
        if (invalid is not null)
        {
            logger.LogError("Admin inicial não criado: {Error}", invalid);
            return;
        }

        if (await db.Users.AnyAsync(u => u.Email == email, ct))
        {
            logger.LogError(
                "Admin inicial não criado: já existe um usuário com o e-mail {Email}. Promova-o a Admin direto no banco.", email);
            return;
        }

        var user = new User { Name = name, Email = email, Role = UserRole.Admin };
        user.PasswordHash = hasher.HashPassword(user, password);
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Administrador inicial criado: {Email}.", email);
    }
}
