using Microsoft.EntityFrameworkCore;
using TallerMecanico.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// La cadena de conexión no se sube al repositorio: en local viene de user-secrets
// y en la nube de la variable de entorno ConnectionStrings__TallerDB
var cadenaConexion = builder.Configuration.GetConnectionString("TallerDB")
    ?? throw new InvalidOperationException("Falta configurar la cadena de conexión TallerDB.");

builder.Services.AddDbContext<TallerContext>(options =>
    options.UseSqlServer(cadenaConexion));

// CORS con un origen concreto, definido en appsettings.json
var origenPermitido = builder.Configuration["Cors:OrigenPermitido"]
    ?? throw new InvalidOperationException("Falta configurar Cors:OrigenPermitido.");

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(origenPermitido)
              .AllowAnyHeader()
              .AllowAnyMethod()));

var app = builder.Build();

// Configure the HTTP request pipeline.

// Swagger queda visible también en la API publicada, no solo en Development
app.MapOpenApi();
app.UseSwaggerUI(options =>
    options.SwaggerEndpoint("/openapi/v1.json", "Taller Mecánico API v1"));

app.UseHttpsRedirection();

app.UseCors();

app.UseAuthorization();

app.MapControllers();

app.Run();
