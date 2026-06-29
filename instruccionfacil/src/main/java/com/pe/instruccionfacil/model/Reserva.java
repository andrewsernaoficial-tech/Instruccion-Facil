package com.pe.instruccionfacil.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "reserva")
public class Reserva {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_reserva")
    private Long idReserva;

    @ManyToOne
    @JoinColumn(name = "id_alumno", nullable = false)
    private Alumno alumno;

    @ManyToOne
    @JoinColumn(name = "id_profesor", nullable = false)
    private Profesor profesor;

    @Column(name = "fecha_clase", nullable = false)
    private LocalDateTime fechaClase;

    @Column(nullable = false)
    private Double precio;

    @Lob
    @Column(name = "boleta_electronica", nullable = false)
    private byte[] boletaElectronica;

    @Column(name = "calificacion_estrellas")
    private Integer calificacionEstrellas;

    @Lob
    @Column(name = "reporte_avance")
    private String reporteAvance;

    @Column(name = "estado_clase")
    private String estadoClase = "PROGRAMADA";
}