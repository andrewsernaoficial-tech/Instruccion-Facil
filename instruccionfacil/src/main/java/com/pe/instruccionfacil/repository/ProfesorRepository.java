package com.pe.instruccionfacil.repository;

import com.pe.instruccionfacil.model.Profesor;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProfesorRepository extends JpaRepository<Profesor, Long> {
    List<Profesor> findByEstadoAprobacion(String estadoAprobacion);
    List<Profesor> findByDisponibilidadAndEstadoAprobacion(String disponibilidad, String estadoAprobacion);
}