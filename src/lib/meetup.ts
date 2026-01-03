import { GraphQLClient, gql } from "graphql-request";
import { meetupConfig } from "@/config";

// TypeScript interfaces for the GraphQL response
export interface Venue {
  id: string;
  lat: number;
  lon: number;
  postalCode: string;
  city: string;
  state: string;
  address: string;
  country: string;
}

export interface EventNode {
  id: string;
  description: string;
  title: string;
  dateTime: string;
  endTime: string;
  eventUrl: string;
  createdTime: string;
  howToFindUs: string;
  venues: Venue[];
}

export interface EventEdge {
  node: EventNode;
}

export interface MeetupGroup {
  name: string;
  urlname: string;
  lat: number;
  lon: number;
  link: string;
  description: string;
  events: {
    edges: EventEdge[];
  };
}

export interface GraphQLResponse {
  groupByUrlname: MeetupGroup;
}

// GraphQL query for fetching events
const EVENTS_QUERY = gql`
  query GetGroupEvents {
    groupByUrlname(urlname: "${meetupConfig.groupName}") {
      name
      urlname
      lat
      lon
      link
      description
      events {
        edges {
          node {
            id
            description
            title
            dateTime
            endTime
            eventUrl
            createdTime
            howToFindUs
            venues {
              id
              lat
              lon
              postalCode
              city
              state
              address
              country
            }
          }
        }
      }
    }
  }
`;

// Function to fetch meetup events
export async function fetchMeetupEvents(): Promise<MeetupGroup> {
  const client = new GraphQLClient(meetupConfig.graphqlUrl);
  const data: GraphQLResponse = await client.request(EVENTS_QUERY);

  if (!data.groupByUrlname) {
    throw new Error("Group not found");
  }

  return data.groupByUrlname;
}

// Helper function to get venue address
export const getVenueAddress = (venues: Venue[]): string => {
  if (!venues || venues.length === 0) return "Venue TBA";
  const venue = venues[0];
  if (!venue.address) return "Venue TBA";
  return `${venue.address}, ${venue.city}, ${venue.state}`;
};
