package com.pe.instruccionfacil.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "flota_vehicular")
public class FlotaVehicular {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_vehiculo")
    private Long idVehiculo;

    @Column(unique = true, nullable = false)
    private String placa;

    @Column(nullable = false)
    private String modelo;

    @Lob
    @Column(nullable = false)
    private byte[] soat;

    private String estado = "DISPONIBLE";
}