package com.pe.instruccionfacil.repository;

import com.pe.instruccionfacil.model.Alumno;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AlumnoRepository extends JpaRepository<Alumno, Long> {
}