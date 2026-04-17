import React, { useState } from "react";
import Head from "next/head";
import { config } from "@/config";

interface Committee {
  name: string;
  description: string;
  chair: string;
  members: string[];
  openPositions: string[];
  meetingSchedule: string;
}

export default function CommitteesPage() {
  const committees: Committee[] = config.pages.committees?.data ?? [];
  const [selectedCommittee, setSelectedCommittee] = useState<Committee | null>(
    null,
  );
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const totalOpenings = committees.reduce(
    (sum, c) => sum + c.openPositions.length,
    0,
  );

  return (
    <>
      <Head>
        <title>{config.pages.committees?.meta?.title ?? "Committees"}</title>
        <meta
          name="description"
          content={
            config.pages.committees?.meta?.description ?? "Committees page"
          }
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black bitcoin-orange mb-4 font-archivo-black">
            Committees
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get involved by joining one of our committees. We have positions
            open for dedicated community members who want to make a difference.
          </p>
        </div>

        {committees.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              No Committees Configured
            </h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Committees haven&apos;t been set up yet. Check back later or
              contact an organizer to learn about getting involved.
            </p>
          </div>
        ) : (
          <>
            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
                <div className="text-3xl font-bold bitcoin-orange mb-2">
                  {committees.length}
                </div>
                <div className="text-gray-600">Active Committees</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
                <div className="text-3xl font-bold green-600 mb-2">
                  {totalOpenings}
                </div>
                <div className="text-gray-600">Open Positions</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
                <div className="text-3xl font-bold bitcoin-orange mb-2">
                  Join Us
                </div>
                <div className="text-gray-600">Make a Difference</div>
              </div>
            </div>

            {/* Apply Button */}
            <div className="text-center mb-12">
              <button
                onClick={() => setShowApplicationForm(true)}
                className="px-8 py-3 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors"
              >
                Apply to Join a Committee
              </button>
            </div>

            {/* Committee Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {committees.map((committee, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedCommittee(committee)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-bold font-archivo-black bitcoin-orange">
                      {committee.name}
                    </h3>
                    {committee.openPositions.length > 0 && (
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        {committee.openPositions.length} Open
                        {committee.openPositions.length > 1 ? "ings" : "ing"}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-4 text-sm">
                    {committee.description}
                  </p>
                  <div className="text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {committee.meetingSchedule || "Schedule TBD"}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      {committee.members.length} Member
                      {committee.members.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Committee Details Modal */}
      {selectedCommittee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold font-archivo-black bitcoin-orange mb-2">
                    {selectedCommittee.name}
                  </h2>
                  {selectedCommittee.openPositions.length > 0 && (
                    <span className="inline-block bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded">
                      {selectedCommittee.openPositions.length} Open Position
                      {selectedCommittee.openPositions.length > 1
                        ? "s"
                        : ""}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCommittee(null)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                >
                  ×
                </button>
              </div>

              <p className="text-gray-600 mb-6">
                {selectedCommittee.description}
              </p>

              {selectedCommittee.meetingSchedule && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <svg
                      className="w-5 h-5 bitcoin-orange"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="font-medium">Meeting Schedule:</span>
                    <span>{selectedCommittee.meetingSchedule}</span>
                  </div>
                </div>
              )}

              {/* Leadership */}
              {selectedCommittee.chair && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-3 font-archivo-black">
                    Leadership
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                      <div className="w-10 h-10 bg-bitcoin-orange rounded-full flex items-center justify-center text-white font-bold">
                        C
                      </div>
                      <div>
                        <div className="font-medium">
                          {selectedCommittee.chair}
                        </div>
                        <div className="text-sm text-gray-500">Chair</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Members */}
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-3 font-archivo-black">
                  Members
                </h3>
                <div className="space-y-2">
                  {selectedCommittee.members.map((member, memberIndex) => (
                    <div
                      key={memberIndex}
                      className="flex items-center gap-3 bg-gray-50 rounded-lg p-3"
                    >
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold">
                        {member.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{member}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Open Positions */}
              {selectedCommittee.openPositions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-3 font-archivo-black">
                    Open Positions
                  </h3>
                  <div className="space-y-2">
                    {selectedCommittee.openPositions.map(
                      (position, posIndex) => (
                        <div
                          key={posIndex}
                          className="flex items-center gap-3 bg-green-50 rounded-lg p-3"
                        >
                          <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center text-green-700 font-bold">
                            +
                          </div>
                          <div className="font-medium text-green-800">
                            {position}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Apply Button */}
              {selectedCommittee.openPositions.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedCommittee(null);
                    setShowApplicationForm(true);
                  }}
                  className="w-full px-6 py-3 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors"
                >
                  Apply to Join This Committee
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Application Form Modal */}
      {showApplicationForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold font-archivo-black bitcoin-orange">
                  Apply to Join a Committee
                </h2>
                <button
                  onClick={() => setShowApplicationForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = {
                    name: formData.get("name") as string,
                    email: formData.get("email") as string,
                    phone: formData.get("phone") as string,
                    committee: formData.get("committee") as string,
                    message: formData.get("message") as string,
                  };

                  // Save to localStorage
                  const existingApps = JSON.parse(
                    localStorage.getItem("committee-applications") || "[]",
                  );
                  existingApps.push({
                    ...data,
                    submittedAt: new Date().toISOString(),
                  });
                  localStorage.setItem(
                    "committee-applications",
                    JSON.stringify(existingApps),
                  );

                  alert(
                    "Thank you for your interest! Your application has been submitted.",
                  );
                  setShowApplicationForm(false);
                }}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
                  />
                </div>

                <div>
                  <label
                    htmlFor="committee"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Committee of Interest *
                  </label>
                  <select
                    id="committee"
                    name="committee"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
                  >
                    <option value="">Select a committee</option>
                    {committees.map((committee, index) => (
                      <option key={index} value={committee.name}>
                        {committee.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Why do you want to join? *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors"
                >
                  Submit Application
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
