import { Bounty, BountyFormData } from '../types/bounty';

const BOUNTIES_STORAGE_KEY = 'kc_bitcoin_bounties';
const KCBICOINERS_DOMAIN = 'kcbicoiners.com';

export function getLightningAddress(prefix: string): string {
  return `${prefix}@${KCBICOINERS_DOMAIN}`;
}

export function createBounty(formData: BountyFormData): Bounty {
  return {
    id: Date.now().toString(), // Simple timestamp-based ID
    lightning_prefix: formData.lightning_prefix.toLowerCase().trim(),
    name: formData.name.trim(),
    title: formData.title.trim(),
    description: formData.description.trim(),
    created_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    status: 'open'
  };
}

export function searchBounties(bounties: Bounty[], searchTerm: string): Bounty[] {
  if (!searchTerm.trim()) return bounties;
  
  const lowercaseSearch = searchTerm.toLowerCase();
  return bounties.filter(bounty => 
    (bounty.name?.toLowerCase().includes(lowercaseSearch) || false) ||
    (bounty.title?.toLowerCase().includes(lowercaseSearch) || false) ||
    (bounty.description?.toLowerCase().includes(lowercaseSearch) || false) ||
    (bounty.lightning_prefix?.toLowerCase().includes(lowercaseSearch) || false)
  );
}

export function loadBounties(): Bounty[] {
  if (typeof window === 'undefined') return []; // Server-side check
  
  try {
    const stored = localStorage.getItem(BOUNTIES_STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    
    // Ensure all bounties have required fields with defaults
    return parsed.map(bounty => ({
      id: bounty.id || Date.now().toString(),
      lightning_prefix: bounty.lightning_prefix || '',
      name: bounty.name || '',
      title: bounty.title || '',
      description: bounty.description || '',
      created_date: bounty.created_date || new Date().toISOString().split('T')[0],
      status: bounty.status || 'open'
    }));
  } catch (error) {
    console.error('Error loading bounties from localStorage:', error);
    return [];
  }
}

export function saveBounties(bounties: Bounty[]): void {
  if (typeof window === 'undefined') return; // Server-side check
  
  try {
    localStorage.setItem(BOUNTIES_STORAGE_KEY, JSON.stringify(bounties));
  } catch (error) {
    console.error('Error saving bounties to localStorage:', error);
    throw new Error('Failed to save bounties');
  }
}

export function addBounty(formData: BountyFormData): Bounty[] {
  const bounties = loadBounties();
  const newBounty = createBounty(formData);
  const updatedBounties = [...bounties, newBounty];
  saveBounties(updatedBounties);
  return updatedBounties;
}

export function updateBountyStatus(id: string, status: 'open' | 'completed'): Bounty[] {
  const bounties = loadBounties();
  const updatedBounties = bounties.map(bounty => 
    bounty.id === id ? { ...bounty, status } : bounty
  );
  saveBounties(updatedBounties);
  return updatedBounties;
}

export function deleteBounty(id: string): Bounty[] {
  const bounties = loadBounties();
  const updatedBounties = bounties.filter(bounty => bounty.id !== id);
  saveBounties(updatedBounties);
  return updatedBounties;
}

export function getBountiesByStatus(status: 'open' | 'completed'): Bounty[] {
  const bounties = loadBounties();
  return bounties.filter(bounty => bounty.status === status);
}

export function sortBountiesByDate(bounties: Bounty[], descending: boolean = true): Bounty[] {
  return [...bounties].sort((a, b) => {
    const dateA = new Date(a.created_date).getTime();
    const dateB = new Date(b.created_date).getTime();
    return descending ? dateB - dateA : dateA - dateB;
  });
}

export function validateLightningAddress(address: string): boolean {
  const lightningPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return lightningPattern.test(address.trim());
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    return new Promise((resolve, reject) => {
      document.execCommand('copy') ? resolve() : reject();
      textArea.remove();
    });
  }
}
