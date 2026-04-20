# Issue #52: Shop Page NIP-99 Marketplace - Architecture Plan

## Current State

The shop page (`src/pages/shop.tsx`, 1258 lines) currently:
- Fetches vendors using custom kind 30333 (Bitcoin Vendor Directory)
- Integrates BTCMap for merchant locations
- Has vendor submission via `VendorForm.tsx`
- Uses whitelist filtering (fixed in issue #29)

NIP-99 is NOT implemented. Kind 31989 (stall) and 31990 (product) events are unused.

## NIP-99 Overview

NIP-99 defines a Nostr-native marketplace protocol:
- **Kind 31989 (Stall)**: A shop/merchant with name, description, shipping zones, currency
- **Kind 31990 (Product)**: An item with price, quantity, images, specifications
- Products link to stalls via `#a` tag (stall coordinate)
- Both are replaceable events (need `d` tag)

### Stall Event (kind 31989)
```
{
  kind: 31989,
  content: "stall description",
  tags: [
    ["d", "<stall-id>"],
    ["name", "Bitcoin Hardware Store"],
    ["currency", "USD"],
    ["shipping", "[{\"id\":\"local\",\"name\":\"Local Pickup\",\"cost\":0,\"zones\":[\"KC\"]}]"],
    ...custom tags
  ]
}
```

### Product Event (kind 31990)
```
{
  kind: 31990,
  content: "product description",
  tags: [
    ["d", "<product-id>"],
    ["a", "31989:<pubkey>:<stall-id>"],  // links to stall
    ["name", "Coldcard Mk4"],
    ["price", "15000", "sats"],
    ["quantity", "5"],
    ["image", "https://..."],
    ["category", "hardware"],
    ...custom tags
  ]
}
```

## Proposed Architecture

### Phase 1: Data Layer (this branch)
1. Create `src/types/marketplace.ts` - TypeScript types for NIP-99
2. Create `src/utils/marketplaceEvents.ts` - Fetch, parse, publish stalls/products
3. Add config entries for marketplace kinds

### Phase 2: UI Components (future)
1. `src/components/StallCard.tsx` - Display a stall with its products
2. `src/components/ProductCard.tsx` - Display a product with price, image
3. `src/components/StallForm.tsx` - Create/edit stall
4. `src/components/ProductForm.tsx` - Create/edit product

### Phase 3: Integration (future)
1. Add NIP-99 tab to shop page alongside current vendors/BTCMap
2. Wire up stall/product CRUD operations
3. Add search/filter by stall, product category, price range

## Migration Path

The current kind 30333 vendors and BTCMap integration should remain.
NIP-99 would be added as a new "Marketplace" tab/section on the shop page.
Over time, vendors could migrate from kind 30333 to NIP-99 stalls+products.

## Dependencies

- Issue #29 (whitelist filtering) should be merged first -- marketplace events need filtering too
- The fetch pattern follows the same `pool.request(relays, filter).subscribe()` used in committeeEvents.ts

## Estimated Effort

- Phase 1 (data layer): 4-6 hours
- Phase 2 (UI components): 8-12 hours
- Phase 3 (integration): 4-6 hours
- Total: 16-24 hours
