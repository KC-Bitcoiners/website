import React from "react";
import Head from "next/head";
import EventCard from "@/components/EventCard";
import VideoSection from "@/components/VideoSection";

export default function BlockParty() {
  const eventData = {
    date: "09/15/2024",
    title: "Bitcoin Block Party",
    startTime: "2 pm",
    endTime: "8 pm",
    location: "5835 Lamar Ave, Mission, KS",
    description: [
      "Join us for Kansas City's 4th Bitcoin Block Party on Sunday September 15th from 2pm to 8pm at RJ's Bob-Be-Que (5835 Lamar Ave, Mission, KS).",
      "Enjoy complimentary beer and barbecue, a vendor market, and live music as we interact with and celebrate Bitcoin. Come learn, celebrate, and engage with your community!",
      "If you're new to Bitcoin, don't worry! We will have plenty of expert Bitcoiners on site to help you buy Bitcoin, set up a wallet, and start using it to support local vendors!",
    ],
  };

  const videoUrl =
    "https://player.vimeo.com/video/1006322170?h=82546469e4&autoplay=0&title=0&portrait=0&byline=0&badge=0&loop=0&muted=0&controls=1";

  return (
    <>
      <Head>
        <title>Block Party - KC Bitcoin Meetup Group</title>
        <meta
          name="description"
          content="Special Bitcoin events and block party celebrations in Kansas City"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <section className="my-16 max-w-6xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-black bitcoin-orange mb-8 font-archivo-black">
          Block Party
        </h1>
      </section>

      {/* Event Card Section */}
      <section className="bg-white my-16 container mx-auto px-6">
        <EventCard {...eventData} />
      </section>

      <VideoSection
        title="LEARN MORE"
        videoUrl={videoUrl}
        videoTitle="Bitcoin Block Party Video"
      />
    </>
  );
}
