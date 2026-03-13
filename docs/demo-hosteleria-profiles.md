# Perfiles demo VERIJOB para hostelería

Dataset comercial y de validación UX preparado para ventas, demos de producto y pruebas internas del sector hostelería en España.

## Objetivo

Estos tres perfiles están diseñados para que una empresa entienda en menos de un minuto:

- quién es el candidato
- qué ha hecho
- qué está verificado
- por qué su historial transmite confianza

## Perfil demo 1 - SALA

- Identidad: Laura Martín Serrano
- Titular: Camarera de sala | Jefa de rango
- Ubicación: Madrid
- Disponibilidad: abierta a oportunidades, incorporación en 15 días, jornada completa
- Propósito comercial: mostrar estabilidad y experiencia de cara al público

### Resumen profesional

Profesional de sala con 7 años de experiencia en restauración organizada y servicio a la carta. Acostumbrada a ritmo alto, atención al detalle, coordinación con cocina y venta sugerida. Busca entorno estable donde aportar autonomía en sala y buen trato al cliente.

### Trayectoria laboral

1. Restaurante La Marabanda, Madrid
Puesto: Jefa de rango
Fechas: febrero 2023 - febrero 2026
Estado: verificada por empresa

2. Taberna Puerta 57, Madrid
Puesto: Camarera de sala
Fechas: junio 2020 - enero 2023
Estado: verificada por empresa

3. Café Bulevar Goya, Madrid
Puesto: Runner / Ayudante de sala
Fechas: septiembre 2018 - mayo 2020
Estado: pendiente

### Evidencias y confianza

- Vida laboral aprobada
- Nómina aprobada asociada a La Marabanda
- Contrato de trabajo aprobado asociado a Taberna Puerta 57
- Señal de confianza sugerida: `Confianza alta`
- Trust score orientativo: `71`

### Skills e idiomas

- Servicio de sala
- Protocolo de mesa
- Venta sugerida
- TPV y cierre de caja
- Gestión de rango
- Atención al cliente
- Español nativo
- Inglés profesional básico para atención al cliente

### Recomendación visual

Retrato profesional luminoso, uniforme neutro o americana negra, fondo claro y expresión cercana.

## Perfil demo 2 - COCINA

- Identidad: David Ruiz Navarro
- Titular: Ayudante de cocina | Cocinero
- Ubicación: Valencia
- Disponibilidad: búsqueda activa, incorporación inmediata, jornada completa
- Propósito comercial: mostrar progresión y fiabilidad documental

### Resumen profesional

Perfil de cocina con progresión clara desde apoyo en producción hasta cocinero de partida. Acostumbrado a mise en place, control de mermas, fichas técnicas y cumplimiento de APPCC. Destaca por documentación ordenada y continuidad en entornos de volumen medio-alto.

### Trayectoria laboral

1. Arrocería La Dársena, Valencia
Puesto: Cocinero
Fechas: enero 2024 - febrero 2026
Estado: verificada documentalmente

2. Grupo Mercado Norte, Valencia
Puesto: Ayudante de cocina
Fechas: mayo 2021 - diciembre 2023
Estado: verificada por empresa

3. Panadería Obrador San Telmo, Valencia
Puesto: Auxiliar de obrador
Fechas: octubre 2019 - abril 2021
Estado: pendiente

### Evidencias y confianza

- Vida laboral aprobada
- Certificado de empresa aprobado asociado a Arrocería La Dársena
- Nómina aprobada asociada a Arrocería La Dársena
- Contrato de trabajo aprobado asociado a Grupo Mercado Norte
- Señal de confianza sugerida: `Confianza sólida`
- Trust score orientativo: `68`

### Skills e idiomas

- Mise en place
- Partida de calientes
- Control de stock
- APPCC
- Fichas técnicas
- Preelaboración
- Español nativo
- Valenciano conversación

### Recomendación visual

Retrato limpio y directo, chaquetilla de cocina lisa o polo oscuro, fondo neutro.

## Perfil demo 3 - RESPONSABLE

- Identidad: Marta Gil Ortega
- Titular: Encargada | Responsable de turno | Jefa de sala
- Ubicación: Barcelona
- Disponibilidad: abierta a proyectos selectivos, incorporación en 30 días, jornada completa
- Propósito comercial: mostrar trayectoria, responsabilidad y credibilidad alta

### Resumen profesional

Responsable de hostelería con más de 10 años de trayectoria en sala y gestión operativa. Experiencia liderando equipos, organización de turnos, control de incidencias, coordinación con cocina y seguimiento de ventas. Perfil pensado para transmitir mando intermedio fiable y muy entendible por empresa.

### Trayectoria laboral

1. Brasería Rambla Alta, Barcelona
Puesto: Encargada
Fechas: marzo 2022 - febrero 2026
Estado: verificada por empresa

2. Grupo Bocana Tapas, Barcelona
Puesto: Responsable de turno
Fechas: enero 2019 - febrero 2022
Estado: verificada por empresa

3. Hotel Mirador del Port, Barcelona
Puesto: Jefa de sala
Fechas: abril 2015 - diciembre 2018
Estado: verificada documentalmente

4. Café Teatre Liceu, Barcelona
Puesto: Camarera de sala
Fechas: septiembre 2012 - marzo 2015
Estado: pendiente

### Evidencias y confianza

- Vida laboral aprobada
- Nómina aprobada asociada a Brasería Rambla Alta
- Certificado de empresa aprobado asociado a Grupo Bocana Tapas
- Contrato de trabajo aprobado asociado a Hotel Mirador del Port
- Señal de confianza sugerida: `Confianza muy alta`
- Trust score orientativo: `88`

### Skills e idiomas

- Liderazgo de equipos
- Planificación de turnos
- Apertura y cierre
- Control de caja
- Resolución de incidencias
- Coordinación sala-cocina
- Español nativo
- Catalán profesional
- Inglés profesional para atención al cliente y operativa

### Recomendación visual

Retrato ejecutivo-cercano, blazer o uniforme premium, fondo limpio y buena luz natural.

## Formato elegido

Se han dejado dos formatos complementarios:

- `docs/demo-hosteleria-profiles.json`: dataset estructurado y fácil de transformar a seed o carga manual
- `docs/demo-hosteleria-profiles.md`: versión legible para negocio, ventas y revisión rápida

## Uso recomendado en demos

1. Usar `Laura Martín Serrano` para enseñar rapidez de lectura del perfil y valor comercial en sala.
2. Usar `David Ruiz Navarro` para mostrar el peso de la verificación documental y la coherencia de cocina.
3. Usar `Marta Gil Ortega` para enseñar un perfil premium con historial fuerte y alta confianza.

## Siguiente paso sugerido

Si se quiere cargar en producto, el siguiente paso razonable es mapear este JSON a las tablas actuales de `profiles`, `candidate_profiles`, `employment_records`, `verification_requests` y `evidences` mediante un seed controlado, sin tocar auth ni billing.
