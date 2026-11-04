using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using Microsoft.EntityFrameworkCore;

namespace TallerMecanico.Api.Models;

[Index("Placa", Name = "UQ__Vehiculo__8310F99DA857875A", IsUnique = true)]
public partial class Vehiculo
{
    [Key]
    public int Id { get; set; }

    [Required(ErrorMessage = "La placa es obligatoria.")]
    [StringLength(10, ErrorMessage = "La placa no puede superar los 10 caracteres.")]
    public string Placa { get; set; } = null!;

    [Required(ErrorMessage = "La marca es obligatoria.")]
    [StringLength(50, ErrorMessage = "La marca no puede superar los 50 caracteres.")]
    public string Marca { get; set; } = null!;

    [Required(ErrorMessage = "El modelo es obligatorio.")]
    [StringLength(50, ErrorMessage = "El modelo no puede superar los 50 caracteres.")]
    public string Modelo { get; set; } = null!;

    [Range(1980, 2030, ErrorMessage = "El año debe estar entre 1980 y 2030.")]
    public int Anio { get; set; }

    [Range(0, 2000000, ErrorMessage = "El kilometraje debe estar entre 0 y 2000000.")]
    public int Kilometraje { get; set; }

    public int ClienteId { get; set; }

    // Admite nulo para que el POST solo envíe ClienteId. [ValidateNever] ignora el objeto
    // cliente de ejemplo que Swagger incluye en el cuerpo.
    [ValidateNever]
    [ForeignKey("ClienteId")]
    [InverseProperty("Vehiculos")]
    public virtual Cliente? Cliente { get; set; }
}
