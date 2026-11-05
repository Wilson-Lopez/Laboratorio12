using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using TallerMecanico.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers(options =>
{
    // El [Required] implícito del cuerpo tiene su mensaje en inglés; las entidades ya declaran los suyos
    options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;

    // Mensajes de enlace de datos en español
    var mensajes = options.ModelBindingMessageProvider;
    mensajes.SetNonPropertyAttemptedValueIsInvalidAccessor(valor => $"El valor '{valor}' no es válido.");
    mensajes.SetMissingRequestBodyRequiredValueAccessor(() => "El cuerpo de la petición es obligatorio.");
})
.AddJsonOptions(options =>
    // No devuelve el detalle en inglés de System.Text.Json cuando el JSON es inválido
    options.AllowInputFormatterExceptionMessages = false);

// Errores generados por ASP.NET en español. Los de las reglas de negocio se escriben en los controladores.
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context =>
    {
        var problema = context.ProblemDetails;

        problema.Title = problema.Status switch
        {
            StatusCodes.Status400BadRequest => "Los datos enviados no son válidos.",
            StatusCodes.Status404NotFound => "No se encontró el recurso solicitado.",
            StatusCodes.Status405MethodNotAllowed => "El método HTTP no está permitido en esta ruta.",
            StatusCodes.Status415UnsupportedMediaType => "Tipo de contenido no admitido: use application/json.",
            StatusCodes.Status500InternalServerError => "Ocurrió un error interno en el servidor.",
            _ => problema.Title
        };

        // ASP.NET usa este texto fijo cuando el JSON está mal escrito o un valor no tiene el tipo esperado
        if (problema is HttpValidationProblemDetails validacion)
        {
            foreach (var errores in validacion.Errors.Values)
            {
                for (var i = 0; i < errores.Length; i++)
                {
                    if (errores[i] == "The input was not valid.")
                    {
                        errores[i] = "El valor enviado no tiene el formato correcto.";
                    }
                }
            }
        }
    });

// Por defecto OpenAPI declara los números como ["integer", "string"] y Swagger UI no valida ese tipo:
// responde "Required field is not provided" aunque se escriba el id
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict);

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

// Errores no controlados (500) y respuestas sin cuerpo (ruta inexistente, método no permitido) en JSON
app.UseExceptionHandler();
app.UseStatusCodePages();

// Antes que la página y Swagger: si cargaran por HTTP y sus peticiones se redirigieran a HTTPS,
// el navegador las bloquearía por ser de otro origen
app.UseHttpsRedirection();

// Página del panel, en la carpeta wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

// Swagger queda visible también en la API publicada, no solo en Development
app.MapOpenApi();
app.UseSwaggerUI(options =>
    options.SwaggerEndpoint("/openapi/v1.json", "Taller Mecánico API v1"));

app.UseCors();

app.UseAuthorization();

app.MapControllers();

app.Run();
