package com.pe.instruccionfacil.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "profesor")
@PrimaryKeyJoinColumn(name = "id_usuario")
public class Profesor extends Usuario {

    @Column(nullable = false)
    private String nombre;

    @Column(nullable = false)
    private String apellido;

    @Column(nullable = false)
    private String telefono;

    @Column(name = "licencia_profesional", nullable = false)
    private String licenciaProfesional;

    @Column(name = "estado_aprobacion")
    private String estadoAprobacion = "PENDIENTE";

    private String disponibilidad = "NO_DISPONIBLE";

    @ManyToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "id_vehiculo")
    private FlotaVehicular flotaVehicular;
}