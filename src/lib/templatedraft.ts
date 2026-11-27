import type { Lead } from '@/types/lead';
import { isB2B, isJobLead, leadLanguage } from '@/lib/leadview';
import { BATON_PARTNER_URL } from '@/lib/batonmail';

// A fallback that needs no AI. When the model cannot be reached (no credit, an outage) a new lead would otherwise be saved with no email,
// and a follow-up would not go out. These drafts are built from what the app already knows about the lead and are written in English,
// Dutch, French and Norwegian. They are plainer than the AI drafts and are used only when there is no draft at all (never to replace one).
// Only things the app has actually seen are claimed: a problem is stated as "I couldn't find X on the page I looked at".

type L4 = 'en' | 'nl' | 'fr' | 'no';
const SUPPORTED: L4[] = ['en', 'nl', 'fr', 'no'];

interface Pack {
  hi: (first?: string) => string;
  looked: string[];            // opening line, {n} = their name
  timeB2B: string;
  timeLocal: string;
  close: string;               // {n}
  b2b: Record<'book' | 'price' | 'proof' | 'start', { subject: string; problem: string; fix: string; proof: 'dlp' | 'initial' }>;
  local: Record<string, { subject: string; problem: string; fix: string }>;
  proofText: { dlp: string; initial: string; booked: string };
  fu1: string;                 // follow-up 1, {n}
  fu2: string;                 // follow-up 2, {n}
}

const PACKS: Record<L4, Pack> = {
  en: {
    hi: f => (f ? `Hi ${f},` : 'Hi there,'),
    looked: ["I had a look at {n}'s website.", "I was looking at {n}'s website."],
    timeB2B: '5 to 7 days at a fixed price.',
    timeLocal: 'Fixed price, live in about two weeks.',
    close: "Want me to send a one-page sketch of that for {n}? Just reply YES. If it's not for you, just say so.",
    proofText: {
      dlp: 'I rebuilt 12 pages for DLP Africa, a telecommunications company in Ghana, with custom forms tracked on every page.',
      initial: 'I built the landing page for a consultancy whose founder got 5+ new clients from it.',
      booked: 'I designed BookedEZ, a booking app that paid out over $10K to its users in its first month.',
    },
    b2b: {
      book: { subject: 'A booking step for {n}', problem: "On the page I looked at I couldn't find a clear way to book a call or ask for a quote, so a visitor who is ready has to hunt for a way in.", fix: "I'd add a short enquiry page that asks what they need and books the right call.", proof: 'dlp' },
      price: { subject: "Pricing on {n}'s site", problem: "On the page I looked at I couldn't find pricing or what a package includes, so a buyer has to get in touch before they know the cost.", fix: "I'd add a pricing and what's-included section that shows the main options up front.", proof: 'initial' },
      proof: { subject: "Case studies on {n}'s site", problem: "On the page I looked at I couldn't find case studies or client results, so a new buyer has nothing to check you against.", fix: "I'd add case studies sorted by industry, so a buyer sees work like theirs first.", proof: 'initial' },
      start: { subject: "An idea for {n}'s site", problem: '', fix: "I'd add a short \"where should I start?\" page: three questions, then it points to the right service and a booking link.", proof: 'initial' },
    },
    local: {
      nowebsite: { subject: 'A website for {n}', problem: 'Your Google listing has no website, so people who find you there have nowhere to click through to.', fix: "I'd build a simple, fast site with your services, opening hours and an easy way to call or book." },
      newco: { subject: 'A first website for {n}', problem: 'Your company is new and has no website yet, so people searching your name will not find you.', fix: "I'd build a launch site that says what you do and how to reach you." },
      nohttps: { subject: "{n}'s site shows a warning", problem: 'Browsers show a "Not secure" warning when people open your site.', fix: "I'd move it to a secure address, so visitors are not warned away." },
      notmobile: { subject: "{n} on a phone", problem: 'Your site is hard to read on a phone, which is where most people look you up.', fix: "I'd rebuild it for phones first, with your number and directions one tap away." },
      freesub: { subject: 'Your own domain for {n}', problem: 'Your site is on a free builder address rather than your own domain name.', fix: "I'd move it to your own domain, with a matching email address." },
      comingsoon: { subject: "{n}'s homepage", problem: 'Your site still says "coming soon", so visitors leave without getting in touch.', fix: "I'd put up a real homepage that explains what you offer and brings in enquiries." },
      nocontent: { subject: "{n}'s homepage", problem: 'Your homepage has very little on it, so visitors cannot tell what you offer.', fix: 'I\'d add clear pages for your services, prices and contact details.' },
      down: { subject: "{n}'s site did not load", problem: 'Your website did not load when I tried it, so anyone clicking through from Google hits a dead end.', fix: "I'd get a working site back online quickly, on reliable hosting." },
    },
    fu1: "I put together a short idea for {n} in my last email: one small change, a fixed price, and a one-page sketch if you'd like to see it. Just reply YES and I'll send it over.",
    fu2: 'This is my last note about {n}. If a one-page sketch would help, reply YES and I will send it. Otherwise no reply needed.',
  },
  nl: {
    hi: f => (f ? `Hallo ${f},` : 'Hallo,'),
    looked: ['Ik heb de website van {n} bekeken.', 'Ik keek naar de website van {n}.'],
    timeB2B: 'In 5 tot 7 dagen, voor een vast bedrag.',
    timeLocal: 'Vast bedrag, binnen ongeveer twee weken live.',
    close: 'Zal ik hiervoor een korte schets voor {n} sturen? Antwoord gewoon JA. Is het niets voor u, laat het me gerust weten.',
    proofText: {
      dlp: 'Ik heb 12 pagina\'s van DLP Africa, een telecombedrijf in Ghana, opnieuw gebouwd, met eigen formulieren die op elke pagina worden gemeten.',
      initial: 'Ik bouwde de landingspagina voor een adviesbureau, waarvan de oprichter er 5+ nieuwe klanten mee kreeg.',
      booked: 'Ik ontwierp BookedEZ, een boekingsapp die in de eerste maand meer dan $10K uitbetaalde aan gebruikers.',
    },
    b2b: {
      book: { subject: 'Een afspraakstap voor {n}', problem: 'Op de pagina die ik bekeek vond ik geen duidelijke manier om een gesprek te boeken of een offerte aan te vragen, dus een bezoeker die klaar is moet zelf zoeken.', fix: 'Ik zou een korte aanvraagpagina toevoegen die vraagt wat men nodig heeft en het juiste gesprek inplant.', proof: 'dlp' },
      price: { subject: 'Prijzen op de site van {n}', problem: 'Op de pagina die ik bekeek vond ik geen prijzen of wat een pakket omvat, dus een koper moet contact opnemen voordat hij de kosten weet.', fix: 'Ik zou een onderdeel met prijzen en wat erbij zit toevoegen, met de belangrijkste opties vooraan.', proof: 'initial' },
      proof: { subject: 'Cases op de site van {n}', problem: 'Op de pagina die ik bekeek vond ik geen cases of klantresultaten, dus een nieuwe koper heeft niets om u aan te toetsen.', fix: 'Ik zou cases toevoegen, gesorteerd per sector, zodat een koper eerst werk ziet dat op het zijne lijkt.', proof: 'initial' },
      start: { subject: 'Een idee voor de site van {n}', problem: '', fix: 'Ik zou een korte pagina "waar begin ik?" toevoegen: drie vragen, en dan de juiste dienst en een boekingslink.', proof: 'initial' },
    },
    local: {
      nowebsite: { subject: 'Een website voor {n}', problem: 'Uw Google-vermelding heeft geen website, dus wie u daar vindt kan nergens doorklikken.', fix: 'Ik zou een eenvoudige, snelle site bouwen met uw diensten, openingstijden en een makkelijke manier om te bellen of te boeken.' },
      newco: { subject: 'Een eerste website voor {n}', problem: 'Uw bedrijf is nieuw en heeft nog geen website, dus wie uw naam zoekt vindt u niet.', fix: 'Ik zou een startsite bouwen die zegt wat u doet en hoe men u bereikt.' },
      nohttps: { subject: 'De site van {n} toont een waarschuwing', problem: 'Browsers tonen de waarschuwing "Niet beveiligd" wanneer iemand uw site opent.', fix: 'Ik zou de site naar een beveiligd adres verplaatsen, zodat bezoekers niet worden weggejaagd.' },
      notmobile: { subject: '{n} op een telefoon', problem: 'Uw site is lastig te lezen op een telefoon, terwijl de meeste mensen u daar opzoeken.', fix: 'Ik zou hem eerst voor telefoons opbouwen, met uw nummer en route met één tik bereikbaar.' },
      freesub: { subject: 'Een eigen domein voor {n}', problem: 'Uw site staat op een gratis adres van een sitebouwer in plaats van op uw eigen domeinnaam.', fix: 'Ik zou hem naar uw eigen domein verhuizen, met een bijpassend e-mailadres.' },
      comingsoon: { subject: 'De homepage van {n}', problem: 'Uw site zegt nog "binnenkort beschikbaar", dus bezoekers vertrekken zonder contact op te nemen.', fix: 'Ik zou een echte homepage neerzetten die uitlegt wat u aanbiedt en aanvragen binnenhaalt.' },
      nocontent: { subject: 'De homepage van {n}', problem: 'Uw homepage bevat weinig, dus bezoekers zien niet wat u aanbiedt.', fix: 'Ik zou duidelijke pagina\'s toevoegen voor uw diensten, prijzen en contactgegevens.' },
      down: { subject: 'De site van {n} laadde niet', problem: 'Uw website laadde niet toen ik het probeerde, dus wie vanuit Google doorklikt komt op een dood punt uit.', fix: 'Ik zou snel weer een werkende site online zetten, op betrouwbare hosting.' },
    },
    fu1: 'In mijn vorige e-mail deed ik een kort voorstel voor {n}: één kleine verandering, voor een vast bedrag, met een schets op één pagina als u die wilt zien. Antwoord gewoon JA, dan stuur ik hem toe.',
    fu2: 'Dit is mijn laatste bericht over {n}. Als een schets op één pagina u zou helpen, antwoord dan JA en ik stuur hem. Anders is een antwoord niet nodig.',
  },
  fr: {
    hi: f => (f ? `Bonjour ${f},` : 'Bonjour,'),
    looked: ["J'ai regardé le site de {n}.", "Je regardais le site de {n}."],
    timeB2B: 'En 5 à 7 jours, à prix fixe.',
    timeLocal: 'Prix fixe, en ligne en deux semaines environ.',
    close: "Voulez-vous que je vous envoie une courte esquisse pour {n} ? Répondez simplement OUI. Si ce n'est pas pour vous, dites-le-moi.",
    proofText: {
      dlp: "J'ai reconstruit 12 pages pour DLP Africa, une entreprise de télécommunications au Ghana, avec des formulaires sur mesure suivis sur chaque page.",
      initial: "J'ai créé la page d'atterrissage d'un cabinet de conseil dont le fondateur a obtenu plus de 5 nouveaux clients grâce à elle.",
      booked: "J'ai conçu BookedEZ, une application de réservation qui a versé plus de 10 000 $ à ses utilisateurs le premier mois.",
    },
    b2b: {
      book: { subject: 'Une étape de prise de rendez-vous pour {n}', problem: "Sur la page que j'ai regardée, je n'ai pas trouvé de moyen clair de réserver un appel ou de demander un devis : un visiteur prêt doit chercher par où commencer.", fix: "J'ajouterais une courte page de demande qui précise le besoin et réserve le bon appel.", proof: 'dlp' },
      price: { subject: 'Les tarifs sur le site de {n}', problem: "Sur la page que j'ai regardée, je n'ai pas trouvé de tarifs ni ce que comprend une offre : un acheteur doit vous contacter avant de connaître le coût.", fix: "J'ajouterais une section tarifs et contenu de l'offre, avec les options principales en tête.", proof: 'initial' },
      proof: { subject: 'Des cas clients sur le site de {n}', problem: "Sur la page que j'ai regardée, je n'ai pas trouvé d'études de cas ni de résultats clients : un nouvel acheteur n'a rien pour vous évaluer.", fix: "J'ajouterais des cas clients classés par secteur, pour qu'un acheteur voie d'abord un travail proche du sien.", proof: 'initial' },
      start: { subject: 'Une idée pour le site de {n}', problem: '', fix: "J'ajouterais une courte page « par où commencer ? » : trois questions, puis le bon service et un lien de réservation.", proof: 'initial' },
    },
    local: {
      nowebsite: { subject: 'Un site pour {n}', problem: "Votre fiche Google n'a pas de site web : ceux qui vous y trouvent ne peuvent cliquer nulle part.", fix: "Je créerais un site simple et rapide avec vos services, vos horaires et un moyen facile d'appeler ou de réserver." },
      newco: { subject: 'Un premier site pour {n}', problem: "Votre entreprise est nouvelle et n'a pas encore de site : ceux qui cherchent votre nom ne vous trouvent pas.", fix: 'Je créerais un site de lancement qui dit ce que vous faites et comment vous joindre.' },
      nohttps: { subject: 'Le site de {n} affiche un avertissement', problem: 'Les navigateurs affichent « Non sécurisé » quand on ouvre votre site.', fix: 'Je le passerais sur une adresse sécurisée, pour que les visiteurs ne soient pas repoussés.' },
      notmobile: { subject: '{n} sur un téléphone', problem: 'Votre site est difficile à lire sur un téléphone, là où la plupart des gens vous cherchent.', fix: 'Je le reconstruirais d\'abord pour les téléphones, avec votre numéro et l\'itinéraire à un geste.' },
      freesub: { subject: 'Un nom de domaine à vous pour {n}', problem: 'Votre site est sur une adresse gratuite de créateur de site plutôt que sur votre propre nom de domaine.', fix: 'Je le déplacerais vers votre propre domaine, avec une adresse e-mail assortie.' },
      comingsoon: { subject: "La page d'accueil de {n}", problem: 'Votre site affiche encore « bientôt disponible » : les visiteurs repartent sans vous contacter.', fix: "Je mettrais en ligne une vraie page d'accueil qui explique votre offre et fait venir des demandes." },
      nocontent: { subject: "La page d'accueil de {n}", problem: "Votre page d'accueil contient très peu de choses : les visiteurs ne voient pas ce que vous proposez.", fix: 'J\'ajouterais des pages claires pour vos services, vos prix et vos coordonnées.' },
      down: { subject: 'Le site de {n} ne se chargeait pas', problem: "Votre site ne s'est pas chargé quand j'ai essayé : ceux qui cliquent depuis Google tombent sur une impasse.", fix: 'Je remettrais rapidement un site fonctionnel en ligne, sur un hébergement fiable.' },
    },
    fu1: "Dans mon dernier e-mail, je proposais une courte idée pour {n} : un petit changement, à prix fixe, avec une esquisse d'une page si vous voulez la voir. Répondez simplement OUI et je vous l'envoie.",
    fu2: "Ceci est mon dernier message au sujet de {n}. Si une esquisse d'une page peut vous aider, répondez OUI et je vous l'envoie. Sinon, aucune réponse n'est nécessaire.",
  },
  no: {
    hi: f => (f ? `Hei ${f},` : 'Hei,'),
    looked: ['Jeg tok en titt på nettsiden til {n}.', 'Jeg så på nettsiden til {n}.'],
    timeB2B: 'På 5 til 7 dager, til fast pris.',
    timeLocal: 'Fast pris, ute om omtrent to uker.',
    close: 'Skal jeg sende en kort skisse av dette for {n}? Svar bare JA. Er det ikke noe for dere, si fra.',
    proofText: {
      dlp: 'Jeg bygde om 12 sider for DLP Africa, et telekomselskap i Ghana, med egne skjemaer som måles på hver side.',
      initial: 'Jeg bygde landingssiden for et rådgivningsselskap, og grunnleggeren fikk over 5 nye kunder gjennom den.',
      booked: 'Jeg designet BookedEZ, en bookingapp som betalte ut over $10K til brukerne i løpet av første måned.',
    },
    b2b: {
      book: { subject: 'Et bookingtrinn for {n}', problem: 'På siden jeg så på fant jeg ingen tydelig måte å booke en samtale eller be om tilbud på, så en besøkende som er klar må lete etter veien inn.', fix: 'Jeg ville lagt til en kort henvendelsesside som spør hva de trenger og booker riktig samtale.', proof: 'dlp' },
      price: { subject: 'Priser på nettsiden til {n}', problem: 'På siden jeg så på fant jeg ikke priser eller hva en pakke inneholder, så en kjøper må ta kontakt før de vet hva det koster.', fix: 'Jeg ville lagt til en seksjon med priser og hva som er med, med hovedalternativene først.', proof: 'initial' },
      proof: { subject: 'Kundecaser på nettsiden til {n}', problem: 'På siden jeg så på fant jeg ingen kundecaser eller resultater, så en ny kjøper har ingenting å sjekke dere mot.', fix: 'Jeg ville lagt til kundecaser sortert etter bransje, så en kjøper først ser arbeid som ligner sitt eget.', proof: 'initial' },
      start: { subject: 'En idé for nettsiden til {n}', problem: '', fix: 'Jeg ville lagt til en kort side «hvor skal jeg begynne?»: tre spørsmål, så riktig tjeneste og en bookinglenke.', proof: 'initial' },
    },
    local: {
      nowebsite: { subject: 'En nettside for {n}', problem: 'Google-oppføringen deres har ingen nettside, så de som finner dere der har ingenting å klikke videre til.', fix: 'Jeg ville bygd en enkel, rask side med tjenestene deres, åpningstider og en enkel måte å ringe eller booke på.' },
      newco: { subject: 'En første nettside for {n}', problem: 'Selskapet deres er nytt og har ingen nettside ennå, så de som søker på navnet finner dere ikke.', fix: 'Jeg ville bygd en lanseringsside som sier hva dere gjør og hvordan man når dere.' },
      nohttps: { subject: 'Nettsiden til {n} viser en advarsel', problem: 'Nettlesere viser «Ikke sikker» når noen åpner nettsiden deres.', fix: 'Jeg ville flyttet den til en sikker adresse, så besøkende ikke blir skremt bort.' },
      notmobile: { subject: '{n} på mobil', problem: 'Nettsiden deres er vanskelig å lese på mobil, som er der de fleste slår dere opp.', fix: 'Jeg ville bygd den for mobil først, med nummeret og veibeskrivelsen ett trykk unna.' },
      freesub: { subject: 'Eget domene for {n}', problem: 'Nettsiden deres ligger på en gratis adresse fra et byggeverktøy, ikke på eget domenenavn.', fix: 'Jeg ville flyttet den til eget domene, med en tilhørende e-postadresse.' },
      comingsoon: { subject: 'Forsiden til {n}', problem: 'Nettsiden deres sier fortsatt «kommer snart», så besøkende går uten å ta kontakt.', fix: 'Jeg ville satt opp en ekte forside som forklarer hva dere tilbyr og henter inn henvendelser.' },
      nocontent: { subject: 'Forsiden til {n}', problem: 'Forsiden deres har veldig lite innhold, så besøkende ser ikke hva dere tilbyr.', fix: 'Jeg ville lagt til tydelige sider for tjenester, priser og kontaktinformasjon.' },
      down: { subject: 'Nettsiden til {n} lastet ikke', problem: 'Nettsiden deres lastet ikke da jeg prøvde, så de som klikker seg inn fra Google havner i en blindvei.', fix: 'Jeg ville raskt fått en fungerende side online igjen, på pålitelig hosting.' },
    },
    fu1: 'I forrige e-post foreslo jeg en kort idé for {n}: én liten endring, til fast pris, med en skisse på én side hvis dere vil se den. Svar bare JA, så sender jeg den.',
    fu2: 'Dette er min siste melding om {n}. Hvis en skisse på én side kan hjelpe, svar JA så sender jeg den. Ellers trengs ingen svar.',
  },
};

// The findings the app records in a local lead's description ("Issues found: ...", "no website listed on Google") mapped to a template.
const LOCAL_KEYS: [RegExp, string][] = [
  [/no website listed on Google/i, 'nowebsite'],
  [/no website found for this new company/i, 'newco'],
  [/no HTTPS/i, 'nohttps'],
  [/not mobile-friendly/i, 'notmobile'],
  [/free builder subdomain/i, 'freesub'],
  [/under construction|coming soon/i, 'comingsoon'],
  [/almost no content/i, 'nocontent'],
  [/down or broken/i, 'down'],
];
// Findings that say or imply the site is old ("copyright says 2002", "very old HTML") are never used: the email must not suggest that.

const fill = (s: string, n: string) => s.replace(/\{n\}/g, n);
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const clean = (title: string) => title.replace(/\s+(Pty Ltd|Ltd|Limited|LLC|Inc|GmbH|BV|B\.V\.|AS|SARL|SAS)\.?$/i, '').replace(/\s+[-|–].*$/, '').trim() || title;
const firstName = (l: Lead) => {
  const n = (l.contactName ?? '').trim();
  if (!n || n === l.title || /\b(team|ltd|inc|llc)\b/i.test(n)) return undefined;
  const f = n.split(/\s+/)[0];
  return /^[\p{L}'’-]{2,24}$/u.test(f) ? f : undefined;
};

// What a B2B lead's page text lacks, read from the text the app saved. Only the page text is checked, so a claim is always "on the page I looked at".
function b2bCase(l: Lead): 'book' | 'price' | 'proof' | 'start' {
  const t = l.siteText ?? '';
  if (t.length < 200) return 'start';
  if (!/\b(book|request|schedule|get)\s+(a\s+|your\s+)?(free\s+)?(demo|call|consultation|quote|meeting|appointment)|afspraak|offerte aanvragen|devis|rendez-vous|tilbud/i.test(t)) return 'book';
  if (!/\b(pricing|prices?|price list|packages?|plans?|per month|\/mo\b|from [£$€]\s?\d|tarifs?|prijzen|priser)\b/i.test(t)) return 'price';
  if (!/\b(case stud(y|ies)|testimonials?|success stor(y|ies)|our clients|results|cas clients|klantcases|kundecaser)\b/i.test(t)) return 'proof';
  return 'start';
}

export function templateSupported(l: Lead): boolean {
  if (l.contactLinks?.segment === 'baton') return !!l.contactEmail;
  return !!l.contactEmail && !isJobLead(l) && l.source !== 'website' && l.source !== 'visitor' && l.source !== 'remote' && SUPPORTED.includes(leadLanguage(l) as L4);
}

// A first email with no AI, or null when the app does not know enough to say something true (then the lead waits for a real draft).
export function templateDraft(l: Lead): string | null {
  if (!templateSupported(l)) return null;
  if (l.contactLinks?.segment === 'baton') return batonDraft(l);
  const lang = leadLanguage(l) as L4;
  const P = PACKS[lang];
  const name = clean(l.title);
  const seed = hash(l.id);
  const opener = fill(P.looked[seed % P.looked.length], name);
  const hi = P.hi(firstName(l));

  if (isB2B(l)) {
    const c = P.b2b[b2bCase(l)];
    const body = [
      c.problem ? `${opener} ${c.problem}` : opener,
      `${c.fix} ${P.timeB2B}`,
      P.proofText[c.proof],
      fill(P.close, name),
    ];
    return `Subject: ${fill(c.subject, name)}\n\n${hi}\n\n${body.join('\n\n')}\n\nSamuel\nadefilasamuel.com`;
  }

  // A local business or a new company: needs a recorded finding to point at.
  const key = LOCAL_KEYS.find(([re]) => re.test(l.description))?.[1];
  if (!key) return null;
  const c = P.local[key];
  const body = [
    `${c.problem}`,
    `${c.fix} ${P.timeLocal}`,
    P.proofText.booked,
    fill(P.close, name),
  ];
  return `Subject: ${fill(c.subject, name)}\n\n${hi}\n\n${body.join('\n\n')}\n\nSamuel\nadefilasamuel.com`;
}

// A follow-up with no AI: the short reminder (number 1) or the last note (number 2), in the lead's language.
export function templateFollowUp(l: Lead, number: number): string | null {
  if (l.contactLinks?.segment === 'baton') return batonFollowUp(l, number);
  const lang = leadLanguage(l);
  if (!SUPPORTED.includes(lang as L4)) return null;
  const P = PACKS[lang as L4];
  const first = (l.proposal ?? '').split('\n').find((x, i) => i > 0 && x.trim() && !/^subject:/i.test(x.trim()))?.trim();
  const hi = first && first.length < 60 && first.endsWith(',') ? first : P.hi(firstName(l));
  const body = fill(number >= 2 ? P.fu2 : P.fu1, clean(l.title));
  return `${hi}\n\n${body}\n\nSamuel`;
}

// ─── Baton: a pitch to developers and agencies who build client sites ────────────────────────────────────────────────
// Baton (batonedit.com) gives a client a link where they edit the text, images and links of the live site themselves, with draft,
// publish and one-click rollback, so small edits stop coming back to the developer as tickets. These leads come from GitHub profiles
// (see /api/baton-import); only what the profile shows is claimed (the stack they build in), and the email is signed for Baton.
const BATON_SIGN = '\n\nSamuel\nbatonedit.com';

const batonStack = (l: Lead): string => {
  const s = (l.description.match(/Builds with: (.+?)\.(?:\s|$)/)?.[1] ?? '').split(/,\s*/).map(x => x.trim()).filter(Boolean);
  return s.length ? s.slice(0, 2).join(' and ') : '';
};
// An organisation (no personal name on the lead) is written to as a team; a person is written to as "you".
const batonIsAgency = (l: Lead) => !l.contactName;

export function batonDraft(l: Lead): string {
  const n = clean(l.title);
  const first = l.contactName ? l.contactName.split(" ")[0] : firstName(l);
  const hi = first ? `Hi ${first},` : 'Hi there,';
  const stack = batonStack(l);
  const seed = hash(l.id);
  const agency = batonIsAgency(l);
  const hooks = [
    stack ? `Building client sites in ${stack}? Then you know the tiny edit requests that follow every launch.` : 'You know the tiny edit requests that follow every client launch.',
    'Every launch ends the same way: the client wants one heading, one photo or one phone number changed.',
    "The build is the easy part. It's the stream of small text and image changes after launch that eats the week.",
  ];
  const why = 'Baton lets your client edit the words, photos and links on the live site themselves. Nothing goes live until they publish, and any change can be undone.';
  const benefit = 'You get fewer edit requests, and if your client picks a paid plan you earn 30% of what they pay for 12 months.';
  const subjects = agency
    ? [`Fewer edit requests at ${n}`, 'Let your clients edit their own sites']
    : ['Let your clients edit their own sites', 'Fewer edit requests after launch'];
  const body = [hooks[seed % hooks.length], why, benefit, `See how Baton works: ${BATON_PARTNER_URL}`, 'Not for you? Just say so.'].join('\n\n');
  return `Subject: ${subjects[(seed >> 5) % subjects.length]}\n\n${hi}\n\n${body}${BATON_SIGN}`;
}

export function batonFollowUp(l: Lead, number: number): string {
  const first = l.contactName ? l.contactName.split(" ")[0] : firstName(l);
  const hi = first ? `Hi ${first},` : 'Hi there,';
  const body = number >= 2
    ? "Last note from me. If client edits ever become a drag on your time, Baton (batonedit.com) is there. Reply any time and I'll set up a test link."
    : `Just checking my note didn't get buried. Handing a site to a client on Baton is free, and you earn 30% of what they pay for 12 months if they pick a paid plan: ${BATON_PARTNER_URL}`;
  return `${hi}\n\n${body}\n\nSamuel\nbatonedit.com`;
}
