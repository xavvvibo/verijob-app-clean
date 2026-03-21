export const UX_COPY = {
  confidence: {
    title: "Nivel de confianza",
    high: "Confianza alta",
    medium: "Confianza media",
    low: "Confianza baja",
    description_high:
      "Validación con alta fiabilidad. Esta experiencia aporta confianza real al perfil del candidato.",
    description_medium:
      "Validación con fiabilidad media. Se recomienda revisar detalles antes de tomar una decisión.",
    description_low:
      "Validación con baja fiabilidad. Se recomienda solicitar documentación antes de tomar una decisión.",
  },

  verifier: {
    domain: "Dominio del verificador",
    explanation:
      "Coincidencia entre el dominio del verificador y la empresa asociada.",
    exact_match:
      "Coincidencia exacta entre el dominio del verificador y la empresa asociada.",
    partial_match:
      "Coincidencia parcial. Revisar manualmente.",
    no_match:
      "No se detecta relación clara entre el dominio y la empresa.",
  },

  actions: {
    confirm: "Confirmar experiencia",
    reject: "Rechazar validación",
    trace: "Esta acción quedará registrada con trazabilidad.",
  },

  warnings: {
    low_confidence:
      "⚠️ Esta validación tiene baja fiabilidad. Se recomienda solicitar documentación adicional.",
  },
};
