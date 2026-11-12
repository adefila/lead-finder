import type { SchoolProfile } from '@/lib/school';

// A hand-kept list of master's funding for computer science, plus the countries where tuition is free or close to it.
// There is no free live feed of scholarships, so the list lives here. Dates and amounts change every year: every entry
// links to the official page, and the page says to confirm there before you apply.

export type Group = 'germany' | 'sweden' | 'elsewhere' | 'global';

export interface Scholarship {
  id: string;
  name: string;
  group: Group;
  country: string;
  provider: string;
  covers: string;
  funding: 'full' | 'partial';
  summary: string;
  // What they usually ask for
  minClass: 'first' | 'upper' | 'lower' | null;   // typical competitive level, not a hard rule
  minWorkYears: number;
  referees: number;
  english: string;
  docs: string[];
  closes: string;                                  // plain words
  closeMonth: number | null;                       // 1 to 12, for "about N months away"
  limitedCourses?: boolean;                        // only some courses qualify, check for a computing one
  url: string;
}

const BASE_DOCS = ['Transcript', 'Degree certificate', 'CV', 'Motivation letter', 'Passport'];

export const SCHOLARSHIPS: Scholarship[] = [
  {
    id: 'daad-epos', name: 'DAAD development-related master\'s scholarship (EPOS)', group: 'germany', country: 'Germany', provider: 'DAAD',
    covers: 'Monthly stipend, health insurance, travel. Public tuition is free.', funding: 'full',
    summary: 'For graduates from developing countries, on a list of development-related master\'s courses at German universities. Only some courses are computing, so check the list for one that fits.',
    minClass: 'upper', minWorkYears: 2, referees: 2, english: 'English (or German) proof, set by each course',
    docs: [...BASE_DOCS, 'Proof of work experience', '2 reference letters'], closes: 'Usually between August and November, set by each course', closeMonth: 10, limitedCourses: true,
    url: 'https://www.daad.de/en/study-and-research-in-germany/scholarships/',
  },
  {
    id: 'daad-database', name: 'DAAD scholarship database', group: 'germany', country: 'Germany', provider: 'DAAD',
    covers: 'Search tool: every DAAD scholarship you qualify for', funding: 'full',
    summary: 'Not one scholarship but the official search. Choose Master, your home country and Computer Science to see every current option and its deadline.',
    minClass: null, minWorkYears: 0, referees: 0, english: 'Varies', docs: BASE_DOCS, closes: 'Varies', closeMonth: null,
    url: 'https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/',
  },
  {
    id: 'deutschlandstipendium', name: 'Deutschlandstipendium', group: 'germany', country: 'Germany', provider: 'German universities and sponsors',
    covers: '300 euros a month, for a year at a time', funding: 'partial',
    summary: 'A merit award you apply for at your German university after you are enrolled. It helps with living costs; it does not replace a main scholarship.',
    minClass: 'upper', minWorkYears: 0, referees: 0, english: 'Whatever your course needs', docs: ['Transcript', 'CV', 'Proof of enrolment'],
    closes: 'Set by each university, often in summer or autumn', closeMonth: null,
    url: 'https://www.deutschlandstipendium.de/en/',
  },
  {
    id: 'saarland-sic', name: 'Saarland Informatics Campus master\'s scholarships', group: 'germany', country: 'Germany', provider: 'Saarland University',
    covers: 'Funding for strong international computer science applicants', funding: 'partial',
    summary: 'A computer science campus with several research institutes that backs top master\'s applicants. Competitive: a high grade and a clear research interest matter most.',
    minClass: 'first', minWorkYears: 0, referees: 2, english: 'IELTS or TOEFL', docs: [...BASE_DOCS, '2 reference letters'], closes: 'See the programme page', closeMonth: null,
    url: 'https://saarland-informatics-campus.de/en/',
  },
  {
    id: 'si-gp', name: 'Swedish Institute Scholarship for Global Professionals', group: 'sweden', country: 'Sweden', provider: 'Swedish Institute',
    covers: 'Tuition, monthly living allowance, travel grant, insurance', funding: 'full',
    summary: 'The main fully funded route to a Swedish master\'s for people from eligible countries. Leadership and work experience count as much as grades. Only listed master\'s programmes qualify, so pick the course first.',
    minClass: 'upper', minWorkYears: 3, referees: 2, english: 'IELTS or TOEFL',
    docs: [...BASE_DOCS, 'Proof of about 3,000 hours of work, leadership or volunteering', '2 reference letters', 'Admission to a Swedish master\'s programme'],
    closes: 'Usually winter, around January to February', closeMonth: 1, limitedCourses: true,
    url: 'https://si.se/en/apply/scholarships/swedish-institute-scholarship-for-global-professionals/',
  },
  {
    id: 'kth', name: 'KTH Scholarship', group: 'sweden', country: 'Sweden', provider: 'KTH Royal Institute of Technology',
    covers: 'Tuition fee (full or part)', funding: 'partial',
    summary: 'Automatic consideration when you apply to a KTH master\'s with a high grade. Covers tuition only, so you still show money for living costs.',
    minClass: 'first', minWorkYears: 0, referees: 0, english: 'IELTS or TOEFL', docs: [...BASE_DOCS],
    closes: 'Same as admission, mid January', closeMonth: 1,
    url: 'https://www.kth.se/en/studies/master/costs-and-scholarships/scholarships',
  },
  {
    id: 'chalmers', name: 'Chalmers University scholarship', group: 'sweden', country: 'Sweden', provider: 'Chalmers University of Technology',
    covers: 'Tuition fee (full or part)', funding: 'partial',
    summary: 'Awarded on merit with your master\'s application at Chalmers, which has strong computer science and software engineering courses.',
    minClass: 'first', minWorkYears: 0, referees: 0, english: 'IELTS or TOEFL', docs: [...BASE_DOCS],
    closes: 'Same as admission, mid January', closeMonth: 1,
    url: 'https://www.chalmers.se/en/education/your-studies/tuition-fees-and-scholarships/',
  },
  {
    id: 'lund', name: 'Lund University Global Scholarship', group: 'sweden', country: 'Sweden', provider: 'Lund University',
    covers: 'Part of the tuition fee', funding: 'partial',
    summary: 'A tuition reduction for top international master\'s applicants to Lund. Worth applying for next to a bigger scholarship.',
    minClass: 'first', minWorkYears: 0, referees: 0, english: 'IELTS or TOEFL', docs: [...BASE_DOCS],
    closes: 'Same as admission, mid January', closeMonth: 1,
    url: 'https://www.lunduniversity.lu.se/admissions/masters-studies/fees-and-scholarships',
  },
  {
    id: 'liu', name: 'Linköping University Global Master\'s Scholarship', group: 'sweden', country: 'Sweden', provider: 'Linköping University',
    covers: 'Tuition fee (full or part)', funding: 'partial',
    summary: 'Merit-based tuition support when you apply to a Linköping master\'s, with several computing and data courses.',
    minClass: 'upper', minWorkYears: 0, referees: 0, english: 'IELTS or TOEFL', docs: [...BASE_DOCS],
    closes: 'Same as admission, mid January', closeMonth: 1,
    url: 'https://liu.se/en/education/tuition-fees-and-scholarships',
  },
  {
    id: 'erasmus-mundus', name: 'Erasmus Mundus Joint Master\'s (computing courses)', group: 'elsewhere', country: 'Several European countries', provider: 'European Commission',
    covers: 'Tuition, monthly allowance, travel', funding: 'full',
    summary: 'Fully funded two-year master\'s run by a group of universities, with study in two or more countries. There are computing courses in data science, AI, cybersecurity and software. Each course sets its own deadline and picks its own students.',
    minClass: 'upper', minWorkYears: 0, referees: 2, english: 'IELTS or TOEFL', docs: [...BASE_DOCS, '2 reference letters'],
    closes: 'Each course sets its own date, mostly between October and February', closeMonth: 1,
    url: 'https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/erasmus-mundus-joint-masters',
  },
  {
    id: 'stipendium-hungaricum', name: 'Stipendium Hungaricum', group: 'elsewhere', country: 'Hungary', provider: 'Hungarian government',
    covers: 'Tuition, monthly stipend, housing, health insurance', funding: 'full',
    summary: 'A Hungarian government scholarship for students from partner countries, with English-taught master\'s in computer science and informatics. You apply through your own country\'s channel and the Tempus site.',
    minClass: 'upper', minWorkYears: 0, referees: 0, english: 'English proof', docs: [...BASE_DOCS, 'Medical certificate'],
    closes: 'Usually mid January', closeMonth: 1,
    url: 'https://stipendiumhungaricum.hu/',
  },
  {
    id: 'turkiye', name: 'Türkiye Burslari', group: 'elsewhere', country: 'Türkiye', provider: 'Turkish government',
    covers: 'Tuition, monthly stipend, housing, language year if needed', funding: 'full',
    summary: 'A full Turkish government scholarship for master\'s students, with a free language year when needed. Open to international students, with a strong grade needed.',
    minClass: 'first', minWorkYears: 0, referees: 2, english: 'English or Turkish proof', docs: [...BASE_DOCS, '2 reference letters'],
    closes: 'Usually February', closeMonth: 2,
    url: 'https://turkiyeburslari.gov.tr/',
  },
  {
    id: 'chevening', name: 'Chevening Scholarship', group: 'global', country: 'United Kingdom', provider: 'UK government',
    covers: 'Tuition, monthly allowance, flights', funding: 'full',
    summary: 'A one-year fully funded UK master\'s. Needs at least two years of work experience, and leadership counts heavily. The UK charges tuition, so this one is only for the scholarship.',
    minClass: 'upper', minWorkYears: 2, referees: 2, english: 'IELTS or TOEFL', docs: [...BASE_DOCS, '2 reference letters', 'Proof of work experience'],
    closes: 'Early October', closeMonth: 10,
    url: 'https://www.chevening.org/scholarships/',
  },
  {
    id: 'commonwealth', name: 'Commonwealth Master\'s Scholarship', group: 'global', country: 'United Kingdom', provider: 'Commonwealth Scholarship Commission',
    covers: 'Tuition, living allowance, flights', funding: 'full',
    summary: 'A fully funded UK master\'s for students from Commonwealth countries, with a focus on development impact. You apply through your country\'s nominating agency.',
    minClass: 'upper', minWorkYears: 0, referees: 2, english: 'IELTS or TOEFL', docs: [...BASE_DOCS, '2 reference letters'],
    closes: 'Autumn, set by each nominating agency', closeMonth: null,
    url: 'https://cscuk.fcdo.gov.uk/scholarships/',
  },
];

// Countries to look at for a master's that costs little or nothing. Facts to confirm on the official page.
export interface CountryNote { country: string; cost: string; note: string; url: string }
export const COUNTRIES: CountryNote[] = [
  { country: 'Germany', cost: 'Free tuition', note: 'Public universities charge no tuition. You pay a semester fee of roughly 150 to 350 euros, and show about 11,900 euros a year in a blocked account. Baden-Württemberg charges non-EU students about 1,500 euros a semester.', url: 'https://www.study-in-germany.de/en/' },
  { country: 'Sweden', cost: 'Paid, free with a scholarship', note: 'Non-EU students pay tuition, so the scholarships above are what make it free. You also show living funds for the residence permit.', url: 'https://studyinsweden.se/' },
  { country: 'Hungary', cost: 'Free with Stipendium Hungaricum', note: 'Fully funded for students from partner countries.', url: 'https://stipendiumhungaricum.hu/' },
  { country: 'Austria', cost: 'Low fees', note: 'Public universities charge non-EU students about 730 euros a semester, with some exemptions.', url: 'https://www.studyinaustria.at/en' },
  { country: 'Iceland', cost: 'Almost free', note: 'Public universities charge only a yearly registration fee, but English-taught computer science courses are few.', url: 'https://www.studyiniceland.is/' },
  { country: 'Czechia', cost: 'Free in Czech only', note: 'Tuition is free for courses taught in Czech. English-taught courses charge fees.', url: 'https://www.studyin.cz/' },
  { country: 'Norway', cost: 'No longer free', note: 'Public universities began charging tuition to non-EU students from autumn 2023, so it is no longer a free option.', url: 'https://www.studyinnorway.no/' },
];

// The next time a month comes round, and how far off that is.
export function monthsUntil(month: number | null, now = new Date()): number | null {
  if (!month) return null;
  const cur = now.getMonth() + 1;
  return (month - cur + 12) % 12;
}

export interface ScholarshipMatch {
  score: number;
  why: string[];
  gaps: string[];
}

const RANK = { first: 4, upper: 3, lower: 2, third: 1 } as const;
export const CLASS_LABEL: Record<string, string> = { first: 'First class', upper: 'Second class upper', lower: 'Second class lower', third: 'Third class' };

// Fit with your transcript, and your CV's years of work if you have uploaded one.
export function matchScholarship(s: Scholarship, school: SchoolProfile | null, workYears: number | null): ScholarshipMatch {
  const why: string[] = [];
  const gaps: string[] = [];
  let score = 55;

  if (school?.field === 'cs') { why.push('Your degree is in computing'); score += 10; }
  else if (school?.field === 'other') { gaps.push('Your degree is not in computing. Check the course entry rules'); score -= 15; }

  const have = school?.classification ? RANK[school.classification] : null;
  if (s.minClass) {
    if (have === null) gaps.push(`Competitive at ${CLASS_LABEL[s.minClass].toLowerCase()} or above. Add your transcript to check`);
    else if (have >= RANK[s.minClass]) { why.push(`Your ${CLASS_LABEL[school!.classification!].toLowerCase()} meets the usual level`); score += have === 4 ? 25 : 18; }
    else { gaps.push(`Winners are usually ${CLASS_LABEL[s.minClass].toLowerCase()} or above`); score -= 25; }
  }

  if (s.minWorkYears > 0) {
    if (workYears === null) gaps.push(`Needs about ${s.minWorkYears} years of work. Upload your CV on the Jobs tab to check`);
    else if (workYears >= s.minWorkYears) { why.push(`${workYears} years of work covers the ${s.minWorkYears} needed`); score += 12; }
    else { gaps.push(`Needs about ${s.minWorkYears} years of work, your CV shows ${workYears}`); score -= 30; }
  }

  if (s.limitedCourses) { gaps.push('Only some courses qualify. Check the list for a computing one'); score -= 8; }
  if (school?.english) { why.push(`You have an English test (${school.english})`); score += 4; }
  else if (/ielts|toefl/i.test(s.english)) gaps.push('Needs an English test score (IELTS or TOEFL)');

  return { score: Math.max(0, Math.min(100, Math.round(score))), why, gaps };
}
