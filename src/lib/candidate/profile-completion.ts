type CompletionItemStatus = "completed" | "pending";

export type CandidateProfileCompletionItem = {
  id: "identity" | "experience" | "education" | "achievements" | "evidence";
  label: string;
  status: CompletionItemStatus;
  completed: boolean;
};

export type CandidateProfileCompletionModel = {
  score: number;
  completed: number;
  total: number;
  checklist: CandidateProfileCompletionItem[];
};

function hasText(value: unknown) {
  return String(value || "").trim().length > 0;
}

export function buildCandidateProfileCompletionModel(args: {
  profile: any;
  candidateProfile: any;
  experienceCount: number;
  evidenceCount: number;
  achievementsCount: number;
}) : CandidateProfileCompletionModel {
  const educationCount = Array.isArray(args.candidateProfile?.education) ? args.candidateProfile.education.length : 0;

  const checklist: CandidateProfileCompletionItem[] = [
    {
      id: "identity",
      label: "Datos básicos",
      completed: hasText(args.profile?.full_name),
      status: hasText(args.profile?.full_name) ? "completed" : "pending",
    },
    {
      id: "experience",
      label: "Experiencia laboral",
      completed: Number(args.experienceCount || 0) > 0,
      status: Number(args.experienceCount || 0) > 0 ? "completed" : "pending",
    },
    {
      id: "education",
      label: "Formación académica",
      completed: educationCount > 0,
      status: educationCount > 0 ? "completed" : "pending",
    },
    {
      id: "achievements",
      label: "Idiomas y logros",
      completed: Number(args.achievementsCount || 0) > 0,
      status: Number(args.achievementsCount || 0) > 0 ? "completed" : "pending",
    },
    {
      id: "evidence",
      label: "Evidencias",
      completed: Number(args.evidenceCount || 0) > 0,
      status: Number(args.evidenceCount || 0) > 0 ? "completed" : "pending",
    },
  ];

  const completed = checklist.filter((item) => item.completed).length;
  const total = checklist.length;

  return {
    score: Math.round((completed / Math.max(1, total)) * 100),
    completed,
    total,
    checklist,
  };
}
