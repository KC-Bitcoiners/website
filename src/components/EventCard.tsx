import React from "react";

interface EventCardProps {
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string[];
}

export default function EventCard({
  date,
  title,
  startTime,
  endTime,
  location,
  description,
}: EventCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-8 w-full">
      <div className="grid md:grid-cols-4 gap-6 items-start">
        {/* Date Column */}
        <div className="md:col-span-1">
          <h3 className="text-3xl font-bold bitcoin-orange font-archivo-black mb-2">
            {date}
          </h3>
        </div>

        {/* Event Details Column */}
        <div className="md:col-span-2">
          <h4 className="text-2xl font-bold text-gray-900 mb-4 font-archivo-black">
            {title}
          </h4>
          <p className="text-gray-600 mb-4">{location}</p>
          <div className="text-gray-700 space-y-4">
            {description.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>

        {/* Time and Location Column */}
        <div className="md:col-span-1 text-right">
          <div className="space-y-2 text-lg font-semibold text-gray-900">
            <h4>
              {startTime} - {endTime}
            </h4>
            <p className="text-gray-600 text-sm">{location}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
