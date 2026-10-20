const en = {
  appName: 'BLOP Match',
  languageLabel: 'Language',
  meta: {
    description: 'Meet people who like what you like.',
  },
  common: {
    signOut: 'Sign out',
    genericError: 'Something went wrong. Please try again.',
  },
  home: {
    tagline: 'People happen here',
    title: 'Meet people who like what you like',
    subtitle: 'A short friendship experiment by BLOP. Tell us what you love and we will introduce you to people around you.',
    howTitle: 'How it works',
    steps: [
      'Sign in and tell us a bit about you and your interests (about 5 minutes).',
      'We email you when you have a match. You will see their first name, WhatsApp and Instagram.',
      'Reach out, have a chat and, if it clicks, meet up.',
    ],
    review: (days: number) =>
      `${days} ${days === 1 ? 'day' : 'days'} after each match, we ask you to rate the interaction. It takes 2 minutes.`,
    duration: 'The study runs for about 2 weeks. It is just for friendship.',
    privacy: 'Only your matches see your first name, WhatsApp and Instagram. You can leave at any time.',
    privacyLink: 'Read the privacy notice',
    cta: 'Join the experiment',
  },
  login: {
    title: 'Join BLOP Match',
    subtitle: 'No passwords. Pick one option.',
    google: 'Continue with Google',
    or: 'or',
    emailLabel: 'Your email',
    emailPlaceholder: 'you@example.com',
    emailSubmit: 'Email me a sign-in link',
    sending: 'Sending…',
    sentTitle: 'Check your inbox',
    sentBody: 'We sent a sign-in link to your email. Open it on this phone to continue.',
    useAnotherEmail: 'Use another email',
    invalidEmail: 'Please enter a valid email.',
    sendError: 'We could not send the link. Wait a minute and try again.',
    googleError: 'We could not open Google sign-in. Please try again.',
    authError: 'That sign-in link did not work or has expired. Please try again.',
  },
  join: {
    title: 'Create your profile',
    subtitle: 'This is what we use to find your matches.',
    name: 'First name',
    whatsapp: 'WhatsApp',
    whatsappHint: 'With country code, e.g. +351 912 345 678',
    instagram: 'Instagram',
    instagramHint: 'Your handle, without @',
    city: 'City',
    cityPlaceholder: 'e.g. Lisbon',
    ageRange: 'Age',
    timeInCity: 'How long have you lived in this city?',
    origin: 'Where are you from?',
    interestsTitle: 'Your interests',
    interestsHint: 'Pick 3 to 6 in each category.',
    otherLabel: 'Other (optional)',
    otherPlaceholder: 'Anything we missed?',
    consent:
      'I agree to share my first name, WhatsApp and Instagram with my matches, and to take part in this research study. I am 18 or older.',
    consentLink: 'Privacy notice',
    submit: 'Join',
    submitting: 'Saving…',
    fixErrors: 'Please check the highlighted fields.',
    categories: {
      music: 'Music',
      sports: 'Sports',
      food: 'Food & drinks',
      hobbies: 'Hobbies',
    },
    ageOptions: {
      '18-24': '18–24',
      '25-30': '25–30',
      '31-35': '31–35',
      '36+': '36+',
    },
    timeInCityOptions: {
      lt6m: 'Less than 6 months',
      '6-24m': '6 months to 2 years',
      '2y+': 'More than 2 years',
      always: 'All my life',
    },
    originOptions: {
      this_city: 'This city',
      same_country: 'Another city in this country',
      other_country: 'Another country',
    },
    errors: {
      required: 'This field is required.',
      tooLong: 'This is too long.',
      whatsapp: 'Include your country code, e.g. +351 912 345 678.',
      instagram: 'Use only letters, numbers, dots and underscores.',
      interests: 'Pick 3 to 6.',
      consent: 'You need to agree to take part.',
    },
  },
  me: {
    title: (name: string) => `Hi, ${name}!`,
    noMatches: "We'll email you as soon as you get a match.",
  },
  privacy: {
    title: 'Privacy notice',
    sections: [
      {
        heading: 'Who we are',
        body: 'BLOP Match is an academic study by the BLOP project (MIET 2026). It tests whether shared interests help strangers connect.',
      },
      {
        heading: 'What we collect',
        body: 'Your profile (first name, email, WhatsApp, Instagram, city, language, age range, time in the city, origin and interests) and the reviews you send about your matches.',
      },
      {
        heading: 'Who sees it',
        body: 'Your matches see your first name, WhatsApp, Instagram and the interests you have in common. They never see your email. The research team sees everything, for analysis only.',
      },
      {
        heading: 'How long we keep it',
        body: 'Until the end of the study. After that, the data is anonymised or deleted.',
      },
      {
        heading: 'Your choices',
        body: '"Leave the study" deactivates your profile, so you get no new matches. To delete your data, just write to founders@meetblop.com.',
      },
      {
        heading: 'Age',
        body: 'You must be 18 or older to take part.',
      },
    ],
  },
  emails: {
    button: 'Go to my page',
    footer: 'BLOP Match · a research study by BLOP (MIET 2026)',
    welcome: {
      subject: 'Welcome to BLOP Match',
      greeting: (name: string) => `Hi ${name},`,
      body: 'Thanks for joining the experiment! Here is what happens next:',
      steps: [
        'We email you when you have a match.',
        'Say hi on WhatsApp or Instagram and have a chat.',
        'A few days later, we ask you to rate the interaction.',
      ],
    },
  },
  footer: {
    privacy: 'Privacy',
  },
};

export type Dict = typeof en;
export default en;
