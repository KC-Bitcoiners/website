// Static events data for fully static build
export interface StaticEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  image?: string;
  link?: string;
  isPast?: boolean;
}

export const staticEvents: StaticEvent[] = [
  {
    id: "kc-weekly-meetup-1",
    title: "KC Bitcoiners Weekly Meetup",
    description: "Join us for our weekly Bitcoin meetup where we discuss the latest in Bitcoin technology, price action, and adoption. All skill levels welcome!",
    location: "123 Main St, Kansas City, MO",
    startDate: "2024-01-15",
    startTime: "18:00",
    endTime: "20:00",
    image: "/bitcoinShaka.jpg",
    link: "https://meetup.com/kc-bitcoiners",
  },
  {
    id: "bitcoin-workshop-1",
    title: "Bitcoin Wallet Security Workshop",
    description: "Learn how to secure your Bitcoin holdings with proper wallet management, backup strategies, and best practices for self-custody.",
    location: "Tech Hub, Kansas City",
    startDate: "2024-01-22",
    startTime: "14:00",
    endTime: "17:00",
    image: "/bitcoinShaka.jpg",
  },
  {
    id: "lightning-network-presentation",
    title: "Lightning Network Deep Dive",
    description: "A technical presentation on how the Lightning Network works, including channels, routing, and practical usage examples.",
    location: "University of Missouri-Kansas City",
    startDate: "2024-02-05",
    startTime: "19:00",
    endTime: "21:00",
    image: "/bitcoinShaka.jpg",
  },
];

// Helper functions for static event handling
export const getUpcomingStaticEvents = (): StaticEvent[] => {
  const now = new Date();
  return staticEvents.filter(event => {
    const eventDate = new Date(event.startDate);
    return eventDate >= now;
  }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
};

export const getPastStaticEvents = (): StaticEvent[] => {
  const now = new Date();
  return staticEvents.filter(event => {
    const eventDate = new Date(event.startDate);
    return eventDate < now;
  }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
};

export const getStaticEventById = (id: string): StaticEvent | undefined => {
  return staticEvents.find(event => event.id === id);
};
