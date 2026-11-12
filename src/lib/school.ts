// What is read from your transcript and degree certificate. Same free text reading as the CV (see profile.ts).

export type Classification = 'first' | 'upper' | 'lower' | 'third';

export interface SchoolProfile {
  degree: string | null;
  university: string | null;
  field: 'cs' | 'other' | null;
  classification: Classification | null;
  cgpa: string | null;            // e.g. "4.52 / 5.00"
  gradYear: number | null;
  english: string | null;         // e.g. "IELTS 7.0"
  files: string[];
  updatedAt: string;
}

const CS = /computer science|software engineering|information technology|computer engineering|information systems|data science|cyber ?security|informatics|computing/i;

function classFromRatio(r: number): Classification {
  return r >= 0.9 ? 'first' : r >= 0.7 ? 'upper' : r >= 0.48 ? 'lower' : 'third';
}

export function extractSchool(text: string, files: string[]): SchoolProfile {
  const flat = text.replace(/\s+/g, ' ');
  let classification: Classification | null = null;
  if (/first[- ]class|distinction/i.test(flat)) classification = 'first';
  else if (/second[- ]class\s*\(?\s*upper|2\s*[:.]\s*1\b|upper credit|second class honou?rs,? upper/i.test(flat)) classification = 'upper';
  else if (/second[- ]class\s*\(?\s*lower|2\s*[:.]\s*2\b|lower credit/i.test(flat)) classification = 'lower';
  else if (/third[- ]class/i.test(flat)) classification = 'third';

  let cgpa: string | null = null;
  const g = flat.match(/(?:c\.?g\.?p\.?a\.?|cumulative grade point average)[\s):=-]*(\d(?:\.\d{1,2})?)\s*(?:\/|out of)?\s*(\d(?:\.\d+)?)?/i);
  if (g) {
    const value = Number(g[1]);
    const scale = g[2] && Number(g[2]) >= 4 ? Number(g[2]) : value > 4 ? 5 : 4;
    if (value > 0 && value <= scale) {
      cgpa = `${value.toFixed(2)} / ${scale.toFixed(2)}`;
      classification ??= classFromRatio(value / scale);
    }
  }

  const degree = flat.match(/\b(?:b\.?\s?sc\.?|b\.?\s?eng\.?|b\.?\s?tech\.?|bachelor(?:'s)? of [a-z]+|hnd|higher national diploma)\b[^.;]{0,70}/i)?.[0]?.trim().replace(/\s+/g, ' ') ?? null;
  const uniRaw = flat.match(/\b(?:[a-z]+ )?university of [a-z]+(?: [a-z]+){0,2}|\b[a-z]+(?: [a-z]+)? university\b/i)?.[0] ?? null;
  const uni = uniRaw ? uniRaw.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/ Of /g, ' of ') : null;

  const now = new Date().getFullYear();
  const near = flat.match(/(?:graduat\w*|class of|date of award|conferred|awarded)[^0-9]{0,60}((?:19|20)\d{2})/i);
  const years = [...flat.matchAll(/\b((?:19|20)\d{2})\b/g)].map(m => Number(m[1])).filter(y => y >= 1990 && y <= now);
  const gradYear = near ? Number(near[1]) : years.length ? Math.max(...years) : null;

  const eng = flat.match(/\b(ielts|toefl|duolingo|pte)\b[^0-9]{0,30}(\d{1,3}(?:\.\d)?)/i);

  return {
    degree: degree ? degree.slice(0, 80) : null,
    university: uni,
    field: CS.test(flat) ? 'cs' : flat.length > 200 ? 'other' : null,
    classification,
    cgpa,
    gradYear,
    english: eng ? `${eng[1].toUpperCase()} ${eng[2]}` : null,
    files,
    updatedAt: new Date().toISOString(),
  };
}
