"use client";

interface Props {
  total: number;
  emailVerified: number;
  documentVerified: number;
}

export default function VerificationRing({
  total,
  emailVerified,
  documentVerified
}: Props) {
  if (total === 0) {
    return (
      <div style={{ fontSize: 14, color: "#6B7280" }}>
        No hay experiencias registradas
      </div>
    );
  }

  const none = total - emailVerified - documentVerified;

  const maxPoints = total * 2;
  const points = emailVerified * 1 + documentVerified * 2;
  const percentage = Math.round((points / maxPoints) * 100);

  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  const noneRatio = none / total;
  const emailRatio = emailVerified / total;
  const docRatio = documentVerified / total;

  const noneOffset = 0;
  const emailOffset = noneRatio * circumference;
  const docOffset = (noneRatio + emailRatio) * circumference;

  return (
    <div style={{ width: 200, height: 200, position: "relative" }}>
      <svg width="200" height="200">
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke="#E5E7EB"
          strokeWidth="18"
        />

        {/* No verificado - rojo */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke="#B91C1C"
          strokeWidth="18"
          strokeDasharray={`${noneRatio * circumference} ${circumference}`}
          strokeDashoffset={-noneOffset}
          transform="rotate(-90 100 100)"
        />

        {/* Email - amarillo */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke="#D97706"
          strokeWidth="18"
          strokeDasharray={`${emailRatio * circumference} ${circumference}`}
          strokeDashoffset={-emailOffset}
          transform="rotate(-90 100 100)"
        />

        {/* Documental - verde */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke="#15803D"
          strokeWidth="18"
          strokeDasharray={`${docRatio * circumference} ${circumference}`}
          strokeDashoffset={-docOffset}
          transform="rotate(-90 100 100)"
        />
      </svg>

      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center"
      }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>
          {percentage}%
        </div>
        <div style={{ fontSize: 13, color: "#6B7280" }}>
          Perfil verificado
        </div>
      </div>
    </div>
  );
}
