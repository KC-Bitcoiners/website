import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { config, basePath } from "@/config";
import { isWhitelisted } from "@/config";
import { useNostr } from "@/contexts/NostrContext";
import { useModal } from "@/hooks/useModal";
import {
  Committee,
  CommitteeMember,
  CommitteeOpening,
  fetchCommittees,
  fetchMembersForAllCommittees,
  fetchOpeningsForAllCommittees,
  buildDeleteEvent,
  publishDelete,
} from "@/utils/committeeEvents";
import CommitteeFormModal from "@/components/CommitteeFormModal";
import CommitteeMemberFormModal from "@/components/CommitteeMemberFormModal";
import CommitteeOpeningFormModal from "@/components/CommitteeOpeningFormModal";
import EventActions from "@/components/EventActions";
import { logger } from "@/utils/logger";

// Lazy-load markdown rendering (~200KB) — only needed when opening descriptions are expanded
const LazyMarkdown: React.FC<{ children: string }> = ({ children }) => {
  const [mod, setMod] = useState<{ default: React.ComponentType<{ children: string; rehypePlugins: unknown[] }> } | null>(null);
  const [sanitize, setSanitize] = useState<unknown>(null);

  useEffect(() => {
    Promise.all([
      import("react-markdown"),
      import("rehype-sanitize"),
    ]).then(([md, san]) => {
      setMod(md as typeof mod);
      setSanitize(san.default);
    });
  }, []);

  if (!mod || !sanitize) {
    return <div className="animate-pulse bg-gray-100 rounded h-12" />;
  }

  const MarkdownComponent = mod.default;
  return <MarkdownComponent rehypePlugins={[sanitize]}>{children}</MarkdownComponent>;
};

// UI-facing committee shape (matches the existing rendering code)
interface UICommittee {
  id: string;
  coordinate: string;
  name: string;
  description: string;
  chair?: { name: string; email?: string; phone?: string };
  viceChair?: { name: string; email?: string; phone?: string };
  members: Array<{ name: string; email?: string; phone?: string }>;
  openings: number;
  meetingSchedule?: string;
  image?: string;
  rawCommittee: Committee;
  rawMembers: CommitteeMember[];
  rawOpenings: CommitteeOpening[];
}

function memberToContact(m: CommitteeMember): {
  name: string;
  email?: string;
  phone?: string;
} {
  return { name: m.name, email: m.email, phone: m.phone };
}

function isRole(member: CommitteeMember, role: string): boolean {
  const m = member.role.toLowerCase().replace(/[-_\s]+/g, "");
  const r = role.toLowerCase().replace(/[-_\s]+/g, "");
  return m === r;
}

function buildUICommittee(
  committee: Committee,
  members: CommitteeMember[],
  openings: CommitteeOpening[],
): UICommittee {
  const chair = members.find((m) => isRole(m, "chair"));
  const viceChair = members.find((m) => isRole(m, "vice-chair"));
  const regularMembers = members.filter(
    (m) => !isRole(m, "chair") && !isRole(m, "vice-chair"),
  );

  return {
    id: committee.id,
    coordinate: committee.coordinate,
    name: committee.title,
    description: committee.description,
    chair: chair ? memberToContact(chair) : undefined,
    viceChair: viceChair ? memberToContact(viceChair) : undefined,
    members: regularMembers.map(memberToContact),
    openings: committee.openings,
    meetingSchedule: committee.meetingSchedule,
    image: committee.image,
    rawCommittee: committee,
    rawMembers: members,
    rawOpenings: openings,
  };
}

export default function CommitteesPage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [membersMap, setMembersMap] = useState<Map<string, CommitteeMember[]>>(
    new Map(),
  );
  const [openingsMap, setOpeningsMap] = useState<
    Map<string, CommitteeOpening[]>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedCommittee, setSelectedCommittee] =
    useState<UICommittee | null>(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showAddCommittee, setShowAddCommittee] = useState(false);
  const [editCommittee, setEditCommittee] = useState<Committee | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberTargetCommittee, setMemberTargetCommittee] =
    useState<Committee | null>(null);
  const [editMember, setEditMember] = useState<CommitteeMember | null>(null);
  const [showAddOpening, setShowAddOpening] = useState(false);
  const [editOpening, setEditOpening] = useState<CommitteeOpening | null>(null);
  const [expandedOpenings, setExpandedOpenings] = useState<Set<string>>(
    new Set(),
  );
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(
    new Set(),
  );
  const { user, hasExtension } = useNostr();

  // Sign an event using the NIP-07 extension or Nostr context
  const signEvent = async (event: {
    kind: number;
    content: string;
    tags: string[][];
    created_at: number;
  }): Promise<Record<string, unknown>> => {
    if (window.nostr) {
      const pk = await window.nostr.getPublicKey();
      return await window.nostr.signEvent({ ...event, pubkey: pk });
    }
    throw new Error("No signing method available");
  };

  // Show admin controls only if user has a whitelisted pubkey
  // (this is a static site — there is no server-side whitelist enforcement)
  const isAdmin = !!(user && isWhitelisted(user.pubkey));

  // Modal accessibility: Escape key + scroll lock
  const closeSelectedCommittee = useCallback(
    () => setSelectedCommittee(null),
    [],
  );
  const closeApplicationForm = useCallback(
    () => setShowApplicationForm(false),
    [],
  );
  useModal(!!selectedCommittee, closeSelectedCommittee);
  useModal(showApplicationForm, closeApplicationForm);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedCommittees = await fetchCommittees();
      setCommittees(fetchedCommittees);
      const members = await fetchMembersForAllCommittees(fetchedCommittees);
      setMembersMap(members);
      const openings = await fetchOpeningsForAllCommittees(fetchedCommittees);
      setOpeningsMap(openings);
    } catch (err) {
      logger.warn("Failed to load committee data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const uiCommittees = committees.map((c) =>
    buildUICommittee(
      c,
      membersMap.get(c.coordinate) || [],
      openingsMap.get(c.coordinate) || [],
    ),
  );
  const totalOpenings = uiCommittees.reduce(
    (sum, c) => sum + c.rawOpenings.length,
    0,
  );
  const totalMembers = uiCommittees.reduce(
    (sum, c) => sum + c.rawMembers.length,
    0,
  );

  const handleDeleteCommittee = useCallback(
    async (committee: Committee) => {
      if (!user || !committee.rawEvent) return;
      const unsignedDelete = buildDeleteEvent({
        eventId: committee.id,
        eventKind: 30068,
        reason: "Deleted by author",
      });
      const signedDelete = await signEvent(
        unsignedDelete as {
          kind: number;
          content: string;
          tags: string[][];
          created_at: number;
        },
      );
      await publishDelete(signedDelete);
      // Optimistically remove
      setCommittees((prev) => prev.filter((c) => c.id !== committee.id));
    },
    [user, signEvent],
  );

  const handleDeleteMember = useCallback(
    async (member: CommitteeMember) => {
      if (!user || !member.rawEvent) return;
      const unsignedDelete = buildDeleteEvent({
        eventId: member.id,
        eventKind: 39068,
        reason: "Deleted by author",
      });
      const signedDelete = await signEvent(
        unsignedDelete as {
          kind: number;
          content: string;
          tags: string[][];
          created_at: number;
        },
      );
      await publishDelete(signedDelete);
      // Optimistically remove
      setMembersMap((prev) => {
        const updated = new Map(prev);
        const members = (updated.get(member.committeeCoordinate) || []).filter(
          (m) => m.id !== member.id,
        );
        updated.set(member.committeeCoordinate, members);
        return updated;
      });
    },
    [user, signEvent],
  );

  const handleEditCommittee = useCallback((committee: Committee) => {
    setEditCommittee(committee);
    setShowAddCommittee(true);
  }, []);

  const handleEditMember = useCallback((member: CommitteeMember) => {
    setEditMember(member);
    setShowAddMember(true);
  }, []);

  const handleDeleteOpening = useCallback(
    async (opening: CommitteeOpening) => {
      if (!user || !opening.rawEvent) return;
      const unsignedDelete = buildDeleteEvent({
        eventId: opening.id,
        eventKind: 39069,
        reason: "Deleted by author",
      });
      const signedDelete = await signEvent(
        unsignedDelete as {
          kind: number;
          content: string;
          tags: string[][];
          created_at: number;
        },
      );
      await publishDelete(signedDelete);
      // Optimistically remove
      setOpeningsMap((prev) => {
        const updated = new Map(prev);
        const openings = (
          updated.get(opening.committeeCoordinate) || []
        ).filter((o) => o.id !== opening.id);
        updated.set(opening.committeeCoordinate, openings);
        return updated;
      });
      if (selectedCommittee) {
        setSelectedCommittee({
          ...selectedCommittee,
          rawOpenings: selectedCommittee.rawOpenings.filter(
            (o) => o.id !== opening.id,
          ),
        });
      }
    },
    [user, signEvent, selectedCommittee],
  );

  const handleEditOpening = useCallback((opening: CommitteeOpening) => {
    setEditOpening(opening);
    setShowAddOpening(true);
  }, []);

  const handleOpeningDone = useCallback(async () => {
    setShowAddOpening(false);
    setEditOpening(null);
    const fetchedCommittees = await fetchCommittees();
    setCommittees(fetchedCommittees);
    const members = await fetchMembersForAllCommittees(fetchedCommittees);
    setMembersMap(members);
    const openings = await fetchOpeningsForAllCommittees(fetchedCommittees);
    setOpeningsMap(openings);
    if (selectedCommittee) {
      const coord = selectedCommittee.coordinate;
      const updated = fetchedCommittees.find((c) => c.coordinate === coord);
      if (updated) {
        setSelectedCommittee(
          buildUICommittee(
            updated,
            members.get(coord) || [],
            openings.get(coord) || [],
          ),
        );
      }
    }
  }, [selectedCommittee]);

  const handleCommitteeDone = useCallback(() => {
    setShowAddCommittee(false);
    setEditCommittee(null);
    loadAll();
  }, [loadAll]);

  const handleMemberDone = useCallback(async () => {
    setShowAddMember(false);
    setEditMember(null);
    const fetchedCommittees = await fetchCommittees();
    setCommittees(fetchedCommittees);
    const members = await fetchMembersForAllCommittees(fetchedCommittees);
    setMembersMap(members);
    const openings = await fetchOpeningsForAllCommittees(fetchedCommittees);
    setOpeningsMap(openings);
    // Refresh selected committee with fresh data
    if (selectedCommittee) {
      const coord = selectedCommittee.coordinate;
      const updated = fetchedCommittees.find((c) => c.coordinate === coord);
      if (updated) {
        setSelectedCommittee(
          buildUICommittee(
            updated,
            members.get(coord) || [],
            openings.get(coord) || [],
          ),
        );
      }
    }
  }, [selectedCommittee]);

  return (
    <>
      <Head>
        <title>{config.pages.committees.meta.title}</title>
        <meta
          name="description"
          content={config.pages.committees.meta.description}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href={`${basePath}/favicon.ico`} />
      </Head>

      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black bitcoin-orange mb-4 font-archivo-black">
            Get Involved!
          </h1>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
            <div className="text-3xl font-bold bitcoin-orange mb-2">
              {uiCommittees.length}
            </div>
            <div className="text-gray-600">Active Committees</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {totalOpenings}
            </div>
            <div className="text-gray-600">Open Positions</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
            <div className="text-3xl font-bold bitcoin-orange mb-2">
              {totalMembers}
            </div>
            <div className="text-gray-600">Members</div>
          </div>
        </div>

        {/* Admin: Add Committee + Apply buttons */}
        <div className="text-center mb-12 flex justify-center gap-4 flex-wrap">
          <button
            onClick={() => setShowApplicationForm(true)}
            className="px-8 py-3 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors"
          >
            Apply to Join a Committee
          </button>
          {isAdmin && (
            <button
              data-testid="add-committee-btn"
              onClick={() => {
                setEditCommittee(null);
                setShowAddCommittee(true);
              }}
              className="px-8 py-3 border-2 border-bitcoin-orange text-bitcoin-orange rounded-lg font-semibold hover:bg-bitcoin-orange hover:text-white transition-colors"
            >
              + Create Committee
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mb-8 text-center" data-testid="committees-loading">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 max-w-md mx-auto">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bitcoin-orange mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Loading Committees
              </h3>
              <p className="text-gray-600">Connecting to Nostr...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && uiCommittees.length === 0 && (
          <div
            className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center"
            data-testid="committees-empty"
          >
            <span className="text-6xl block mb-4">🏛️</span>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              No Committees Yet
            </h3>
            <p className="text-gray-600">
              {isAdmin
                ? 'Click "Create Committee" above to add the first committee.'
                : "Committees will appear here once they are created. Check back soon!"}
            </p>
          </div>
        )}

        {/* Committee Cards */}
        {!loading && uiCommittees.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uiCommittees.map((committee) => (
              <div
                key={committee.id}
                data-testid={`committee-card-${committee.rawCommittee.dTag}`}
                className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedCommittee(committee)}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3
                    className="text-xl font-bold font-archivo-black bitcoin-orange cursor-pointer hover:underline"
                    onClick={() => setSelectedCommittee(committee)}
                  >
                    {committee.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    {committee.rawOpenings.length > 0 && (
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        {committee.rawOpenings.length} Open
                        {committee.rawOpenings.length > 1 ? "ings" : "ing"}
                      </span>
                    )}
                    {isAdmin && committee.rawCommittee.rawEvent && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <EventActions
                          event={committee.rawCommittee.rawEvent}
                          signEvent={signEvent}
                          pubkey={user?.pubkey}
                          onEdit={() =>
                            handleEditCommittee(committee.rawCommittee)
                          }
                          onDelete={() =>
                            handleDeleteCommittee(committee.rawCommittee)
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
                <p
                  className="text-gray-600 mb-4 text-sm cursor-pointer"
                  onClick={() => setSelectedCommittee(committee)}
                >
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
                    {committee.rawMembers.length} Member
                    {committee.rawMembers.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                  {selectedCommittee.rawOpenings.length > 0 && (
                    <span className="inline-block bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded">
                      {selectedCommittee.rawOpenings.length} Open Position
                      {selectedCommittee.rawOpenings.length > 1 ? "s" : ""}
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
              {(selectedCommittee.chair || selectedCommittee.viceChair) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-3 font-archivo-black">
                    Leadership
                  </h3>
                  <div className="space-y-2">
                    {selectedCommittee.chair &&
                      (() => {
                        const chairMember = selectedCommittee.rawMembers.find(
                          (m) => m.role === "chair",
                        );
                        const chairId = chairMember?.id || "chair";
                        const chairExpanded = expandedMembers.has(chairId);
                        const hasChairContact = !!(
                          selectedCommittee.chair.email ||
                          selectedCommittee.chair.phone
                        );
                        return (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-bitcoin-orange rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                                C
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">
                                  {selectedCommittee.chair.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Chair
                                </div>
                              </div>
                              {hasChairContact && (
                                <button
                                  onClick={() =>
                                    setExpandedMembers((prev) => {
                                      const s = new Set(prev);
                                      if (s.has(chairId)) s.delete(chairId);
                                      else s.add(chairId);
                                      return s;
                                    })
                                  }
                                  className="text-sm px-3 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition-colors font-medium flex-shrink-0"
                                >
                                  {chairExpanded ? "Hide" : "Contact"}
                                </button>
                              )}
                              {isAdmin && chairMember?.rawEvent && (
                                <EventActions
                                  event={chairMember.rawEvent}
                                  signEvent={signEvent}
                                  pubkey={user?.pubkey}
                                  onEdit={() => handleEditMember(chairMember)}
                                  onDelete={() =>
                                    handleDeleteMember(chairMember)
                                  }
                                />
                              )}
                            </div>
                            {chairExpanded && hasChairContact && (
                              <div className="mt-2 pl-[52px] text-sm">
                                {selectedCommittee.chair.email && (
                                  <a
                                    href={`mailto:${selectedCommittee.chair.email}`}
                                    className="text-bitcoin-orange hover:underline mr-3"
                                  >
                                    {selectedCommittee.chair.email}
                                  </a>
                                )}
                                {selectedCommittee.chair.phone && (
                                  <a
                                    href={`tel:${selectedCommittee.chair.phone}`}
                                    className="text-gray-600"
                                  >
                                    {selectedCommittee.chair.phone}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    {selectedCommittee.viceChair &&
                      (() => {
                        const vcMember = selectedCommittee.rawMembers.find(
                          (m) => m.role === "vice-chair",
                        );
                        const vcId = vcMember?.id || "vice-chair";
                        const vcExpanded = expandedMembers.has(vcId);
                        const hasVcContact = !!(
                          selectedCommittee.viceChair.email ||
                          selectedCommittee.viceChair.phone
                        );
                        return (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                                VC
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">
                                  {selectedCommittee.viceChair.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Vice Chair
                                </div>
                              </div>
                              {hasVcContact && (
                                <button
                                  onClick={() =>
                                    setExpandedMembers((prev) => {
                                      const s = new Set(prev);
                                      if (s.has(vcId)) s.delete(vcId);
                                      else s.add(vcId);
                                      return s;
                                    })
                                  }
                                  className="text-sm px-3 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition-colors font-medium flex-shrink-0"
                                >
                                  {vcExpanded ? "Hide" : "Contact"}
                                </button>
                              )}
                              {isAdmin && vcMember?.rawEvent && (
                                <EventActions
                                  event={vcMember.rawEvent}
                                  signEvent={signEvent}
                                  pubkey={user?.pubkey}
                                  onEdit={() => handleEditMember(vcMember)}
                                  onDelete={() => handleDeleteMember(vcMember)}
                                />
                              )}
                            </div>
                            {vcExpanded && hasVcContact && (
                              <div className="mt-2 pl-[52px] text-sm">
                                {selectedCommittee.viceChair.email && (
                                  <a
                                    href={`mailto:${selectedCommittee.viceChair.email}`}
                                    className="text-bitcoin-orange hover:underline mr-3"
                                  >
                                    {selectedCommittee.viceChair.email}
                                  </a>
                                )}
                                {selectedCommittee.viceChair.phone && (
                                  <a
                                    href={`tel:${selectedCommittee.viceChair.phone}`}
                                    className="text-gray-600"
                                  >
                                    {selectedCommittee.viceChair.phone}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                </div>
              )}

              {/* Members */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold font-archivo-black">
                    Members
                  </h3>
                  {isAdmin && (
                    <button
                      data-testid="add-member-btn"
                      onClick={() => {
                        setMemberTargetCommittee(
                          selectedCommittee.rawCommittee,
                        );
                        setEditMember(null);
                        setShowAddMember(true);
                      }}
                      className="text-sm px-3 py-1 bg-bitcoin-orange text-white rounded hover:bg-bitcoin-orange-hover transition-colors font-semibold"
                    >
                      + Add Member
                    </button>
                  )}
                </div>
                {selectedCommittee.members.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCommittee.members.map((member, index) => {
                      const rawMember = selectedCommittee.rawMembers.filter(
                        (m) => !isRole(m, "chair") && !isRole(m, "vice-chair"),
                      )[index];
                      const memberId = rawMember?.id || `member-${index}`;
                      const isExpanded = expandedMembers.has(memberId);
                      const hasContact = !!(member.email || member.phone);
                      return (
                        <div key={index} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold flex-shrink-0">
                              {member.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{member.name}</div>
                              {rawMember && (
                                <div className="text-sm text-gray-500">
                                  {rawMember.role}
                                </div>
                              )}
                            </div>
                            {hasContact && (
                              <button
                                onClick={() =>
                                  setExpandedMembers((prev) => {
                                    const s = new Set(prev);
                                    if (s.has(memberId)) s.delete(memberId);
                                    else s.add(memberId);
                                    return s;
                                  })
                                }
                                className="text-sm px-3 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition-colors font-medium flex-shrink-0"
                              >
                                {isExpanded ? "Hide" : "Contact"}
                              </button>
                            )}
                            {isAdmin && rawMember?.rawEvent && (
                              <EventActions
                                event={rawMember.rawEvent}
                                signEvent={signEvent}
                                pubkey={user?.pubkey}
                                onEdit={() => handleEditMember(rawMember)}
                                onDelete={() => handleDeleteMember(rawMember)}
                              />
                            )}
                          </div>
                          {isExpanded && hasContact && (
                            <div className="mt-2 pl-[52px] text-sm">
                              {member.email && (
                                <a
                                  href={`mailto:${member.email}`}
                                  className="text-bitcoin-orange hover:underline mr-3"
                                >
                                  {member.email}
                                </a>
                              )}
                              {member.phone && (
                                <a
                                  href={`tel:${member.phone}`}
                                  className="text-gray-600"
                                >
                                  {member.phone}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No members yet.</p>
                )}
              </div>

              {/* Open Positions */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold font-archivo-black">
                    Open Positions
                  </h3>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setEditOpening(null);
                        setShowAddOpening(true);
                      }}
                      className="text-sm px-3 py-1 bg-bitcoin-orange text-white rounded hover:bg-bitcoin-orange-hover transition-colors font-semibold"
                    >
                      + Add Opening
                    </button>
                  )}
                </div>
                {selectedCommittee.rawOpenings.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCommittee.rawOpenings.map((opening) => (
                      <div
                        key={opening.id}
                        className="flex items-start gap-3 bg-gray-50 rounded-lg p-3"
                      >
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold flex-shrink-0">
                          OP
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{opening.title}</div>
                          {opening.description && (
                            <div className="text-sm text-gray-600 mt-1">
                              {expandedOpenings.has(opening.id) ? (
                                <div className="prose prose-sm max-w-none">
                                  <LazyMarkdown>{opening.description}</LazyMarkdown>
                                  <button
                                    onClick={() =>
                                      setExpandedOpenings((prev) => {
                                        const s = new Set(prev);
                                        s.delete(opening.id);
                                        return s;
                                      })
                                    }
                                    className="text-bitcoin-orange hover:underline text-xs font-medium mt-1"
                                  >
                                    Show less
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() =>
                                    setExpandedOpenings((prev) =>
                                      new Set(prev).add(opening.id),
                                    )
                                  }
                                  className="line-clamp-2 cursor-pointer"
                                >
                                  <LazyMarkdown>{opening.description}</LazyMarkdown>
                                  <span className="text-bitcoin-orange hover:underline text-xs font-medium">
                                    Show more
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {isAdmin && opening.rawEvent && (
                          <EventActions
                            event={opening.rawEvent}
                            signEvent={signEvent}
                            pubkey={user?.pubkey}
                            onEdit={() => handleEditOpening(opening)}
                            onDelete={() => handleDeleteOpening(opening)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No open positions.</p>
                )}
              </div>

              {/* Apply Button */}
              {selectedCommittee.rawOpenings.length > 0 && (
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
                    {uiCommittees.map((committee) => (
                      <option
                        key={committee.id}
                        value={committee.rawCommittee.dTag}
                      >
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

      {/* Modals */}
      {showAddCommittee && (
        <CommitteeFormModal
          editCommittee={editCommittee}
          onDone={handleCommitteeDone}
          onCancel={() => {
            setShowAddCommittee(false);
            setEditCommittee(null);
          }}
          pubkey={user?.pubkey}
          signEvent={signEvent}
        />
      )}
      {showAddMember && memberTargetCommittee && (
        <CommitteeMemberFormModal
          committeeCoordinate={memberTargetCommittee.coordinate}
          editMember={editMember}
          onDone={handleMemberDone}
          onCancel={() => {
            setShowAddMember(false);
            setEditMember(null);
          }}
          pubkey={user?.pubkey}
          signEvent={signEvent}
        />
      )}
      {showAddOpening && selectedCommittee && (
        <CommitteeOpeningFormModal
          committeeCoordinate={selectedCommittee.coordinate}
          editOpening={editOpening}
          onDone={handleOpeningDone}
          onCancel={() => {
            setShowAddOpening(false);
            setEditOpening(null);
          }}
          pubkey={user?.pubkey}
          signEvent={signEvent}
        />
      )}
    </>
  );
}
