// Goal roadmap templates for the "Path" feature. Each step carries a query
// that is run through the matcher to suggest a mentor for that step.
export const PATH_TEMPLATES = {
  placement: {
    label: 'Product-company SDE internship',
    steps: [
      { title: 'Skill gap check', detail: 'Baseline your DSA, OOP and system design against SDE internship expectations.', query: 'DSA interviews' },
      { title: 'DSA mentor', detail: 'Sharpen arrays, graphs and DP with structured weekly problems.', query: 'DSA algorithms interviews' },
      { title: 'Portfolio project', detail: 'Turn one project into a portfolio piece that survives interview questions.', query: 'project system design' },
      { title: 'Resume review', detail: 'Get your resume reviewed by someone who has cleared this screen.', query: 'resume placement' },
      { title: 'Mock interviews', detail: 'Run 2–3 timed mock rounds before the real thing.', query: 'mock interviews' },
    ],
  },
  gate: {
    label: 'GATE CS preparation',
    steps: [
      { title: 'Baseline assessment', detail: 'Diagnostic check across core CS subjects to see where you stand.', query: 'GATE exam strategy' },
      { title: 'Core subjects mentor', detail: 'Algorithms, OS, DBMS and CN with a structured study plan.', query: 'GATE algorithms' },
      { title: 'Practice & strategy', detail: 'Weekly mock tests and time-management strategy.', query: 'GATE exam strategy aptitude' },
      { title: 'Peer study group', detail: 'Join a senior-led study circle for accountability.', query: 'GATE senior' },
      { title: 'Final revision', detail: 'Last-mile revision plan two weeks before the exam.', query: 'GATE' },
    ],
  },
  research: {
    label: 'Research / UROP',
    steps: [
      { title: 'Pick a research area', detail: 'Narrow down to one problem you can explain in two sentences.', query: 'research computer vision machine learning' },
      { title: 'Read 5 key papers', detail: 'Get a senior to walk you through how to read and reproduce a paper.', query: 'research deep learning' },
      { title: 'Approach a supervisor', detail: 'Meet faculty with a specific question, not "I want to do AI".', query: 'UROP faculty research' },
      { title: 'Apply to a UROP / project', detail: 'Apply to an open research slot through Nexus and track it.', query: 'UROP' },
      { title: 'Plan a publication', detail: 'Understand the path from results to a workshop or conference paper.', query: 'research publication' },
    ],
  },
  startup: {
    label: 'Student startup',
    steps: [
      { title: 'Validate the problem', detail: 'Talk to 10 potential users before building anything.', query: 'startup validation' },
      { title: 'Find a founder mentor', detail: 'Someone who has built in a similar space.', query: 'startup entrepreneurship' },
      { title: 'Build an MVP team', detail: 'Find co-builders with complementary skills.', query: 'team product' },
      { title: 'Incubation readiness', detail: 'Prepare for campus incubation / pre-incubation programmes.', query: 'incubation innovation' },
    ],
  },
  general: {
    label: 'General goal',
    steps: [
      { title: 'Clarify your goal', detail: 'Write down exactly what outcome you want and by when.', query: 'career guidance' },
      { title: 'Find a primary mentor', detail: 'One person who understands your domain end to end.', query: 'mentorship guidance' },
      { title: 'Find a peer mentor', detail: 'A senior who was recently where you are now.', query: 'senior guidance' },
      { title: 'Build toward an outcome', detail: 'A concrete project, exam or application tied to your goal.', query: 'project' },
    ],
  },
};

export function templateFor(title) {
  const s = title.toLowerCase();
  if (/sde|placement|intern|microsoft|google|amazon|job/.test(s)) return 'placement';
  if (/gate|masters|\bms\b|higher/.test(s)) return 'gate';
  if (/research|urop|vision|paper|ml|ai/.test(s)) return 'research';
  if (/startup|founder|entrepreneur/.test(s)) return 'startup';
  return 'general';
}
