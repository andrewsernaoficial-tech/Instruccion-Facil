# InstrucciónFácil

Primera entrega funcional del proyecto web de la escuela de manejo. Frontend **Angular 21**, API Node.js/Express y almacenamiento SQLite **solo para desarrollo**. Logo y colores proporcionados por la escuela. Interfaz y fechas en español; agenda en America/Lima.

> La instancia de AWS no está conectada. No se ha confirmado el motor ni el esquema de su base de datos. Este proyecto no instala ni modifica nada en esa instancia. No es todavía la implementación completa de los 64 requisitos ni una versión habilitada para producción.

## Repositorio existente

La rama de esta entrega agrega el proyecto Angular en la raíz del repositorio `andrewsernaoficial-tech/Instruccion-Facil`. La aplicación Java previa permanece en `instruccionfacil/`. Su `pom.xml` declara Spring Boot y el controlador `ojdbc11`; esto no confirma la versión del servidor Oracle en AWS. La API Node/SQLite sirve únicamente como implementación local independiente para probar el nuevo frontend. Su integración con Spring Boot/Oracle está pendiente; no se sustituyó la aplicación Java.

## Requisitos y arranque

Instalar Node.js 24 y Git en la computadora de desarrollo. No es necesario compilar en la instancia t3.small.

```bash
npm ci
```

Copiar `.env.example` a `.env`. En Windows se puede copiar desde el Explorador o con PowerShell:

```powershell
Copy-Item .env.example .env
```

Editar únicamente el archivo local `.env`: definir `ADMIN_EMAIL` y una contraseña propia en `ADMIN_PASSWORD` de entre 12 y 72 caracteres. No hay contraseña inicial incorporada al proyecto.

```bash
npm run admin:create
npm start
```

Abrir **http://localhost:4200**. Ingresar con el administrador creado. Eliminar `ADMIN_PASSWORD` del archivo `.env` después del alta. El comando no reemplaza administradores existentes.

### Configuración inicial desde la web

1. En **Configuración**, habilitar Yape con el número y titular de la escuela; definir teléfono de WhatsApp y políticas.
2. En **Clases y tarifas**, registrar clases, duración, precio y descripción.
3. En **Instructores**, registrar al menos un instructor activo.
4. En **Horarios**, asignarle una o varias jornadas semanales. Para descansos, usar jornadas separadas.
5. En **Flota**, registrar vehículos disponibles para alumnos que no traen auto.
6. Crear una cuenta de alumno desde la portada para probar una reserva real en el entorno local.

La base inicia vacía, sin horarios ni tarifas publicados. Los datos quedan en `var/development.db` y los archivos privados en `var/private/`, excluidos de Git. Las pruebas usan su propia base en memoria y no modifican la base de desarrollo.

## Incluido en esta entrega

- Portada responsiva con logo y catálogo público administrable.
- Registro por correo, acceso, salida y sesiones de servidor en cookies HttpOnly.
- Perfiles operativos iniciales de alumno y administrador; permisos comprobados en API.
- Alta y edición de clases, tarifas, instructores, vehículos y jornadas semanales.
- Yape configurable por administrador y enlace al chat de WhatsApp.
- Disponibilidad calculada desde jornadas y ocupaciones, con asignación de vehículo de escuela.
- Reserva pendiente de pago con precio, instrucciones de pago y políticas históricos.
- Prevención de traslapes de instructor/vehículo mediante transacción SQLite serializada en esta implementación de desarrollo.
- Vencimiento automático y prórroga única al recibir evidencia válida a tiempo.
- Comprobantes privados JPG/PNG/PDF de hasta 5 MB con validación de firma básica.
- Bandeja de pagos para aprobar/rechazar; aprobación idempotente y cancelación de citas.
- Incidencias por pago tardío y solicitudes de ajuste, sin simular devoluciones bancarias.
- Conteos iniciales, total histórico aprobado y auditoría de acciones.
- 15 pruebas automatizadas de reglas y API, más compilación estricta de Angular.

## Estructura

```text
apps/web/       Frontend Angular standalone, plantillas y estilos
apps/api/src/   API, reglas de agenda y persistencia de desarrollo
apps/api/test/  Pruebas aisladas de dominio y HTTP
.github/       Flujo de validación para GitHub Actions
```

`npm run build` genera `dist/web/browser`. La API puede servir ese resultado y las rutas `/api` desde el mismo origen. Para revisarlo localmente sin el servidor de Angular, configurar `APP_ORIGIN=http://localhost:3000` en `.env` y ejecutar `npm run api`. En producción se necesita HTTPS y `APP_ORIGIN` con el origen público real; revisar la arquitectura y controles pendientes antes de publicar.

## Verificación

```bash
npm run check
```

Las pruebas cubren doble reserva, flota compartida, horarios contiguos, vehículo propio, expiración, prórroga única, comprobante tardío, aprobación, idempotencia de revisión, propiedad de datos, rol administrativo, origen HTTP y sesiones. La ejecución no sustituye una prueba de carga, una auditoría de seguridad o pruebas de integración AWS.

## Pendientes principales

Pendientes principales: conexión al motor real en AWS, perfil personal completo, recepción e instructor como cuentas con sus paneles, reprogramación, cierre/asistencia, mantenimiento/documentos, medios adicionales y QR, recuperación por correo, notificaciones persistentes, reportes PDF/Excel, ajustes financieros y facturación opcional. No se envían mensajes automáticos de WhatsApp sin API oficial.

## GitHub

El código está preparado para un repositorio privado. Incluye `.gitignore`, bloqueo de dependencias y CI. No subir `.env`, bases, comprobantes, tokens ni credenciales de AWS. La documentación ampliada de requisitos y UML se entrega por separado. El logo es el aportado por la escuela.

Si se importa manualmente con GitHub CLI, tras autenticarse con la cuenta correcta:

```bash
git init -b main
git add .
git commit -m "Inicio del proyecto InstruccionFacil"
gh repo create instruccion-facil --private --source . --remote origin --push
```

Si el nombre ya existe, revisar ese repositorio antes de conectar un remoto o modificar contenido ajeno.
