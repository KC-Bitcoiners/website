export interface Bounty {
  id: string;
  lightning_prefix: string; // Just the prefix (e.g., "lamb")
  name: string; // Display name for the bounty
  title: string; // Searchable title
  description: string;
  created_date: string; // YYYY-MM-DD format
  status: 'open' | 'completed';
}

export interface BountyFormData {
  lightning_prefix: string;
  name: string;
  title: string;
  description: string;
}
