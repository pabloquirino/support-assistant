using System.Globalization;
using System.Text;

namespace AssistantSupport.Api.Common;

public static class TextNormalizer
{
    /// <summary>
    /// Minúsculas, sem acentos e com espaços colapsados.
    /// Ex.: "  Pagamento NÃO   Caiu " -> "pagamento nao caiu".
    /// </summary>
    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var decomposed = input.Trim().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        var lastWasSpace = false;

        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;

            if (char.IsWhiteSpace(c))
            {
                if (!lastWasSpace) sb.Append(' ');
                lastWasSpace = true;
                continue;
            }

            sb.Append(char.ToLowerInvariant(c));
            lastWasSpace = false;
        }

        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}