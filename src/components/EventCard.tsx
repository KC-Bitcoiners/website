import React from "react";
import { ClockIcon, MarkerIcon } from "./Icons";

interface EventCardProps {
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  link?: string;
  description: string[];
  className?: string; // Allow custom background color
}

export default function EventCard({
  date,
  title,
  startTime,
  endTime,
  location,
  description,
  link,
  className,
}: EventCardProps) {
  return (
    <div
      className={`${className || "bg-white border border-gray-200"} rounded-lg shadow-lg p-4 sm:p-6 lg:p-8 w-full overflow-hidden`}
    >
      {/* Mobile-first layout */}
      <div className="space-y-4 sm:space-y-6">
        {/* Header section with date and title */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6">
          <div className="order-2 sm:order-1 flex-1">
            <h4 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-2 font-archivo-black leading-tight">
              {link ? (
                <a
                  className="hover:underline"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {title}
                </a>
              ) : (
                title
              )}
            </h4>
          </div>
          <div className="order-1 sm:order-2 flex-shrink-0">
            <h3 className="text-2xl sm:text-3xl font-bold bitcoin-orange font-archivo-black">
              {date}
            </h3>
          </div>
        </div>

        {/* Time and location section */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-gray-600">
          <div className="flex items-center gap-2">
            <ClockIcon className="size-6 text-gray-500" />
            <span className="font-semibold text-gray-900">
              {startTime} - {endTime}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MarkerIcon className="size-6 text-gray-500" />
            {location && location !== "Location TBD" ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm sm:text-base text-blue-600 hover:text-blue-800 underline hover:underline-offset-2"
                title="Open in Google Maps"
              >
                {location}
              </a>
            ) : (
              <span className="text-sm sm:text-base">{location}</span>
            )}
          </div>
        </div>

        {/* Description section */}
        <div className="text-gray-700 space-y-2">
          {description.map((paragraph, index) => (
            <p key={index} className="text-sm sm:text-base leading-relaxed">
              {paragraph.replaceAll("\\", "")}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
