import type { SchoolProfile } from '@/lib/school';

// A hand-kept list of master's funding for computer science, plus the countries where tuition is free or close to it.
// There is no free live feed of scholarships, so the list lives here. Dates and amounts change every year: every entry
// links to the official page, and the page says to confirm there before you apply.

export type Group = 'germany' | 'sweden' | 'europe' | 'uk' | 'asia' | 'global';

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
  // How to apply, in order. Written from the official pages; the dates change every year, so each step says to check the current call.
  steps: string[];
  // Why this is a trusted source: who runs it. Every entry is a government, a university or a major foundation, and none charges a fee to apply.
  trust: string;
  // A cost that is not the scholarship's: for example a university admission fee. Shown so it is never a surprise.
  fee?: string;
}

const BASE_DOCS = ['Transcript', 'Degree certificate', 'CV', 'Motivation letter', 'Passport'];

type Base = Omit<Scholarship, 'steps' | 'trust' | 'fee'>;

const BASE: Base[] = [
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
    id: 'erasmus-mundus', name: 'Erasmus Mundus Joint Master\'s (computing courses)', group: 'europe', country: 'Several European countries', provider: 'European Commission',
    covers: 'Tuition, monthly allowance, travel', funding: 'full',
    summary: 'Fully funded two-year master\'s run by a group of universities, with study in two or more countries. There are computing courses in data science, AI, cybersecurity and software. Each course sets its own deadline and picks its own students.',
    minClass: 'upper', minWorkYears: 0, referees: 2, english: 'IELTS or TOEFL', docs: [...BASE_DOCS, '2 reference letters'],
    closes: 'Each course sets its own date, mostly between October and February', closeMonth: 1,
    url: 'https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/erasmus-mundus-joint-masters',
  },
  {
    id: 'stipendium-hungaricum', name: 'Stipendium Hungaricum', group: 'europe', country: 'Hungary', provider: 'Hungarian government',
    covers: 'Tuition, monthly stipend, housing, health insurance', funding: 'full',
    summary: 'A Hungarian government scholarship for students from partner countries, with English-taught master\'s in computer science and informatics. You apply through your own country\'s channel and the Tempus site.',
    minClass: 'upper', minWorkYears: 0, referees: 0, english: 'English proof', docs: [...BASE_DOCS, 'Medical certificate'],
    closes: 'Usually mid January', closeMonth: 1,
    url: 'https://stipendiumhungaricum.hu/',
  },
  {
    id: 'turkiye', name: 'Türkiye Burslari', group: 'europe', country: 'Türkiye', provider: 'Turkish government',
    covers: 'Tuition, monthly stipend, housing, language year if needed', funding: 'full',
    summary: 'A full Turkish government scholarship for master\'s students, with a free language year when needed. Open to international students, with a strong grade needed.',
    minClass: 'first', minWorkYears: 0, referees: 2, english: 'English or Turkish proof', docs: [...BASE_DOCS, '2 reference letters'],
    closes: 'Usually February', closeMonth: 2,
    url: 'https://turkiyeburslari.gov.tr/',
  },
  {
    id: 'chevening', name: 'Chevening Scholarship', group: 'uk', country: 'United Kingdom', provider: 'UK government',
    covers: 'Tuition, monthly allowance, flights', funding: 'full',
    summary: 'A one-year fully funded UK master\'s. Needs at least two years of work experience, and leadership counts heavily. The UK charges tuition, so this one is only for the scholarship.',
    minClass: 'upper', minWorkYears: 2, referees: 2, english: 'IELTS or TOEFL', docs: [...BASE_DOCS, '2 reference letters', 'Proof of work experience'],
    closes: 'Early October', closeMonth: 10,
    url: 'https://www.chevening.org/scholarships/',
  },
  {
    id: 'commonwealth', name: 'Commonwealth Master\'s Scholarship', group: 'uk', country: 'United Kingdom', provider: 'Commonwealth Scholarship Commission',
    covers: 'Tuition, living allowance, flights', funding: 'full',
    summary: 'A fully funded UK master\'s for students from Commonwealth countries, with a focus on development impact. You apply through your country\'s nominating agency.',
    minClass: 'upper', minWorkYears: 0, referees: 2, english: 'IELTS or TOEFL', docs: [...BASE_DOCS, '2 reference letters'],
    closes: 'Autumn, set by each nominating agency', closeMonth: null,
    url: 'https://cscuk.fcdo.gov.uk/scholarships/',
  },

  {
    id: 'gates-cambridge', name: 'Gates Cambridge Scholarship (master\'s)', group: 'uk', country: 'United Kingdom', provider: 'Gates Cambridge Trust, University of Cambridge',
    covers: 'Full cost: tuition, living allowance, flights, visa and health costs', funding: 'full',
    summary: 'A fully funded Cambridge master\'s or PhD for outstanding students from outside the UK. There is no separate form: you apply for your Cambridge course and tick Gates Cambridge. Very competitive, so a strong grade and a clear plan for impact matter most.',
    minClass: 'first', minWorkYears: 0, referees: 2, english: 'IELTS or TOEFL, set by the course', docs: [...BASE_DOCS, 'References, as the course requires'],
    closes: 'Set by your course in the Cambridge course directory: 8 December or 6 January for the international round', closeMonth: 12,
    url: 'https://www.gatescambridge.org/apply/',
  },
  {
    id: 'rhodes-west-africa', name: 'Rhodes Scholarship (West Africa, including Nigeria)', group: 'uk', country: 'United Kingdom', provider: 'Rhodes Trust, University of Oxford',
    covers: 'Tuition, fees, living stipend, flights, health insurance', funding: 'full',
    summary: 'A fully funded Oxford master\'s or doctorate. Nigerian citizens apply through the West Africa constituency. It looks for leadership, character and service as much as grades, and there are age and residence rules, so check them first.',
    minClass: 'first', minWorkYears: 0, referees: 3, english: 'Set by your Oxford course', docs: [...BASE_DOCS, 'Personal statement', 'Several reference letters'],
    closes: 'Usually mid-year, with interviews in November. The 2027 round closed in August 2026', closeMonth: 8,
    url: 'https://www.rhodeshouse.ox.ac.uk/scholarships/the-rhodes-scholarship/',
  },
  {
    id: 'mastercard-foundation', name: 'Mastercard Foundation Scholars Program (master\'s)', group: 'global', country: 'Africa and partner universities', provider: 'Mastercard Foundation',
    covers: 'Tuition, living costs and mentoring at a partner university', funding: 'full',
    summary: 'Fully funded study for talented young Africans who need financial support, at partner universities in Africa and abroad. There is no central application: you apply to a partner university and say you want the Scholars Program. For a master\'s you must be 35 or under.',
    minClass: 'upper', minWorkYears: 0, referees: 2, english: 'Set by each partner university', docs: [...BASE_DOCS, 'Reference letters'],
    closes: 'Each partner university sets its own date', closeMonth: null, limitedCourses: true,
    url: 'https://mastercardfdn.org/en/what-we-do/our-programs/mastercard-foundation-scholars-program/',
  },
  {
    id: 'eiffel', name: 'Eiffel Excellence Scholarship (France)', group: 'europe', country: 'France', provider: 'Campus France, French government',
    covers: 'Monthly allowance, travel, health insurance. Tuition is not covered', funding: 'partial',
    summary: 'A French government award for top master\'s students from outside France. You cannot apply to Campus France yourself: a French university nominates you, so you apply for a master\'s there and contact the person named on its Eiffel page. You must not already be living in France.',
    minClass: 'first', minWorkYears: 0, referees: 2, english: 'Set by the course', docs: [...BASE_DOCS],
    closes: 'Each university sets an earlier internal date, mostly November to early December', closeMonth: 11,
    url: 'https://www.campusfrance.org/en/eiffel-scholarship-program-of-excellence',
  },
  {
    id: 'csc', name: 'Chinese Government Scholarship (CSC)', group: 'asia', country: 'China', provider: 'China Scholarship Council',
    covers: 'Tuition, housing, monthly living allowance, medical insurance', funding: 'full',
    summary: 'A fully funded master\'s at a Chinese university. Nigerians can apply through the embassy route (Type A) or through a university that nominates them (Type B). A supervisor\'s acceptance letter strengthens a master\'s application.',
    minClass: 'upper', minWorkYears: 0, referees: 2, english: 'English proof if the course is in English', docs: [...BASE_DOCS, 'Study plan', 'Medical exam', 'Police clearance'],
    closes: 'The embassy posts the call between December and February. University dates run from January to April', closeMonth: 3,
    url: 'https://www.campuschina.org/',
  },
  {
    id: 'gks-graduate', name: 'Global Korea Scholarship, graduate (embassy track)', group: 'asia', country: 'South Korea', provider: 'Korean government (NIIED)',
    covers: 'Tuition, monthly allowance, flights, language year, health insurance', funding: 'full',
    summary: 'A fully funded Korean master\'s. The embassy track runs through the Korean Cultural Centre in Nigeria. The recent graduate round opened in February and closed within two weeks, so be ready before it opens. Check the age limit.',
    minClass: 'upper', minWorkYears: 0, referees: 2, english: 'English or Korean proof', docs: [...BASE_DOCS, 'Study plan', 'Recommendation letters'],
    closes: 'The call usually opens in February and closes about two weeks later', closeMonth: 2,
    url: 'https://www.studyinkorea.go.kr/',
  },
  {
    id: 'mext', name: 'Japanese Government (MEXT) Scholarship, research students', group: 'asia', country: 'Japan', provider: 'Government of Japan (MEXT)',
    covers: 'Tuition, monthly allowance, flights', funding: 'full',
    summary: 'A fully funded route to a Japanese master\'s, starting as a research student. You apply through the Embassy of Japan in Nigeria with a research plan, and papers are submitted to the embassy in Abuja. The research plan must match the course you later enter.',
    minClass: 'upper', minWorkYears: 0, referees: 1, english: 'English or Japanese proof', docs: [...BASE_DOCS, 'Research plan', 'Original transcripts'],
    closes: 'The call is usually posted in April or May, with a deadline in early June', closeMonth: 6,
    url: 'https://www.studyinjapan.go.jp/en/smap-stopj-applications-research.html',
  },
  {
    id: 'ireland-goi', name: 'Government of Ireland International Education Scholarship', group: 'europe', country: 'Ireland', provider: 'Higher Education Authority, Ireland',
    covers: 'A stipend of 10,000 euro and a tuition fee waiver for one year', funding: 'partial',
    summary: 'For students from outside the EU and UK. You first get an offer from an eligible Irish university, then apply on the HEA portal once a year. A good fit for a one-year master\'s. Only one application per person is allowed.',
    minClass: 'upper', minWorkYears: 0, referees: 2, english: 'Set by the course', docs: [...BASE_DOCS, '2 references uploaded on the portal', 'Proof of your admission offer'],
    closes: 'The portal usually opens between January and March', closeMonth: 3,
    url: 'https://hea.ie/policy/internationalisation/goi-ies/',
  },
  {
    id: 'manaaki', name: 'Manaaki New Zealand Scholarships', group: 'global', country: 'New Zealand', provider: 'New Zealand government (MFAT)',
    covers: 'Tuition, living allowance, flights, insurance', funding: 'full',
    summary: 'A fully funded New Zealand master\'s for people from developing countries who will return home. Whether Nigeria is on the eligible list is unclear: sources disagree, so use the official eligibility checker before you plan anything.',
    minClass: 'upper', minWorkYears: 1, referees: 2, english: 'IELTS about 6.5 for postgraduate study', docs: [...BASE_DOCS, 'Work history', 'Reference letters'],
    closes: 'Most countries open in February and March', closeMonth: 3,
    url: 'https://www.nzscholarships.govt.nz/',
  },
  {
    id: 'australia-awards', name: 'Australia Awards Scholarships (Africa)', group: 'global', country: 'Australia', provider: 'Australian government (DFAT)',
    covers: 'Tuition, living allowance, flights, insurance', funding: 'full',
    summary: 'A fully funded Australian master\'s for people from eligible African countries, and Nigeria is on the list. It looks for leadership and a clear plan to help your country. You apply to the award first and do not need a university offer yet. You must leave Australia for at least two years afterwards.',
    minClass: 'upper', minWorkYears: 0, referees: 2, english: 'IELTS or equivalent', docs: [...BASE_DOCS, 'Proof of work experience', 'Reference letters'],
    closes: 'The last round closed on 30 April. The next one usually opens in February', closeMonth: 4, limitedCourses: true,
    url: 'https://www.studyaustralia.gov.au/en/tools-and-resources/news/australia-awards-scholarships-applications-2027',
  },
  {
    id: 'eth-esop', name: 'ETH Zurich Excellence Scholarship and Opportunity Programme (ESOP)', group: 'europe', country: 'Switzerland', provider: 'ETH Zurich',
    covers: 'About 13,500 Swiss francs a semester plus a tuition waiver, as reported', funding: 'full',
    summary: 'For the top of the class applying to an ETH master\'s, including computer science. You tick the scholarship in ETH\'s online master\'s application and add a short pre-proposal for your thesis. You must not already be in a master\'s.',
    minClass: 'first', minWorkYears: 0, referees: 2, english: 'IELTS or TOEFL', docs: [...BASE_DOCS, 'Pre-proposal for your master thesis', 'Reference letters'],
    closes: 'Usually 30 November, around midday Zurich time', closeMonth: 11,
    url: 'https://ethz.ch/en/studies/financial/scholarships/excellencescholarship.html',
  },
  {
    id: 'epfl-excellence', name: 'EPFL Excellence Fellowships', group: 'europe', country: 'Switzerland', provider: 'EPFL',
    covers: 'About 10,000 Swiss francs a semester, up to 40,000 in total, and reserved housing', funding: 'full',
    summary: 'For top students applying to an EPFL master\'s, including computing. No separate form: you tick a box in EPFL\'s online master\'s application. You can apply to only one EPFL master\'s programme per year.',
    minClass: 'first', minWorkYears: 0, referees: 2, english: 'English proof', docs: [...BASE_DOCS],
    closes: 'Usually 15 December, with a second round later in spring', closeMonth: 12,
    url: 'https://www.epfl.ch/education/master/',
  },
  {
    id: 'maeci-italy', name: 'Italian Government scholarships (MAECI)', group: 'europe', country: 'Italy', provider: 'Italian Ministry of Foreign Affairs (MAECI)',
    covers: 'Monthly allowance and health insurance', funding: 'partial',
    summary: 'Grants for foreign students at Italian universities, for state master\'s degrees (laurea magistrale), not the university-run "Master universitari". You also pre-enrol on Universitaly. Check the age limit for master\'s applicants.',
    minClass: 'upper', minWorkYears: 0, referees: 0, english: 'B2 in the language of the course', docs: [...BASE_DOCS],
    closes: 'The last round closed in late March', closeMonth: 3,
    url: 'https://studyinitaly.esteri.it/',
  },
  {
    id: 'czech-gov', name: 'Czech Government Scholarship for developing countries', group: 'europe', country: 'Czechia', provider: 'Czech Ministry of Foreign Affairs and Ministry of Education',
    covers: 'About 16,000 Czech koruna a month for a master\'s, as reported, with study in English', funding: 'partial',
    summary: 'Offered to Nigerian students for a follow-up master\'s in English. Information technology is one of the recommended fields. The notice reaches Nigerians through the Federal Ministry of Education and the Czech embassy in Abuja.',
    minClass: 'upper', minWorkYears: 0, referees: 0, english: 'English proof', docs: [...BASE_DOCS],
    closes: 'The window has run from late August to the end of September', closeMonth: 9,
    url: 'https://mzv.gov.cz/abuja/en/news_events/government_scholarships_for_nigerian.html',
  },
  {
    id: 'banach-nawa', name: 'Banach NAWA Programme (Poland)', group: 'europe', country: 'Poland', provider: 'Polish National Agency for Academic Exchange (NAWA)',
    covers: 'Tuition exemption, monthly scholarship of about 2,500 zloty, travel allowance, a preparatory course', funding: 'full',
    summary: 'Scholarships for master\'s studies at Polish universities, open to students from listed countries, and Nigeria is on the list. Computing is not named as a field, so check which courses at Polish universities qualify.',
    minClass: 'upper', minWorkYears: 0, referees: 1, english: 'English or Polish proof', docs: [...BASE_DOCS],
    closes: 'Usually early May', closeMonth: 5, limitedCourses: true,
    url: 'https://study.gov.pl/banach-nawa-programme',
  },
  {
    id: 'jjwbgsp', name: 'Joint Japan/World Bank Graduate Scholarship Program', group: 'global', country: 'Several countries', provider: 'World Bank and the Government of Japan',
    covers: 'Tuition, monthly living stipend, flights, health insurance', funding: 'full',
    summary: 'For people from developing countries, including Nigeria, studying development-related subjects at about two dozen partner universities. You need unconditional admission first and a paid full-time job in development when you apply. Only some courses qualify, so check the list.',
    minClass: 'upper', minWorkYears: 3, referees: 2, english: 'Set by the university', docs: [...BASE_DOCS, 'Proof of development work', 'Reference letters'],
    closes: 'Set by each participating university, and dates change every year', closeMonth: null, limitedCourses: true,
    url: 'https://www.worldbank.org/en/programs/scholarships',
  },
  {
    id: 'aalto-excellence', name: 'Aalto University Excellence Scholarship (Finland)', group: 'europe', country: 'Finland', provider: 'Aalto University',
    covers: 'A tuition waiver. Living costs are not covered', funding: 'partial',
    summary: 'For non-EU students at an Aalto master\'s, including computer science and data science. You answer "yes" to the scholarship question on the master\'s application form, and it is decided together with admission. You cannot apply for it before or after the application period.',
    minClass: 'first', minWorkYears: 0, referees: 0, english: 'IELTS or TOEFL', docs: [...BASE_DOCS],
    closes: 'The application period usually runs from early December to early January', closeMonth: 1,
    url: 'https://www.aalto.fi/en/admission-services/apply-to-masters-programmes',
  },
];

const OFFICIAL_NOTE = 'Every step below is for the official page only. Never pay anyone to apply, and be careful with blogs: many list old dates or the wrong rules.';

const EXTRA: Record<string, { steps: string[]; trust: string; fee?: string }> = {
  'daad-epos': { trust: 'Run by the German government\'s academic exchange service (DAAD).', steps: [
    'Open the DAAD EPOS course list and pick the courses that match your degree and your interest in computing.',
    'Check the entry rules on each course page: a degree, about two years of work since graduating, and English or German proof.',
    'Gather your documents: transcript, degree certificate, CV, motivation letter, passport, proof of work and two reference letters.',
    'Apply the way the course page says, mostly through the DAAD portal and to the university, before the course\'s own deadline.',
    'Watch your email after the deadline: shortlisted candidates may be asked for an interview.' ] },
  'daad-database': { trust: 'The official DAAD scholarship search.', steps: [
    'Open the database and choose Master, your home country and the subject Computer Science.',
    'Open each result and read who can apply, what it pays and when it closes.',
    'Save the ones that fit and put their deadlines in your calendar.',
    'Apply through the link each scholarship page gives you.' ] },
  'deutschlandstipendium': { trust: 'A German national programme, run by each university with public and private sponsors.', steps: [
    'Get admitted to a German university and enrol first.',
    'Find your university\'s Deutschlandstipendium page (usually in the scholarship office) and note the call date.',
    'Submit your transcript, CV, proof of enrolment and anything else the call asks for.',
    'Wait for the university\'s selection. It is a top-up for living costs, so keep a main scholarship plan too.' ] },
  'saarland-sic': { trust: 'Run by Saarland University, a public German university.', steps: [
    'Choose a master\'s at the Saarland Informatics Campus on the campus website.',
    'Read the scholarship section of that programme\'s page for what is offered this year.',
    'Apply for the course online with transcripts, CV, motivation letter, two references and an English test.',
    'Follow the page for how funding is decided, and answer any follow-up quickly.' ] },
  'si-gp': { trust: 'Run by the Swedish Institute, an agency of the Swedish government.', steps: [
    'Pick a master\'s from the Swedish Institute list of eligible programmes. Only those qualify.',
    'Apply to your chosen programmes on the national admissions site by the January deadline, and keep the application numbers.',
    'Collect proof of about 3,000 hours of work, leadership or volunteering, and two reference letters.',
    'Apply for the scholarship on the Swedish Institute\'s site in the same window, as that year\'s instructions say.',
    'Wait for the Swedish Institute\'s decision, which comes after the universities decide on admission.' ] },
  'kth': { trust: 'Run by KTH Royal Institute of Technology, a public Swedish university.', steps: [
    'Apply for your KTH master\'s on the national admissions site by the January deadline.',
    'Check the KTH scholarship page for whether you are considered automatically or must tick an option.',
    'Send the documents with your application, including your transcript and English test.',
    'The scholarship is decided with the admission result. It covers tuition only, so plan for living costs.' ] },
  'chalmers': { trust: 'Run by Chalmers University of Technology, a public Swedish university.', steps: [
    'Apply for your Chalmers master\'s on the national admissions site by the January deadline.',
    'Read the Chalmers scholarship page to see whether a separate form is needed.',
    'Send your transcript, CV, motivation letter and English test.',
    'Wait for the admission and scholarship decision together.' ] },
  'lund': { trust: 'Run by Lund University, a public Swedish university.', steps: [
    'Apply for your Lund master\'s on the national admissions site by the January deadline.',
    'Check the Lund scholarship page to see whether you are considered automatically.',
    'Send your documents with the application.',
    'Wait for the admission and scholarship decision.' ] },
  'liu': { trust: 'Run by Linköping University, a public Swedish university.', steps: [
    'Apply for your Linköping master\'s on the national admissions site by the mid-January deadline.',
    'Check the university\'s scholarship page to see whether you are considered automatically.',
    'Send your documents with the application.',
    'Wait for the admission and scholarship decision.' ] },
  'erasmus-mundus': { trust: 'Run by the European Commission through each joint master\'s programme.', steps: [
    'Search the Erasmus Mundus catalogue for joint master\'s in computer science, data science, AI or cybersecurity.',
    'Read each course\'s page for its own deadline, the countries you would study in and what it pays.',
    'Apply directly to the course on its website. There is no central application.',
    'Prepare the usual documents and two references, and apply to several courses if you can.' ] },
  'stipendium-hungaricum': { trust: 'Run by the Hungarian government through the Tempus Public Foundation.', steps: [
    'Check that Nigeria is on the partner list and read how applicants from your country apply.',
    'Choose up to three English-taught master\'s courses in computer science or informatics.',
    'Create an account on the Stipendium Hungaricum application site during the call, which usually closes in mid-January.',
    'Upload your documents and a medical certificate, and follow any nomination step the country page describes.' ] },
  'turkiye': { trust: 'Run by the Turkish government\'s Türkiye Scholarships programme.', steps: [
    'Open the Türkiye Scholarships site during the call, usually in January and February, and create an account.',
    'Choose your programmes and universities from the lists the site gives you.',
    'Upload your transcript, certificate, passport, recommendation letters and motivation letter.',
    'Submit before the closing date, then wait for the interview invitation by email.' ] },
  'chevening': { trust: 'Run by the UK Foreign, Commonwealth and Development Office.', steps: [
    'Check you are from an eligible country, hold a degree and have at least two years of work experience.',
    'Open the application on the Chevening site when it opens, usually in August, and register.',
    'Choose up to three UK courses from the Chevening list.',
    'Write the four essays on leadership, networking, studying in the UK and your career plan, and give two referees.',
    'Submit by the early October deadline, then wait for the interview and the UK university offers.' ] },
  'commonwealth': { trust: 'Run by the UK Commonwealth Scholarship Commission, funded by the UK government.', steps: [
    'Check that you are a citizen of an eligible Commonwealth country and that the course fits the development themes.',
    'Find your country\'s nominating agency on the Commission\'s site and read its call.',
    'Apply on the Commission\'s online application system during the call, usually in the autumn.',
    'Give two references and choose your UK courses, then wait for the nomination and decision.' ] },
  'gates-cambridge': { trust: 'Run by the Gates Cambridge Trust at the University of Cambridge, funded by the Gates Foundation.', steps: [
    'Choose a Cambridge master\'s in the course directory and find its funding deadline: 8 December or 6 January for the international round.',
    'Apply for the course through the University\'s graduate application portal.',
    'In the funding section, tick Gates Cambridge and answer the four short questions.',
    'Ask one referee to write a Gates Cambridge reference as well as your course references.',
    'Meet both the admission and the Gates deadlines. Offers go out by early April for the international round.' ] },
  'rhodes-west-africa': { trust: 'Run by the Rhodes Trust at the University of Oxford.', steps: [
    'Check the rules on the Rhodes site: Nigerian citizenship, five of the last ten years living in an eligible country, a degree and the age limit.',
    'Choose an Oxford master\'s or doctorate and read its entry requirements.',
    'Complete the West Africa online application during the call, usually mid-year, with your personal statement and referees.',
    'Prepare for the virtual interview and, if shortlisted, the in-person interview in Abuja, Accra or Lagos.',
    'Apply to Oxford for your course as the Trust instructs.' ] },
  'mastercard-foundation': { trust: 'Run by the Mastercard Foundation through its partner universities.', fee: 'Some partner universities charge an application fee. The Foundation says it is reimbursed if you are selected.', steps: [
    'Open the Foundation\'s list of partner universities and choose ones with a master\'s that fits you. You must be 35 or under for a master\'s.',
    'Read each university\'s own page for its Scholars Program deadline and entry rules.',
    'Apply through that university\'s admissions portal and say you want the Mastercard Foundation Scholars Program.',
    'Ask your referees early, because most universities want recommendation letters.' ] },
  'eiffel': { trust: 'Run by Campus France for the French government.', steps: [
    'Choose a master\'s at a French university and find that university\'s Eiffel page.',
    'Contact the named coordinator or international office well before its internal deadline, which is mostly in November or early December.',
    'Apply for the master\'s as the university asks. You cannot apply to Campus France yourself, and you must not already live in France.',
    'The university nominates a small number of candidates to Campus France, which makes the final choice.' ] },
  'csc': { trust: 'Run by the China Scholarship Council for the Chinese government.', steps: [
    'Watch the Chinese Embassy in Nigeria for the yearly call, usually posted between December and February.',
    'Choose your route: Type A through the Federal Scholarship Board and the embassy, or Type B through a Chinese university that nominates you.',
    'For Type B, contact the university and a supervisor early to get a pre-admission or acceptance letter.',
    'Create your account on the CSC online system and apply with the agency number for your route.',
    'Prepare the study plan, medical exam and police clearance early, because they take time in Nigeria.' ] },
  'gks-graduate': { trust: 'Run by the Korean government through NIIED and its embassies.', steps: [
    'Watch the Korean Cultural Centre in Nigeria for the yearly call, usually in February.',
    'Check the age and grade rules in the call before you start.',
    'Prepare your documents and study plan ahead of time, because the window is short.',
    'Apply through the Study in Korea site during the window, then attend the interview.',
    'Use the embassy track for your country, and read the notice on whether papers must also be delivered in person.' ] },
  'mext': { trust: 'Run by the Government of Japan (MEXT), through its embassy in Nigeria.', steps: [
    'Watch the Embassy of Japan in Nigeria for the research students call, usually in April or May.',
    'Read the guide on the Study in Japan site for the current rules and checklist.',
    'Write your research plan and gather your original transcripts, certificate and other documents.',
    'Submit the complete package to the embassy in Abuja by the deadline, usually in early June.',
    'Prepare for the written exam and interview if you are shortlisted.' ] },
  'ireland-goi': { trust: 'Run by the Higher Education Authority, an Irish government agency.', steps: [
    'Choose an eligible Irish university and apply for your master\'s there first.',
    'Wait for a conditional or final offer. You need it before you can apply for the scholarship.',
    'Open the GOI-IES online portal during the yearly call, usually between January and March.',
    'Submit your application, with two references uploaded through the portal. Only one application per person is allowed.' ] },
  'manaaki': { trust: 'Run by the New Zealand government\'s foreign ministry (MFAT).', steps: [
    'Take the online eligibility test on the New Zealand Scholarships site, and check that Nigeria is on the list for your award type.',
    'If you pass, register on the site and apply during the call, usually in February and March.',
    'Prepare your work history, because postgraduate applicants generally need about a year of relevant work.',
    'If you are shortlisted, you then apply to study at a New Zealand university.' ] },
  'australia-awards': { trust: 'Run by the Australian government (DFAT).', steps: [
    'Check the Australia Awards page for Nigeria and read the eligibility, including the work and leadership expectations.',
    'Create an account on the online application system when the round opens, usually in February.',
    'Complete the application. You do not need a university offer yet.',
    'Submit before the closing date, around the end of April, and wait for the shortlist and interview.' ] },
  'eth-esop': { trust: 'Run by ETH Zurich, a public Swiss university.', steps: [
    'Check that you are in about the top tenth of your bachelor\'s class and have not started a master\'s.',
    'Start your ETH master\'s application on eApply and upload the normal admission documents.',
    'Write the pre-proposal for your master\'s thesis and upload it.',
    'Tick the ESOP option and submit before the deadline, usually 30 November around midday Zurich time.' ] },
  'epfl-excellence': { trust: 'Run by EPFL, a public Swiss university.', steps: [
    'Choose one EPFL master\'s programme. You can apply to only one per year.',
    'Start the online master\'s application and upload the admission documents.',
    'Tick the box for the Excellence Fellowship in the same application.',
    'Submit before the deadline, usually 15 December, or in the later round if it is open.' ] },
  'maeci-italy': { trust: 'Run by Italy\'s Ministry of Foreign Affairs.', fee: 'Italian universities often charge an application fee for admission.', steps: [
    'Choose a state master\'s (laurea magistrale) at an Italian university and apply for admission first.',
    'Pre-enrol on Universitaly. Your university validates it and sends it to the Italian embassy in your country.',
    'Apply for the grant on the Study in Italy portal during the call, which closed in late March last year.',
    'Check the age limit and the language certificate for your course.' ] },
  'czech-gov': { trust: 'Run by the Czech government, announced through the Nigerian Federal Ministry of Education and the Czech embassy in Abuja.', steps: [
    'Watch the Federal Ministry of Education and the Czech embassy in Abuja for the yearly notice, usually from late August.',
    'Choose an English-taught follow-up master\'s in a recommended field such as information technology.',
    'Apply through the Czech application system by the end of September, with transcripts, certificate and language proof.',
    'For technical help with the system, the embassy page lists a Czech contact address.' ] },
  'banach-nawa': { trust: 'Run by NAWA, the Polish government\'s academic exchange agency.', steps: [
    'Check that Nigeria is on the eligible list and read the current call on the study.gov.pl page.',
    'Choose a second-cycle (master\'s) course at a Polish university and check that it qualifies.',
    'Apply on the NAWA application system by the deadline, usually early May.',
    'Send the documents the call asks for, then wait for the university and NAWA decisions.' ] },
  'jjwbgsp': { trust: 'Run by the World Bank with the Government of Japan.', steps: [
    'Open the World Bank guidelines and read the list of participating master\'s programmes. Only those qualify.',
    'Check that you meet the rules: a degree from at least three years ago and a paid full-time development job.',
    'Apply to a participating university\'s master\'s programme first and get unconditional admission, apart from funding.',
    'Wait for the university to shortlist you, then complete the scholarship form you are sent.' ] },
  'aalto-excellence': { trust: 'Run by Aalto University, a public Finnish university.', fee: 'Aalto charges non-EU applicants an application fee of 100 euro. It is the university\'s admission fee, not the scholarship\'s.', steps: [
    'Choose an Aalto master\'s such as computer science or data science and read its requirements.',
    'During the application period, usually early December to early January, fill in the master\'s application form.',
    'Answer "yes" to the scholarship question on the form. You cannot apply before or after the period.',
    'Pay the application fee and upload your documents, then wait for the admission and scholarship decision together.' ] },
};

export const SCHOLARSHIPS: Scholarship[] = BASE.map(b => ({ ...b, ...EXTRA[b.id] }));
export { OFFICIAL_NOTE };

// Countries to look at for a master's that costs little or nothing. Facts to confirm on the official page.
export interface CountryNote { country: string; cost: string; note: string; url: string }
export const COUNTRIES: CountryNote[] = [
  { country: 'Germany', cost: 'Free tuition', note: 'No tuition at public universities. Semester fee of about 150 to 350 euros. Baden-Württemberg charges non-EU students.', url: 'https://www.study-in-germany.de/en/' },
  { country: 'Sweden', cost: 'Paid, free with a scholarship', note: 'Non-EU students pay tuition, so a scholarship is what makes it free.', url: 'https://studyinsweden.se/' },
  { country: 'Hungary', cost: 'Free with Stipendium Hungaricum', note: 'Fully funded for students from partner countries.', url: 'https://stipendiumhungaricum.hu/' },
  { country: 'Austria', cost: 'Low fees', note: 'About 730 euros a semester for non-EU students.', url: 'https://www.studyinaustria.at/en' },
  { country: 'Iceland', cost: 'Almost free', note: 'Yearly registration fee only, but few English computer science courses.', url: 'https://www.studyiniceland.is/' },
  { country: 'Czechia', cost: 'Free in Czech only', note: 'Free for Czech-taught courses. English-taught ones charge fees.', url: 'https://www.studyin.cz/' },
  { country: 'Norway', cost: 'No longer free', note: 'Charges non-EU students tuition since autumn 2023.', url: 'https://www.studyinnorway.no/' },
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
