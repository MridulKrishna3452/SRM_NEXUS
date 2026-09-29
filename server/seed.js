/**
 * Seeds demo data. ALL people, projects and requests below are fictional samples
 * created for the hackathon demo — they are not real SRMIST staff, students or programmes.
 *
 *   npm run db:seed    → seed only if the database is empty
 *   npm run db:reset   → wipe all data and re-seed (safe while the server is running)
 */
import { openDb, migrate } from './db.js';
import { config } from './config.js';
import { hashPassword } from './lib/auth.js';

export function seed(conn, { reset = false, password = config.seedPassword } = {}) {
  migrate(conn);
  const hasUsers = conn.prepare('SELECT COUNT(*) n FROM users').get().n > 0;
  if (hasUsers && !reset) return { skipped: true };

  conn.exec('BEGIN');
  try {
    if (reset) {
      for (const t of ['student_skills', 'notifications', 'request_events', 'requests', 'saved_mentors', 'goals', 'opportunities', 'sessions', 'mentors', 'users']) {
        conn.exec(`DELETE FROM ${t}`);
      }
      conn.exec("DELETE FROM sqlite_sequence");
    }

    const now = Date.now();
    const at = (daysAgo, hours = 0) => new Date(now - daysAgo * 864e5 + hours * 36e5).toISOString();
    const dateIn = (days) => new Date(now + days * 864e5).toISOString().slice(0, 10);
    const pw = hashPassword(password);

    // ---------- Users ----------
    const insUser = conn.prepare(`INSERT INTO users (name, email, password_hash, role, department, year_of_study, interests, created_at)
      VALUES (?,?,?,?,?,?,?,?)`);
    const U = {};
    const users = [
      ['admin', 'Nexus Admin (Mentorship Cell)', 'admin@nexus.demo', 'admin', 'Student Affairs (sample)', null, []],
      ['aditi', 'Aditi Sharma', 'student@nexus.demo', 'student', 'CSE — AI & ML', 'II', ['Computer Vision', 'Research', 'DSA']],
      ['kavithaU', 'Dr. Kavitha Rao', 'mentor@nexus.demo', 'mentor', 'Computing Technologies', null, []],
      ['rohitU', 'Rohit Verma', 'rohit@nexus.demo', 'mentor', 'CSE', 'IV', []],
      ['rahul', 'Rahul Krishnan', 'rahul@nexus.demo', 'student', 'ECE', 'III', ['Embedded', 'IoT', 'Robotics']],
      ['nisha', 'Nisha Menon', 'nisha@nexus.demo', 'student', 'CSE — Data Science', 'III', ['Machine Learning', 'GATE']],
      ['farhan', 'Farhan Ali', 'farhan@nexus.demo', 'student', 'Mechanical', 'II', ['Startup', 'Product']],
      ['divya', 'Divya Raghavan', 'divya@nexus.demo', 'student', 'IT', 'IV', ['DSA', 'Interviews']],
      ['sanjay', 'Sanjay Pillai', 'sanjay@nexus.demo', 'student', 'CSE — Cyber Security', 'I', ['Research', 'Python']],
    ];
    users.forEach(([key, name, email, role, dept, year, interests], i) => {
      U[key] = Number(insUser.run(name, email, pw, role, dept, year, JSON.stringify(interests), at(40 - i)).lastInsertRowid);
    });

    // ---------- Mentor directory ----------
    const insMentor = conn.prepare(`INSERT INTO mentors (user_id, name, kind, headline, department, tags, bio, availability, weekly_capacity, hue, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const HUE = { Senior: '#2F63E8', Faculty: '#5B37C9', Alumni: '#0F8F63' };
    const M = {};
    const mentors = [
      ['kavitha', U.kavithaU, 'Dr. Kavitha Rao', 'Faculty', 'Associate Professor · Vision & Perception', 'Dept. of Computing Technologies',
        ['Computer Vision', 'Deep Learning', 'Image Processing', 'Research', 'UROP'],
        'Supervises UROP tracks in vision and perception. Prefers students who come with a specific question rather than "I want to do AI".', ['Wed', 'Fri'], 5],
      ['rohit', U.rohitU, 'Rohit Verma', 'Senior', 'Final year · SDE intern (2025)', 'CSE',
        ['DSA', 'System Design', 'Interviews', 'Java', 'Placement'],
        'Interned at a product company after a focused 4-month DSA + system design sprint. Runs a weekend study group and mock-interviews juniors.', ['Sat'], 4],
      ['arjun', null, 'Arjun Mehta', 'Senior', 'Final year · Computer vision projects', 'CSE',
        ['Computer Vision', 'Deep Learning', 'Python', 'PyTorch', 'Research'],
        'Has shipped two computer-vision projects, including a real-time defect detector for a robotics competition. Loves turning papers into weekend builds.', ['Sat', 'Sun'], 3],
      ['sneha', null, 'Sneha Iyer', 'Alumni', 'ML Engineer · CSE 2022', 'Alumni — CSE',
        ['Computer Vision', 'Machine Learning', 'Python', 'Career Guidance'],
        'Works on an applied vision team in industry. Mentors 1–2 students a month on research-to-industry transitions and portfolio projects.', ['Sun'], 2],
      ['priya', null, 'Priya Nair', 'Alumni', 'Software Engineer · CSE 2023', 'Alumni — CSE',
        ['DSA', 'Interviews', 'Resume', 'Placement'],
        'Reviews resumes and runs mock interviews for students targeting product-based companies.', ['Sun'], 3],
      ['suresh', null, 'Dr. Suresh Kumar', 'Faculty', 'Professor · Algorithms & Complexity', 'Dept. of Computing Technologies',
        ['Algorithms', 'DSA', 'GATE', 'Research', 'Higher Studies'],
        'Teaches core algorithms and guides students preparing for GATE. Known for a first-principles teaching style.', ['Tue', 'Thu'], 4],
      ['aakash', null, 'Aakash Gupta', 'Alumni', 'M.Tech student · CSE 2021', 'Alumni — CSE',
        ['GATE', 'DSA', 'Algorithms', 'Exam Strategy', 'Higher Studies'],
        'Qualified GATE CS while at SRM and moved on to an M.Tech. Shares a structured 6-month prep timeline with every mentee.', ['Sat', 'Sun'], 3],
      ['meera', null, 'Meera Pillai', 'Senior', 'Final year · GATE CS qualifier', 'CSE',
        ['GATE', 'Exam Strategy', 'Aptitude'],
        'Qualified GATE CS this year while balancing coursework. Great at helping juniors build a realistic study schedule.', ['Fri'], 2],
      ['karthik', null, 'Karthik Rajan', 'Alumni', 'Founder, EdTech startup · CSE 2019', 'Alumni — CSE',
        ['Startup', 'Entrepreneurship', 'EdTech', 'Fundraising', 'Product'],
        'Built and raised seed funding for an EdTech startup after graduating. Mentors early-stage student founders on product and fundraising.', ['Sat'], 2],
      ['anitha', null, 'Dr. Anitha Balan', 'Faculty', 'Faculty mentor · Innovation & incubation', 'Dept. of Data Science & Business Systems',
        ['Startup', 'Innovation', 'Incubation', 'Product', 'Entrepreneurship'],
        'Helps first-time student founders validate ideas before they touch a pitch deck.', ['Mon', 'Wed'], 4],
      ['vikram', null, 'Vikram Shah', 'Senior', 'Final year · Robotics & embedded lead', 'ECE',
        ['Embedded', 'IoT', 'Hardware', 'Robotics', 'Drones', 'Projects'],
        'Leads a student robotics team and has built two autonomous drone prototypes. Happy to help cross-department teams get started.', ['Sun'], 3],
      ['lakshmi', null, 'Dr. Lakshmi Narayanan', 'Faculty', 'Assistant Professor · NLP & ML', 'Dept. of Networking & Communications',
        ['Machine Learning', 'NLP', 'Research', 'UROP', 'Python'],
        'Works on language technologies for Indian languages. Open to students who want a first research experience.', ['Tue', 'Fri'], 4],
    ];
    mentors.forEach(([key, uid, name, kind, headline, dept, tags, bio, avail, cap], i) => {
      M[key] = Number(insMentor.run(uid, name, kind, headline, dept, JSON.stringify(tags), bio, JSON.stringify(avail), cap, HUE[kind], at(45 - i)).lastInsertRowid);
    });

    // ---------- Opportunities ----------
    const insOpp = conn.prepare(`INSERT INTO opportunities (type, title, provider, mentor_id, description, tags, slots_total, duration, deadline)
      VALUES (?,?,?,?,?,?,?,?,?)`);
    const O = {};
    const opps = [
      ['urop', 'UROP', 'Edge AI for Campus Traffic Monitoring', 'Dr. Kavitha Rao', M.kavitha,
        'Apply lightweight vision models to real-time traffic monitoring. Weekly check-ins and a clear path to a workshop paper.',
        ['Computer Vision', 'PyTorch', 'Edge AI', 'Research'], 4, '10 weeks', dateIn(9)],
      ['nlp', 'UROP', 'Tamil–English Code-Mixed Text Classifier', 'Dr. Lakshmi Narayanan', M.lakshmi,
        'Build and evaluate classifiers for code-mixed social media text. Good first research project for II/III year students.',
        ['NLP', 'Machine Learning', 'Python', 'Research'], 3, '8 weeks', dateIn(14)],
      ['assistant', 'In-house Project', 'Campus Knowledge Assistant', 'Student innovation team (sample)', M.arjun,
        'Build a searchable assistant that connects campus expertise, projects and opportunities.',
        ['LLM', 'RAG', 'Web Development', 'Projects'], 4, 'Semester', dateIn(21)],
      ['mock', 'Alumni Circle', 'Product Engineering Mock Interview Circle', 'Alumni volunteers (sample)', M.priya,
        'Small-group weekly mock interview series led by alumni working in product engineering.',
        ['DSA', 'System Design', 'Interviews'], 12, '6 weeks · online', dateIn(6)],
      ['founders', 'Entrepreneurship', 'Student Founder Office Hours', 'Innovation mentors (sample)', M.anitha,
        'Structured mentorship for validating student startup ideas before applying to incubation.',
        ['Startup', 'Product', 'Validation', 'Pitching'], 8, '6 weeks', dateIn(18)],
      ['drone', 'In-house Project', 'Autonomous Delivery Drone Build', 'Robotics team (sample)', M.vikram,
        'Cross-department build: flight control, embedded vision and a campus demo run.',
        ['Embedded', 'Drones', 'Computer Vision', 'Hardware'], 5, '12 weeks', dateIn(25)],
      ['crowd', 'In-house Project', 'Campus Crowd Density Estimation', 'Dr. Kavitha Rao', M.kavitha,
        'Estimate crowd density at busy campus points from video using lightweight CNNs. In-house lab project with a demo at semester end.',
        ['Computer Vision', 'Deep Learning', 'Python', 'OpenCV'], 3, '12 weeks', dateIn(20)],
    ];
    opps.forEach(([key, type, title, provider, mid, desc, tags, slots, dur, deadline]) => {
      O[key] = Number(insOpp.run(type, title, provider, mid, desc, JSON.stringify(tags), slots, dur, deadline).lastInsertRowid);
    });

    // ---------- Requests with full status history ----------
    const insReq = conn.prepare(`INSERT INTO requests (student_id, type, category, title, description, preferred_day, preferred_slot,
        mentor_id, opportunity_id, priority, status, scheduled_for, resolution_note, feedback_rating, feedback_comment, created_at, updated_at, resolved_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insEv = conn.prepare(`INSERT INTO request_events (request_id, actor_id, kind, from_status, to_status, note, created_at) VALUES (?,?,?,?,?,?,?)`);
    const insNote = conn.prepare('INSERT INTO notifications (user_id, request_id, message, is_read, created_at) VALUES (?,?,?,?,?)');

    const mentorUser = { [M.kavitha]: U.kavithaU, [M.rohit]: U.rohitU };

    /**
     * steps: [hoursAfterCreation, actorKey, kind, toStatus|null, note]
     * status transitions are applied in order; the final status is derived.
     */
    function req({ student, type, category, title, description, day = null, slot = null, mentor = null, opp = null, priority = 'normal', daysAgo, steps = [], scheduled = null, feedback = null }) {
      const created = at(daysAgo);
      let status = 'submitted';
      let resolvedAt = null;
      let resolution = null;
      let last = created;
      const events = [[created, U[student], 'status', null, 'submitted', 'Request submitted']];
      for (const [h, actor, kind, to, note] of steps) {
        const t = at(daysAgo, h);
        if (kind === 'status') {
          events.push([t, U[actor], 'status', status, to, note]);
          status = to;
          if (to === 'resolved' || to === 'declined') { resolvedAt = t; resolution = note; }
        } else events.push([t, U[actor], kind, null, null, note]);
        last = t;
      }
      if (feedback) { const t = at(daysAgo, steps.at(-1)[0] + 5); events.push([t, U[student], 'feedback', null, null, `Rated ${feedback[0]}/5 — ${feedback[1]}`]); last = t; }
      const id = Number(insReq.run(U[student], type, category, title, description, day, slot, mentor, opp, priority, status, scheduled,
        resolution, feedback?.[0] ?? null, feedback?.[1] ?? null, created, last, resolvedAt).lastInsertRowid);
      for (const [t, actor, kind, from, to, note] of events) insEv.run(id, actor, kind, from, to, note, t);
      return { id, status, last, mentorUser: mentor ? mentorUser[mentor] : null };
    }

    const ref = (id) => `NX-${1000 + id}`;

    // Aditi (demo student) — one request in each stage
    const a1 = req({ student: 'aditi', type: 'mentorship', category: 'Research & UROP', mentor: M.arjun, daysAgo: 18, day: 'Sat', slot: 'Evening',
      title: 'How do I start a computer vision research project?',
      description: 'I have finished an online deep learning course and want to start a small CV project that could grow into a UROP. Need help choosing a problem and dataset.',
      steps: [[5, 'admin', 'status', 'in_review', 'Routed to a senior with CV project experience'],
        [20, 'admin', 'status', 'in_progress', 'Session confirmed'],
        [70, 'admin', 'status', 'resolved', 'Session held. Arjun shared a shortlist of 3 datasets and a 4-week plan.']],
      scheduled: 'Sat, 5:00 PM · Tech Park lobby (sample)', feedback: [5, 'Very practical — I now have a plan.'] });
    const a2 = req({ student: 'aditi', type: 'opportunity', category: 'Research & UROP', mentor: M.kavitha, opp: O.urop, daysAgo: 6, priority: 'high',
      title: 'Application: Edge AI for Campus Traffic Monitoring',
      description: 'I am in II year CSE (AI & ML) and have built a small object detection demo with YOLO. I can commit 8 hours a week for the full 10 weeks.',
      steps: [[3, 'admin', 'status', 'in_review', 'Eligibility checked — forwarded to the project faculty'],
        [30, 'kavithaU', 'comment', null, 'Please share a link to your detection demo before the interview.'],
        [40, 'aditi', 'comment', null, 'Shared the GitHub link in the application notes. Thank you!'],
        [52, 'kavithaU', 'status', 'in_progress', 'Shortlisted for a 15-minute interview.']],
      scheduled: 'Fri, 3:30 PM · Faculty cabin (sample)' });
    const a3 = req({ student: 'aditi', type: 'mentorship', category: 'Placements & Internships', mentor: M.rohit, daysAgo: 2, day: 'Sat', slot: 'Morning',
      title: 'Mock DSA round before internship season',
      description: 'Looking for a timed mock interview focused on graphs and dynamic programming, plus feedback on how I explain my approach.',
      steps: [[4, 'rohitU', 'status', 'in_review', 'Happy to help — checking my Saturday slots.']] });
    const a4 = req({ student: 'aditi', type: 'guidance', category: 'Higher Studies & GATE', daysAgo: 0.3,
      title: 'Should I start GATE preparation in II year?',
      description: 'I am unsure whether to focus on placements or start GATE preparation early. Would like to talk to someone who did both.' });

    // Other students — gives the admin queue realistic volume
    const others = [
      req({ student: 'rahul', type: 'opportunity', category: 'Projects & Teams', mentor: M.vikram, opp: O.drone, daysAgo: 12,
        title: 'Application: Autonomous Delivery Drone Build',
        description: 'ECE III year, I have worked with STM32 and PX4 in a club project. Interested in the flight controller side of the build.',
        steps: [[6, 'admin', 'status', 'in_review', 'Forwarded to the robotics team lead'], [30, 'admin', 'status', 'in_progress', 'Intro meeting scheduled'],
          [120, 'admin', 'status', 'resolved', 'Selected for the flight-control sub-team.']], feedback: [4, 'Quick response, clear next steps.'] }),
      req({ student: 'nisha', type: 'mentorship', category: 'Higher Studies & GATE', mentor: M.aakash, daysAgo: 15, day: 'Sun', slot: 'Evening',
        title: 'GATE CS 6-month study plan', description: 'Need help building a realistic 6-month GATE plan alongside my III year coursework and a minor project.',
        steps: [[8, 'admin', 'status', 'in_review', 'Assigned to an alumni mentor who qualified GATE'], [26, 'admin', 'status', 'in_progress', 'Session set up'],
          [96, 'admin', 'status', 'resolved', 'Shared a week-by-week plan and a mock test schedule.']], feedback: [5, 'The plan is exactly what I needed.'] }),
      req({ student: 'farhan', type: 'opportunity', category: 'Entrepreneurship', mentor: M.anitha, opp: O.founders, daysAgo: 9,
        title: 'Application: Student Founder Office Hours', description: 'Working on a peer-to-peer lab equipment rental idea for hostels. Want to validate it before building an app.',
        steps: [[10, 'admin', 'status', 'in_review', 'Reviewing idea summary'], [48, 'admin', 'status', 'in_progress', 'Accepted into the office-hours cohort']] }),
      req({ student: 'divya', type: 'mentorship', category: 'Placements & Internships', mentor: M.priya, daysAgo: 8, priority: 'high', day: 'Sun', slot: 'Afternoon',
        title: 'Resume review for product-company applications', description: 'Applications open soon. I want my resume reviewed for impact statements and project descriptions.',
        steps: [[2, 'admin', 'status', 'in_review', 'Assigned to alumni resume reviewer'], [20, 'admin', 'status', 'in_progress', 'Resume shared with mentor'],
          [60, 'admin', 'status', 'resolved', 'Resume reviewed; 6 concrete edits suggested.']] }),
      req({ student: 'sanjay', type: 'opportunity', category: 'Research & UROP', mentor: M.lakshmi, opp: O.nlp, daysAgo: 4,
        title: 'Application: Tamil–English Code-Mixed Text Classifier', description: 'I am a first-year student comfortable with Python and scikit-learn and would like my first research experience.',
        steps: [[20, 'admin', 'status', 'in_review', 'Checking eligibility for I year students']] }),
      req({ student: 'rahul', type: 'guidance', category: 'Projects & Teams', daysAgo: 3, priority: 'normal',
        title: 'Looking for a CS teammate for a hardware hackathon', description: 'Our team has embedded and mechanical covered but needs someone for the computer vision / app side. How can we find a teammate?' }),
      req({ student: 'nisha', type: 'mentorship', category: 'Research & UROP', mentor: M.kavitha, daysAgo: 1.5, day: 'Wed', slot: 'Afternoon',
        title: 'Guidance on choosing a final-year project in medical imaging', description: 'I want to work on medical image segmentation for my final-year project and would like advice on scope and datasets.' }),
      req({ student: 'sanjay', type: 'mentorship', category: 'Research & UROP', mentor: M.kavitha, daysAgo: 0.8, priority: 'low', day: 'Fri', slot: 'Morning',
        title: 'How to read a research paper as a first-year?', description: 'I keep getting lost in the maths sections of papers. Would love a short session on how to approach reading them.' }),
      req({ student: 'divya', type: 'opportunity', category: 'Placements & Internships', mentor: M.priya, opp: O.mock, daysAgo: 5,
        title: 'Application: Product Engineering Mock Interview Circle', description: 'Final year IT student preparing for off-campus drives. Can attend every weekly session.',
        steps: [[12, 'admin', 'status', 'in_review', 'Seat available'], [30, 'admin', 'status', 'in_progress', 'Added to the Week 1 group']] }),
      req({ student: 'farhan', type: 'mentorship', category: 'Entrepreneurship', mentor: M.karthik, daysAgo: 11,
        title: 'Fundraising basics for a student startup', description: 'Want to understand grants vs angel funding for an early-stage hardware startup idea.',
        steps: [[30, 'admin', 'status', 'in_review', 'Checking mentor availability'],
          [80, 'admin', 'status', 'declined', 'Mentor is unavailable this month — please join Student Founder Office Hours instead.']] }),
      req({ student: 'nisha', type: 'guidance', category: 'Academics & Other', daysAgo: 7,
        title: 'Finding a study group for Theory of Computation', description: 'Looking for a senior-led study group for TOC before the cycle test.',
        steps: [[4, 'nisha', 'status', 'cancelled', 'Found a group through my class.']] }),
      req({ student: 'rahul', type: 'mentorship', category: 'Placements & Internships', mentor: M.rohit, daysAgo: 0.5, priority: 'normal', day: 'Sat', slot: 'Afternoon',
        title: 'Switching from core ECE to software roles', description: 'I am in ECE and want to target software roles. What should I prioritise in the next 6 months?' }),
    ];

    // More applicants for the demo faculty's projects (ranked by verified skill fit in "My Projects")
    const moreApps = [
      req({ student: 'nisha', type: 'opportunity', category: 'Research & UROP', mentor: M.kavitha, opp: O.urop, daysAgo: 1.2,
        title: 'Application: Edge AI for Campus Traffic Monitoring', description: 'III year Data Science student. I have trained CNNs in coursework and want research experience in efficient vision models.' }),
      req({ student: 'sanjay', type: 'opportunity', category: 'Projects & Teams', mentor: M.kavitha, opp: O.crowd, daysAgo: 2,
        title: 'Application: Campus Crowd Density Estimation', description: 'First-year student learning OpenCV. I can help with data collection and labelling while I learn the modelling side.' }),
      req({ student: 'rahul', type: 'opportunity', category: 'Projects & Teams', mentor: M.kavitha, opp: O.crowd, daysAgo: 3,
        title: 'Application: Campus Crowd Density Estimation', description: 'ECE III year. I can deploy the model on an edge device and handle the camera pipeline.',
        steps: [[6, 'kavithaU', 'status', 'in_review', 'Reviewing embedded experience']] }),
    ];
    others.push(...moreApps);

    // ---------- Skills with verification pipeline ----------
    const insSkill = conn.prepare(`INSERT INTO student_skills (user_id, skill, level, evidence_url, evidence_note, status, verifier_id, verifier_note, reviewed_at, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const skill = (who, name, level, status, verifier, evidence, note = null, daysAgo = 5) => {
      const created = at(daysAgo + 2);
      const reviewed = status === 'pending' ? null : at(daysAgo);
      insSkill.run(U[who], name, level, `https://example.com/demo/${who}/${name.toLowerCase().replace(/\W+/g, '-')}`, evidence,
        status, verifier ? U[verifier] : null, note, reviewed, created, reviewed || created);
    };
    skill('aditi', 'Python', 'Advanced', 'verified', 'kavithaU', 'Course project: image classifier with data pipeline and tests (sample evidence).', 'Code reviewed — clean and well structured.', 12);
    skill('aditi', 'PyTorch', 'Intermediate', 'verified', 'kavithaU', 'Trained a YOLO-style detector on a custom dataset (sample evidence).', 'Verified during UROP screening.', 4);
    skill('aditi', 'DSA', 'Intermediate', 'verified', 'rohitU', 'Mock interview round — graphs and DP (sample evidence).', 'Solid on graphs; practise DP.', 10);
    skill('aditi', 'Computer Vision', 'Intermediate', 'pending', null, 'Object detection demo repository and short write-up (sample evidence).', null, 1);
    skill('aditi', 'Edge AI', 'Beginner', 'rejected', 'admin', 'Watched an online talk on TinyML.', 'Please link a working project or certificate, then resubmit.', 3);
    skill('nisha', 'Machine Learning', 'Advanced', 'verified', 'admin', 'Elective grade sheet + Kaggle notebook (sample evidence).', 'Grade sheet checked.', 8);
    skill('nisha', 'Python', 'Advanced', 'verified', 'admin', 'Minor project repository (sample evidence).', null, 8);
    skill('nisha', 'Deep Learning', 'Intermediate', 'pending', null, 'CNN assignment reports from coursework (sample evidence).', null, 1);
    skill('nisha', 'Computer Vision', 'Beginner', 'pending', null, 'Image segmentation mini project (sample evidence).', null, 1);
    skill('sanjay', 'Python', 'Intermediate', 'pending', null, 'Scripts written for a club automation task (sample evidence).', null, 2);
    skill('sanjay', 'OpenCV', 'Beginner', 'pending', null, 'Face-blur webcam demo built over a weekend (sample evidence).', null, 2);
    skill('rahul', 'Embedded', 'Advanced', 'verified', 'admin', 'Robotics club flight controller work (sample evidence).', 'Confirmed by club lead.', 9);
    skill('rahul', 'Python', 'Intermediate', 'verified', 'admin', 'Sensor data logging scripts (sample evidence).', null, 9);
    skill('rahul', 'OpenCV', 'Intermediate', 'pending', null, 'Line-following robot with camera input (sample evidence).', null, 2);
    skill('divya', 'DSA', 'Advanced', 'verified', 'rohitU', 'Contest profile and mock interview (sample evidence).', null, 6);
    skill('divya', 'Java', 'Intermediate', 'verified', 'admin', 'Internship project certificate (sample evidence).', null, 6);
    skill('farhan', 'Product', 'Beginner', 'pending', null, 'User interview notes for a hostel rental idea (sample evidence).', null, 2);

    // Notifications for the demo accounts
    const n = (uid, r, msg, read, t) => insNote.run(uid, r, msg, read ? 1 : 0, t);
    n(U.aditi, a2.id, `${ref(a2.id)} moved to In Progress: shortlisted for interview`, false, at(6, 52));
    n(U.aditi, a2.id, `New comment on ${ref(a2.id)} from Dr. Kavitha Rao`, false, at(6, 30));
    n(U.aditi, a3.id, `${ref(a3.id)} moved to In Review`, false, at(2, 4));
    n(U.aditi, a1.id, `${ref(a1.id)} moved to Resolved`, true, at(18, 70));
    n(U.aditi, null, '✓ "PyTorch" was verified by Dr. Kavitha Rao', false, at(4));
    n(U.aditi, null, '"Edge AI" needs more evidence — see the note from Nexus Admin (Mentorship Cell)', true, at(3));
    for (const r of [...others, a4].filter((x) => x.status === 'submitted')) n(U.admin, r.id, `New request ${ref(r.id)} needs triage`, false, r.last);
    for (const r of others.filter((x) => x.mentorUser && x.status === 'submitted')) n(r.mentorUser, r.id, `New request ${ref(r.id)} assigned to you`, false, r.last);

    // Saved mentors + a goal for the demo student
    conn.prepare('INSERT INTO saved_mentors (user_id, mentor_id) VALUES (?,?), (?,?)').run(U.aditi, M.sneha, U.aditi, M.kavitha);
    conn.prepare("INSERT INTO goals (user_id, title, template_key, steps_done) VALUES (?,?,?,?)").run(U.aditi, 'Get into a computer vision UROP', 'research', '[0,1]');

    conn.exec('COMMIT');
    return { skipped: false, users: users.length, mentors: mentors.length, opportunities: opps.length, requests: others.length + 4, skills: 17 };
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}

// CLI entry
if (/seed\.js$/.test(process.argv[1] || '')) {
  const reset = process.argv.includes('--reset');
  const conn = openDb();
  const out = seed(conn, { reset });
  conn.close();
  if (out.skipped) console.log('Database already has data — skipped. Use "npm run db:reset" to wipe and re-seed.');
  else {
    console.log(`Seeded ${config.databasePath}: ${out.users} users, ${out.mentors} mentors, ${out.opportunities} opportunities, ${out.requests} requests.`);
    console.log(`Demo accounts (password: ${config.seedPassword}): student@nexus.demo · mentor@nexus.demo · admin@nexus.demo`);
  }
}
