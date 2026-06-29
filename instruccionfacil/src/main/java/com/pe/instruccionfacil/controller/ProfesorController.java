package com.pe.instruccionfacil.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Controller
public class ProfesorController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/profesor/dashboard")
    public String showDashboard(Model model) {
        Long idProfesor = 3L;

        List<Map<String, Object>> resultados = jdbcTemplate.queryForList(
                "SELECT u.id_usuario, u.nombre_usuario, u.correo, p.nombre, p.apellido, p.disponibilidad " +
                        "FROM usuario u JOIN profesor p ON u.id_usuario = p.id_usuario WHERE u.id_usuario = ?",
                idProfesor
        );

        if (resultados.isEmpty()) {
            model.addAttribute("error", "El perfil del profesor no se encuentra registrado.");
            return "error";
        }

        model.addAttribute("perfil", resultados.get(0));

        List<Map<String, Object>> solicitudes = jdbcTemplate.queryForList(
                "SELECT r.id_reserva, u.nombre_usuario AS ALUMNO, TO_CHAR(r.fecha_clase, 'YYYY-MM-DD HH24:MI') AS FECHA, r.precio, DBMS_LOB.GETLENGTH(r.boleta_electronica) AS TIENE_BOLETA FROM reserva r JOIN usuario u ON r.id_alumno = u.id_usuario WHERE r.id_profesor = ? AND r.estado_clase = 'PROGRAMADA'",
                idProfesor
        );
        model.addAttribute("solicitudes", solicitudes);

        List<Map<String, Object>> clasesHistorial = jdbcTemplate.queryForList(
                "SELECT r.id_reserva, u.nombre_usuario AS ALUMNO, TO_CHAR(r.fecha_clase, 'YYYY-MM-DD HH24:MI') AS FECHA, r.precio, r.estado_clase, r.calificacion_estrellas, DBMS_LOB.SUBSTR(r.reporte_avance, 4000, 1) AS REPORTE_AVANCE FROM reserva r JOIN usuario u ON r.id_alumno = u.id_usuario WHERE r.id_profesor = ? AND r.estado_clase IN ('COMPLETADA', 'CANCELADA') ORDER BY r.id_reserva DESC",
                idProfesor
        );
        model.addAttribute("clasesHistorial", clasesHistorial);

        return "profesor/dashboard";
    }

    @GetMapping("/usuario/foto/{id}")
    @ResponseBody
    public ResponseEntity<byte[]> obtenerFotoPerfil(@PathVariable("id") Long id) {
        try {
            byte[] foto = jdbcTemplate.queryForObject(
                    "SELECT foto_profile FROM usuario WHERE id_usuario = ?",
                    byte[].class,
                    id
            );
            if (foto != null) {
                return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(foto);
            }
        } catch (Exception e) {
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/profesor/disponibilidad")
    public String cambiarDisponibilidad(@RequestParam("idUsuario") Long idUsuario,
                                        @RequestParam("nuevoEstado") String nuevoEstado) {
        jdbcTemplate.update(
                "UPDATE profesor SET disponibilidad = ? WHERE id_usuario = ?",
                nuevoEstado, idUsuario
        );
        return "redirect:/profesor/dashboard";
    }

    @PostMapping("/profesor/clase/establecer-precio")
    public String establecerPrecio(@RequestParam("idReserva") Long idReserva,
                                   @RequestParam("precio") Double precio) {
        jdbcTemplate.update(
                "UPDATE reserva SET precio = ? WHERE id_reserva = ?",
                precio, idReserva
        );
        return "redirect:/profesor/dashboard";
    }

    @PostMapping("/profesor/clase/finalizar")
    public String finalizarClase(@RequestParam("idReserva") Long idReserva,
                                 @RequestParam("reporte") String reporte) {
        jdbcTemplate.update(
                "UPDATE reserva SET estado_clase = 'COMPLETADA', reporte_avance = ? WHERE id_reserva = ?",
                reporte, idReserva
        );
        return "redirect:/profesor/dashboard";
    }

    @PostMapping("/profesor/clase/cancelar")
    public String cancelarClase(@RequestParam("idReserva") Long idReserva) {
        jdbcTemplate.update(
                "UPDATE reserva SET estado_clase = 'CANCELADA' WHERE id_reserva = ?",
                idReserva
        );
        return "redirect:/profesor/dashboard";
    }

    @PostMapping("/profesor/perfil/editar")
    public String editarPerfil(@RequestParam("idUsuario") Long idUsuario,
                               @RequestParam("nombre") String nombre,
                               @RequestParam("apellido") String apellido,
                               @RequestParam("correo") String correo,
                               @RequestParam(value = "foto", required = false) MultipartFile foto) {

        jdbcTemplate.update(
                "UPDATE usuario SET correo = ? WHERE id_usuario = ?",
                correo, idUsuario
        );

        jdbcTemplate.update(
                "UPDATE profesor SET nombre = ?, apellido = ? WHERE id_usuario = ?",
                nombre, apellido, idUsuario
        );

        if (foto != null && !foto.isEmpty()) {
            try {
                byte[] fotoBytes = foto.getBytes();
                jdbcTemplate.update(
                        "UPDATE usuario SET foto_profile = ? WHERE id_usuario = ?",
                        fotoBytes, idUsuario
                );
            } catch (IOException e) {
                e.printStackTrace();
            }
        }

        return "redirect:/profesor/dashboard";
    }
}