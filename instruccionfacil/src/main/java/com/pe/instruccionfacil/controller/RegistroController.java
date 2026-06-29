package com.pe.instruccionfacil.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Autowired;
import com.pe.instruccionfacil.service.UsuarioService;

@Controller
public class RegistroController {

    @Autowired
    private UsuarioService usuarioService;

    @GetMapping("/registro")
    public String mostrarRegistro() {
        return "registro";
    }

    @PostMapping("/registro")
    public String procesarRegistro(
            @RequestParam("rol") String rol,
            @RequestParam("nombre") String nombre,
            @RequestParam("apellido") String apellido,
            @RequestParam("nombreUsuario") String nombreUsuario,
            @RequestParam("telefono") String telefono,
            @RequestParam("correo") String correo,
            @RequestParam("contrasena") String contrasena,
            @RequestParam(value = "fotoPerfil", required = false) MultipartFile fotoPerfil,
            @RequestParam(value = "licenciaProfesional", required = false) String licenciaProfesional,
            @RequestParam(value = "tieneCarro", required = false, defaultValue = "no") String tieneCarro,
            @RequestParam(value = "placa", required = false) String placa,
            @RequestParam(value = "modelo", required = false) String modelo,
            @RequestParam(value = "soat", required = false) MultipartFile soat) {

        try {
            usuarioService.registrarUsuario(rol, nombre, apellido, nombreUsuario, telefono, correo,
                    contrasena, fotoPerfil, licenciaProfesional, tieneCarro,
                    placa, modelo, soat);

            if ("PROFESOR".equals(rol)) {
                return "redirect:/login?esperaAprobacion=true";
            }
            return "redirect:/login?registroExitoso=true";

        } catch (Exception e) {
            return "redirect:/registro?error=true";
        }
    }
}