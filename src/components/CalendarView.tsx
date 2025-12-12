import React, { useState, useEffect, useRef } from "react";
import { CalendarEvent } from "../types/calendar";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";

type ViewType = "month" | "week" | "day";

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  currentView?: 'month' | 'week' | 'day';
  getEventColor?: (event: CalendarEvent) => string;
}

export default function CalendarView({ events, onEventClick, currentView, getEventColor }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const viewType = currentView || "month";
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const dayScrollRef = useRef<HTMLDivElement>(null);

  // Smart time range: show limited time range around events instead of full 24 hours
  useEffect(() => {
    const calculateTimeRange = (events: CalendarEvent[]) => {
      if (events.length === 0) {
        // No events - show 6am to 10pm range
        return { startHour: 6, endHour: 22, totalHours: 16 };
      }

      // Find earliest and latest event times
      let earliestHour = 18; // Default to 6pm
      let latestHour = 8; // Default to 8am

      events.forEach((event) => {
        if (event.kind === 31922) return; // Skip all-day events

        let startTime: number;
        if (event.start?.includes("-")) {
          startTime = new Date(event.start).getTime() / 1000;
        } else {
          startTime = parseInt(event.start || "0");
        }

        const eventDate = new Date(startTime * 1000);
        const eventHour = eventDate.getHours();

        if (eventHour < earliestHour) {
          earliestHour = eventHour;
        }
        if (eventHour > latestHour) {
          latestHour = eventHour;
        }
      });

      // Show 2 hours before earliest and 2 hours after latest
      const startHour = Math.max(0, earliestHour - 2);
      const endHour = Math.min(23, latestHour + 2);
      const totalHours = endHour - startHour + 1;

      return { startHour, endHour, totalHours };
    };

    // Time range calculation is now handled within each view's render function
  }, [viewType, currentDate, events]);

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);

    switch (viewType) {
      case "month":
        if (direction === "prev") {
          newDate.setMonth(newDate.getMonth() - 1);
        } else {
          newDate.setMonth(newDate.getMonth() + 1);
        }
        break;
      case "week":
        if (direction === "prev") {
          newDate.setDate(newDate.getDate() - 7);
        } else {
          newDate.setDate(newDate.getDate() + 7);
        }
        break;
      case "day":
        if (direction === "prev") {
          newDate.setDate(newDate.getDate() - 1);
        } else {
          newDate.setDate(newDate.getDate() + 1);
        }
        break;
    }

    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const formatWeekRange = (date: Date) => {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const formatDayDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    // Use local timezone for date comparison
    const startOfDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      23,
      59,
      59,
      999,
    );
    const startOfDayTimestamp = Math.floor(startOfDay.getTime() / 1000);
    const endOfDayTimestamp = Math.floor(endOfDay.getTime() / 1000);

    return events.filter((event) => {
      if (event.kind === 31922) {
        // All-day event - check if event date matches the calendar date
        if (event.start && event.end) {
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);
          // Check if the event spans the current date
          return eventStart <= endOfDay && eventEnd >= startOfDay;
        } else if (event.start) {
          const eventStart = new Date(event.start);
          // Compare dates in local timezone
          return (
            eventStart.getFullYear() === date.getFullYear() &&
            eventStart.getMonth() === date.getMonth() &&
            eventStart.getDate() === date.getDate()
          );
        }
        return false;
      } else {
        // Timed event
        const eventStart = parseInt(event.start || "0");
        const eventEnd = parseInt(event.end || eventStart.toString());

        // Check if event overlaps with the current day (using local timezone timestamps)
        return (
          (eventStart >= startOfDayTimestamp &&
            eventStart <= endOfDayTimestamp) ||
          (eventEnd >= startOfDayTimestamp && eventEnd <= endOfDayTimestamp) ||
          (eventStart <= startOfDayTimestamp && eventEnd >= endOfDayTimestamp)
        );
      }
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getWeekDays = (date: Date) => {
    const weekDays = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    const startOfDay = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate(),
    );

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfDay);
      day.setDate(startOfDay.getDate() + i);
      weekDays.push(day);
    }

    return weekDays;
  };

  const calculateEventPosition = (event: CalendarEvent) => {
    if (event.kind === 31922) return null; // Skip all-day events

    // Handle both timestamp strings and date strings
    let startTime: number;
    let endTime: number;

    if (event.start?.includes("-")) {
      // Date string format (from meetup events)
      startTime = new Date(event.start).getTime() / 1000;
      endTime = event.end
        ? new Date(event.end).getTime() / 1000
        : startTime + 3600;
    } else {
      // Timestamp format (from local events)
      startTime = parseInt(event.start || "0");
      endTime = parseInt(event.end || startTime.toString());
    }

    const start = new Date(startTime * 1000);
    const end = new Date(endTime * 1000);

    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const duration = endMinutes - startMinutes;

    // Calculate position using 60px per hour for accurate positioning
    const topPosition = (startMinutes / 60) * 60; // Convert minutes to pixels (60px per hour)
    const heightPixels = (duration / 60) * 60; // Convert duration minutes to pixels

    return {
      top: topPosition,
      height: Math.max(heightPixels, 30), // Minimum 30px height for visibility
      startMinutes,
      endMinutes,
    };
  };

  const calculateEventLayout = (events: CalendarEvent[]) => {
    if (events.length === 0) return [];

    // Sort events by start time
    const sortedEvents = [...events].sort((a, b) => {
      const aStart = parseInt(a.start || "0");
      const bStart = parseInt(b.start || "0");
      return aStart - bStart;
    });

    const layout: Array<{
      event: CalendarEvent;
      position: { top: number; height: number; left: number; width: number };
    }> = [];

    // Find overlapping groups
    for (let i = 0; i < sortedEvents.length; i++) {
      const currentEvent = sortedEvents[i];
      const currentPosition = calculateEventPosition(currentEvent);

      if (!currentPosition) continue;

      // Find events that overlap with this event
      const overlappingEvents = [currentEvent];
      const concurrentEvents: number[] = [i];

      for (let j = i + 1; j < sortedEvents.length; j++) {
        const nextEvent = sortedEvents[j];
        const nextPosition = calculateEventPosition(nextEvent);

        if (!nextPosition) continue;

        // Check if events overlap
        if (
          currentPosition.startMinutes < nextPosition.endMinutes &&
          nextPosition.startMinutes < currentPosition.endMinutes
        ) {
          overlappingEvents.push(nextEvent);
          concurrentEvents.push(j);
        } else {
          break; // No more overlaps possible since events are sorted
        }
      }

      // Calculate layout for overlapping events
      const eventCount = overlappingEvents.length;
      const eventWidth = 100 / eventCount; // Divide width equally

      overlappingEvents.forEach((event, index) => {
        const position = calculateEventPosition(event);
        if (position) {
          layout.push({
            event,
            position: {
              top: position.top,
              height: position.height,
              left: index * eventWidth,
              width: eventWidth,
            },
          });
        }
      });

      // Skip the events we just processed
      i += concurrentEvents.length - 1;
    }

    return layout;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthEvents = days.flatMap((day) =>
      day ? getEventsForDate(day) : [],
    );
    const hasEvents = monthEvents.length > 0;

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden relative">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-semibold text-gray-700"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dayEvents = day ? getEventsForDate(day) : [];
            const isToday =
              day && day.toDateString() === new Date().toDateString();
            const isCurrentMonth =
              day && day.getMonth() === currentDate.getMonth();

            return (
              <div
                key={index}
                className={`min-h-[100px] p-2 border-r border-b border-gray-200 ${
                  isToday ? "bg-bitcoin-orange/20" : ""
                } ${!isCurrentMonth ? "bg-gray-50" : ""}`}
              >
                {day && (
                  <>
                    <div
                      className={`text-sm font-medium mb-1 ${
                        isToday ? "text-bitcoin-orange" : "text-gray-900"
                      }`}
                    >
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event, eventIndex) => (
                        <div
                          key={eventIndex}
                          onClick={() => onEventClick?.(event)}
                          className={`text-xs p-1 text-white rounded cursor-pointer hover:opacity-90 transition-colors whitespace-normal ${getEventColor ? getEventColor(event).replace(/border-\w+/, '') : 'bg-bitcoin-orange'}`}
                          title={`${event.title} - ${event.kind === 31923 ? (event.start?.includes('-') ? new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : new Date(parseInt(event.start!) * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })) : 'All day'}`}
                        >
                          <div className="font-semibold">{event.title}</div>
                          {event.kind === 31923 && (
                            <div className="text-xs opacity-90">
                              {(event.start?.includes("-")
                                ? new Date(event.start)
                                : new Date(parseInt(event.start || "0") * 1000)
                              ).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {!hasEvents && (
          <div className="absolute inset-0 flex items-start justify-center pt-16 bg-gray-50/90">
            <div className="text-center">
              <div className="text-gray-400 text-6xl mb-4">�️</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No Events This Month
              </h3>
              <p className="text-gray-500">
                There are no events scheduled for this month.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const weekEvents = weekDays.flatMap((day) => getEventsForDate(day));
    const hasEvents = weekEvents.length > 0;

    // Calculate time range for this view
    const calculateTimeRange = (events: CalendarEvent[]) => {
      if (events.length === 0) {
        return {
          startHour: 6,
          endHour: 22,
          hours: Array.from({ length: 16 }, (_, i) => 6 + i),
        };
      }

      let earliestHour = 18;
      let latestHour = 8;

      events.forEach((event) => {
        if (event.kind === 31922) return;
        let startTime: number;
        if (event.start?.includes("-")) {
          startTime = new Date(event.start).getTime() / 1000;
        } else {
          startTime = parseInt(event.start || "0");
        }
        const eventHour = new Date(startTime * 1000).getHours();
        if (eventHour < earliestHour) earliestHour = eventHour;
        if (eventHour > latestHour) latestHour = eventHour;
      });

      const startHour = Math.max(0, earliestHour - 2);
      const endHour = Math.min(23, latestHour + 2);
      const hours = Array.from(
        { length: endHour - startHour + 1 },
        (_, i) => startHour + i,
      );

      return { startHour, endHour, hours };
    };

    const timeRange = calculateTimeRange(weekEvents);

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Week grid - no separate header to avoid duplication */}
        <div className="grid grid-cols-8">
          {/* Time column header */}
          <div className="p-2 border-r border-b border-gray-200 bg-gray-50">
            <div className="text-xs font-semibold text-gray-700">Time</div>
          </div>

          {/* Day headers */}
          {weekDays.map((day, index) => {
            const dayEvents = getEventsForDate(day);
            const isToday = day.toDateString() === new Date().toDateString();

            return (
              <div
                key={index}
                className={`p-2 border-r border-b border-gray-200 ${
                  isToday ? "bg-bitcoin-orange/20" : "bg-gray-50"
                }`}
              >
                <div
                  className={`text-xs font-semibold ${
                    isToday ? "text-bitcoin-orange" : "text-gray-700"
                  }`}
                >
                  {day.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                {dayEvents.length > 0 && (
                  <div className="text-xs text-gray-600 mt-1">
                    {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Week grid */}
        <div ref={weekScrollRef} className="h-[600px] relative overflow-y-auto">
          {" "}
          {/* Reduced height to enable scrolling */}
          {!hasEvents && (
            <div className="absolute inset-0 flex items-start justify-center pt-16 bg-gray-50/90">
              <div className="text-center">
                <div className="text-gray-400 text-6xl mb-4">�️</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No Events This Week
                </h3>
                <p className="text-gray-500">
                  There are no events scheduled for this week.
                </p>
              </div>
            </div>
          )}
          {(() => {
            // Calculate layout for each day once, outside the hour loop
            const dayLayouts = weekDays.map((day) => {
              const dayEvents = getEventsForDate(day).filter(
                (event) => event.kind !== 31922,
              ); // Skip all-day events
              return calculateEventLayout(dayEvents);
            });

            return timeRange.hours.map((hour: number) => (
              <div
                key={hour}
                data-hour={hour}
                className="grid grid-cols-8 border-b border-gray-300"
              >
                {/* Time column */}
                <div className="w-20 p-2 border-r border-gray-200 text-sm text-gray-600">
                  {formatTime(new Date(2000, 0, 1, hour, 0, 0, 0))}
                </div>

                {/* Day columns with events */}
                {weekDays.map((day, dayIndex) => {
                  const dayEvents = getEventsForDate(day).filter(
                    (event) => event.kind !== 31922,
                  ); // Skip all-day events

                  return (
                    <div
                      key={dayIndex}
                      className="border-r border-gray-200 relative h-[60px]"
                    >
                      {/* Only render events that start in this hour */}
                      {dayEvents.map((event) => {
                        const eventStart = event.start?.includes("-")
                          ? new Date(event.start)
                          : new Date(parseInt(event.start || "0") * 1000);
                        const eventHour = eventStart.getHours();

                        // Only render if this event belongs to this hour slot
                        if (eventHour !== hour) return null;

                        // Find this event's layout from the pre-calculated day layout
                        const dayLayout = dayLayouts[dayIndex];
                        const layoutItem = dayLayout.find(
                          (item) => item.event.id === event.id,
                        );

                        if (!layoutItem) return null;

                        // Calculate position relative to current hour
                        const eventPosition = calculateEventPosition(event);
                        if (!eventPosition) return null;

                        const relativeTop = eventPosition.top - hour * 60; // Position relative to current hour

                        return (
                          <div
                            key={event.id}
                            onClick={() => onEventClick?.(event)}
                            className={`absolute text-white text-xs p-1 rounded cursor-pointer hover:opacity-90 transition-colors overflow-hidden z-10 ${getEventColor ? getEventColor(event).replace(/border-\w+/, '') : 'bg-bitcoin-orange'}`}
                            style={{
                              top: `${relativeTop}px`,
                              left: `${2 + layoutItem.position.left}%`,
                              width: `${layoutItem.position.width - 4}%`,
                              height: `${layoutItem.position.height}px`,
                              minHeight: "20px",
                            }}
                            title={event.title}
                          >
                            <div className="font-semibold truncate">
                              {event.title}
                            </div>
                            <div className="text-xs opacity-90">
                              {formatTime(eventStart)}
                              {event.end &&
                                ` - ${formatTime(event.end?.includes("-") ? new Date(event.end) : new Date(parseInt(event.end || "0") * 1000))}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const hasEvents = dayEvents.length > 0;

    // Calculate time range for this view
    const calculateTimeRange = (events: CalendarEvent[]) => {
      if (events.length === 0) {
        return {
          startHour: 6,
          endHour: 22,
          hours: Array.from({ length: 16 }, (_, i) => 6 + i),
        };
      }

      let earliestHour = 18;
      let latestHour = 8;

      events.forEach((event) => {
        if (event.kind === 31922) return;
        let startTime: number;
        if (event.start?.includes("-")) {
          startTime = new Date(event.start).getTime() / 1000;
        } else {
          startTime = parseInt(event.start || "0");
        }
        const eventHour = new Date(startTime * 1000).getHours();
        if (eventHour < earliestHour) earliestHour = eventHour;
        if (eventHour > latestHour) latestHour = eventHour;
      });

      const startHour = Math.max(0, earliestHour - 2);
      const endHour = Math.min(23, latestHour + 2);
      const hours = Array.from(
        { length: endHour - startHour + 1 },
        (_, i) => startHour + i,
      );

      return { startHour, endHour, hours };
    };

    const timeRange = calculateTimeRange(dayEvents);

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Day header - no separate controls to avoid duplication */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">
            {currentDate.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </h3>
          <div className="text-sm text-gray-600 mt-1">
            {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}{" "}
            scheduled
          </div>
        </div>

        <div
          className="flex"
          style={{
            height: `${Math.min((timeRange.endHour - timeRange.startHour + 1) * 60 + 80, 800)}px`,
          }}
        >
          {" "}
          {/* Dynamic height based on time range */}
          {/* Fixed time column - CRITICAL: This provides the time labels on the left side */}
          <div className="w-20 flex-shrink-0 border-r border-gray-200 bg-gray-50">
            {timeRange.hours.map((hour: number) => (
              <div
                key={hour}
                className="h-[60px] p-2 text-sm text-gray-600 border-b border-gray-100 flex items-start"
              >
                {formatTime(new Date(2000, 0, 1, hour, 0, 0, 0))}
              </div>
            ))}
          </div>
          {/* Content area - enable scrolling */}
          <div ref={dayScrollRef} className="flex-1 relative overflow-y-auto">
            {!hasEvents && (
              <div className="absolute inset-0 flex items-start justify-center pt-16 bg-gray-50/90">
                <div className="text-center">
                  <div className="text-gray-400 text-6xl mb-4">�️</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    No Events Today
                  </h3>
                  <p className="text-gray-500">
                    There are no events scheduled for this day.
                  </p>
                </div>
              </div>
            )}
            {/* Render hour grid lines for visual reference - only for displayed time range */}
            {timeRange.hours.map((hour: number, index: number) => (
              <div
                key={hour}
                data-hour={hour}
                className="absolute left-0 right-0 border-b border-gray-300"
                style={{ top: `${index * 60}px` }}
              />
            ))}

            {/* Render events with layout to avoid overlapping */}
            {(() => {
              const timedEvents = dayEvents.filter(
                (event) => event.kind !== 31922,
              );
              const eventLayout = calculateEventLayout(timedEvents);

              return eventLayout.map(({ event, position }) => {
                // Calculate position relative to the dynamic time range
                let startTime: number;
                let endTime: number;

                if (event.start?.includes("-")) {
                  startTime = new Date(event.start).getTime() / 1000;
                  endTime = event.end
                    ? new Date(event.end).getTime() / 1000
                    : startTime + 3600;
                } else {
                  startTime = parseInt(event.start || "0");
                  endTime = parseInt(event.end || startTime.toString());
                }

                const start = new Date(startTime * 1000);
                const end = new Date(endTime * 1000);

                const startMinutes = start.getHours() * 60 + start.getMinutes();
                const endMinutes = end.getHours() * 60 + end.getMinutes();
                const duration = endMinutes - startMinutes;

                // Position relative to the start of our time range
                const rangeStartMinutes = timeRange.startHour * 60;
                const topPosition = (startMinutes - rangeStartMinutes) * 1; // 1px per minute (60px per hour)
                const heightPixels = duration * 1; // 1px per minute

                // Only render if the event is within our display range
                if (
                  topPosition + heightPixels < 0 ||
                  topPosition >
                    (timeRange.endHour - timeRange.startHour + 1) * 60
                ) {
                  return null;
                }

                return (
                  <div
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    className={`absolute text-white p-2 rounded cursor-pointer hover:opacity-90 transition-colors overflow-hidden z-10 ${getEventColor ? getEventColor(event).replace(/border-\w+/, '') : 'bg-bitcoin-orange'}`}
                    style={{
                      top: `${topPosition}px`,
                      left: `${2 + position.left}%`,
                      width: `${position.width - 4}%`,
                      height: `${Math.max(heightPixels, 30)}px`, // Minimum 30px height
                    }}
                  >
                    <div className="font-semibold text-sm truncate">
                      {event.title}
                    </div>
                    <div className="text-xs opacity-90">
                      {formatTime(start)}
                      {event.end && ` - ${formatTime(end)}`}
                    </div>
                  </div>
                );
              });
            })()}

            {/* All-day events */}
            {dayEvents
              .filter((event) => event.kind === 31922)
              .map((event) => (
                <div
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className="absolute top-2 left-2 right-2 bg-gray-100 text-gray-800 p-2 rounded cursor-pointer hover:bg-gray-200 transition-colors overflow-hidden z-10"
                >
                  <div className="font-semibold text-sm truncate">
                    {event.title}
                  </div>
                  <div className="text-xs text-gray-600">All day</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Calendar Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* View Type Display */}
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-700">
              {viewType === "month" && "Month View"}
              {viewType === "week" && "Week View"}
              {viewType === "day" && "Day View"}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
              {viewType === "month" && formatMonthYear(currentDate)}
              {viewType === "week" && formatWeekRange(currentDate)}
              {viewType === "day" && formatDayDate(currentDate)}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateDate("prev")}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Previous"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors border border-gray-300 rounded"
              >
                Today
              </button>
              <button
                onClick={() => navigateDate("next")}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Next"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {viewType === "month" && renderMonthView()}
      {viewType === "week" && renderWeekView()}
      {viewType === "day" && renderDayView()}
    </div>
  );
}
