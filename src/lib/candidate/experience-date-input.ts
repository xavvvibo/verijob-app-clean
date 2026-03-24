export type ParsedExperienceDate = {
  storageValue: string | null;
  inputValue: string;
};

function pad2(value: string) {
  return value.padStart(2, "0");
}

function normalizeRaw(value: unknown) {
  return String(value || "").trim();
}

export function parseExperienceDateInput(value: unknown, { allowPresent = false }: { allowPresent?: boolean } = {}): ParsedExperienceDate {
  const raw = normalizeRaw(value);
  if (!raw) return { storageValue: null, inputValue: "" };

  const lower = raw.toLowerCase();
  if (allowPresent && ["actualidad", "actual", "presente", "present", "current"].includes(lower)) {
    return { storageValue: null, inputValue: "Actualidad" };
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return { storageValue: `${iso[1]}-${iso[2]}-${iso[3]}`, inputValue: `${iso[1]}-${iso[2]}` };
  }

  const ym = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (ym) {
    return { storageValue: `${ym[1]}-${pad2(ym[2])}-01`, inputValue: `${ym[1]}-${pad2(ym[2])}` };
  }

  const mySlash = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (mySlash) {
    return { storageValue: `${mySlash[2]}-${pad2(mySlash[1])}-01`, inputValue: `${mySlash[2]}-${pad2(mySlash[1])}` };
  }

  const myDash = raw.match(/^(\d{1,2})-(\d{4})$/);
  if (myDash) {
    return { storageValue: `${myDash[2]}-${pad2(myDash[1])}-01`, inputValue: `${myDash[2]}-${pad2(myDash[1])}` };
  }

  const year = raw.match(/^(\d{4})$/);
  if (year) {
    return { storageValue: `${year[1]}-01-01`, inputValue: `${year[1]}-01` };
  }

  throw new Error("Usa una fecha valida en formato AAAA-MM, MM/AAAA o AAAA.");
}

export function toExperienceInputValue(value: unknown) {
  return parseExperienceDateInput(value, { allowPresent: true }).inputValue;
}
