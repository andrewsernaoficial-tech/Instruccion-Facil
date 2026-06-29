package com.pe.instruccionfacil.controller;

import com.pe.instruccionfacil.model.Usuario;
import com.pe.instruccionfacil.service.UsuarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import jakarta.servlet.http.HttpSession;
import java.util.Optional;

@Controller
public class AuthController {

    @Autowired
    private UsuarioService usuarioService;

    @GetMapping("/login")
    public String mostrarLogin() {
        return "login";
    }

    @PostMapping("/login")
    public String procesarLogin(@RequestParam("loginInput") String loginInput,
                                @RequestParam("contrasena") String contrasena,
                                HttpSession session,
                                Model model) {

        Optional<Usuario> usuarioOpt = usuarioService.autenticar(loginInput, contrasena);

        if (usuarioOpt.isPresent()) {
            Usuario usuario = usuarioOpt.get();
            session.setAttribute("usuarioLogueado", usuario);

            if ("PROFESOR".equals(usuario.getRol()) && !"APROBADO".equals(usuarioService.obtenerEstadoProfesor(usuario.getIdUsuario()))) {
                model.addAttribute("error", "cuentaPendiente");
                return "login";
            }

            switch (usuario.getRol()) {
                case "ADMIN":
                    return "redirect:/admin/dashboard";
                case "PROFESOR":
                    return "redirect:/profesor/dashboard";
                case "ALUMNO":
                    return "redirect:/alumno/dashboard";
                default:
                    model.addAttribute("error", "rolInvalido");
                    return "login";
            }
        } else {
            model.addAttribute("error", "credencialesIncorrectas");
            return "login";
        }
    }

    @GetMapping("/logout")
    public String cerrarSesion(HttpSession session) {
        if (session != null) {
            session.invalidate();
        }
        return "redirect:/login";
    }
}