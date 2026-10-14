FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore em camada separada para aproveitar cache
COPY src/AssistantSupport.Api/AssistantSupport.Api.csproj src/AssistantSupport.Api/
RUN dotnet restore src/AssistantSupport.Api/AssistantSupport.Api.csproj

COPY src/ src/
RUN dotnet publish src/AssistantSupport.Api/AssistantSupport.Api.csproj \
    -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# curl é usado apenas pelo healthcheck do Compose
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Diretório do volume com dono não-root (o volume nomeado herda essas permissões)
RUN mkdir -p /app/storage && chown app:app /app/storage

COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER app

ENTRYPOINT ["dotnet", "AssistantSupport.Api.dll"]