import { Question } from '../types/game';

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'q1',
    title: 'Rank what Mahatma Gandhi would be most disappointed by if he visited 2026 India:',
    category: 'Gandhi Special',
    darkHumorTrivia: 'Bapu walked 388 km for Salt. Modern youth won\'t walk 300 meters without ordering an Uber Auto.',
    bapuCommentary: '"I fought for independence, not for reels made in front of my statues!"',
    options: [
      { id: 'q1_o1', text: 'Instagram Reels made in front of Sabarmati Ashram', presetPercentage: 42, presetPoints: 42 },
      { id: 'q1_o2', text: '5-Star luxury hotels charging ₹800 for "Organic Goat Milk"', presetPercentage: 28, presetPoints: 28 },
      { id: 'q1_o3', text: 'Grandchildren arguing over property while quoting Ahimsa', presetPercentage: 18, presetPoints: 18 },
      { id: 'q1_o4', text: 'People wearing Khadi only to look aesthetic on LinkedIn', presetPercentage: 8, presetPoints: 8 },
      { id: 'q1_o5', text: 'Fast-food joints selling "Non-Violent Vegan Crispy Burgers"', presetPercentage: 4, presetPoints: 4 },
    ],
  },
  {
    id: 'q2',
    title: 'Rank the top excuses an Indian kid gives after getting caught breaking a house rule:',
    category: 'Indian Parivar',
    darkHumorTrivia: 'Belts and Flying Chappals have a 99.4% accuracy rate in Indian households.',
    bapuCommentary: '"Non-violence ends where an Indian mom\'s flying footwear begins."',
    options: [
      { id: 'q2_o1', text: '"Sharma ji\'s son was doing it first!"', presetPercentage: 45, presetPoints: 45 },
      { id: 'q2_o2', text: '"I was doing combined study for Board Exams!"', presetPercentage: 25, presetPoints: 25 },
      { id: 'q2_o3', text: '"My phone battery died, I swear!"', presetPercentage: 15, presetPoints: 15 },
      { id: 'q2_o4', text: '"I was praying at the temple on the way back."', presetPercentage: 10, presetPoints: 10 },
      { id: 'q2_o5', text: '"It was a fast for Bapu\'s soul!"', presetPercentage: 5, presetPoints: 5 },
    ],
  },
  {
    id: 'q3',
    title: 'If Bapu had a smartphone during the Dandi Salt March, what app would he use most?',
    category: 'Dark Satire',
    darkHumorTrivia: 'Dandi March took 24 days. Strava users would have turned it into a marathon flex with GPS tracking.',
    bapuCommentary: '"My Fast-unto-Death would be live-streamed on Twitch with subscriber goals."',
    options: [
      { id: 'q3_o1', text: 'Strava (to flex 388 km step-count on British Viceroy)', presetPercentage: 38, presetPoints: 38 },
      { id: 'q3_o2', text: 'Zomato (to complain about saltless meals)', presetPercentage: 26, presetPoints: 26 },
      { id: 'q3_o3', text: 'X / Twitter (to drop savage clapbacks at Winston Churchill)', presetPercentage: 19, presetPoints: 19 },
      { id: 'q3_o4', text: 'WhatsApp Family Group (sending "Good Morning" with spinning charkha GIFs)', presetPercentage: 12, presetPoints: 12 },
      { id: 'q3_o5', text: 'Tinder (Bio: "Looking for someone non-violent and peaceful")', presetPercentage: 5, presetPoints: 5 },
    ],
  }
];
