package com.pe.instruccionfacil.service;

import com.pe.instruccionfacil.model.Usuario;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.Base64;
import java.util.Optional;

@Service
public class UsuarioService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public Optional<Usuario> autenticar(String loginInput, String contrasena) {
        String sql = "SELECT id_usuario, nombre_usuario, correo, contrasena, rol FROM usuario WHERE (correo = ? OR nombre_usuario = ?) AND contrasena = ?";

        try {
            Usuario usuario = jdbcTemplate.queryForObject(sql, (rs, rowNum) -> {
                Usuario u = new Usuario();
                u.setIdUsuario(rs.getLong("id_usuario"));
                u.setNombreUsuario(rs.getString("nombre_usuario"));
                u.setCorreo(rs.getString("correo"));
                u.setContrasena(rs.getString("contrasena"));
                u.setRol(rs.getString("rol"));
                return u;
            }, loginInput, loginInput, contrasena);

            return Optional.of(usuario);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public String obtenerEstadoProfesor(Long idUsuario) {
        String sql = "SELECT estado_aprobacion FROM profesor WHERE id_usuario = ?";
        try {
            return jdbcTemplate.queryForObject(sql, String.class, idUsuario);
        } catch (Exception e) {
            return "PENDIENTE";
        }
    }

    @Transactional
    public void registrarUsuario(String rol, String nombre, String apellido, String nombreUsuario,
                                 String telefono, String correo, String contrasena, MultipartFile fotoPerfil,
                                 String licenciaProfesional, String tieneCarro, String placa,
                                 String modelo, MultipartFile soat) throws IOException {

        byte[] fotoBytes = (fotoPerfil != null && !fotoPerfil.isEmpty()) ? fotoPerfil.getBytes() : null;

        String sqlUsuario = "INSERT INTO usuario (nombre_usuario, correo, contrasena, rol, foto_profile, fecha_registro) VALUES (?, ?, ?, ?, ?, SYSDATE)";
        jdbcTemplate.update(sqlUsuario, nombreUsuario, correo, contrasena, rol, fotoBytes);

        String sqlGetId = "SELECT id_usuario FROM usuario WHERE nombre_usuario = ?";
        Long idUsuario = jdbcTemplate.queryForObject(sqlGetId, Long.class, nombreUsuario);

        if ("ALUMNO".equals(rol)) {
            String sqlAlumno = "INSERT INTO alumno (id_usuario, nombre, apellido, telefono) VALUES (?, ?, ?, ?)";
            jdbcTemplate.update(sqlAlumno, idUsuario, nombre, apellido, telefono);
        }
        else if ("PROFESOR".equals(rol)) {
            Long idVehiculo = null;

            if ("si".equals(tieneCarro) && placa != null && !placa.isEmpty()) {
                byte[] soatBytes = (soat != null && !soat.isEmpty()) ? soat.getBytes() : null;

                String sqlVehiculo = "INSERT INTO flota_vehicular (placa, modelo, soat, estado) VALUES (?, ?, ?, 'DISPONIBLE')";
                jdbcTemplate.update(sqlVehiculo, placa, modelo, soatBytes);

                String sqlGetCarId = "SELECT id_vehiculo FROM flota_vehicular WHERE placa = ?";
                idVehiculo = jdbcTemplate.queryForObject(sqlGetCarId, Long.class, placa);
            }

            String sqlProfesor = "INSERT INTO profesor (id_usuario, nombre, apellido, telefono, licencia_profesional, id_vehiculo, estado_aprobacion) VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE')";
            jdbcTemplate.update(sqlProfesor, idUsuario, nombre, apellido, telefono, licenciaProfesional, idVehiculo);
        }
    }
}