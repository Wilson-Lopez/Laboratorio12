using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TallerMecanico.Api.Data;
using TallerMecanico.Api.Models;

namespace TallerMecanico.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VehiculosController : ControllerBase
{
    private readonly TallerContext _context;

    public VehiculosController(TallerContext context)
    {
        _context = context;
    }

    // GET: api/vehiculos?marca=Toyota&placa=ABC&anioDesde=2018&anioHasta=2022&clienteId=1
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<Vehiculo>>> GetVehiculos(
        [FromQuery] string? marca,
        [FromQuery] string? placa,
        [FromQuery] int? anioDesde,
        [FromQuery] int? anioHasta,
        [FromQuery] int? clienteId)
    {
        var consulta = _context.Vehiculos
            .AsNoTracking()
            .Include(v => v.Cliente)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(marca))
        {
            consulta = consulta.Where(v => v.Marca.Contains(marca));
        }

        if (!string.IsNullOrWhiteSpace(placa))
        {
            consulta = consulta.Where(v => v.Placa.Contains(placa));
        }

        if (anioDesde.HasValue)
        {
            consulta = consulta.Where(v => v.Anio >= anioDesde.Value);
        }

        if (anioHasta.HasValue)
        {
            consulta = consulta.Where(v => v.Anio <= anioHasta.Value);
        }

        if (clienteId.HasValue)
        {
            consulta = consulta.Where(v => v.ClienteId == clienteId.Value);
        }

        return Ok(await consulta.OrderBy(v => v.Placa).ToListAsync());
    }

    // GET: api/vehiculos/5
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Vehiculo>> GetVehiculo(int id)
    {
        var vehiculo = await _context.Vehiculos
            .AsNoTracking()
            .Include(v => v.Cliente)
            .FirstOrDefaultAsync(v => v.Id == id);

        if (vehiculo == null)
        {
            return NotFound(new { mensaje = $"No existe el vehículo con id {id}." });
        }

        return Ok(vehiculo);
    }

    // POST: api/vehiculos
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<Vehiculo>> PostVehiculo(Vehiculo vehiculo)
    {
        if (!await _context.Clientes.AnyAsync(c => c.Id == vehiculo.ClienteId))
        {
            ModelState.AddModelError(nameof(vehiculo.ClienteId), $"No existe el cliente con id {vehiculo.ClienteId}.");
            return ValidationProblem(ModelState);
        }

        // Regla de negocio: la placa no se puede repetir
        if (await _context.Vehiculos.AnyAsync(v => v.Placa == vehiculo.Placa))
        {
            return Conflict(new { mensaje = $"Ya existe un vehículo con la placa {vehiculo.Placa}." });
        }

        // El Id lo genera la base de datos y solo se usa la clave foránea, no el cliente del cuerpo
        vehiculo.Id = 0;
        vehiculo.Cliente = null;

        _context.Vehiculos.Add(vehiculo);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetVehiculo), new { id = vehiculo.Id }, vehiculo);
    }

    // PUT: api/vehiculos/5
    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> PutVehiculo(int id, Vehiculo vehiculo)
    {
        if (id != vehiculo.Id)
        {
            return BadRequest(new { mensaje = "El id de la ruta no coincide con el del cuerpo." });
        }

        if (!await _context.Vehiculos.AnyAsync(v => v.Id == id))
        {
            return NotFound(new { mensaje = $"No existe el vehículo con id {id}." });
        }

        if (!await _context.Clientes.AnyAsync(c => c.Id == vehiculo.ClienteId))
        {
            ModelState.AddModelError(nameof(vehiculo.ClienteId), $"No existe el cliente con id {vehiculo.ClienteId}.");
            return ValidationProblem(ModelState);
        }

        // Regla de negocio: la placa no se puede repetir
        if (await _context.Vehiculos.AnyAsync(v => v.Placa == vehiculo.Placa && v.Id != id))
        {
            return Conflict(new { mensaje = $"Ya existe otro vehículo con la placa {vehiculo.Placa}." });
        }

        // Solo se usa la clave foránea, no el cliente del cuerpo
        vehiculo.Cliente = null;

        _context.Entry(vehiculo).State = EntityState.Modified;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // DELETE: api/vehiculos/5
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteVehiculo(int id)
    {
        var vehiculo = await _context.Vehiculos.FindAsync(id);

        if (vehiculo == null)
        {
            return NotFound(new { mensaje = $"No existe el vehículo con id {id}." });
        }

        _context.Vehiculos.Remove(vehiculo);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
