package com.pe.instruccionfacil.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
public class AdminController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/admin/dashboard")
    public String showDashboard(Model model) {
        List<Map<String, Object>> usuarios = jdbcTemplate.queryForList(
                "SELECT id_usuario, nombre_usuario, correo, rol FROM usuario WHERE rol IN ('ALUMNO', 'PROFESOR')"
        );
        model.addAttribute("usuarios", usuarios);

        List<Map<String, Object>> solicitudes = jdbcTemplate.queryForList(
                "SELECT u.id_usuario, p.nombre AS NOMBRE, p.apellido AS APELLIDO, u.correo AS CORREO, p.estado_aprobacion AS ESTADO_APROBACION " +
                        "FROM usuario u JOIN profesor p ON u.id_usuario = p.id_usuario"
        );
        model.addAttribute("solicitudes", solicitudes);

        List<Map<String, Object>> flota = jdbcTemplate.queryForList(
                "SELECT id_vehiculo, placa, modelo, estado FROM flota_vehicular"
        );
        model.addAttribute("flota", flota);

        Map<String, Object> metrics = new HashMap<>();

        try {
            metrics.put("TOTAL_USUARIOS", jdbcTemplate.queryForObject("SELECT COUNT(*) FROM usuario", Integer.class));
        } catch (Exception e) {
            metrics.put("TOTAL_USUARIOS", 0);
        }

        try {
            metrics.put("TOTAL_ALUMNOS", jdbcTemplate.queryForObject("SELECT COUNT(*) FROM usuario WHERE rol = 'ALUMNO'", Integer.class));
        } catch (Exception e) {
            metrics.put("TOTAL_ALUMNOS", 0);
        }

        try {
            metrics.put("TOTAL_PROFESORES", jdbcTemplate.queryForObject("SELECT COUNT(*) FROM usuario WHERE rol = 'PROFESOR'", Integer.class));
        } catch (Exception e) {
            metrics.put("TOTAL_PROFESORES", 0);
        }

        try {
            Double ganancias = jdbcTemplate.queryForObject("SELECT NVL(SUM(precio), 0) FROM reserva WHERE estado_clase = 'COMPLETADA'", Double.class);
            metrics.put("GANANCIAS_TOTALES", ganancias != null ? ganancias : 0.0);
        } catch (Exception e) {
            metrics.put("GANANCIAS_TOTALES", 0.0);
        }

        model.addAttribute("metrics", metrics);

        return "admin/dashboard";
    }

    @PostMapping("/admin/usuario/editar")
    public String editarUsuario(@RequestParam("idUsuario") Long idUsuario,
                                @RequestParam("nombreUsuario") String nombreUsuario,
                                @RequestParam("correo") String correo,
                                @RequestParam("rol") String rol) {
        jdbcTemplate.update(
                "UPDATE usuario SET nombre_usuario = ?, correo = ?, rol = ? WHERE id_usuario = ?",
                nombreUsuario, correo, rol, idUsuario
        );
        return "redirect:/admin/dashboard";
    }
}