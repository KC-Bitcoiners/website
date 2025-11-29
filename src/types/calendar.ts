// Simplified CalendarEvent interface based on nostrcal's CalendarEvent
export interface CalendarEvent {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  
  // Parsed calendar data
  dTag?: string;
  title?: string;
  summary?: string;
  image?: string;
  start?: string;
  end?: string;
  location?: string;
  locations?: string[];
  geohash?: string;
  description?: string;
  timezone?: string;
  endTimezone?: string;
  hashtags?: string[];
  references?: string[];
  participants?: string[];
  
  // UI properties
  color?: string;
  source?: string;
}

// Event creation form data
export interface EventFormData {
  title: string;
  description: string;
  summary: string;
  image: string;
  locations: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  hashtags: string[];
  references: string[];
  eventType: 'timed' | 'all-day';
}
