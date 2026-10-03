import { Question } from '../types/game';

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'q1',
    title: 'Rank what Mahatma Gandhi would be most disappointed by if he visited 2026 India:',
    category: 'Gandhi Special',
    darkHumorTrivia: 'Bapu walked 388 km for Salt. Modern youth won\'t walk 300 meters without ordering an Uber Auto.',
    bapuCommentary: '"I fought for independence, not for reels made in front of my statues!"',
    options: [
      { id: 'q1_o1', text: 'Instagram Reels made in front of the Sabarmati Ashram', presetPercentage: 38, presetPoints: 38 },
      { id: 'q1_o2', text: '5-Star luxury hotels charging ₹800 for "Organic Goat Milk"', presetPercentage: 27, presetPoints: 27 },
      { id: 'q1_o3', text: 'Grandchildren arguing over property while quoting Ahimsa', presetPercentage: 18, presetPoints: 18 },
      { id: 'q1_o4', text: 'People wearing Khadi only to look aesthetic on LinkedIn', presetPercentage: 11, presetPoints: 11 },
      { id: 'q1_o5', text: 'Fast-food joints selling "Non-Violent Vegan Crispy Burgers"', presetPercentage: 6, presetPoints: 6 },
    ],
  },
  {
    id: 'q2',
    title: 'Rank the top excuses an Indian kid gives after getting caught breaking a house rule:',
    category: 'Indian Parivar',
    darkHumorTrivia: 'Belts and Flying Chappals have a 99.4% accuracy rate in Indian households.',
    bapuCommentary: '"Non-violence ends where an Indian mom\'s flying footwear begins."',
    options: [
      { id: 'q2_o1', text: '"Sharma ji\'s son was doing it first!"', presetPercentage: 42, presetPoints: 42 },
      { id: 'q2_o2', text: '"I was doing combined study for Board Exams!"', presetPercentage: 26, presetPoints: 26 },
      { id: 'q2_o3', text: '"My phone battery died, I swear!"', presetPercentage: 16, presetPoints: 16 },
      { id: 'q2_o4', text: '"I was praying at the temple on the way back."', presetPercentage: 10, presetPoints: 10 },
      { id: 'q2_o5', text: '"It was a fast for Bapu\'s soul!"', presetPercentage: 6, presetPoints: 6 },
    ],
  },
  {
    id: 'q3',
    title: 'If Bapu had a smartphone during the Dandi Salt March, what app would he use most?',
    category: 'Dark Satire',
    darkHumorTrivia: 'Dandi March took 24 days. Strava users would have turned it into a marathon flex with GPS tracking.',
    bapuCommentary: '"My Fast-unto-Death would be live-streamed on Twitch with subscriber goals."',
    options: [
      { id: 'q3_o1', text: 'Strava (to flex 388 km step-count on British Viceroy)', presetPercentage: 35, presetPoints: 35 },
      { id: 'q3_o2', text: 'Zomato (to complain about saltless meals)', presetPercentage: 25, presetPoints: 25 },
      { id: 'q3_o3', text: 'X / Twitter (to drop savage clapbacks at Winston Churchill)', presetPercentage: 20, presetPoints: 20 },
      { id: 'q3_o4', text: 'WhatsApp Family Group (sending "Good Morning" with spinning charkha GIFs)', presetPercentage: 13, presetPoints: 13 },
      { id: 'q3_o5', text: 'Tinder (Bio: "Looking for someone non-violent and peaceful")', presetPercentage: 7, presetPoints: 7 },
    ],
  },
  {
    id: 'q4',
    title: 'Rank the fastest ways to start a massive fight at an Indian family wedding:',
    category: 'Indian Parivar',
    darkHumorTrivia: 'Fufa-ji (Uncle) is legally obligated to be offended at least three times per wedding function.',
    bapuCommentary: '"True Satyagraha is sitting silently while Fufa-ji complains about lukewarm Paneer."',
    options: [
      { id: 'q4_o1', text: 'Forgetting to greet Fufa-ji first at the entrance', presetPercentage: 45, presetPoints: 45 },
      { id: 'q4_o2', text: 'Running out of Gulab Jamun at the dessert counter', presetPercentage: 24, presetPoints: 24 },
      { id: 'q4_o3', text: 'Comparing wedding budget to Cousin\'s grand wedding last month', presetPercentage: 15, presetPoints: 15 },
      { id: 'q4_o4', text: 'DJ playing Naagin Dance music 10 minutes past midnight', presetPercentage: 10, presetPoints: 10 },
      { id: 'q4_o5', text: 'Accidentally revealing the groom\'s ex was invited', presetPercentage: 6, presetPoints: 6 },
    ],
  },
  {
    id: 'q5',
    title: 'Rank what Indian parents consider the biggest "sin" a child can commit:',
    category: 'Dark Satire',
    darkHumorTrivia: 'Choosing Arts over Engineering has caused more family drama than 1947 partition debates.',
    bapuCommentary: '"An eye for an eye leaves the whole world blind, but choosing BA in Drama leaves your father silent."',
    options: [
      { id: 'q5_o1', text: 'Choosing BA in Fine Arts over B.Tech Computer Science', presetPercentage: 40, presetPoints: 40 },
      { id: 'q5_o2', text: 'Waking up after 9:00 AM on a Sunday morning', presetPercentage: 28, presetPoints: 28 },
      { id: 'q5_o3', text: 'Drinking cold water straight from the fridge while having a slight cough', presetPercentage: 17, presetPoints: 17 },
      { id: 'q5_o4', text: 'Answering back with logical facts during a lecture', presetPercentage: 10, presetPoints: 10 },
      { id: 'q5_o5', text: 'Throwing away Tupperware container lids', presetPercentage: 5, presetPoints: 5 },
    ],
  }
];
