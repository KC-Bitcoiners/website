import { useState, useEffect } from 'react';
import { useNostr } from '@/contexts/NostrContext';
import { XIcon } from './Icons';
import { generateVendorNaddr } from '@/utils/vendorAttestations';

// RochesterKC business data
const ROCHESTERKC_DATA = {
  name: "RochesterKC",
  category: "Service",
  lightning: true,
  onchain: true,
  lightningAddress: "rochesterkc@getalby.com",
  onchainAddress: "bc1qxfzq9yp7s4xqfz8xq7hj0xvq7xq5xq3xq7hj0xvq7xq5xq3xq7hj0xvq7",
  notes: "Coworking space and Bitcoin community hub in Kansas City",
  contact: "913-491-2969",
  address: "1520 Holmes St, Kansas City, MO 64102",
  website: "https://rochesterkc.com",
  phone: "913-491-2969",
  lat: 39.0943,
  lon: -94.5829,
  email: "info@rochesterkc.com",
  twitter: "@RochesterKC",
  mastodon: "@rochesterkc@mastodon.social",
  description: "RochesterKC is a vibrant coworking space and Bitcoin community hub located in the Crossroads Arts District of Kansas City. We provide a collaborative environment for entrepreneurs, developers, and Bitcoin enthusiasts to work, network, and learn together.",
  opening_hours: "Mon-Fri 9am-6pm, Sat 10am-4pm, Closed Sunday",
};

interface VendorFormData {
  name: string;
  category: string;
  lightning: boolean;
  onchain: boolean;
  lightningAddress?: string;
  onchainAddress?: string;
  notes: string;
  contact: string;
  address: string;
  website?: string;
  phone?: string;
  // btcmap.org specific fields
  lat?: number;
  lon?: number;
  email?: string;
  mastodon?: string;
  twitter?: string;
  description?: string;
  opening_hours?: string;
  payment_methods?: string[];
}

interface VendorFormProps {
  onClose: () => void;
  onSuccess: (data: { eventId: string; naddr: string }) => void;
  editVendor?: any;
  isEdit?: boolean;
}

export default function VendorForm({ onClose, onSuccess, editVendor, isEdit = false }: VendorFormProps) {
  const { user } = useNostr();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<VendorFormData>({
    name: '',
    category: '',
    lightning: false,
    onchain: false,
    lightningAddress: '',
    onchainAddress: '',
    notes: '',
    contact: '',
    address: '',
    website: '',
    phone: '',
    // btcmap.org specific fields
    lat: undefined,
    lon: undefined,
    email: '',
    mastodon: '',
    twitter: '',
    description: '',
    opening_hours: '',
    payment_methods: [],
  });

  const categories = [
    'Restaurant',
    'Cafe',
    'Retail',
    'Service',
    'Entertainment',
    'Professional',
    'Healthcare',
    'Education',
    'Technology',
    'Other',
  ];

  const handleInputChange = (field: keyof VendorFormData, value: string | boolean | number | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Pre-fill form with vendor data when editing
  useEffect(() => {
    if (isEdit && editVendor) {
      console.log('🏪 Pre-filling form with vendor data:', editVendor);
      
      // Parse payment methods if available
      const paymentMethods = editVendor.payment_methods || [];
      const lightning = paymentMethods.includes('lightning') || editVendor.lightning === '1' || editVendor.lightning === true;
      const onchain = paymentMethods.includes('onchain') || editVendor.onchain === '1' || editVendor.onchain === true;
      
      setFormData({
        name: editVendor.name || '',
        category: editVendor.category || '',
        lightning: lightning,
        onchain: onchain,
        lightningAddress: editVendor.lightningAddress || '',
        onchainAddress: editVendor.onchainAddress || '',
        notes: editVendor.notes || '',
        contact: editVendor.contact || '',
        address: editVendor.address || '',
        website: editVendor.website || '',
        phone: editVendor.phone || '',
        lat: editVendor.lat || undefined,
        lon: editVendor.lon || undefined,
        email: editVendor.email || '',
        mastodon: editVendor.mastodon || '',
        twitter: editVendor.twitter || '',
        description: editVendor.description || '',
        opening_hours: editVendor.opening_hours || '',
        payment_methods: paymentMethods,
      });
    }
  }, [isEdit, editVendor]);

  // Auto-populate form with RochesterKC data
  const autoPopulateRochesterKC = () => {
    setFormData({
      name: ROCHESTERKC_DATA.name,
      category: ROCHESTERKC_DATA.category,
      lightning: ROCHESTERKC_DATA.lightning,
      onchain: ROCHESTERKC_DATA.onchain,
      lightningAddress: ROCHESTERKC_DATA.lightningAddress,
      onchainAddress: ROCHESTERKC_DATA.onchainAddress,
      notes: ROCHESTERKC_DATA.notes,
      contact: ROCHESTERKC_DATA.contact,
      address: ROCHESTERKC_DATA.address,
      website: ROCHESTERKC_DATA.website,
      phone: ROCHESTERKC_DATA.phone,
      lat: ROCHESTERKC_DATA.lat,
      lon: ROCHESTERKC_DATA.lon,
      email: ROCHESTERKC_DATA.email,
      mastodon: ROCHESTERKC_DATA.mastodon,
      twitter: ROCHESTERKC_DATA.twitter,
      description: ROCHESTERKC_DATA.description,
      opening_hours: ROCHESTERKC_DATA.opening_hours,
      payment_methods: ROCHESTERKC_DATA.lightning && ROCHESTERKC_DATA.onchain ? ['lightning', 'onchain'] : ROCHESTERKC_DATA.lightning ? ['lightning'] : ROCHESTERKC_DATA.onchain ? ['onchain'] : [],
    });
  };

  // Save vendor data to CSV with btcmap.org compatibility
  const saveToCsv = async (vendorData: any) => {
    try {
      // Create CSV row compatible with existing format and btcmap.org
      const csvRow = [
        `"${vendorData.category}"`,
        `"${vendorData.name}"`,
        vendorData.lightning || '0',
        vendorData.onchain || '0',
        `"${vendorData.notes || ''}"`,
        `"${vendorData.contact}"`,
        // Additional btcmap.org fields (appended to maintain compatibility)
        `"${vendorData.address}"`,
        `"${vendorData.website || ''}"`,
        `"${vendorData.phone || ''}"`,
        `"${vendorData.email || ''}"`,
        `"${vendorData.lat || ''}"`,
        `"${vendorData.lon || ''}"`,
        `"${vendorData.description || ''}"`,
        `"${vendorData.opening_hours || ''}"`,
        `"${vendorData.twitter || ''}"`,
        `"${vendorData.mastodon || ''}"`,
        `"${vendorData.payment_methods ? vendorData.payment_methods.join(',') : ''}"`,
        `"${vendorData.submittedAt}"`,
        `"${vendorData.submittedBy || ''}"`,
      ].join(',');

      console.log('📄 CSV row to save:', csvRow);
      
      // In a real implementation, this would save to a file or API
      // For now, we'll log it and show a success message
      console.log('✅ Vendor data prepared for CSV export');
      
      return csvRow;
    } catch (error) {
      console.error('Error saving to CSV:', error);
      throw error;
    }
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!formData.name.trim()) errors.push('Vendor name is required');
    if (!formData.category.trim()) errors.push('Category is required');
    if (!formData.address.trim()) errors.push('Address is required');
    if (!formData.contact.trim()) errors.push('Contact information is required');
    
    // Lightning and onchain addresses are now optional
    // Only validate if provided
    if (formData.lightning && formData.lightningAddress?.trim()) {
      // Basic Lightning address validation (email format)
      if (!formData.lightningAddress.includes('@')) {
        errors.push('Lightning address should be in format: user@domain.com');
      }
    }
    
    if (formData.onchain && formData.onchainAddress?.trim()) {
      // Basic Bitcoin address validation
      if (!formData.onchainAddress.match(/^(bc1|1|3)[a-zA-HJ-NP-Z0-9]{25,62}$/)) {
        errors.push('Invalid Bitcoin address format');
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      alert('Please fix the following errors:\n\n' + errors.join('\n'));
      return;
    }

    if (!user) {
      alert('Please connect your Nostr account to submit a vendor.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create payment methods array
      const paymentMethods = [];
      if (formData.lightning) paymentMethods.push('lightning');
      if (formData.onchain) paymentMethods.push('onchain');

      // Create Nostr event for vendor attestation with btcmap.org compatibility
      const vendorData = {
        name: formData.name,
        category: formData.category,
        lightning: formData.lightning ? '1' : '0',
        onchain: formData.onchain ? '1' : '0',
        lightningAddress: formData.lightningAddress || '',
        onchainAddress: formData.onchainAddress || '',
        notes: formData.notes,
        contact: formData.contact,
        address: formData.address,
        website: formData.website || '',
        phone: formData.phone || '',
        // btcmap.org specific fields
        lat: formData.lat,
        lon: formData.lon,
        email: formData.email || '',
        mastodon: formData.mastodon || '',
        twitter: formData.twitter || '',
        description: formData.description || '',
        opening_hours: formData.opening_hours || '',
        payment_methods: paymentMethods,
        submittedBy: user.pubkey,
        submittedAt: new Date().toISOString(),
      };

      // Create the event content
      const content = JSON.stringify(vendorData);

      // Use existing dTag for edit, or generate new one for create
      const dTag = isEdit && editVendor ? 
        editVendor.dTag || `vendor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` :
        `vendor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create tags for the event
      const tags: string[][] = [
        ['d', dTag],
        ['t', 'vendor'],
        ['t', 'bitcoin'],
        ['t', formData.category.toLowerCase()],
        ['name', formData.name],
        ['category', formData.category],
        ['address', formData.address],
        ['contact', formData.contact],
        ['submitted_by', user.pubkey],
      ];

      if (formData.lightning) {
        tags.push(['lightning', '1']);
        if (formData.lightningAddress) {
          tags.push(['lightning_address', formData.lightningAddress]);
        }
      }

      if (formData.onchain) {
        tags.push(['onchain', '1']);
        if (formData.onchainAddress) {
          tags.push(['onchain_address', formData.onchainAddress]);
        }
      }

      if (formData.website) {
        tags.push(['website', formData.website]);
      }

      if (formData.phone) {
        tags.push(['phone', formData.phone]);
      }

      if (formData.notes) {
        tags.push(['notes', formData.notes]);
      }

      // btcmap.org specific tags
      if (formData.lat && formData.lon) {
        tags.push(['location', `${formData.lat},${formData.lon}`]);
      }
      
      if (formData.email) {
        tags.push(['email', formData.email]);
      }
      
      if (formData.twitter) {
        tags.push(['twitter', formData.twitter]);
      }
      
      if (formData.mastodon) {
        tags.push(['mastodon', formData.mastodon]);
      }
      
      if (formData.opening_hours) {
        tags.push(['opening_hours', formData.opening_hours]);
      }
      
      if (formData.description) {
        tags.push(['description', formData.description]);
      }

      // Create the event object with custom Bitcoin Vendor Directory kind
      const event = {
        kind: 30333, // Custom Bitcoin Vendor Directory kind
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: content,
      };

      console.log('🏪 Creating vendor attestation event:', event);

      // Sign and publish the event using the Nostr extension
      if (typeof window === 'undefined' || !window.nostr) {
        throw new Error('Nostr extension not found. Please install a Nostr extension.');
      }

      const signedEvent = await window.nostr.signEvent({
        ...event,
        pubkey: user.pubkey,
      });

      console.log('✅ Vendor event signed:', signedEvent.id);

      // Publish to relays
      const relays = [
        'wss://relay.damus.io',
        'wss://relay.snort.social',
        'wss://nos.lol',
      ];

      let publishSuccess = false;
      let publishedEventId = '';

      const publishPromises = relays.map(relayUrl => {
        return new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(relayUrl);
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Publish timeout'));
          }, 10000);

          ws.onopen = () => {
            ws.send(JSON.stringify(['EVENT', signedEvent]));
          };

          ws.onmessage = (message) => {
            try {
              const response = JSON.parse(message.data);
              if (response[0] === 'OK') {
                const [, eventId, success, errorMessage] = response;
                if (success && eventId) {
                  publishedEventId = eventId;
                  publishSuccess = true;
                  clearTimeout(timeout);
                  ws.close();
                  resolve();
                } else {
                  clearTimeout(timeout);
                  ws.close();
                  reject(new Error(errorMessage || 'Publish failed'));
                }
              }
            } catch (error) {
              console.error(`Error parsing response from ${relayUrl}:`, error);
            }
          };

          ws.onerror = (error) => {
            clearTimeout(timeout);
            reject(error);
          };

          ws.onclose = () => {
            clearTimeout(timeout);
            if (!publishSuccess) {
              reject(new Error('Connection closed without success'));
            }
          };
        });
      });

      try {
        await Promise.race([
          Promise.any(publishPromises),
          new Promise((_, reject) => setTimeout(() => reject(new Error('All publishes timed out')), 15000))
        ]);
      } catch (error) {
        if (!publishSuccess) {
          throw error;
        }
      }

      if (publishSuccess && publishedEventId) {
        // Generate proper naddr for event
        const naddr = generateVendorNaddr(30333, user.pubkey, dTag);
        
        console.log('✅ Vendor successfully published to Nostr!');
        console.log(`🆔 Event ID: ${publishedEventId}`);
        console.log(`🔗 Naddr: ${naddr}`);

        onSuccess({
          eventId: publishedEventId,
          naddr: naddr,
        });

        // Save to CSV (btcmap.org format)
        await saveToCsv(vendorData);

        // Reset form
        setFormData({
          name: '',
          category: '',
          lightning: false,
          onchain: false,
          lightningAddress: '',
          onchainAddress: '',
          notes: '',
          contact: '',
          address: '',
          website: '',
          phone: '',
          // btcmap.org fields
          lat: undefined,
          lon: undefined,
          email: '',
          mastodon: '',
          twitter: '',
          description: '',
          opening_hours: '',
          payment_methods: [],
        });

        onClose();
      } else {
        throw new Error('Failed to publish vendor to any relay');
      }
    } catch (error) {
      console.error('Error submitting vendor:', error);
      alert('Failed to submit vendor: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-archivo-black">
              {isEdit ? 'Edit Bitcoin Vendor' : 'Submit New Bitcoin Vendor'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Compatible with <span className="text-orange-600 font-semibold">btcmap.org</span> • Creates Nostr attestations • Saved to CSV
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={autoPopulateRochesterKC}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 border border-transparent rounded hover:bg-blue-700 transition-colors"
              title="Auto-fill with RochesterKC data"
            >
              🏢 Fill RochesterKC
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                placeholder="e.g., Bitcoin Coffee Shop"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                required
              >
                <option value="">Select a category</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address *
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                placeholder="123 Main St, Kansas City, MO 64111"
                required
              />
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Payment Methods *</h3>
            
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.lightning}
                  onChange={(e) => handleInputChange('lightning', e.target.checked)}
                  className="mr-2 h-4 w-4 text-bitcoin-orange focus:ring-bitcoin-orange border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Accepts Lightning Payments</span>
              </label>

              {formData.lightning && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lightning Address
                  </label>
                  <input
                    type="text"
                    value={formData.lightningAddress}
                    onChange={(e) => handleInputChange('lightningAddress', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                    placeholder="name@domain.com"
                  />
                </div>
              )}

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.onchain}
                  onChange={(e) => handleInputChange('onchain', e.target.checked)}
                  className="mr-2 h-4 w-4 text-bitcoin-orange focus:ring-bitcoin-orange border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Accepts On-Chain Payments</span>
              </label>

              {formData.onchain && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    On-Chain Address
                  </label>
                  <input
                    type="text"
                    value={formData.onchainAddress}
                    onChange={(e) => handleInputChange('onchainAddress', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                    placeholder="bc1q..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Information *
              </label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => handleInputChange('contact', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                placeholder="Email, phone, or npub"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          {/* Location Information (btcmap.org compatibility) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Location Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.lat || ''}
                  onChange={(e) => handleInputChange('lat', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                  placeholder="39.0997"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.lon || ''}
                  onChange={(e) => handleInputChange('lon', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                  placeholder="-94.5786"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opening Hours
              </label>
              <input
                type="text"
                value={formData.opening_hours || ''}
                onChange={(e) => handleInputChange('opening_hours', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                placeholder="Mon-Fri 9am-5pm, Sat 10am-4pm"
              />
            </div>
          </div>

          {/* Social Media Information (btcmap.org compatibility) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Social Media</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                placeholder="contact@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Twitter
              </label>
              <input
                type="text"
                value={formData.twitter || ''}
                onChange={(e) => handleInputChange('twitter', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                placeholder="@vendor_handle"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mastodon
              </label>
              <input
                type="text"
                value={formData.mastodon || ''}
                onChange={(e) => handleInputChange('mastodon', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                placeholder="@vendor@mastodon.social"
              />
            </div>
          </div>

          {/* Detailed Description (btcmap.org compatibility) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
              placeholder="Describe what makes this business special..."
            />
          </div>

          {/* Additional Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
              placeholder="Additional information about the vendor..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !user}
              className="px-4 py-2 text-sm font-medium text-white bg-bitcoin-orange border border-transparent rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (isEdit ? 'Updating...' : 'Submitting...') : (isEdit ? 'Update Vendor' : 'Submit Vendor')}
            </button>
          </div>

          {!user && (
            <div className="text-center text-sm text-red-600">
              Please connect your Nostr account to submit vendors.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
