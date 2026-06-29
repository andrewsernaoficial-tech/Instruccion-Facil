package com.pe.instruccionfacil.controller;

import com.pe.instruccionfacil.model.Usuario;
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
import jakarta.servlet.http.HttpSession;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Controller
public class AlumnoController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/alumno/dashboard")
    public String dashboardAlumno(Model model, HttpSession session) {
        Usuario usuarioLogueado = (Usuario) session.getAttribute("usuarioLogueado");
        if (usuarioLogueado == null) {
            return "redirect:/login";
        }

        String sqlAgendables = "SELECT u.id_usuario, p.nombre, p.apellido FROM usuario u JOIN profesor p ON u.id_usuario = p.id_usuario WHERE p.estado_aprobacion = 'APROBADO' AND p.disponibilidad = 'DISPONIBLE'";
        List<Map<String, Object>> profesoresAgendables = jdbcTemplate.queryForList(sqlAgendables);
        model.addAttribute("profesoresAgendables", profesoresAgendables);

        String sqlDisponibles = "SELECT u.id_usuario, p.nombre, p.apellido, f.modelo AS modelo_carro, f.placa FROM usuario u JOIN profesor p ON u.id_usuario = p.id_usuario LEFT JOIN flota_vehicular f ON p.id_vehiculo = f.id_vehiculo WHERE p.estado_aprobacion = 'APROBADO' AND p.disponibilidad = 'DISPONIBLE'";
        List<Map<String, Object>> profesoresDisponibles = jdbcTemplate.queryForList(sqlDisponibles);
        model.addAttribute("profesoresDisponibles", profesoresDisponibles);

        String sqlPerfil = "SELECT u.id_usuario, u.nombre_usuario, u.correo, a.nombre, a.apellido, a.telefono FROM usuario u JOIN alumno a ON u.id_usuario = a.id_usuario WHERE u.id_usuario = ?";
        List<Map<String, Object>> resultadosPerfil = jdbcTemplate.queryForList(sqlPerfil, usuarioLogueado.getIdUsuario());

        if (!resultadosPerfil.isEmpty()) {
            model.addAttribute("alumnoPerfil", resultadosPerfil.get(0));
        } else {
            return "redirect:/login";
        }

        List<Map<String, Object>> reservas = jdbcTemplate.queryForList(
                "SELECT r.id_reserva, p.nombre || ' ' || p.apellido AS PROFESOR, TO_CHAR(r.fecha_clase, 'YYYY-MM-DD HH24:MI') AS FECHA, r.precio, r.estado_clase, r.calificacion_estrellas, DBMS_LOB.SUBSTR(r.reporte_avance, 4000, 1) AS REPORTE_AVANCE FROM reserva r JOIN profesor p ON r.id_profesor = p.id_usuario WHERE r.id_alumno = ? ORDER BY r.id_reserva DESC",
                usuarioLogueado.getIdUsuario()
        );
        model.addAttribute("reservas", reservas);

        return "alumno/dashboard";
    }

    @PostMapping("/alumno/perfil/guardar")
    public String guardarPerfil(@RequestParam("nombre") String nombre,
                                @RequestParam("apellido") String apellido,
                                @RequestParam("telefono") String telefono,
                                @RequestParam(value = "contrasena", required = false) String contrasena,
                                @RequestParam(value = "fotoPerfil", required = false) MultipartFile fotoPerfil,
                                HttpSession session) throws Exception {

        Usuario usuarioLogueado = (Usuario) session.getAttribute("usuarioLogueado");
        if (usuarioLogueado == null) {
            return "redirect:/login";
        }

        String sqlUpdateAlumno = "UPDATE alumno SET nombre = ?, apellido = ?, telefono = ? WHERE id_usuario = ?";
        jdbcTemplate.update(sqlUpdateAlumno, nombre, apellido, telefono, usuarioLogueado.getIdUsuario());

        if (contrasena != null && !contrasena.trim().isEmpty()) {
            String sqlUpdatePass = "UPDATE usuario SET contrasena = ? WHERE id_usuario = ?";
            jdbcTemplate.update(sqlUpdatePass, contrasena, usuarioLogueado.getIdUsuario());
        }

        if (fotoPerfil != null && !fotoPerfil.isEmpty()) {
            String sqlUpdateFoto = "UPDATE usuario SET foto_profile = ? WHERE id_usuario = ?";
            jdbcTemplate.update(sqlUpdateFoto, fotoPerfil.getBytes(), usuarioLogueado.getIdUsuario());
        }

        return "redirect:/alumno/dashboard";
    }

    @PostMapping("/alumno/reservar")
    public String reservarClase(@RequestParam("fechaReserva") String fecha,
                                @RequestParam("idProfesor") Long idProfesor,
                                HttpSession session) {
        Usuario usuarioLogueado = (Usuario) session.getAttribute("usuarioLogueado");
        if (usuarioLogueado == null) {
            return "redirect:/login";
        }

        String timestampFormateado = fecha.replace("T", " ") + ":00";
        jdbcTemplate.update(
                "INSERT INTO reserva (id_alumno, id_profesor, fecha_clase, precio, boleta_electronica, estado_clase) VALUES (?, ?, TO_TIMESTAMP(?, 'YYYY-MM-DD HH24:MI:SS'), 0.0, EMPTY_BLOB(), 'PROGRAMADA')",
                usuarioLogueado.getIdUsuario(), idProfesor, timestampFormateado
        );

        return "redirect:/alumno/dashboard";
    }

    @PostMapping("/alumno/solicitar-ya")
    public String solicitarYa(@RequestParam("idProfesor") Long idProfesor, HttpSession session) {
        Usuario usuarioLogueado = (Usuario) session.getAttribute("usuarioLogueado");
        if (usuarioLogueado == null) {
            return "redirect:/login";
        }

        jdbcTemplate.update(
                "INSERT INTO reserva (id_alumno, id_profesor, fecha_clase, precio, boleta_electronica, estado_clase) VALUES (?, ?, SYSTIMESTAMP, 0.0, EMPTY_BLOB(), 'PROGRAMADA')",
                usuarioLogueado.getIdUsuario(), idProfesor
        );

        return "redirect:/alumno/dashboard";
    }

    @PostMapping("/alumno/pagar")
    public String pagarClase(@RequestParam("idReserva") Long idReserva,
                             @RequestParam("boleta") MultipartFile boleta) {
        if (boleta != null && !boleta.isEmpty()) {
            try {
                jdbcTemplate.update(
                        "UPDATE reserva SET boleta_electronica = ? WHERE id_reserva = ?",
                        boleta.getBytes(), idReserva
                );
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        return "redirect:/alumno/dashboard";
    }

    @PostMapping("/alumno/calificar")
    public String calificarProfesor(@RequestParam("idReserva") Long idReserva,
                                    @RequestParam("estrellas") Integer estrellas) {
        jdbcTemplate.update(
                "UPDATE reserva SET calificacion_estrellas = ? WHERE id_reserva = ?",
                estrellas, idReserva
        );
        return "redirect:/alumno/dashboard";
    }
}
