# Committee Structures

`draft` `optional`

This NIP defines a committee management system for Nostr, enabling communities to create organizational structures with members, roles, and open positions. Committees use a multi-event architecture that separates board metadata from members and openings, allowing for flexible organizational management.

## Motivation

Bitcoin community groups (meetups, hack spaces, conferences) need lightweight organizational structures — committees with chairs, members, and open volunteer positions. Existing Nostr kinds don't provide a way to express these relationships.

While NIP-51 lists can group pubkeys, they lack the semantics for roles (chair, vice-chair, member), open positions, and the committee metadata (meeting schedules, images, descriptions) that real-world organizations need.

This NIP provides three event kinds that work together:

- **Committee** (kind 30068) — The group itself (parameterized replaceable)
- **Committee Member** (kind 39068) — A person belonging to a committee
- **Committee Opening** (kind 39069) — An open position on a committee

## Event Kinds

### Kind 30068: Committee

A parameterized replaceable event representing a committee or working group.

**Required Tags:**

| Tag | Description |
| --- | --- |
| `d` | Unique identifier (slug) for the committee |

**Optional Tags:**

| Tag | Description |
| --- | --- |
| `title` | Human-readable committee name |
| `description` | Extended description of the committee's purpose |
| `image` | Committee logo or cover image URL |
| `meetingSchedule` | Recurring meeting schedule (free-form text, e.g. "2nd Thursday of each month at 7pm") |
| `openings` | Number of open positions (integer as string) |
| `t` | Hashtag for categorization (repeatable) |

**Content:** Empty string or optional description text.

**Example:**

```json
{
  "kind": 30068,
  "pubkey": "<committee-author-pubkey>",
  "created_at": 1704067200,
  "content": "Organizes monthly meetup logistics including venue, speakers, and refreshments.",
  "tags": [
    ["d", "events-committee"],
    ["title", "Events Committee"],
    ["description", "Organizes monthly meetup logistics"],
    ["image", "https://example.com/events-committee.png"],
    ["meetingSchedule", "1st Wednesday of each month at 6pm"],
    ["openings", "3"],
    ["t", "events"],
    ["t", "meetup"]
  ]
}
```

**Committee Address Format:** `30068:<pubkey>:<d-tag>`

### Kind 39068: Committee Member

A regular event representing a person's membership in a committee. Each member is a separate event, enabling per-member role tracking and independent updates.

**Required Tags:**

| Tag | Description |
| --- | --- |
| `a` | Committee coordinate: `30068:<pubkey>:<d-tag>` |
| `d` | Unique identifier for this membership record |
| `role` | Member's role (e.g. `chair`, `vice-chair`, `member`) |
| `name` | Display name of the member |

**Optional Tags:**

| Tag | Description |
| --- | --- |
| `email` | Contact email address |
| `phone` | Contact phone number |
| `p` | Nostr pubkey of the member (for linking to their Nostr identity) |

**Content:** Empty string.

**Example:**

```json
{
  "kind": 39068,
  "pubkey": "<committee-author-pubkey>",
  "created_at": 1704067200,
  "content": "",
  "tags": [
    ["a", "30068:<committee-pubkey>:events-committee"],
    ["d", "alice-membership"],
    ["role", "chair"],
    ["name", "Alice"],
    ["email", "alice@example.com"],
    ["p", "<alice-nostr-pubkey>"]
  ]
}
```

### Kind 39069: Committee Opening

A regular event representing an open position on a committee. Openings can be created and deleted independently of members.

**Required Tags:**

| Tag | Description |
| --- | --- |
| `a` | Committee coordinate: `30068:<pubkey>:<d-tag>` |
| `d` | Unique identifier for this opening |
| `title` | Title of the open position |

**Optional Tags:**

| Tag | Description |
| --- | --- |
| `description` | Description of responsibilities for the position |

**Content:** Empty string or optional description text.

**Example:**

```json
{
  "kind": 39069,
  "pubkey": "<committee-author-pubkey>",
  "created_at": 1704067200,
  "content": "Help coordinate speakers and manage the event calendar.",
  "tags": [
    ["a", "30068:<committee-pubkey>:events-committee"],
    ["d", "speaker-coordinator-opening"],
    ["title", "Speaker Coordinator"],
    ["description", "Find and coordinate speakers for monthly meetups"]
  ]
}
```

## Client Behavior

### Fetching Committees

```
{
  "kinds": [30068],
  "authors": ["<whitelisted-pubkeys>"]
}
```

Clients should deduplicate by coordinate (`kind:pubkey:d-tag`), keeping the most recent event.

### Fetching Members

```
{
  "kinds": [39068],
  "authors": ["<whitelisted-pubkeys>"],
  "#a": ["30068:<pubkey>:<d-tag>"]
}
```

Members should be displayed sorted by role (chair first, then vice-chair, then members), then alphabetically by name.

### Fetching Openings

```
{
  "kinds": [39069],
  "authors": ["<whitelisted-pubkeys>"],
  "#a": ["30068:<pubkey>:<d-tag>"]
}
```

### Role Values

Common role values and their suggested display order:

| Role | Sort Priority |
| --- | --- |
| `chair` | 0 (first) |
| `vice-chair` | 1 |
| `member` | 2 |

Clients may encounter custom role values not listed above — these should sort after the standard roles.

### Displaying Committees

1. Fetch all committee events (kind 30068)
2. For each committee, fetch members (kind 39068) and openings (kind 39069) by `a` tag
3. Display members grouped by role with contact info
4. Display openings as actionable items users can express interest in

## Deletion

Committees, members, and openings can be deleted using NIP-09 deletion events referencing the event ID or using NIP-33 `a` tag deletion for parameterized replaceable events (kind 30068).

## Access Control

This NIP does not define on-chain access control. Implementations typically restrict publishing to a whitelist of authorized pubkeys maintained by the community. The `authors` filter ensures only authorized events are displayed.

## References

- NIP-01: Basic protocol flow
- NIP-09: Event deletion
- NIP-33: Parameterized replaceable events
