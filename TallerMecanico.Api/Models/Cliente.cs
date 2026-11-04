using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;

namespace TallerMecanico.Api.Models;

[Index("Dni", Name = "UQ__Clientes__C03085758D1A73E7", IsUnique = true)]
public partial class Cliente
{
    [Key]
    public int Id { get; set; }

    [Required(ErrorMessage = "Los nombres son obligatorios.")]
    [StringLength(100, ErrorMessage = "Los nombres no pueden superar los 100 caracteres.")]
    public string Nombres { get; set; } = null!;

    [Required(ErrorMessage = "El DNI es obligatorio.")]
    [StringLength(8, MinimumLength = 8, ErrorMessage = "El DNI debe tener 8 caracteres.")]
    public string Dni { get; set; } = null!;

    [Required(ErrorMessage = "El teléfono es obligatorio.")]
    [StringLength(15, ErrorMessage = "El teléfono no puede superar los 15 caracteres.")]
    public string Telefono { get; set; } = null!;

    [StringLength(100, ErrorMessage = "El correo no puede superar los 100 caracteres.")]
    public string? Correo { get; set; }

    // [JsonIgnore] corta el ciclo Cliente -> Vehiculos -> Cliente al serializar, sin usar DTOs
    [JsonIgnore]
    [InverseProperty("Cliente")]
    public virtual ICollection<Vehiculo> Vehiculos { get; set; } = new List<Vehiculo>();
}
