package com.pe.instruccionfacil.repository;

import com.pe.instruccionfacil.model.FlotaVehicular;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface FlotaVehicularRepository extends JpaRepository<FlotaVehicular, Long> {
    Optional<FlotaVehicular> findByPlaca(String placa);
}