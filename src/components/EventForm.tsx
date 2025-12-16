import React, { useState } from "react";
import { EventFormData } from "@/types/calendar";
import { XIcon, PlusIcon, CalendarIcon, ClockIcon } from "./Icons";

interface EventFormProps {
  initialData?: Partial<EventFormData>;
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function EventForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: EventFormProps) {
  const [formData, setFormData] = useState<EventFormData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    summary: initialData?.summary || "",
    image: initialData?.image || "",
    locations: initialData?.locations || [],
    startDate: initialData?.startDate || "",
    endDate: initialData?.endDate || "",
    startTime: initialData?.startTime || "",
    endTime: initialData?.endTime || "",
    timezone:
      initialData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    hashtags: initialData?.hashtags || [],
    references: initialData?.references || [],
    eventType: initialData?.eventType || "timed",
  });

  const [locationInput, setLocationInput] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [referenceInput, setReferenceInput] = useState("");

  const handleInputChange = (
    field: keyof EventFormData,
    value: string | string[],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addLocation = () => {
    if (
      locationInput.trim() &&
      !formData.locations.includes(locationInput.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        locations: [...prev.locations, locationInput.trim()],
      }));
      setLocationInput("");
    }
  };

  const removeLocation = (location: string) => {
    setFormData((prev) => ({
      ...prev,
      locations: prev.locations.filter((l) => l !== location),
    }));
  };

  const addHashtag = () => {
    if (
      hashtagInput.trim() &&
      !formData.hashtags.includes(hashtagInput.trim())
    ) {
      const tag = hashtagInput.trim().startsWith("#")
        ? hashtagInput.trim().slice(1)
        : hashtagInput.trim();
      setFormData((prev) => ({
        ...prev,
        hashtags: [...prev.hashtags, tag],
      }));
      setHashtagInput("");
    }
  };

  const removeHashtag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      hashtags: prev.hashtags.filter((t) => t !== tag),
    }));
  };

  const addReference = () => {
    if (
      referenceInput.trim() &&
      !formData.references.includes(referenceInput.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        references: [...prev.references, referenceInput.trim()],
      }));
      setReferenceInput("");
    }
  };

  const removeReference = (ref: string) => {
    setFormData((prev) => ({
      ...prev,
      references: prev.references.filter((r) => r !== ref),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert("Event title is required");
      return;
    }

    if (!formData.startDate) {
      alert("Start date is required");
      return;
    }

    if (formData.eventType === "timed" && !formData.startTime) {
      alert("Start time is required for timed events");
      return;
    }

    onSubmit(formData);
  };

  const timezones = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
  ];

  // Auto-set end time to 1 hour after start time for timed events
  const handleStartTimeChange = (time: string) => {
    handleInputChange("startTime", time);
    if (time && formData.startDate && !formData.endTime) {
      const startDateTime = new Date(`${formData.startDate}T${time}`);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      handleInputChange("endTime", endDateTime.toTimeString().slice(0, 5));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-archivo-black">
          {initialData ? "Edit Event" : "Create New Event"}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XIcon className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="timed"
                checked={formData.eventType === "timed"}
                onChange={(e) => handleInputChange("eventType", e.target.value)}
                className="mr-2"
              />
              <ClockIcon className="w-4 h-4 mr-1" />
              Timed Event
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="all-day"
                checked={formData.eventType === "all-day"}
                onChange={(e) => handleInputChange("eventType", e.target.value)}
                className="mr-2"
              />
              <CalendarIcon className="w-4 h-4 mr-1" />
              All-day Event
            </label>
          </div>
        </div>

        {/* Basic Information */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange("title", e.target.value)}
            placeholder="Event title"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
            required
          />
        </div>

        <div>
          <label
            htmlFor="summary"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Summary
          </label>
          <input
            id="summary"
            type="text"
            value={formData.summary}
            onChange={(e) => handleInputChange("summary", e.target.value)}
            placeholder="Brief summary"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Event description"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
          />
        </div>

        {/* Date/Time Fields */}
        {formData.eventType === "timed" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Date *
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    handleInputChange("startDate", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="startTime"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Time *
                </label>
                <input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  End Date
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange("endDate", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
                />
              </div>
              <div>
                <label
                  htmlFor="endTime"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  End Time
                </label>
                <input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => handleInputChange("endTime", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="timezone"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Timezone
              </label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => handleInputChange("timezone", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="startDateAllDay"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Start Date *
              </label>
              <input
                id="startDateAllDay"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
                required
              />
            </div>
            <div>
              <label
                htmlFor="endDateAllDay"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                End Date (optional)
              </label>
              <input
                id="endDateAllDay"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange("endDate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
              />
            </div>
          </div>
        )}

        {/* Locations */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Locations
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="Add location or URL"
              onKeyPress={(e) =>
                e.key === "Enter" && (e.preventDefault(), addLocation())
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
            />
            <button
              type="button"
              onClick={addLocation}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          {formData.locations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.locations.map((location) => (
                <span
                  key={location}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  📍{" "}
                  {location.length > 30
                    ? `${location.substring(0, 30)}...`
                    : location}
                  <button
                    type="button"
                    onClick={() => removeLocation(location)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="image"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Image URL
          </label>
          <input
            id="image"
            type="url"
            value={formData.image}
            onChange={(e) => handleInputChange("image", e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
          />
        </div>

        {/* Hashtags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hashtags
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              placeholder="hashtag"
              onKeyPress={(e) =>
                e.key === "Enter" && (e.preventDefault(), addHashtag())
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
            />
            <button
              type="button"
              onClick={addHashtag}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.hashtags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeHashtag(tag)}
                  className="text-gray-500 hover:text-red-600"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* References */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            References & Links
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={referenceInput}
              onChange={(e) => setReferenceInput(e.target.value)}
              placeholder="Enter URL or reference"
              onKeyPress={(e) =>
                e.key === "Enter" && (e.preventDefault(), addReference())
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
            />
            <button
              type="button"
              onClick={addReference}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.references.map((ref) => (
              <span
                key={ref}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm max-w-32"
              >
                <span className="truncate">{ref}</span>
                <button
                  type="button"
                  onClick={() => removeReference(ref)}
                  className="text-gray-500 hover:text-red-600 flex-shrink-0"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-bitcoin-orange text-white rounded-md hover:bg-bitcoin-orange-hover transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Publishing..." : "Publish Event"}
          </button>
        </div>
      </form>
    </div>
  );
}
