'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Check, Bookmark } from 'lucide-react';

type Mark = 'saved' | 'done';
type Spot = { id: string; name: string; kind: string; why: string; tip: string; url: string; checked: boolean };

const KEY = 'lf-launch-marks';

const LAUNCH: Spot[] = [
  { id: 'showhn', name: 'Show HN', kind: 'Hacker News', why: 'Developers and agencies read it, which is who Baton is for.', tip: 'Post a working demo link and a plain description. Expect hard questions and answer fast.', url: 'https://news.ycombinator.com/showhn.html', checked: true },
  { id: 'ph', name: 'Product Hunt', kind: 'Launch day', why: 'Broad launch-day exposure and a developer tools category.', tip: 'Needs a demo video and a real launch plan. A bare listing gets little.', url: 'https://www.producthunt.com/', checked: true },
  { id: 'ih', name: 'Indie Hackers', kind: 'Community', why: 'Founders trade feedback on positioning before a launch.', tip: 'Post before you launch and ask what is unclear.', url: 'https://www.indiehackers.com/', checked: true },
  { id: 'devhunt', name: 'DevHunt', kind: 'Launch board for dev tools', why: 'A weekly launch board only for developer tools, voted on by developers who sign in with GitHub or Google.', tip: 'Reported as free. Confirm the current terms on the site.', url: 'https://devhunt.org/', checked: true },
  { id: 'peerlist', name: 'Peerlist Launchpad', kind: 'Launch board', why: 'Reported as free to launch with a verified personal profile. Paid featured launches start at $29.', tip: 'Use the free launch only and skip the paid featured slot. Fill in your profile first.', url: 'https://peerlist.io/launchpad', checked: true },
];

const PITCH: Spot[] = [
  { id: 'framerexperts', name: 'Framer Experts directory', kind: 'Freelancers and agencies', why: 'Framer lists freelancers and agencies that build client sites in Framer. Handover to a client is exactly their problem.', tip: 'Free to browse. Pick ones with several client sites, email them, and ask them to try Baton on one site and tell you what breaks.', url: 'https://www.framer.com/community/experts/', checked: false },
  { id: 'clutch', name: 'Clutch web developer directory', kind: 'Agencies that build custom sites', why: 'Agencies that build custom sites for clients, with their size, clients and a link to their own site.', tip: 'Free to browse. Look for small agencies, find the owner on their own site, and offer them a free trial on one client project.', url: 'https://clutch.co/web-developers', checked: false },
  { id: 'rframer', name: 'r/Framer', kind: 'Reddit, Framer builders', why: 'People who build client sites in Framer, often asking how to let clients edit them.', tip: 'Answer a real question first. Mention Baton only where it solves what they asked, and read the rules on promotion.', url: 'https://www.reddit.com/r/Framer/', checked: false },
  { id: 'rwebflow', name: 'r/webflow', kind: 'Reddit, Webflow builders', why: 'Webflow freelancers and agencies, who deal with client editing all the time.', tip: 'Same approach as r/Framer: help first, mention Baton where it fits. Read the rules first.', url: 'https://www.reddit.com/r/webflow/', checked: false },
  { id: 'rnocode', name: 'r/nocode', kind: 'Reddit, no-code builders', why: 'People who build sites and apps without much code, and the agencies that sell that work.', tip: 'Read the rules on promotion before you post anything.', url: 'https://www.reddit.com/r/nocode/', checked: false },
  { id: 'cursorforum', name: 'Cursor forum', kind: 'Developers who build with AI', why: 'Developers building client sites with AI tools. A site built with AI still needs a way for the client to edit it.', tip: 'Free to join. Ask a question or share a lesson before you mention Baton.', url: 'https://forum.cursor.com/', checked: false },
  { id: 'linkedinagency', name: 'LinkedIn, agency owners', kind: 'Direct outreach', why: 'Owners of small web and design agencies, found by searching, who can say yes without a committee.', tip: 'Searching and a connection request with a short note are free. Offer a free trial on one client site, not a pitch.', url: 'https://www.linkedin.com/search/results/people/?keywords=web%20agency%20founder', checked: false },
  { id: 'webflowexperts', name: 'Webflow Experts directory', kind: 'Freelancers and agencies', why: 'Agencies and freelancers that build client sites in Webflow, and who face the client-editing question.', tip: 'Free to browse. Pick ones with several client sites and offer a free trial on one.', url: 'https://webflow.com/experts', checked: false },
  { id: 'framermarket', name: 'Framer Marketplace creators', kind: 'Template makers and designers', why: 'People who design and sell Framer templates build for clients too.', tip: 'Free to browse. Contact a few with a short note about how Baton hands a site over to a client.', url: 'https://www.framer.com/marketplace/', checked: false },
  { id: 'designrush', name: 'DesignRush web development agencies', kind: 'Agencies that build custom sites', why: 'A directory of web design and development agencies.', tip: 'Free to browse. Find the owner on the agency\'s own site, and avoid the directory\'s paid features.', url: 'https://www.designrush.com/agency/web-development', checked: false },
  { id: 'sortlist', name: 'Sortlist', kind: 'Agency directory', why: 'A directory of agencies across many countries, with their work and size.', tip: 'Free to browse. Contact small agencies directly through their own sites.', url: 'https://www.sortlist.com/', checked: false },
  { id: 'goodfirms', name: 'GoodFirms', kind: 'Agency directory', why: 'Another directory of web and software agencies.', tip: 'Free to browse. Look for small agencies and reach the owner on their own site.', url: 'https://www.goodfirms.co/', checked: false },
  { id: 'contra', name: 'Contra', kind: 'Independent freelancers', why: 'A network of independent designers and developers who show their client work.', tip: 'Free to join and browse. Pick people who build sites for clients and send a short note.', url: 'https://contra.com/', checked: false },
  { id: 'rfreelance', name: 'r/freelance', kind: 'Reddit, freelancers', why: 'Freelancers talk about client handover and billing problems.', tip: 'Help with a real question first. Read the rules on promotion before you mention Baton.', url: 'https://www.reddit.com/r/freelance/', checked: false },
  { id: 'xclientedit', name: 'X search: clients editing sites', kind: 'Direct outreach', why: 'People post when a client wants to change their own site, which is exactly the problem Baton solves.', tip: 'Free. Reply with something useful and only mention Baton if it fits.', url: 'https://x.com/search?q=client%20%22edit%20the%20website%22&f=live', checked: false },
  { id: 'redditclientedit', name: 'Reddit search: client edits', kind: 'Direct outreach', why: 'Developers ask how to let a client change text without breaking the site.', tip: 'Free. Answer the question properly, then mention Baton only where it fits.', url: 'https://www.reddit.com/search/?q=client%20edit%20website%20without%20developer', checked: false },
  { id: 'lovableusers', name: 'X search: sites built with AI for clients', kind: 'Direct outreach', why: 'People who build client sites with AI tools often struggle to hand them over.', tip: 'Free. Find a few and offer to try Baton on one real site.', url: 'https://x.com/search?q=lovable%20OR%20bolt%20OR%20v0%20%22client%20site%22&f=live', checked: false },
  { id: 'linkedinfreelance', name: 'LinkedIn, freelance web developers', kind: 'Direct outreach', why: 'Freelancers who build sites for clients and can say yes alone.', tip: 'Searching and a short connection note are free. Offer a free trial on one client site.', url: 'https://www.linkedin.com/search/results/people/?keywords=freelance%20web%20developer', checked: false },
];

const SHOUT: Spot[] = [
  { id: 'hnworking', name: 'Ask HN: What are you working on?', kind: 'Hacker News thread', why: 'A monthly thread where people post what they are building, and one comment is enough.', tip: 'Free. Find the current month\'s thread with the link, then add one plain comment with what Baton does and the link.', url: 'https://hn.algolia.com/?dateRange=pastMonth&query=%22what%20are%20you%20working%20on%22&sort=byDate&type=story', checked: false },
  { id: 'ihworking', name: 'Indie Hackers: what are you working on', kind: 'Community thread', why: 'Founders post what they are working on in recurring threads and reply to each other.', tip: 'Free. Find the latest "What are you working on" thread on the site and leave a comment.', url: 'https://www.indiehackers.com/', checked: false },
  { id: 'showoffsat', name: 'r/webdev Showoff Saturday', kind: 'Reddit weekly thread', why: 'Developers share what they made in a weekly thread.', tip: 'Free. Post only in the weekly thread. Sources disagree on whether commercial tools are allowed, so read the sidebar first.', url: 'https://www.reddit.com/r/webdev/', checked: false },
  { id: 'rstartups', name: 'r/startups share thread', kind: 'Reddit thread', why: 'A thread for founders to share what they are building.', tip: 'Free. New accounts may be blocked, so check the rules and the age and karma limits first.', url: 'https://www.reddit.com/r/startups/', checked: false },
  { id: 'buildinpublic', name: '#buildinpublic on X', kind: 'Social, replies', why: 'Founders reply to each other\'s updates under the tag, and a useful reply gets noticed.', tip: 'Free. Reply to builders with something helpful, and post your own short update with a clip of the editor.', url: 'https://x.com/search?q=%23buildinpublic&f=live', checked: false },
  { id: 'rindiehackers', name: 'r/indiehackers', kind: 'Reddit community', why: 'Founders share what they are building and the lessons from it.', tip: 'Free. Share a build story, not an advert, and read the rules first.', url: 'https://www.reddit.com/r/indiehackers/', checked: false },
  { id: 'rmicrosaas', name: 'r/microsaas', kind: 'Reddit community', why: 'People building small software products compare notes.', tip: 'Free. Read the rules on self-promotion before you post.', url: 'https://www.reddit.com/r/microsaas/', checked: false },
  { id: 'rentride', name: 'r/EntrepreneurRideAlong', kind: 'Reddit community', why: 'Founders post updates on their journey.', tip: 'Free. A weekly update with real numbers works better than a link.', url: 'https://www.reddit.com/r/EntrepreneurRideAlong/', checked: false },
  { id: 'rwebdesign', name: 'r/web_design', kind: 'Reddit community', why: 'Designers who build sites for clients.', tip: 'Free. Read the rules on promotion first.', url: 'https://www.reddit.com/r/web_design/', checked: false },
  { id: 'rreactjs', name: 'r/reactjs', kind: 'Reddit community', why: 'A large React community with a regular thread for sharing projects.', tip: 'Free. Use the project-sharing thread only, and read the rules.', url: 'https://www.reddit.com/r/reactjs/', checked: false },
  { id: 'rnextjs', name: 'r/nextjs', kind: 'Reddit community', why: 'Next.js developers share what they built.', tip: 'Free. Read the rules on self-promotion and post a showcase if it is allowed.', url: 'https://www.reddit.com/r/nextjs/', checked: false },
  { id: 'ralpha', name: 'r/alphaandbetausers', kind: 'Reddit community', why: 'A place to ask people to test an early product.', tip: 'Free. Ask for testers, and say clearly what feedback you want.', url: 'https://www.reddit.com/r/alphaandbetausers/', checked: false },
  { id: 'phdiscuss', name: 'Product Hunt discussions', kind: 'Community threads', why: 'Product Hunt has a discussion area where makers ask and answer questions.', tip: 'Free. Ask a real question about editing client sites, and answer others\' questions.', url: 'https://www.producthunt.com/discussions', checked: false },
  { id: 'linkedinpost', name: 'LinkedIn post', kind: 'Social post', why: 'Agency owners and freelancers read LinkedIn, and a short clip of the editor travels well there.', tip: 'Free. Show the editor changing a real page, with one line on who it is for.', url: 'https://www.linkedin.com/feed/', checked: false },
  { id: 'bluesky', name: 'Bluesky', kind: 'Social post', why: 'A growing developer audience that likes build-in-public updates.', tip: 'Free. Post a short clip and use the same message as on X.', url: 'https://bsky.app/', checked: false },
  { id: 'mastodon', name: 'Mastodon #buildinpublic', kind: 'Social post', why: 'Developers and indie makers post under the tag.', tip: 'Free. Join a large server and post a short update with the tag.', url: 'https://mastodon.social/', checked: false },
  { id: 'threads', name: 'Threads', kind: 'Social post', why: 'A large audience for short posts and screenshots.', tip: 'Free. Repost your best short clip.', url: 'https://www.threads.net/', checked: false },
  { id: 'youtube', name: 'YouTube demo', kind: 'Video', why: 'A short demo video keeps bringing people in through search.', tip: 'Free. Title it for the problem, such as letting a client edit their website without a developer.', url: 'https://www.youtube.com/', checked: false },
];

const DIRS: Spot[] = [
  { id: 'crunchbase', name: 'Crunchbase profile', kind: 'Company directory', why: 'Investors and journalists look companies up here, and a basic profile is free.', tip: 'Add a one-line description, the site, the founder and a logo. Skip anything paid.', url: 'https://www.crunchbase.com/', checked: false },
  { id: 'wellfound', name: 'Wellfound startup profile', kind: 'Startup network', why: 'A startup directory and jobs network. A company profile is free to create.', tip: 'Fill in the profile and the product page. Skip paid recruiting plans.', url: 'https://wellfound.com/', checked: false },
  { id: 'f6s', name: 'F6S', kind: 'Startup network and programmes', why: 'A free startup profile, and a long list of programmes and perks that you can apply to from the same account.', tip: 'Make the profile first, then look through the programmes for free ones.', url: 'https://www.f6s.com/', checked: false },
  { id: 'g2', name: 'G2 vendor profile', kind: 'Software reviews', why: 'People shop for software here, and a basic vendor listing is free.', tip: 'Claim the free listing only. Ask your first users for honest reviews, and skip the paid plans.', url: 'https://sell.g2.com/', checked: false },
  { id: 'capterra', name: 'Capterra vendor listing', kind: 'Software directory', why: 'A large directory where buyers compare software. A basic listing is free.', tip: 'Free listing only. The site also sells paid lead plans, which you do not need.', url: 'https://www.capterra.com/vendors/', checked: false },
  { id: 'betapage', name: 'BetaPage', kind: 'Directory for early products', why: 'A directory that lists new startups for early users.', tip: 'Free listing only. Check what the free submission includes before you start.', url: 'https://betapage.co/', checked: false },
  { id: 'launchingnext', name: 'Launching Next', kind: 'Directory for new startups', why: 'A long-running list of new startups, with a free submission.', tip: 'Free submission only. Have a clear one-line description ready.', url: 'https://www.launchingnext.com/', checked: false },
  { id: 'ihproducts', name: 'Indie Hackers product page', kind: 'Product directory', why: 'Indie Hackers lets you add your product, with revenue and story, where founders will see it.', tip: 'Free. Add the product after you have posted in the community, so the page has a story.', url: 'https://www.indiehackers.com/products', checked: false },
  { id: 'startupstash', name: 'Startup Stash', kind: 'Resource directory', why: 'A curated directory of tools and resources for startups.', tip: 'Look for the suggest-a-tool link. Free to suggest, and they decide what to list.', url: 'https://startupstash.com/', checked: false },
  { id: 'awesomelists', name: 'Awesome lists on GitHub', kind: 'Curated lists', why: 'Developers use these lists to find tools. There are lists for headless CMS, no-code and website tools.', tip: 'Free. Search the list that fits, read its contribution rules, then open a pull request that follows them.', url: 'https://github.com/sindresorhus/awesome', checked: false },
];

const NEWS: Spot[] = [
  { id: 'changelognews', name: 'Changelog News', kind: 'Developer newsletter', why: 'A developer news site and podcast that accepts submitted links.', tip: 'Free. Use the submit link on the news page. It is a good place for a technical write-up, not a pitch.', url: 'https://changelog.com/news', checked: false },
  { id: 'consoledev', name: 'Console', kind: 'Developer tools newsletter', why: 'A weekly newsletter about developer tools, read by the people who choose them.', tip: 'Look for how they take tool suggestions. It is free to suggest, and they decide what to feature.', url: 'https://console.dev/', checked: false },
  { id: 'webtoolsweekly', name: 'Web Tools Weekly', kind: 'Newsletter for front-end tools', why: 'A weekly newsletter of tools for web developers.', tip: 'Look for the submission or contact link. Free to suggest.', url: 'https://webtoolsweekly.com/', checked: false },
  { id: 'jsweekly', name: 'JavaScript Weekly', kind: 'Developer newsletter', why: 'A large weekly JavaScript newsletter. Its team picks links from what people send.', tip: 'Free to suggest a link. Send a technical post about how Baton works, not an advert.', url: 'https://javascriptweekly.com/', checked: false },
  { id: 'frontendfocus', name: 'Frontend Focus', kind: 'Newsletter for web developers', why: 'A weekly newsletter on web design and front-end work, from the same team as JavaScript Weekly.', tip: 'Free to suggest a link. Send something useful to readers, such as a write-up or a demo.', url: 'https://frontendfoc.us/', checked: false },
  { id: 'hackernewsletter', name: 'Hacker Newsletter', kind: 'Weekly digest', why: 'A weekly email of the best Hacker News posts.', tip: 'You cannot submit to it. The way in is a strong Show HN post, so do that first.', url: 'https://hackernewsletter.com/', checked: false },
];

const CREDITS: Spot[] = [
  { id: 'mshub', name: 'Microsoft for Startups Founders Hub', kind: 'Free credits', why: 'Cloud credits and tools for startups, with no equity taken.', tip: 'Free to apply. Check the current credit amounts and rules.', url: 'https://www.microsoft.com/en-us/startups', checked: false },
  { id: 'awsactivate', name: 'AWS Activate', kind: 'Free credits', why: 'Credits for startups on Amazon Web Services.', tip: 'Free to apply. Check the current rules and what a startup needs to qualify.', url: 'https://aws.amazon.com/startups/credits', checked: false },
  { id: 'gcpstartups', name: 'Google Cloud for Startups', kind: 'Free credits', why: 'Cloud credits and support for early startups.', tip: 'Free to apply. Check the current rules and the tier that fits.', url: 'https://cloud.google.com/startup', checked: false },
  { id: 'cfstartups', name: 'Cloudflare for Startups', kind: 'Free credits', why: 'Credits and tools for startups building on Cloudflare.', tip: 'Free to apply. Check the current rules and credit amounts.', url: 'https://www.cloudflare.com/forstartups/', checked: false },
];

const POST: Spot[] = [
  { id: 'betalist', name: 'BetaList', kind: 'Directory for early products', why: 'Reported as a free place to list a product before launch and collect early sign-ups.', tip: 'Use the free submission only. It is slower, and the paid fast lane is not needed.', url: 'https://betalist.com/', checked: true },
  { id: 'saashub', name: 'SaaSHub', kind: 'Software directory', why: 'A software directory where people compare alternatives. Reported as slow but steady for organic leads.', tip: 'Use the free listing only. List Baton against the tools clients use now, such as page builders with editors.', url: 'https://www.saashub.com/', checked: true },
  { id: 'microlaunch', name: 'Microlaunch', kind: 'Launch board for small products', why: 'Reported as a free launch board aimed at indie and micro-SaaS products.', tip: 'Not checked in detail. Read the current rules before you submit.', url: 'https://microlaunch.net/', checked: false },
  { id: 'stackshare', name: 'StackShare', kind: 'Developer tool directory', why: 'Developers look here to see which tools teams use.', tip: 'Add Baton as a tool and list the stack it sits on.', url: 'https://stackshare.io/', checked: false },
  { id: 'altto', name: 'AlternativeTo', kind: 'Software directory', why: 'People searching for an alternative to a tool find it here.', tip: 'Pick the closest tools, and word the listing around what clients can edit without a developer.', url: 'https://alternativeto.net/', checked: false },
  { id: 'sideproject', name: 'r/SideProject', kind: 'Reddit community', why: 'People share what they built and give direct feedback.', tip: 'Read the subreddit rules first. Show what it does, do not just link it.', url: 'https://www.reddit.com/r/SideProject/', checked: false },
  { id: 'saasreddit', name: 'r/SaaS', kind: 'Reddit community', why: 'Founders compare notes on pricing, launches and early customers.', tip: 'Read the rules on self-promotion before you post.', url: 'https://www.reddit.com/r/SaaS/', checked: false },
  { id: 'devto', name: 'DEV Community', kind: 'Write-up', why: 'Developers read build stories here, and agencies are among them.', tip: 'Write how Baton works under the hood, not a sales post. Link to the site at the end.', url: 'https://dev.to/', checked: false },
  { id: 'hashnode', name: 'Hashnode', kind: 'Write-up', why: 'Another developer blogging platform with its own audience.', tip: 'Post the same story as DEV with a different opening, so the two do not read as copies.', url: 'https://hashnode.com/', checked: false },
  { id: 'quora', name: 'Quora', kind: 'Q&A', why: 'People ask how a client can edit their site without a developer, and good answers keep getting traffic.', tip: 'Free. Answer the question properly and mention Baton at the end where it fits.', url: 'https://www.quora.com/', checked: false },
  { id: 'medium', name: 'Medium', kind: 'Write-up', why: 'Publications on Medium accept writing from anyone, and posts are found through search.', tip: 'Free. Write how you built Baton\'s editor, and link to the site at the end.', url: 'https://medium.com/', checked: false },
  { id: 'dribbble', name: 'Dribbble', kind: 'Design showcase', why: 'Designers see the editor\'s interface here.', tip: 'Free. Post a clean shot of the editor with a short note.', url: 'https://dribbble.com/', checked: false },
  { id: 'behance', name: 'Behance', kind: 'Design showcase', why: 'A design showcase with a different audience from Dribbble.', tip: 'Free. Post a short case study of the editor design.', url: 'https://www.behance.net/', checked: false },
  { id: 'nextdiscuss', name: 'Next.js discussions on GitHub', kind: 'Developer community', why: 'Next.js developers share what they built in the Show and tell area.', tip: 'Free. Share a short technical note on how Baton works with Next.js sites.', url: 'https://github.com/vercel/next.js/discussions', checked: false },
  { id: 'vercelcomm', name: 'Vercel community', kind: 'Developer community', why: 'People who deploy sites on Vercel ask for tools and share their own.', tip: 'Free. Help with a question first, then share Baton where it fits.', url: 'https://community.vercel.com/', checked: false },
  { id: 'framercomm', name: 'Framer community', kind: 'Developer community', why: 'Framer builders and agencies, who hand sites to clients.', tip: 'Free. Read the rules, then share how Baton helps with client editing.', url: 'https://www.framer.community/', checked: false },
];

const EVENTS: Spot[] = [
  { id: 'devpost', name: 'Devpost hackathons', kind: 'Hackathon listings, free to enter', why: 'The main place to find online hackathons you can enter alone or with a team.', tip: 'Filter for online and for open dates. Judges and sponsors see your project page.', url: 'https://devpost.com/hackathons', checked: true },
  { id: 'devweek', name: 'DeveloperWeek 2027 Hackathon', kind: 'Online hackathon', why: 'Reported as online from 25 January to 11 February 2027, with awards in Santa Clara.', tip: 'You must register on Devpost before it starts. Check the challenges to see if Baton fits one.', url: 'https://developerweek-2027-hackathon.devpost.com/', checked: true },
  { id: 'lablab', name: 'lablab.ai', kind: 'AI hackathons', why: 'Runs online AI hackathons with sponsor credits. Useful if you add an AI feature to Baton.', tip: 'Not checked. Confirm each hackathon is free to enter before you join.', url: 'https://lablab.ai/', checked: false },
  { id: 'devchallenges', name: 'DEV Community challenges', kind: 'Online challenges', why: 'DEV runs regular build challenges with prizes. A challenge post also reaches its readers.', tip: 'Free to enter. Check the rules of each one, and pick one where Baton fits.', url: 'https://dev.to/challenges', checked: false },
  { id: 'hackathoncom', name: 'Hackathon.com', kind: 'Hackathon listings', why: 'A listing of hackathons around the world, online and in person.', tip: 'Free to browse. Check each hackathon is free to enter.', url: 'https://www.hackathon.com/', checked: false },
  { id: 'luma', name: 'Luma tech events', kind: 'Free events', why: 'Free tech and startup events, including in Lagos and other African cities.', tip: 'Free. Search for your city and go to one where founders meet.', url: 'https://lu.ma/', checked: false },
  { id: 'meetup', name: 'Meetup groups', kind: 'Free events', why: 'Local groups for Next.js, Framer, Webflow and startup founders.', tip: 'Free to join. Pick groups with developers or agencies and talk about the problem, not the product.', url: 'https://www.meetup.com/', checked: false },
  { id: 'gdg', name: 'Google Developer Groups', kind: 'Community events', why: 'Free local developer meetups, including in Nigeria.', tip: 'Free. Find your nearest chapter, and offer a short demo talk.', url: 'https://gdg.community.dev/', checked: false },
  { id: 'startupgrind', name: 'Startup Grind chapters', kind: 'Founder events', why: 'Founders meet at local events, many of them free.', tip: 'Free to join. Check your city\'s chapter for upcoming events.', url: 'https://www.startupgrind.com/', checked: false },
];

const INVEST: Spot[] = [
  { id: 'swg', name: 'Startup Wise Guys', kind: 'Accelerator, Africa', why: 'B2B SaaS programme for East and West Africa.', tip: 'Wants a strong team and early traction, so launch first.', url: 'https://startupwiseguys.com/location/africa/', checked: true },
  { id: 'yc', name: 'Y Combinator', kind: 'Accelerator', why: 'Biggest name for developer tools, and solo founders can apply.', tip: 'Current batch dates not checked. Traction from a launch helps.', url: 'https://www.ycombinator.com/apply', checked: false },
  { id: 'antler', name: 'Antler', kind: 'Accelerator', why: 'Invests at the earliest stage and has an Africa presence.', tip: 'Current programme and location not checked.', url: 'https://www.antler.co/', checked: false },
  { id: 'techstars', name: 'Techstars', kind: 'Accelerator', why: 'Programmes by region and theme.', tip: 'Current programmes not checked.', url: 'https://www.techstars.com/', checked: false },
  { id: 'tinyseed', name: 'TinySeed', kind: 'Fund for bootstrapped SaaS', why: 'Backs small SaaS companies that stay independent, which suits a solo founder.', tip: 'It just raised a fourth fund. Application terms not checked.', url: 'https://tinyseed.com/', checked: false },
  { id: 'ng350', name: 'Nigeria $350,000 programme', kind: 'Funding, Nigeria', why: 'A funding programme for early-stage tech startups in Nigeria.', tip: 'Dates and whether software products qualify not checked.', url: 'https://www.techinafrica.com/nigeria-opens-350000-funding-programme-for-early-stage-tech-startups/', checked: false },
  { id: 'seedinvest', name: 'SEEDINVEST 2026', kind: 'Accelerator, Nigeria', why: 'Grants, training, mentorship and investor readiness for young Nigerian entrepreneurs.', tip: 'Reported as open for 2026. Deadline and whether SaaS qualifies not checked.', url: 'https://www.wearetech.africa/en/fils-uk/brief/brief-one/nigeria-s-seedinvest-accelerator-opens-applications-for-2026-cohort', checked: false },
  { id: 'ffvs', name: 'Fast Forward Venture Studio', kind: 'Pre-seed accelerator', why: 'Listed as offering up to $25,000 in equity-free funding at pre-seed.', tip: 'Listing is from an aggregator and has no dates. Check the programme itself.', url: 'https://incubatorlist.com/top-startup-accelerators-incubators-and-vcs-in-nigeria', checked: false },
  { id: 'freshmango', name: 'Freshmango', kind: 'Remote pre-seed accelerator', why: 'Fully remote, for founders with an idea or a minimal product.', tip: 'No 2026 window found. Check the programme itself.', url: 'https://techbuild.africa/freshmango-accelerator-remote-stage-founders/', checked: false },
  { id: 'tef', name: 'Tony Elumelu Foundation Entrepreneurship Programme', kind: 'Funding, Africa', why: 'A yearly programme for African entrepreneurs, with training, mentoring and seed funding.', tip: 'Free to apply. Check the current call, the amount and who qualifies.', url: 'https://www.tefconnect.com/', checked: false },
  { id: 'gfsafrica', name: 'Google for Startups Accelerator', kind: 'Accelerator, no equity', why: 'Google runs accelerators for startups in several regions, and takes no equity.', tip: 'Free to apply. Check which regions are open and whether software tools qualify.', url: 'https://startup.google.com/accelerator/', checked: false },
  { id: 'seedcamp', name: 'Seedcamp', kind: 'Pre-seed fund', why: 'A European pre-seed fund that backs founders early.', tip: 'Free to apply. Terms and equity are in the offer, so read them.', url: 'https://seedcamp.com/', checked: false },
  { id: 'ef', name: 'Entrepreneur First', kind: 'Talent investor', why: 'Backs people before they have a company, and solo founders can apply.', tip: 'Free to apply. Check the current programme and locations.', url: 'https://www.joinef.com/', checked: false },
  { id: 'spc', name: 'South Park Commons', kind: 'Founder community and fund', why: 'A community and fund for early founders, including those still finding the idea.', tip: 'Free to apply. Check the current programme.', url: 'https://www.southparkcommons.com/', checked: false },
  { id: 'pioneer', name: 'Pioneer', kind: 'Online tournament for founders', why: 'An online programme where founders compete to win funding and support.', tip: 'Free to apply. Check the current terms and equity.', url: 'https://pioneer.app/', checked: false },
  { id: 'venturesplatform', name: 'Ventures Platform', kind: 'Pre-seed fund, Lagos', why: 'A pre-seed investor in West African startups.', tip: 'Free to pitch. Check what stage and sectors it backs now.', url: 'https://ventures-platform.com/', checked: false },
  { id: 'hustle', name: 'Hustle Fund', kind: 'Pre-seed fund', why: 'A pre-seed fund that invests in many small bets.', tip: 'Free to pitch. Read how it takes submissions.', url: 'https://www.hustlefund.vc/', checked: false },
  { id: 'seedstars', name: 'Seedstars', kind: 'Startup programmes', why: 'Runs programmes and competitions for startups in emerging markets, including Africa.', tip: 'Free to apply. Check current calls for Nigeria.', url: 'https://www.seedstars.com/', checked: false },
  { id: 'africaprize', name: 'Africa Prize for Engineering Innovation', kind: 'Prize and support', why: 'A prize and training for engineering innovations from Africa.', tip: 'Free to apply. Check whether a software tool qualifies and the current call.', url: 'https://www.raeng.org.uk/africaprize', checked: false },
  { id: 'emergent', name: 'Emergent Ventures', kind: 'Grants', why: 'Fast grants for people with promising ideas, including solo founders.', tip: 'Free to apply. Check the current rules.', url: 'https://www.mercatus.org/emergent-ventures', checked: false },
];

const CSS = `
  .bl { padding: 20px 20px 8px; }
  .bl-start { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; margin-bottom: 28px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
  .bl-start b { display: block; font-size: 14px; color: var(--fg); margin-bottom: 2px; }
  .bl-start span { font-size: 13px; color: var(--fg-3); line-height: 1.5; }
  .bl-sec { margin-bottom: 32px; }
  .bl-sec h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; color: var(--fg); }
  .bl-sec > p { margin: 0 0 14px; font-size: 13px; color: var(--fg-3); }
  .bl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  @media (max-width: 1000px) { .bl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .bl-card { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); min-width: 0; }
  .bl-card.done { opacity: 0.55; }
  .bl-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .bl-name { margin: 0; font-size: 15px; font-weight: 600; color: var(--fg); line-height: 1.3; }
  .bl-kind { margin-top: 2px; font-size: 12px; color: var(--fg-3); }
  .bl-pill { flex-shrink: 0; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); font-size: 11px; color: var(--fg-2); background: var(--surface-2); white-space: nowrap; }
  .bl-pill.warn { color: var(--fg-3); }
  .bl-block { display: grid; gap: 2px; }
  .bl-label { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fg-3); }
  .bl-text { margin: 0; font-size: 13px; line-height: 1.55; color: var(--fg-2); }
  .bl-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; padding-top: 4px; }
  .bl-empty { margin: 0 !important; font-size: 13px; color: var(--fg-3); }
  .bl-foot { margin: 0; padding: 4px 0 20px; font-size: 12px; color: var(--fg-3); }
  @media (max-width: 720px) { .bl { padding: 16px 12px 4px; } .bl-start { flex-direction: column; align-items: flex-start; } .bl-grid { grid-template-columns: minmax(0, 1fr); } }
`;

function load(): Record<string, Mark> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Mark>; } catch { return {}; }
}

// Where to put Baton in front of people: launch venues first, investors and accelerators second.
export function Launch() {
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [showDone, setShowDone] = useState(false);
  useEffect(() => { setMarks(load()); }, []);
  const doneCount = [...LAUNCH, ...PITCH, ...SHOUT, ...DIRS, ...NEWS, ...POST, ...EVENTS, ...CREDITS, ...INVEST].filter(s => marks[s.id] === 'done').length;
  const visible = (list: Spot[]) => showDone ? list : list.filter(s => marks[s.id] !== 'done');

  const mark = (id: string, m: Mark) => setMarks(prev => {
    const next = { ...prev };
    if (prev[id] === m) delete next[id]; else next[id] = m;
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not saved */ }
    return next;
  });

  const card = (s: Spot) => {
    const m = marks[s.id];
    return (
      <article key={s.id} className={`bl-card${m === 'done' ? ' done' : ''}`}>
        <div className="bl-top">
          <div>
            <h4 className="bl-name">{s.name}</h4>
            <div className="bl-kind">{s.kind}</div>
          </div>
          {m ? <span className="bl-pill">{m === 'saved' ? 'Saved' : 'Done'}</span> : !s.checked && <span className="bl-pill warn" title="Current dates and terms were not checked">Not checked</span>}
        </div>
        <div className="bl-block">
          <span className="bl-label">Why it fits</span>
          <p className="bl-text">{s.why}</p>
        </div>
        <div className="bl-block">
          <span className="bl-label">Before you go</span>
          <p className="bl-text">{s.tip}</p>
        </div>
        <div className="bl-actions">
          <a className="btn btn-sm btn-primary" href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />Open</a>
          <button className="btn btn-sm" aria-pressed={m === 'saved'} onClick={() => mark(s.id, 'saved')}><Bookmark size={13} />{m === 'saved' ? 'Saved' : 'Save'}</button>
          <button className="btn btn-sm" aria-pressed={m === 'done'} onClick={() => mark(s.id, 'done')}><Check size={13} />{m === 'done' ? 'Done' : 'Mark done'}</button>
        </div>
      </article>
    );
  };

  return (
    <div className="bl">
      <style>{CSS}</style>
      {marks.showhn !== 'done' && (
        <div className="bl-start">
          <div>
            <b>Start with Show HN</b>
            <span>It needs no application and no equity, and the traction it brings is what the accelerators below ask for.</span>
          </div>
        </div>
      )}

      <section className="bl-sec">
        <h3>Get Baton noticed</h3>
        <p>Places to launch, in the order I would use them.</p>
        {visible(LAUNCH).length ? <div className="bl-grid">{visible(LAUNCH).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>Developers and agencies to pitch</h3>
        <p>People who build custom client sites or use AI to do it. Ask them to try Baton on one real site and tell you what breaks.</p>
        {visible(PITCH).length ? <div className="bl-grid">{visible(PITCH).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>Put it out there</h3>
        <p>Threads and tags where a short comment or reply is enough. All free.</p>
        {visible(SHOUT).length ? <div className="bl-grid">{visible(SHOUT).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>Free listings and directories</h3>
        <p>Profiles and listings where people and investors look for products. Use the free option on each.</p>
        {visible(DIRS).length ? <div className="bl-grid">{visible(DIRS).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>Newsletters that take submissions</h3>
        <p>Free to suggest a link. Send something useful to their readers, not an advert.</p>
        {visible(NEWS).length ? <div className="bl-grid">{visible(NEWS).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>More places to post</h3>
        <p>Directories, communities and write-ups. Most take an hour or less each.</p>
        {visible(POST).length ? <div className="bl-grid">{visible(POST).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>Hackathons</h3>
        <p>Online hackathons that are free to enter. Check each one before you join.</p>
        {visible(EVENTS).length ? <div className="bl-grid">{visible(EVENTS).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>Free credits for startups</h3>
        <p>Cloud credits you can apply for at no cost, so hosting does not eat into money.</p>
        {visible(CREDITS).length ? <div className="bl-grid">{visible(CREDITS).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>Investors and accelerators</h3>
        <p>Approach these after a launch, once there is some traction to show.</p>
        {visible(INVEST).length ? <div className="bl-grid">{visible(INVEST).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      {doneCount > 0 && (
        <p className="bl-foot"><button className="link-btn" onClick={() => setShowDone(v => !v)}>{showDone ? 'Hide' : 'Show'} the {doneCount} you marked done</button></p>
      )}

      <p className="bl-foot">Everything here is meant to cost nothing. Terms change, so confirm that on each page before you submit, and skip any paid option it offers.</p>
    </div>
  );
}
