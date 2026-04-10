import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { config } from "@/config";
import {
  fetchPinboards,
  fetchFeaturedPins,
  fetchPinsForBoard,
  buildPinEvent,
  buildDeleteEvent,
  publishPin,
  publishDelete,
  buildPinboardEvent,
  publishPinboard,
  Pinboard,
  Pin,
  DisplayType,
  getDisplayType,
  DISPLAY_TYPE_CONFIG,
  ALL_DISPLAY_TYPES,
  getPinUrl,
  detectContentKind,
  DetectedContent,
} from "@/utils/pinboardEvents";
import EventActions from "@/components/EventActions";

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

function getRumbleId(url: string): string | null {
  const match = url.match(/rumble\.com\/(v[a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function getSpotifyEpisodeId(url: string): string | null {
  const match = url.match(/open\.spotify\.com\/episode\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

export default function EducationPage() {
  const [pinboards, setPinboards] = useState<Pinboard[]>([]);
  const [featuredPins, setFeaturedPins] = useState<Pin[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Pinboard | null>(null);
  const [boardPins, setBoardPins] = useState<Pin[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [loadingPins, setLoadingPins] = useState(false);
  const [displayFilter, setDisplayFilter] = useState<DisplayType | "all">("all");
  const [view, setView] = useState<"featured" | "boards">("featured");
  const [showAddPin, setShowAddPin] = useState(false);
  const [editPin, setEditPin] = useState<Pin | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "title">("date");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoadingFeatured(true);
    setLoadingBoards(true);
    try {
      const [boards, pins] = await Promise.all([fetchPinboards(), fetchFeaturedPins()]);
      setPinboards(boards);
      setFeaturedPins(pins);
    } catch (err) {
      console.warn("Failed to load education data:", err);
    }
    setLoadingFeatured(false);
    setLoadingBoards(false);
  };

  const loadPins = useCallback(async (board: Pinboard) => {
    setLoadingPins(true);
    try {
      setBoardPins(await fetchPinsForBoard(board));
    } catch (err) {
      console.warn("Failed to load pins:", err);
      setBoardPins([]);
    }
    setLoadingPins(false);
  }, []);

  const handleBoardClick = useCallback((board: Pinboard) => {
    setSelectedBoard(board);
    setDisplayFilter("all");
    loadPins(board);
  }, [loadPins]);

  const handleBack = useCallback(() => {
    setSelectedBoard(null);
    setBoardPins([]);
    setDisplayFilter("all");
  }, []);

  const handlePinAdded = useCallback(() => {
    setShowAddPin(false);
    setEditPin(null);
    if (selectedBoard) loadPins(selectedBoard);
    else loadAll();
  }, [selectedBoard, loadPins]);

  const handleDeletePin = useCallback(async (pin: Pin) => {
    if (!window.nostr || !pin.rawEvent) return;
    const pubkey = await window.nostr.getPublicKey();
    // Only allow deleting your own pins
    if (pubkey !== pin.pubkey) return;

    // Optimistically remove from local state
    const pinId = pin.id;
    setFeaturedPins((prev) => prev.filter((p) => p.id !== pinId));
    setBoardPins((prev) => prev.filter((p) => p.id !== pinId));

    const unsignedDelete = buildDeleteEvent({
      eventId: pin.id,
      eventKind: 39067,
      reason: "Deleted by author",
    });
    const signedDelete = await window.nostr.signEvent({ ...unsignedDelete, pubkey });
    await publishDelete(signedDelete);
  }, []);

  const handleEditPin = useCallback((pin: Pin) => {
    setEditPin(pin);
    setShowAddPin(true);
  }, []);

  const activePins = view === "featured" ? featuredPins : boardPins;
  const filteredPins = (displayFilter === "all"
    ? activePins
    : activePins.filter((p) => getDisplayType(p) === displayFilter)
  ).sort((a, b) => {
    if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
    return b.created_at - a.created_at; // date desc (newest first)
  });

  // Get the default board coordinate for adding pins.
  // When a NIP-07 extension is present, always allow adding -- the pinboard
  // will be auto-created on first publish if none exists yet.
  const defaultBoardCoord = pinboards.length > 0 ? pinboards[0].coordinate : null;
  const hasNostr = typeof window !== "undefined" && !!(window as any).nostr;
  const canAdd = !!defaultBoardCoord || hasNostr;

  return (
    <>
      <Head>
        <title>{config.pages.education.meta.title}</title>
        <meta name="description" content={config.pages.education.meta.description} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black bitcoin-orange mb-4 font-archivo-black">
            Education Resources
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Curated collections of educational content, articles, links, and media about Bitcoin and sound money.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-4 mb-10">
          <button
            data-testid="tab-featured"
            onClick={() => { setView("featured"); handleBack(); }}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              view === "featured" ? "bg-bitcoin-orange text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Featured Resources
          </button>
          <button
            data-testid="tab-boards"
            onClick={() => setView("boards")}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              view === "boards" ? "bg-bitcoin-orange text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Pinboards
          </button>
        </div>

        {/* Featured Resources View */}
        {view === "featured" && (
          <>
            {loadingFeatured ? (
              <LoadingSpinner text="Loading featured resources..." />
            ) : featuredPins.length === 0 && pinboards.length === 0 && !canAdd ? (
              <EmptyState />
            ) : (
              <>
                <FilterBar
                  pins={activePins}
                  filter={displayFilter}
                  setFilter={setDisplayFilter}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  onAddClick={() => setShowAddPin(true)}
                  canAdd={canAdd}
                />
                {filteredPins.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-10 text-center">
                    <p className="text-gray-600">No resources match this filter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPins.map((pin) => (
                      <PinCard key={pin.id} pin={pin} onDelete={() => handleDeletePin(pin)} onEdit={() => handleEditPin(pin)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Pinboards View */}
        {view === "boards" && (
          <>
            {selectedBoard ? (
              <>
                <button
                  onClick={handleBack}
                  data-testid="back-to-boards"
                  className="mb-6 flex items-center gap-2 text-bitcoin-orange hover:underline font-semibold"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  Back to Boards
                </button>

                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
                  <div className="flex flex-col md:flex-row gap-6">
                    {selectedBoard.image && (
                      <div className="w-full md:w-48 h-36 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <img src={selectedBoard.image} alt={selectedBoard.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-black bitcoin-orange font-archivo-black">{selectedBoard.title}</h2>
                        {selectedBoard.collaborative && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">Collaborative</span>
                        )}
                      </div>
                      {selectedBoard.description && <p className="text-gray-600 mb-3">{selectedBoard.description}</p>}
                      {selectedBoard.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedBoard.tags.map((tag) => (
                            <span key={tag} className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {loadingPins ? (
                  <LoadingSpinner text="Loading pins..." />
                ) : boardPins.length === 0 ? (
                  <EmptyState />
                ) : (
                  <>
                    <FilterBar
                      pins={boardPins}
                      filter={displayFilter}
                      setFilter={setDisplayFilter}
                      sortBy={sortBy}
                      setSortBy={setSortBy}
                      onAddClick={() => setShowAddPin(true)}
                      canAdd={true}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredPins.map((pin) => (
                        <PinCard key={pin.id} pin={pin} onDelete={() => handleDeletePin(pin)} onEdit={() => handleEditPin(pin)} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : loadingBoards ? (
              <LoadingSpinner text="Loading pinboards..." />
            ) : pinboards.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pinboards.map((board) => (
                  <button
                    key={board.coordinate}
                    onClick={() => handleBoardClick(board)}
                    data-testid={`board-${board.dTag}`}
                    className="block bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-bitcoin-orange transition-all text-left w-full"
                  >
                    {board.image && (
                      <div className="w-full h-40 overflow-hidden bg-gray-100">
                        <img src={board.image} alt={board.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{board.title}</h3>
                        {board.collaborative && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium whitespace-nowrap">Collaborative</span>
                        )}
                      </div>
                      {board.description && <p className="text-sm text-gray-600 line-clamp-2 mb-3">{board.description}</p>}
                      {board.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {board.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Add Pin Modal */}
        {showAddPin && (
          <AddPinModal
            boardCoordinate={selectedBoard?.coordinate || defaultBoardCoord || "auto"}
            onDone={handlePinAdded}
            onCancel={() => { setShowAddPin(false); setEditPin(null); }}
            editPin={editPin}
          />
        )}
      </div>
    </>
  );
}

// --- Filter Bar with type buttons and sort controls ---
function FilterBar({
  pins,
  filter,
  setFilter,
  sortBy,
  setSortBy,
  onAddClick,
  canAdd,
}: {
  pins: Pin[];
  filter: DisplayType | "all";
  setFilter: (f: DisplayType | "all") => void;
  sortBy: "date" | "title";
  setSortBy: (s: "date" | "title") => void;
  onAddClick: () => void;
  canAdd: boolean;
}) {
  const counts = { all: pins.length, ...Object.fromEntries(ALL_DISPLAY_TYPES.map((t) => [t, 0])) } as Record<DisplayType | "all", number>;
  for (const pin of pins) {
    const dt = getDisplayType(pin);
    if (counts[dt] !== undefined) counts[dt]++;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-8">
      <button
        data-testid="filter-all"
        onClick={() => setFilter("all")}
        className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
          filter === "all" ? "bg-bitcoin-orange text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        All ({counts.all})
      </button>
      {ALL_DISPLAY_TYPES.filter((key) => counts[key] > 0).map((key) => {
        const cfg = DISPLAY_TYPE_CONFIG[key];
        return (
          <button
            key={key}
            data-testid={`filter-${key}`}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
              filter === key ? cfg.activeColor : `${cfg.color} hover:opacity-80`
            }`}
          >
            {cfg.icon} {cfg.label} ({counts[key]})
          </button>
        );
      })}

      {/* Sort controls */}
      <div className="flex items-center gap-1 ml-2" data-testid="sort-controls">
        <span className="text-xs text-gray-500 mr-1">Sort:</span>
        {(["date", "title"] as const).map((s) => (
          <button
            key={s}
            data-testid={`sort-${s}`}
            onClick={() => setSortBy(s)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              sortBy === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "date" ? "Newest" : "A-Z"}
          </button>
        ))}
      </div>
      {canAdd && (
        <button
          data-testid="add-pin-btn"
          onClick={onAddClick}
          className="ml-auto px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-bitcoin-orange text-white hover:bg-bitcoin-orange-hover"
        >
          + Add Resource
        </button>
      )}
    </div>
  );
}

// --- Pin Card ---
function PinCard({ pin, onDelete, onEdit }: { pin: Pin; onDelete: () => void; onEdit: () => void }) {
  const url = getPinUrl(pin);
  const dt = getDisplayType(pin);
  const ytId = dt === "youtube" ? getYouTubeId(pin.externalRef || "") : null;
  const vimeoId = dt === "youtube" ? getVimeoId(pin.externalRef || "") : null;
  const rumbleId = dt === "youtube" ? getRumbleId(pin.externalRef || "") : null;
  const isVideo = !!(ytId || vimeoId || rumbleId);
  const spotifyEpisodeId = dt === "podcast-episode" ? getSpotifyEpisodeId(pin.externalRef || "") : null;
  const cfg = DISPLAY_TYPE_CONFIG[dt];
  const bookIsbn = dt === "book" ? pin.externalRef?.replace(/^isbn:/i, "") : null;
  const doiId = dt === "paper" ? pin.externalRef?.replace(/^doi:/i, "") : null;
  const geoCoords = dt === "location" ? pin.externalRef?.replace(/^geo:/i, "") : null;
  const displayUrl = bookIsbn
    ? `https://www.bookfinder.com/isbn/${bookIsbn}/`
    : doiId
      ? `https://doi.org/${doiId}`
      : geoCoords
        ? `https://www.google.com/maps?q=${encodeURIComponent(geoCoords)}`
        : url;

  return (
    <div
      data-testid={`pin-${pin.id.slice(0, 8)}`}
      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md hover:border-bitcoin-orange transition-all"
    >
      {/* Video embed */}
      {isVideo && (
        <div className="w-full" style={{ aspectRatio: "16/9" }}>
          {ytId && (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}`}
              title={pin.title || "YouTube video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          )}
          {vimeoId && (
            <iframe
              src={`https://player.vimeo.com/video/${vimeoId}`}
              title={pin.title || "Vimeo video"}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          )}
          {rumbleId && (
            <iframe
              src={`https://rumble.com/embed/${rumbleId}/`}
              title={pin.title || "Rumble video"}
              allowFullScreen
              className="w-full h-full"
            />
          )}
        </div>
      )}

      {/* Spotify embed */}
      {dt === "podcast" && pin.externalRef && (
        <div className="w-full">
          <iframe
            src={pin.externalRef.replace("open.spotify.com/show/", "open.spotify.com/embed/show/") + "?utm_source=generator&theme=0"}
            title={pin.title || "Podcast"}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="w-full"
          />
        </div>
      )}

      {/* Podcast Episode embed */}
      {dt === "podcast-episode" && spotifyEpisodeId && (
        <div className="w-full">
          <iframe
            src={`https://open.spotify.com/embed/episode/${spotifyEpisodeId}?utm_source=generator&theme=0`}
            title={pin.title || "Podcast Episode"}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="w-full"
          />
        </div>
      )}

      {/* Book cover */}
      {dt === "book" && bookIsbn && (
        <div className="w-full h-48 bg-gray-50 flex items-center justify-center overflow-hidden">
          <img
            src={`https://pictures.abebooks.com/isbn/${bookIsbn}-us-300.jpg`}
            alt={pin.title || "Book cover"}
            className="max-h-full object-contain"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </span>
          {pin.rawEvent && <EventActions event={pin.rawEvent} onDelete={onDelete} onEdit={onEdit} />}
        </div>

        {displayUrl ? (
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-bold text-gray-900 mb-1 hover:text-bitcoin-orange transition-colors block"
          >
            {pin.title || "Untitled"}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline ml-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
          </a>
        ) : (
          <h4 className="text-lg font-bold text-gray-900 mb-1">
            {pin.title || pin.content?.slice(0, 80) || "Untitled"}
          </h4>
        )}

        {pin.content && pin.title && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">{pin.content}</p>
        )}

        {pin.externalRef && dt === "link" && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400 truncate block">
              {pin.externalRef.replace(/^https?:\/\//, "").split("/")[0]}
            </span>
          </div>
        )}

        {pin.externalRef && (dt === "book" || dt === "movie" || dt === "paper" || dt === "location") && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400 truncate block font-mono">
              {pin.externalRef}
            </span>
          </div>
        )}

        {pin.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {pin.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Add Pin Modal ---
function AddPinModal({
  boardCoordinate,
  onDone,
  onCancel,
  editPin,
}: {
  boardCoordinate: string;
  onDone: () => void;
  onCancel: () => void;
  editPin?: Pin | null;
}) {
  const [title, setTitle] = useState(editPin?.title || "");
  const [url, setUrl] = useState(editPin?.externalRef || "");
  const [description, setDescription] = useState(editPin?.content || "");
  const [tags, setTags] = useState(editPin?.tags?.join(", ") || "");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [selectedType, setSelectedType] = useState<DisplayType | null>(
    editPin ? getDisplayType(editPin) : null
  );
  const [detected, setDetected] = useState<DetectedContent | null>(
    editPin?.externalRef ? detectContentKind(editPin.externalRef) : null
  );

  const isEditing = !!editPin;

  const handleUrlChange = (val: string) => {
    setUrl(val);
    if (val.trim()) {
      const d = detectContentKind(val);
      setDetected(d);
      // Auto-select type if not already selected
      if (!selectedType) setSelectedType(d.displayType);
    } else {
      setDetected(null);
    }
  };

  const handlePublish = async () => {
    if (!url.trim()) { setError("URL or identifier is required"); return; }
    if (!title.trim()) { setError("Title is required"); return; }
    if (!selectedType) { setError("Please select a content type"); return; }

    setPublishing(true);
    setError("");

    try {
      if (!window.nostr) {
        setError("No Nostr extension found. Please install one to publish.");
        setPublishing(false);
        return;
      }

      const pubkey = await window.nostr.getPublicKey();

      // Auto-create a pinboard if none exists yet ("auto" sentinel)
      let resolvedBoardCoord = boardCoordinate;
      if (boardCoordinate === "auto" || !boardCoordinate) {
        const unsignedBoard = buildPinboardEvent({
          dTag: "education",
          title: "Education",
          description: "Educational resources",
        });
        const signedBoard = await window.nostr.signEvent({ ...unsignedBoard, pubkey });
        const boardOk = await publishPinboard(signedBoard);
        if (!boardOk) {
          setError("Failed to create pinboard on relays.");
          setPublishing(false);
          return;
        }
        // Construct the coordinate from the signed event
        const dTag = (signedBoard.tags as string[][]).find((t: string[]) => t[0] === "d")?.[1] || "education";
        resolvedBoardCoord = `30067:${pubkey}:${dTag}`;
      }

      // Use detected content kind, but override displayType to match user's selection
      let { iTag, kTag } = detectContentKind(url);
      // If the user explicitly chose a type that conflicts with detection, respect user choice
      if (selectedType === "book") { kTag = "isbn"; }
      else if (selectedType === "movie") { kTag = "isan"; }
      else if (selectedType === "paper") { kTag = "doi"; }
      else if (selectedType === "location") { kTag = "geo"; }
      else if (selectedType === "podcast") { if (!kTag.startsWith("podcast")) kTag = "web"; }
      else if (selectedType === "podcast-episode") { kTag = "podcast:item:guid"; }
      else { kTag = "web"; } // youtube and link are both k=web
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const unsignedEvent = buildPinEvent({
        boardCoordinate: resolvedBoardCoord,
        content: description.trim(),
        title: title.trim(),
        externalRef: iTag,
        externalKind: kTag,
        tags: tagList,
        // For updates: reuse the same d tag so the replaceable event is overwritten
        dTag: isEditing ? (editPin?.rawEvent?.tags as string[][] | undefined)?.find((t) => t[0] === "d")?.[1] : undefined,
      });

      const signedEvent = await window.nostr.signEvent({ ...unsignedEvent, pubkey });

      const success = await publishPin(signedEvent);
      if (success) {
        onDone();
      } else {
        setError("Failed to publish to relays. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
    setPublishing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl"
        data-testid="add-pin-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-gray-900 mb-4">{isEditing ? "Edit Resource" : "Add Resource"}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              data-testid="pin-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Bitcoin Standard"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Content Type *</label>
            <div className="flex flex-wrap gap-2" data-testid="type-selector">
              {ALL_DISPLAY_TYPES.map((dt) => {
                const cfg = DISPLAY_TYPE_CONFIG[dt];
                return (
                  <button
                    key={dt}
                    type="button"
                    data-testid={`type-${dt}`}
                    onClick={() => setSelectedType(dt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedType === dt ? cfg.activeColor : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {cfg.icon} {cfg.label}
                  </button>
                );
              })}
            </div>
            {selectedType && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedType === "youtube" && "Paste a video URL (YouTube, Vimeo, or Rumble)"}
                {selectedType === "podcast" && "Paste a Spotify podcast URL or podcast:guid:xxx"}
                {selectedType === "podcast-episode" && "Paste a Spotify episode URL or enter podcast:item:guid:xxx"}
                {selectedType === "link" && "Paste any web URL"}
                {selectedType === "book" && "Enter an ISBN like isbn:978... or a bare ISBN number"}
                {selectedType === "movie" && "Enter an ISAN like isan:XXXX-XXXX-XXXX"}
                {selectedType === "paper" && "Enter a DOI like doi:10.xxx or 10.xxx/yyy"}
                {selectedType === "location" && "Enter coordinates like geo:39.23,-94.03 or lat,lon"}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL or Identifier *</label>
            <input
              data-testid="pin-url"
              type="text"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={
                selectedType === "youtube" ? "https://youtube.com/watch?v=... or https://vimeo.com/..."
                : selectedType === "podcast" ? "https://open.spotify.com/show/... or podcast:guid:xxx"
                : selectedType === "podcast-episode" ? "https://open.spotify.com/episode/... or podcast:item:guid:xxx"
                : selectedType === "link" ? "https://example.com/article"
                : selectedType === "book" ? "isbn:9780743273565 or bare ISBN"
                : selectedType === "movie" ? "isan:XXXX-XXXX-XXXX-XXXX"
                : selectedType === "paper" ? "doi:10.1000/xyz123 or 10.xxxx/yyyy"
                : selectedType === "location" ? "geo:39.23,-94.03 or 39.23,-94.03"
                : "Select a content type first"
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
            {detected && (
              <p className="text-xs text-gray-500 mt-1" data-testid="detected-type">
                Detected: {DISPLAY_TYPE_CONFIG[detected.displayType]?.icon} {DISPLAY_TYPE_CONFIG[detected.displayType]?.label || detected.kTag}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              data-testid="pin-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this resource"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              data-testid="pin-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="bitcoin, economics, education"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="pin-publish"
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 px-4 py-2 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors disabled:opacity-50"
          >
            {publishing ? "Publishing..." : isEditing ? "Update" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Loading Spinner ---
function LoadingSpinner({ text }: { text: string }) {
  return (
    <div className="flex justify-center items-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bitcoin-orange" />
      <span className="ml-4 text-gray-600">{text}</span>
    </div>
  );
}

// --- Empty State ---
function EmptyState() {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
      <span className="text-6xl block mb-4">{"{}"}</span>
      <h3 className="text-xl font-bold text-gray-800 mb-2">No Pinboards Yet</h3>
      <p className="text-gray-600">Pinboards are curated collections of educational content. Check back soon for new resources!</p>
    </div>
  );
}
