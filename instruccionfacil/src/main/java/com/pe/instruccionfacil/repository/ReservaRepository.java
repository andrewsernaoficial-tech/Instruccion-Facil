package com.pe.instruccionfacil.repository;

import com.pe.instruccionfacil.model.Reserva;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReservaRepository extends JpaRepository<Reserva, Long> {
    List<Reserva> findByAlumnoIdUsuario(Long idAlumno);
    List<Reserva> findByProfesorIdUsuario(Long idProfesor);
}