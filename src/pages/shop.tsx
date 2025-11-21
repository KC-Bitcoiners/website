import { GetStaticProps, InferGetStaticPropsType } from "next";
import { useState, useMemo } from "react";
import fs from "fs";
import path from "path";

interface ShopItem {
  Category: string;
  Vendor: string;
  Lightning: string;
  "On-Chain": string;
  Notes: string;
  Contact: string;
}

interface ShopPageProps {
  items: ShopItem[];
  error?: string;
}

type SortField = keyof ShopItem;
type SortDirection = "asc" | "desc";

export const getStaticProps: GetStaticProps<ShopPageProps> = async () => {
  try {
    const filePath = path.join(process.cwd(), "public", "shop.csv");
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // Parse CSV
    const lines = fileContent.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());

    const items: ShopItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Handle CSV parsing with quoted fields
      const values: string[] = [];
      let currentValue = "";
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = "";
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());

      const item: any = {};
      headers.forEach((header, index) => {
        item[header] = values[index] || "";
      });

      items.push(item as ShopItem);
    }

    return {
      props: {
        items,
      },
    };
  } catch (error) {
    console.error("Error reading shop.csv:", error);

    return {
      props: {
        items: [],
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
    };
  }
};

export default function ShopPage({
  items,
  error,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const [sortField, setSortField] = useState<SortField>("Vendor");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filters, setFilters] = useState<Record<string, string>>({
    Category: "",
    Vendor: "",
    Lightning: "",
    "On-Chain": "",
    Notes: "",
    Contact: "",
  });

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Handle filter change
  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Apply filters and sorting
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Apply filters
    Object.keys(filters).forEach((key) => {
      const filterValue = filters[key].toLowerCase();
      if (filterValue) {
        result = result.filter((item) =>
          item[key as keyof ShopItem].toLowerCase().includes(filterValue),
        );
      }
    });

    // Apply sorting
    result.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, filters, sortField, sortDirection]);

  // Render contact cell with appropriate link
  const renderContact = (contact: string) => {
    if (!contact) return null;

    if (contact.startsWith("npub")) {
      return (
        <a
          href={`https://nostrudel.ninja/u/${contact}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-bitcoin-orange hover:underline"
        >
          {contact.substring(0, 12)}...
        </a>
      );
    } else {
      // Assume it's an address
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact)}`;
      return (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-bitcoin-orange hover:underline"
        >
          {contact}
        </a>
      );
    }
  };

  // Render sort indicator
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>;
    return sortDirection === "asc" ? (
      <span className="text-bitcoin-orange">↑</span>
    ) : (
      <span className="text-bitcoin-orange">↓</span>
    );
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8 font-archivo-black">Shop</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-600">
              Unable to load shop data at this time. Please try again later.
            </p>
            <p className="text-sm text-red-500 mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const columns: SortField[] = [
    "Category",
    "Vendor",
    "Lightning",
    "On-Chain",
    "Notes",
    "Contact",
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Page Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-6 font-archivo-black">
          Bitcoin-Accepting Shops
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          Support local businesses that accept Bitcoin! Filter and sort to find
          vendors that accept Lightning or on-chain payments.
        </p>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-700"
                  >
                    <button
                      onClick={() => handleSort(column)}
                      className="flex items-center gap-2 hover:text-bitcoin-orange transition-colors w-full"
                    >
                      <span>{column}</span>
                      {renderSortIndicator(column)}
                    </button>
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-100">
                {columns.map((column) => (
                  <th key={`filter-${column}`} className="px-4 py-2">
                    <input
                      type="text"
                      placeholder={`Filter ${column}...`}
                      value={filters[column]}
                      onChange={(e) =>
                        handleFilterChange(column, e.target.value)
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedItems.length > 0 ? (
                filteredAndSortedItems.map((item, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm">{item.Category}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {item.Vendor}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {item.Lightning === "1" ? (
                        <span className="text-green-600 font-bold">✓</span>
                      ) : (
                        <span className="text-gray-300">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {item["On-Chain"] === "1" ? (
                        <span className="text-green-600 font-bold">✓</span>
                      ) : (
                        <span className="text-gray-300">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.Notes}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {renderContact(item.Contact)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No shops match your filters. Try adjusting your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Section */}
      <div className="mt-8 text-center text-gray-600">
        <p>
          Showing {filteredAndSortedItems.length} of {items.length} shops
        </p>
      </div>

      {/* Call to Action */}
      <section className="mt-16 bg-gradient-to-r from-gray-50 to-orange-50 border border-gray-200 rounded-lg p-8 text-center">
        <h3 className="text-2xl font-bold mb-4 font-archivo-black">
          Know a Bitcoin-Accepting Business?
        </h3>
        <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
          Help us grow this list! If you know of a local business that accepts
          Bitcoin, let us know so we can add them to our directory.
        </p>
      </section>
    </div>
  );
}
