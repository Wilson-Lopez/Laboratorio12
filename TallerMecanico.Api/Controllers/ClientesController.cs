using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TallerMecanico.Api.Data;
using TallerMecanico.Api.Models;

namespace TallerMecanico.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClientesController : ControllerBase
{
    private readonly TallerContext _context;

    public ClientesController(TallerContext context)
    {
        _context = context;
    }

    // GET: api/clientes
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<Cliente>>> GetClientes()
    {
        var clientes = await _context.Clientes
            .AsNoTracking()
            .OrderBy(c => c.Nombres)
            .ToListAsync();

        return Ok(clientes);
    }

    // GET: api/clientes/5
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Cliente>> GetCliente(int id)
    {
        var cliente = await _context.Clientes.FindAsync(id);

        if (cliente == null)
        {
            return NotFound(new { mensaje = $"No existe el cliente con id {id}." });
        }

        return Ok(cliente);
    }

    // GET: api/clientes/5/vehiculos (ruta anidada)
    [HttpGet("{id}/vehiculos")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IEnumerable<Vehiculo>>> GetVehiculosDelCliente(int id)
    {
        if (!await _context.Clientes.AnyAsync(c => c.Id == id))
        {
            return NotFound(new { mensaje = $"No existe el cliente con id {id}." });
        }

        var vehiculos = await _context.Vehiculos
            .AsNoTracking()
            .Where(v => v.ClienteId == id)
            .OrderBy(v => v.Placa)
            .ToListAsync();

        return Ok(vehiculos);
    }

    // POST: api/clientes
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<Cliente>> PostCliente(Cliente cliente)
    {
        // Regla de negocio: el DNI no se puede repetir
        if (await _context.Clientes.AnyAsync(c => c.Dni == cliente.Dni))
        {
            return Conflict(new { mensaje = $"Ya existe un cliente con el DNI {cliente.Dni}." });
        }

        // El Id lo genera la base de datos (IDENTITY)
        cliente.Id = 0;

        _context.Clientes.Add(cliente);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCliente), new { id = cliente.Id }, cliente);
    }

    // PUT: api/clientes/5
    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> PutCliente(int id, Cliente cliente)
    {
        if (id != cliente.Id)
        {
            return BadRequest(new { mensaje = "El id de la ruta no coincide con el del cuerpo." });
        }

        if (!await _context.Clientes.AnyAsync(c => c.Id == id))
        {
            return NotFound(new { mensaje = $"No existe el cliente con id {id}." });
        }

        // Regla de negocio: el DNI no se puede repetir
        if (await _context.Clientes.AnyAsync(c => c.Dni == cliente.Dni && c.Id != id))
        {
            return Conflict(new { mensaje = $"Ya existe otro cliente con el DNI {cliente.Dni}." });
        }

        _context.Entry(cliente).State = EntityState.Modified;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // DELETE: api/clientes/5
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteCliente(int id)
    {
        var cliente = await _context.Clientes.FindAsync(id);

        if (cliente == null)
        {
            return NotFound(new { mensaje = $"No existe el cliente con id {id}." });
        }

        // Regla de negocio: no se elimina un cliente que tiene vehículos registrados
        if (await _context.Vehiculos.AnyAsync(v => v.ClienteId == id))
        {
            return Conflict(new { mensaje = "No se puede eliminar el cliente porque tiene vehículos registrados." });
        }

        _context.Clientes.Remove(cliente);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
