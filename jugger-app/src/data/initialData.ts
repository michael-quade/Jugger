import type { Team, HoleInOneEntry, CourseHistoryEntry, HioDonation } from '../types'

// CTP hole donations to HIO pot before app tracking started (2026)
export const INITIAL_CTP_HIO_HISTORY: { year: number; amount: number }[] = [
  { year: 2022, amount: 12 },
  { year: 2023, amount: 24 },
  { year: 2024, amount: 24 },
  { year: 2025, amount: 36 },
]

export const INITIAL_TEAMS: Team[] = [
  {
    id: 'billy-baroo',
    name: 'Billy Baroo',
    color: '#1e40af',
    players: [
      { id: 'quade',       name: 'Michael Quade',    handicapIndex: 13.7, hdcpLocked: false, hdcp2009gross: 6 },
      { id: 'whitman',     name: 'Nick Whitman',      handicapIndex: 15.4, hdcpLocked: false, hdcp2009gross: 8 },
      { id: 'butterworth', name: 'Nate Butterworth',  handicapIndex: 12.9, hdcpLocked: false, hdcp2009gross: 5 },
      { id: 'holcomb',     name: 'Bryan Holcomb',     handicapIndex: 16.9, hdcpLocked: false, hdcp2009gross: 9 },
    ],
  },
  {
    id: 'ballgame',
    name: '#ballgame',
    color: '#dc2626',
    players: [
      { id: 'pitts',    name: 'Ron Pitts',      handicapIndex: 11.5, hdcpLocked: false, hdcp2009gross: 4 },
      { id: 'gunter',   name: 'Daniel Gunter',  handicapIndex: 18.7, hdcpLocked: false, hdcp2009gross: 18 },
      { id: 'oxford',   name: 'John Oxford',    handicapIndex: 9.1,  hdcpLocked: false, hdcp2009gross: 2 },
      { id: 'oncavage', name: 'Chris Oncavage', handicapIndex: 8.0,  hdcpLocked: false, hdcp2009gross: 1 },
    ],
  },
  {
    id: 'silverbacks',
    name: 'Silverbacks',
    color: '#16a34a',
    players: [
      { id: 'woyahn',   name: 'Danny Woyahn',   handicapIndex: 8.1,  hdcpLocked: false, hdcp2009gross: 1 },
      { id: 'skidmore', name: 'Matt Skidmore',  handicapIndex: 28.5, hdcpLocked: false, hdcp2009gross: 18 },
      { id: 'bender',   name: 'Chad Bender',    handicapIndex: 7.0,  hdcpLocked: false, hdcp2009gross: 0 },
      { id: 'morris',   name: 'Hunter Morris',  handicapIndex: 7.2,  hdcpLocked: false, hdcp2009gross: 0 },
    ],
  },
]

export const HISTORICAL_HOI: HoleInOneEntry[] = []

// Every player donates $20/year since 2022. Pre-seed 2022–2025 as paid, 2026 as pending.
const HIO_PLAYER_NAMES = [
  'Michael Quade',    'Nick Whitman',    'Nate Butterworth', 'Bryan Holcomb',
  'Ron Pitts',        'Daniel Gunter',   'John Oxford',      'Chris Oncavage',
  'Danny Woyahn',     'Matt Skidmore',   'Chad Bender',      'Hunter Morris',
]

export const INITIAL_HIO_DONATIONS: HioDonation[] = HIO_PLAYER_NAMES.flatMap((name, pi) =>
  [2022, 2023, 2024, 2025, 2026].map(yr => ({
    id: `hio-don-${yr}-${pi}`,
    year: yr,
    playerName: name,
    paid: yr < 2026,
    amount: 20,
  }))
)

export const INITIAL_COURSE_HISTORY: CourseHistoryEntry[] = [
  // ── Myrtle Beach / Grand Strand era (2006–2010) ──────────────────────────

  {
    id: 'hist-heathland',
    name: 'Heathland at Legends',
    location: 'Myrtle Beach, SC',
    par: 71,
    website: 'https://www.legendsgolf.com',
    notes: 'Part of the Legends Golf & Resort complex.',
    imageUrl: 'https://www.legendsgolf.com/custom/design/images/logo.png',
    imageContain: true,
    playedRounds: [
      { id: 'pr-heath-2006-r1', year: 2006, round: 1 },
    ],
  },
  {
    id: 'hist-parkland',
    name: 'Parkland at Legends',
    location: 'Myrtle Beach, SC',
    website: 'https://www.legendsgolf.com',
    notes: 'Part of the Legends Golf & Resort complex.',
    imageUrl: 'https://www.legendsgolf.com/custom/design/images/logo.png',
    imageContain: true,
    playedRounds: [
      { id: 'pr-park-2006-r2', year: 2006, round: 2 },
    ],
  },
  {
    id: 'hist-myrtlewood-pinehills',
    name: 'Myrtlewood Pinehills',
    location: 'Myrtle Beach, SC',
    website: 'https://www.myrtlewoodgolf.com',
    imageUrl: 'https://www.myrtlewoodgolf.com/wp-content/uploads/2023/03/Myrtlewood_Logo_white.png',
    imageContain: true,
    playedRounds: [
      { id: 'pr-mwp-2006-r3', year: 2006, round: 3 },
      { id: 'pr-mwp-2008-r3', year: 2008, round: 3 },
      { id: 'pr-mwp-2009-r4', year: 2009, round: 4 },
    ],
  },
  {
    id: 'hist-myrtlewood-palmetto',
    name: 'Myrtlewood Palmetto',
    location: 'Myrtle Beach, SC',
    website: 'https://www.myrtlewoodgolf.com',
    imageUrl: 'https://www.myrtlewoodgolf.com/wp-content/uploads/2023/03/Myrtlewood_Logo_white.png',
    imageContain: true,
    playedRounds: [
      { id: 'pr-mwpal-2006-r4', year: 2006, round: 4 },
      { id: 'pr-mwpal-2008-r4', year: 2008, round: 4 },
      { id: 'pr-mwpal-2009-r5', year: 2009, round: 5 },
    ],
  },
  {
    id: 'hist-arcadian-shores',
    name: 'Arcadian Shores',
    location: 'Myrtle Beach, SC',
    website: 'https://www.hiltonmyrtlebeach.com/golf/',
    imageUrl: 'https://arcadianshoresgolf.com/wp-content/uploads/2017/02/4-16-16-pics-029.jpg',
    playedRounds: [
      { id: 'pr-arc-2006-r5', year: 2006, round: 5 },
      { id: 'pr-arc-2007-r4', year: 2007, round: 4 },
    ],
  },
  {
    id: 'hist-world-tour',
    name: 'World Tour Golf Links',
    location: 'Myrtle Beach, SC',
    website: 'https://www.theworldtourgolf.com',
    notes: 'Replica holes from famous courses around the world.',
    imageUrl: 'https://www.theworldtourgolf.com/_next/image/?url=https%3A%2F%2Fadmin.theworldtourgolf.com%2Fwp-content%2Fuploads%2F2024%2F10%2FWorldTour-Logo2024-6.png&w=256&q=75',
    imageContain: true,
    playedRounds: [
      { id: 'pr-wt-2007-r1', year: 2007, round: 1 },
    ],
  },
  {
    id: 'hist-brunswick-plantation',
    name: 'Brunswick Plantation',
    location: 'Calabash, NC',
    website: 'https://www.brunswickplantation.com',
    imageUrl: 'https://www.brunswickplantation.com/wp-content/uploads/2022/06/6-1024x683.jpg',
    playedRounds: [
      { id: 'pr-bp-2007-r2', year: 2007, round: 2 },
    ],
  },
  {
    id: 'hist-farmstead',
    name: 'Farmstead Golf Links',
    location: 'Longs, SC',
    website: 'https://www.ncgolf.com/golfcourses/farmstead-golf-links',
    imageUrl: 'https://images.ncgolf.com/courselarge/farmsteadgolflinks-large.jpg',
    playedRounds: [
      { id: 'pr-farm-2007-r3', year: 2007, round: 3 },
    ],
  },
  {
    id: 'hist-prestwick',
    name: 'Prestwick Country Club',
    location: 'Myrtle Beach, SC',
    website: 'https://www.prestwickcc.com',
    imageUrl: 'https://i0.wp.com/prestwickcountryclub.com/wp-content/uploads/2016/03/PrestwickRGB_Transparent.png?w=1050&ssl=1',
    imageContain: true,
    playedRounds: [
      { id: 'pr-pres-2007-r5', year: 2007, round: 5 },
      { id: 'pr-pres-2008-r1', year: 2008, round: 1 },
    ],
  },
  {
    id: 'hist-true-blue',
    name: 'True Blue Golf Club',
    location: "Pawleys Island, SC",
    website: 'https://www.truebluegolf.com',
    imageUrl: 'https://www.truebluegolf.com/wp-content/uploads/2019/04/caledonia-golf-vacations-banner-768x402.jpg',
    playedRounds: [
      { id: 'pr-tb-2008-r2', year: 2008, round: 2 },
    ],
  },
  {
    id: 'hist-glen-dornoch',
    name: 'Glen Dornoch Waterway Golf Links',
    location: 'Little River, SC',
    website: 'https://www.glendornoch.com',
    imageUrl: 'https://www.glendornoch.com/wp-content/uploads/2018/02/Glen-Dornoch-Homepage-Hero.jpg',
    playedRounds: [
      { id: 'pr-gd-2009-r1', year: 2009, round: 1 },
    ],
  },
  {
    id: 'hist-panthers-run',
    name: "Panther's Run",
    location: 'Sunset Beach, NC',
    website: 'https://www.bigcatsgolf.com/panthers-run/',
    imageUrl: 'https://www.bigcatsgolf.com/wp-content/uploads/2013/02/pr_logo.png',
    imageContain: true,
    notes: "Now operated by Big Cats Golf.",
    playedRounds: [
      { id: 'pr-pan-2009-r2', year: 2009, round: 2 },
    ],
  },
  {
    id: 'hist-tigers-eye',
    name: "Tiger's Eye Golf Links",
    location: 'Ocean Isle Beach, NC',
    website: 'https://www.brunswickplantation.com',
    imageUrl: 'https://images.ncgolf.com/courselogos/TigersEyelogo.jpg',
    imageContain: true,
    playedRounds: [
      { id: 'pr-te-2009-r3', year: 2009, round: 3 },
    ],
  },
  {
    id: 'hist-wild-wing',
    name: 'Wild Wing Avocet',
    location: 'Conway, SC',
    website: 'https://www.playwildwing.com',
    imageUrl: 'https://www.playwildwing.com/wp-content/uploads/2022/11/WildWing-LogoColor-2.svg',
    imageContain: true,
    playedRounds: [
      { id: 'pr-ww-2010-r1', year: 2010, round: 1 },
    ],
  },
  {
    id: 'hist-willbrook',
    name: 'Willbrook Plantation',
    location: "Pawleys Island, SC",
    website: 'https://www.willbrookgolf.com/',
    imageUrl: 'https://www.willbrookgolf.com/_next/image/?url=https%3A%2F%2Fadmin.willbrookgolf.com%2Fwp-content%2Fuploads%2F2024%2F01%2FWillBrook-Logo-Transparent2.png&w=256&q=75',
    imageContain: true,
    playedRounds: [
      { id: 'pr-wb-2010-r2', year: 2010, round: 2 },
    ],
  },
  {
    id: 'hist-tradition',
    name: 'The Tradition Club',
    location: "Pawleys Island, SC",
    website: 'https://www.traditionclubmyrtlebeach.com',
    imageUrl: 'https://admin.traditionclubmyrtlebeach.com/wp-content/uploads/2024/04/Tradition-Gallery-7.jpg',
    playedRounds: [
      { id: 'pr-trad-2010-r3', year: 2010, round: 3 },
    ],
  },
  {
    id: 'hist-mbn-kings-north',
    name: "Myrtle Beach National — King's North",
    location: 'Myrtle Beach, SC',
    website: 'https://www.myrtlebeachnational.com',
    notes: "Arnold Palmer–designed flagship of Myrtle Beach National.",
    imageUrl: 'https://www.myrtlebeachnational.com/wp-content/uploads/2025/05/Untitled-design-9.png',
    playedRounds: [
      { id: 'pr-mbnkn-2010-r4', year: 2010, round: 4 },
    ],
  },
  {
    id: 'hist-mbn-west',
    name: 'Myrtle Beach National — West',
    location: 'Myrtle Beach, SC',
    website: 'https://www.myrtlebeachnational.com',
    imageUrl: 'https://www.myrtlebeachnational.com/wp-content/uploads/2023/03/Untitled-design-2023-03-20T132345.631.jpg',
    playedRounds: [
      { id: 'pr-mbnw-2010-r5', year: 2010, round: 5 },
    ],
  },

  // ── Pinehurst / Sandhills era (2011–present) ─────────────────────────────

  {
    id: 'hist-talamore',
    name: 'Talamore Golf Course',
    location: 'Southern Pines, NC',
    website: 'https://talamoregolfresort.com/talamore-golf-club/',
    notes: 'The original Talamore course at the resort, sister course to Mid South.',
    imageUrl: 'https://talamoregolfresort.com/wp-content/uploads/2025/01/Talamore-9-b2.jpg',
    playedRounds: [
      { id: 'pr-tal-2011-r1', year: 2011, round: 1 },
      { id: 'pr-tal-2014-r2', year: 2014, round: 2 },
      { id: 'pr-tal-2018-r2', year: 2018, round: 2 },
      { id: 'pr-tal-2020-r4', year: 2020, round: 4 },
      { id: 'pr-tal-2021-r4', year: 2021, round: 4 },
      { id: 'pr-tal-2024-r1', year: 2024, round: 1 },
    ],
  },
  {
    id: 'hist-pinewild-holly',
    name: 'Pinewild Holly',
    location: 'Pinehurst, NC',
    par: 72,
    website: 'https://pinewildcc.com/golf/holly-course/',
    imageUrl: 'https://pinewildcc.com/wp-content/uploads/2024/08/HollyCourse_01.jpg',
    tees: [{ name: 'Blue', rating: 71.2, slope: 137 }],
    playedRounds: [
      { id: 'pr-ph-2011-r2', year: 2011, round: 2 },
      { id: 'pr-ph-2012-r4', year: 2012, round: 4 },
      { id: 'pr-ph-2013-r2', year: 2013, round: 2 },
      { id: 'pr-ph-2015-r4', year: 2015, round: 4 },
      { id: 'pr-ph-2016-r3', year: 2016, round: 3 },
      { id: 'pr-ph-2018-r4', year: 2018, round: 4 },
      { id: 'pr-ph-2019-r4', year: 2019, round: 4 },
      { id: 'pr-ph-2022-r3', year: 2022, round: 3 },
      { id: 'pr-ph-2023-r2', year: 2023, round: 2 },
      { id: 'pr-ph-2024-r2', year: 2024, round: 2 },
      { id: 'pr-ph-2025-r3', year: 2025, round: 3 },
      { id: 'pr-ph-2026-r3', year: 2026, round: 3 },
    ],
  },
  {
    id: 'hist-pinewild-magnolia',
    name: 'Pinewild Magnolia',
    location: 'Pinehurst, NC',
    par: 72,
    website: 'https://pinewildcc.com/golf/magnolia-course/',
    imageUrl: 'https://pinewildcc.com/wp-content/uploads/elementor/thumbs/MagnoliaCourse_01-rcc8s9wcv3uh93h102bj279nh267w0icvkfdiwd9vk.jpg',
    tees: [{ name: 'White', rating: 70.9, slope: 127 }],
    playedRounds: [
      { id: 'pr-pm-2011-r3', year: 2011, round: 3 },
      { id: 'pr-pm-2012-r5', year: 2012, round: 5 },
      { id: 'pr-pm-2013-r3', year: 2013, round: 3 },
      { id: 'pr-pm-2015-r5', year: 2015, round: 5 },
      { id: 'pr-pm-2016-r2', year: 2016, round: 2 },
      { id: 'pr-pm-2018-r5', year: 2018, round: 5 },
      { id: 'pr-pm-2019-r5', year: 2019, round: 5 },
      { id: 'pr-pm-2022-r2', year: 2022, round: 2 },
      { id: 'pr-pm-2023-r3', year: 2023, round: 3 },
      { id: 'pr-pm-2024-r3', year: 2024, round: 3 },
      { id: 'pr-pm-2025-r2', year: 2025, round: 2 },
      { id: 'pr-pm-2026-r2', year: 2026, round: 2 },
    ],
  },
  {
    id: 'hist-mid-south',
    name: 'Mid South',
    location: 'Southern Pines, NC',
    par: 71,
    website: 'https://talamoregolfresort.com/mid-south-club/',
    imageUrl: 'https://talamoregolfresort.com/wp-content/uploads/2025/03/Mid-South-18-and-9-Greens-Aerial.jpg',
    tees: [
      { name: 'Blue',  rating: 72.1, slope: 139 },
      { name: 'White', rating: 70.3, slope: 134 },
    ],
    playedRounds: [
      { id: 'pr-ms-2011-r4', year: 2011, round: 4 },
      { id: 'pr-ms-2014-r3', year: 2014, round: 3 },
      { id: 'pr-ms-2015-r1', year: 2015, round: 1 },
      { id: 'pr-ms-2016-r5', year: 2016, round: 5 },
      { id: 'pr-ms-2018-r3', year: 2018, round: 3 },
      { id: 'pr-ms-2019-r1', year: 2019, round: 1 },
      { id: 'pr-ms-2020-r5', year: 2020, round: 5 },
      { id: 'pr-ms-2021-r2', year: 2021, round: 2 },
      { id: 'pr-ms-2021-r3', year: 2021, round: 3 },
      { id: 'pr-ms-2022-r4', year: 2022, round: 4 },
      { id: 'pr-ms-2022-r5', year: 2022, round: 5 },
      { id: 'pr-ms-2023-r4', year: 2023, round: 4 },
      { id: 'pr-ms-2023-r5', year: 2023, round: 5 },
      { id: 'pr-ms-2024-r4', year: 2024, round: 4 },
      { id: 'pr-ms-2024-r5', year: 2024, round: 5 },
      { id: 'pr-ms-2025-r4', year: 2025, round: 4 },
      { id: 'pr-ms-2025-r5', year: 2025, round: 5 },
      { id: 'pr-ms-2026-r4', year: 2026, round: 4 },
      { id: 'pr-ms-2026-r5', year: 2026, round: 5 },
    ],
  },
  {
    id: 'hist-longleaf',
    name: 'Longleaf Golf Club',
    location: 'Southern Pines, NC',
    website: 'https://www.longleafgfc.com',
    imageUrl: 'https://www.longleafgfc.com/wp-content/uploads/sites/9351/2024/02/longleafwhite.png',
    imageContain: true,
    playedRounds: [
      { id: 'pr-ll-2011-r5', year: 2011, round: 5 },
      { id: 'pr-ll-2012-r1', year: 2012, round: 1 },
      { id: 'pr-ll-2016-r4', year: 2016, round: 4 },
      { id: 'pr-ll-2021-r5', year: 2021, round: 5 },
    ],
  },
  {
    id: 'hist-foxfire-east',
    name: 'Foxfire East',
    location: 'Foxfire Village, NC',
    website: 'https://foxfireresortandgolf.com/',
    imageUrl: 'https://foxfireresortandgolf.com/wp-content/uploads/foxfire_logo_2022a-225x73.png',
    imageContain: true,
    playedRounds: [
      { id: 'pr-fxe-2012-r2', year: 2012, round: 2 },
    ],
  },
  {
    id: 'hist-foxfire-west',
    name: 'Foxfire West',
    location: 'Foxfire Village, NC',
    website: 'https://foxfireresortandgolf.com/',
    imageUrl: 'https://foxfireresortandgolf.com/wp-content/uploads/foxfire_logo_2022a-225x73.png',
    imageContain: true,
    playedRounds: [
      { id: 'pr-fxw-2012-r3', year: 2012, round: 3 },
    ],
  },
  {
    id: 'hist-national-gc',
    name: 'Pinehurst No. 9',
    location: 'Pinehurst, NC',
    website: 'https://www.pinehurst.com/golf/courses/no-9/',
    imageUrl: 'https://cdn-ilbbpdb.nitrocdn.com/ZPvHxDAnfjiOCTRKZzZlFwdZrjJUwSbC/assets/images/source/rev-a12baff/www.pinehurst.com/wp-content/themes/pinehurst/images/logos/PB_1895_Logo_White.svg',
    imageContain: true,
    notes: 'Originally the National Golf Club of NC; acquired by Pinehurst Resort in 2014 and redesignated as Pinehurst No. 9.',
    playedRounds: [
      { id: 'pr-ngc-2013-r1', year: 2013, round: 1 },
    ],
  },
  {
    id: 'hist-the-carolina',
    name: 'The Carolina Golf Club',
    location: 'Pinehurst, NC',
    website: 'https://www.where2golf.com/usa-carolinas/the-carolina-golf-club/',
    imageUrl: 'https://d4iskb05x8hds.cloudfront.net/images/suD9wk6A8MA3vu2O-ZX880NU77E=/37854/fill-600x500/',
    playedRounds: [
      { id: 'pr-car-2013-r4', year: 2013, round: 4 },
      { id: 'pr-car-2013-r5', year: 2013, round: 5 },
    ],
  },
  {
    id: 'hist-dormie',
    name: 'Dormie Club',
    location: 'Pinehurst, NC',
    website: 'https://www.dormieclub.com',
    notes: 'Private club-style course, open by invitation.',
    imageUrl: 'https://images.squarespace-cdn.com/content/v1/61df380b5fb02b0f290a928f/568817cb-e24d-41f7-abe9-b94107a9ce58/dormie+club_background.png',
    playedRounds: [
      { id: 'pr-dorm-2014-r1', year: 2014, round: 1 },
      { id: 'pr-dorm-2016-r1', year: 2016, round: 1 },
      { id: 'pr-dorm-2018-r1', year: 2018, round: 1 },
    ],
  },
  {
    id: 'hist-whispering-pines-pines',
    name: 'Whispering Pines CC — Pines Course',
    location: 'Whispering Pines, NC',
    website: 'https://countryclubofwhisperingpines.com/',
    imageUrl: 'https://countryclubofwhisperingpines.com/wp-content/uploads/2020/03/logo.ccwp_.banner-229x61.png',
    imageContain: true,
    playedRounds: [
      { id: 'pr-wpp-2014-r4', year: 2014, round: 4 },
    ],
  },
  {
    id: 'hist-whispering-pines-river',
    name: 'Whispering Pines CC — River Course',
    location: 'Whispering Pines, NC',
    website: 'https://countryclubofwhisperingpines.com/',
    imageUrl: 'https://countryclubofwhisperingpines.com/wp-content/uploads/2020/03/logo.ccwp_.banner-229x61.png',
    imageContain: true,
    playedRounds: [
      { id: 'pr-wpr-2014-r5', year: 2014, round: 5 },
    ],
  },
  {
    id: 'hist-southern-pines-gc',
    name: 'Southern Pines Golf Club',
    location: 'Southern Pines, NC',
    website: 'https://www.southernpinesgolfclub.com',
    imageUrl: 'https://www.southernpinesgolfclub.com/wp-content/uploads/2021/11/SPGC-banner-8.png',
    playedRounds: [
      { id: 'pr-spgc-2015-r2', year: 2015, round: 2 },
      { id: 'pr-spgc-2022-r1', year: 2022, round: 1 },
    ],
  },
  {
    id: 'hist-legacy',
    name: 'Legacy Golf Links',
    location: 'Aberdeen, NC',
    website: 'https://talamoregolfresort.com/resort-golf/legacy-golf-links/',
    imageUrl: 'https://talamoregolfresort.com/wp-content/uploads/2021/11/DJI_0596E-1820x1365.jpg',
    playedRounds: [
      { id: 'pr-leg-2015-r3', year: 2015, round: 3 },
      { id: 'pr-leg-2020-r1', year: 2020, round: 1 },
      { id: 'pr-leg-2025-r1', year: 2025, round: 1 },
    ],
  },
  {
    id: 'hist-ccnc-dogwood',
    name: 'Country Club of NC — Dogwood',
    location: 'Pinehurst, NC',
    website: 'https://www.ccofnc.com/public/golf-1390.html',
    imageUrl: 'https://www.ccofnc.com/_filelib/ImageGallery/Design/125_104_logo2.png',
    imageContain: true,
    playedRounds: [
      { id: 'pr-dog-2019-r2', year: 2019, round: 2 },
      { id: 'pr-dog-2019-r3', year: 2019, round: 3 },
      { id: 'pr-dog-2020-r2', year: 2020, round: 2 },
    ],
  },
  {
    id: 'hist-ccnc-cardinal',
    name: 'Country Club of NC — Cardinal',
    location: 'Pinehurst, NC',
    website: 'https://www.ccofnc.com/public/golf-1390.html',
    imageUrl: 'https://www.ccofnc.com/_filelib/ImageGallery/Design/125_104_logo2.png',
    imageContain: true,
    playedRounds: [
      { id: 'pr-card-2020-r3', year: 2020, round: 3 },
    ],
  },
  {
    id: 'hist-pine-needles',
    name: 'Pine Needles',
    location: 'Southern Pines, NC',
    par: 71,
    website: 'https://www.pineneedleslodge.com/courses/',
    imageUrl: 'https://www.pineneedleslodge.com/wp-content/uploads/2018/04/GolfHero.jpg',
    tees: [
      { name: 'Ross',  rating: 71.9, slope: 138 },
      { name: 'White', rating: 70.0, slope: 133 },
    ],
    playedRounds: [
      { id: 'pr-pn-2021-r1', year: 2021, round: 1 },
      { id: 'pr-pn-2026-r1', year: 2026, round: 1 },
    ],
  },
  {
    id: 'hist-mid-pines',
    name: 'Mid Pines Inn & Golf Club',
    location: 'Southern Pines, NC',
    website: 'https://www.midpinesinn.com',
    notes: 'Classic Donald Ross design, sister course to Pine Needles.',
    imageUrl: 'https://www.midpinesinn.com/wp-content/uploads/2018/05/GolfAcademySlider.jpg',
    playedRounds: [
      { id: 'pr-mp-2023-r1', year: 2023, round: 1 },
    ],
  },

  // ── Asheville year (2017) ─────────────────────────────────────────────────

  {
    id: 'hist-grove-park-inn',
    name: 'Grove Park Inn Golf Course',
    location: 'Asheville, NC',
    website: 'https://www.omnihotels.com/hotels/asheville-grove-park/golf',
    notes: '2017 — the one year the group went to Asheville.',
    imageUrl: 'https://www.omnihotels.com/-/media/images/hotels/gpirst/golf/gpirst-spring-golf-pair-resort-in-distance.jpg?h=660&iar=0&w=1170',
    playedRounds: [
      { id: 'pr-gpi-2017-r1', year: 2017, round: 1 },
    ],
  },
  {
    id: 'hist-broadmoor',
    name: 'Broadmoor Golf Links',
    location: 'Asheville, NC',
    website: 'https://www.broadmoorgolflinks.com',
    notes: '2017 Asheville trip.',
    imageUrl: 'https://www.broadmoorgolflinks.com/wp-content/uploads/sites/8911/2026/01/Broadmoor-course-sunset.jpg',
    playedRounds: [
      { id: 'pr-bm-2017-r2', year: 2017, round: 2 },
    ],
  },
  {
    id: 'hist-high-vista',
    name: 'High Vista Golf Club',
    location: 'Mills River, NC',
    website: 'https://golfnorthcarolina.com/courses/high-vista-golf-and-country-club/',
    imageUrl: 'https://images.ctfassets.net/56u5qdsjym8c/6kQFDyNM3Vb6eEbABGNFaf/a4c5170032ba4294784b9675c006edec/golf-grass-green-riot-2.jpg?h=600&w=900&fit=fill&fl=progressive&q=80',
    notes: '2017 Asheville trip.',
    playedRounds: [
      { id: 'pr-hv-2017-r3', year: 2017, round: 3 },
    ],
  },
  {
    id: 'hist-cummings-cove',
    name: 'Cummings Cove Golf Club',
    location: 'Hendersonville, NC',
    website: 'https://www.cummingscovegolf.com',
    notes: '2017 Asheville trip — played both Saturday rounds.',
    imageUrl: 'https://www.cummingscovegolf.com/wp-content/uploads/sites/9890/2026/03/course-tour.jpg',
    playedRounds: [
      { id: 'pr-cc-2017-r4', year: 2017, round: 4 },
      { id: 'pr-cc-2017-r5', year: 2017, round: 5 },
    ],
  },
]

// Fallback image map — used by CourseHistory to fill in images for entries
// persisted before imageUrl was added, without requiring a store migration to run.
export const COURSE_IMAGE_DEFAULTS: Record<string, string> = Object.fromEntries(
  INITIAL_COURSE_HISTORY
    .filter(c => c.imageUrl)
    .map(c => [c.id, c.imageUrl as string])
)

export const COURSE_IMAGE_CONTAIN: Record<string, true> = Object.fromEntries(
  INITIAL_COURSE_HISTORY
    .filter(c => c.imageContain)
    .map(c => [c.id, true])
)

// Name overrides — ensures renamed built-in courses show correctly even if
// localStorage has an older name persisted.
export const COURSE_NAME_OVERRIDES: Record<string, string> = Object.fromEntries(
  INITIAL_COURSE_HISTORY.map(c => [c.id, c.name])
)

// Website overrides — ensures updated URLs show correctly without migration.
export const COURSE_WEBSITE_OVERRIDES: Record<string, string> = Object.fromEntries(
  INITIAL_COURSE_HISTORY
    .filter(c => c.website)
    .map(c => [c.id, c.website as string])
)

// Notes overrides — ensures updated notes show correctly without migration.
export const COURSE_NOTES_OVERRIDES: Record<string, string> = Object.fromEntries(
  INITIAL_COURSE_HISTORY
    .filter(c => c.notes)
    .map(c => [c.id, c.notes as string])
)
