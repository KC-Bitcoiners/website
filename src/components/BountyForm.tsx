import React, { useState } from "react";
import { BountyFormData } from "../types/bounty";
import { XIcon, PlusIcon } from "./Icons";

interface BountyFormProps {
  initialData?: Partial<BountyFormData>;
  onSubmit: (data: BountyFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function BountyForm({ initialData, onSubmit, onCancel, isSubmitting = false }: BountyFormProps) {
  const [formData, setFormData] = useState<BountyFormData>({
    lightning_prefix: initialData?.lightning_prefix || '',
    name: initialData?.name || '',
    title: initialData?.title || '',
    description: initialData?.description || '',
  });

  const handleInputChange = (field: keyof BountyFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateLightningPrefix = (prefix: string): boolean => {
    // Only allow alphanumeric characters, underscores, and hyphens
    const prefixPattern = /^[a-zA-Z0-9_-]+$/;
    return prefixPattern.test(prefix.trim()) && prefix.trim().length > 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.lightning_prefix.trim()) {
      alert('Lightning prefix is required');
      return;
    }

    if (!validateLightningPrefix(formData.lightning_prefix)) {
      alert('Please enter a valid Lightning prefix (letters, numbers, underscores, and hyphens only)');
      return;
    }

    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }

    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }

    if (!formData.description.trim()) {
      alert('Description is required');
      return;
    }

    onSubmit({
      lightning_prefix: formData.lightning_prefix.trim(),
      name: formData.name.trim(),
      title: formData.title.trim(),
      description: formData.description.trim(),
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-archivo-black">
          {initialData ? 'Edit Bounty' : 'Create New Bounty'}
        </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Lightning Prefix */}
        <div>
          <label htmlFor="lightning_prefix" className="block text-sm font-medium text-gray-700 mb-1">
            Lightning Prefix *
          </label>
          <div className="flex items-center">
            <input
              id="lightning_prefix"
              type="text"
              value={formData.lightning_prefix}
              onChange={(e) => handleInputChange('lightning_prefix', e.target.value)}
              placeholder="lamb"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
              required
            />
            <div className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md text-gray-600">
              @kcbicoiners.com
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Enter your Lightning address prefix (letters, numbers, underscores, and hyphens only)
          </p>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Display Name *
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="John Doe"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Your display name for this bounty
          </p>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Bounty Title *
          </label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Bitcoin wallet setup tutorial"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            A searchable title for the bounty
          </p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Describe the bounty, product, or service that accepts Bitcoin..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Provide details about what this bounty is for or what product/service accepts Bitcoin
          </p>
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
            {isSubmitting ? 'Creating...' : 'Create Bounty'}
          </button>
        </div>
      </form>
    </div>
  );
}
