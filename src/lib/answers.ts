// The answers application forms keep asking for. Saved once, used for every job you apply to.

export interface Answers {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  timezone: string;
  linkedin: string;
  github: string;
  portfolio: string;
  availability: string;      // notice period or start date
  salary: string;            // what you ask for
  authorization: string;     // right to work
  sponsorship: string;       // "Yes" or "No"
  relocate: string;          // "Yes", "No" or "Open to it"
  experience: string;        // years
  intro: string;             // two or three lines about you, for "tell us about yourself"
  notes: string;             // anything to remember when answering
}

export const ANSWER_FIELDS: { key: keyof Answers; label: string; hint?: string; options?: string[]; long?: boolean }[] = [
  { key: 'fullName', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone', hint: 'With country code' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'timezone', label: 'Time zone', hint: 'e.g. GMT+1 (WAT)' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'github', label: 'GitHub' },
  { key: 'portfolio', label: 'Portfolio website' },
  { key: 'availability', label: 'Notice period or start date', hint: 'e.g. Immediately, or 2 weeks' },
  { key: 'salary', label: 'Salary expectation', hint: 'e.g. 4,000 USD a month' },
  { key: 'authorization', label: 'Work authorisation', hint: 'Where you can work without a visa' },
  { key: 'sponsorship', label: 'Need visa sponsorship?', options: ['', 'Yes', 'No'] },
  { key: 'relocate', label: 'Open to relocating?', options: ['', 'Yes', 'No', 'Open to it'] },
  { key: 'experience', label: 'Years of experience' },
  { key: 'intro', label: 'Short intro', hint: 'Two or three lines, used for "tell us about yourself"', long: true },
  { key: 'notes', label: 'Anything else to remember', hint: 'Rules for answering, e.g. never state a salary under 3,000 USD', long: true },
];

export const EMPTY_ANSWERS: Answers = Object.fromEntries(ANSWER_FIELDS.map(f => [f.key, ''])) as unknown as Answers;

// Start the form from what the CV already says.
export function answersFromCv(text: string, years: number | null): Partial<Answers> {
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0];
  const phone = text.match(/\+?\d[\d\s().-]{8,16}\d/)?.[0]?.trim();
  const linkedin = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+/i)?.[0];
  const github = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+/i)?.[0];
  const url = (u?: string) => (u ? (/^https?:/i.test(u) ? u : `https://${u}`) : undefined);
  return {
    ...(email ? { email } : {}), ...(phone ? { phone } : {}),
    ...(linkedin ? { linkedin: url(linkedin) } : {}), ...(github ? { github: url(github) } : {}),
    ...(years ? { experience: String(years) } : {}),
  };
}
