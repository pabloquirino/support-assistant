FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copia o código-fonte e os arquivos de configuração
COPY src/ src/

# Restaura as dependências após copiar os arquivos
RUN dotnet restore src/AssistantSupport.Api/AssistantSupport.Api.csproj \
    --force \
    --verbosity normal

# Verifica se o pacote problemático está no cache do NuGet
RUN ls -la /root/.nuget/packages/microsoft.codeanalysis.analyzers/3.11.0/

RUN dotnet publish src/AssistantSupport.Api/AssistantSupport.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/storage && chown app:app /app/storage

COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER app

ENTRYPOINT ["dotnet", "AssistantSupport.Api.dll"]
