const normalizeText = (text) => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

export const parseVidaLaboral = (text) => {
  if (!text) return [];
  const rowRegex = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\s\S]+?)(?=\s+\d{2}\s+\d{11,12}|\n\d{2}\/\d{2}\/\d{4}|$)/gu;
  const matches = [...text.matchAll(rowRegex)];
  
  return matches.map(match => {
    const [_, startDate, endDate, rawCompany] = match;
    const companyName = rawCompany.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizedName = normalizeText(companyName);
    const adminKeywords = ['DESEMPLEO', 'SITUACION ASIMILADA', 'VACACIONES', 'INACTIVIDAD', 'COTIZACION'];
    const isAdministrative = adminKeywords.some(kw => normalizedName.includes(kw));

    return {
      startDate,
      endDate,
      companyName: companyName.toUpperCase(),
      normalizedName,
      type: isAdministrative ? 'administrative' : 'employment',
      isVerifiable: !isAdministrative && companyName.length > 2
    };
  }).filter(row => row.companyName !== "");
};
