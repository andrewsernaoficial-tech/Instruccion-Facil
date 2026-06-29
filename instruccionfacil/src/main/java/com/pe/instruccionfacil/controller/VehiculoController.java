package com.pe.instruccionfacil.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class VehiculoController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostMapping("/admin/vehiculo/crear")
    public String crearVehiculo(@RequestParam("placa") String placa,
                                @RequestParam("modelo") String modelo,
                                @RequestParam("estado") String estado) {
        jdbcTemplate.update(
                "INSERT INTO flota_vehicular (placa, modelo, soat, estado) VALUES (?, ?, EMPTY_BLOB(), ?)",
                placa, modelo, estado
        );
        return "redirect:/admin/dashboard";
    }

    @PostMapping("/admin/vehiculo/editar")
    public String editarVehiculo(@RequestParam("idVehiculo") Long idVehiculo,
                                 @RequestParam("placa") String placa,
                                 @RequestParam("modelo") String modelo,
                                 @RequestParam("estado") String estado) {
        jdbcTemplate.update(
                "UPDATE flota_vehicular SET placa = ?, modelo = ?, estado = ? WHERE id_vehiculo = ?",
                placa, modelo, estado, idVehiculo
        );
        return "redirect:/admin/dashboard";
    }

    @PostMapping("/admin/vehiculo/eliminar")
    public String eliminarVehiculo(@RequestParam("idVehiculo") Long idVehiculo) {
        jdbcTemplate.update(
                "DELETE FROM flota_vehicular WHERE id_vehiculo = ?",
                idVehiculo
        );
        return "redirect:/admin/dashboard";
    }
}