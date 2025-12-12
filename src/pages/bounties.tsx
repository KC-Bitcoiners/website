import React, { useState, useEffect } from 'react';
import BountyCard from '../components/BountyCard';
import BountyForm from '../components/BountyForm';
import { PlusIcon } from '../components/Icons';
import { Bounty, BountyFormData } from '../types/bounty';
import {
  loadBounties,
  addBounty,
  updateBountyStatus,
  sortBountiesByDate,
  getBountiesByStatus,
  searchBounties
} from '../utils/bounties';

export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [filteredBounties, setFilteredBounties] = useState<Bounty[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load bounties on component mount
  useEffect(() => {
    const loadedBounties = loadBounties();
    const sortedBounties = sortBountiesByDate(loadedBounties);
    setBounties(sortedBounties);
    setFilteredBounties(sortedBounties);
  }, []);

  // Filter bounties based on search term
  useEffect(() => {
    const filtered = searchTerm.trim() 
      ? searchBounties(bounties, searchTerm) 
      : bounties;
    setFilteredBounties(filtered);
  }, [bounties, searchTerm]);

  const handleCreateBounty = async (formData: BountyFormData) => {
    setIsSubmitting(true);
    try {
      const updatedBounties = addBounty(formData);
      const sortedBounties = sortBountiesByDate(updatedBounties);
      setBounties(sortedBounties);
      setFilteredBounties(sortedBounties);
      setShowCreateForm(false);
      setSuccessMessage('Bounty created successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error creating bounty:', error);
      alert('Failed to create bounty. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      const updatedBounties = updateBountyStatus(id, 'completed');
      const sortedBounties = sortBountiesByDate(updatedBounties);
      setBounties(sortedBounties);
      setFilteredBounties(sortedBounties);
      setSuccessMessage('Bounty marked as completed!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error updating bounty status:', error);
      alert('Failed to update bounty. Please try again.');
    }
  };

  const openBounties = getBountiesByStatus('open').filter(bounty => 
    filteredBounties.some(filtered => filtered.id === bounty.id)
  );
  const completedBounties = getBountiesByStatus('completed').filter(bounty => 
    filteredBounties.some(filtered => filtered.id === bounty.id)
  );

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="relative">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-6 font-archivo-black">Bounties</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Support the Bitcoin ecosystem with Lightning-powered bounties. Add products or services that accept Bitcoin, or fund development tasks for the community.
          </p>
        </div>

        {/* Statistics Sidebar */}
        <div className="flex gap-6">
          <div className="w-24 flex-shrink-0">
            <div className="sticky top-24 space-y-2">
              <div className="bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
                <div className="text-lg font-bold text-bitcoin-orange mb-1">{bounties.length}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
                <div className="text-lg font-bold text-green-600 mb-1">{openBounties.length}</div>
                <div className="text-xs text-gray-600">Open</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
                <div className="text-lg font-bold text-gray-600 mb-1">{completedBounties.length}</div>
                <div className="text-xs text-gray-600">Completed</div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Search Bar */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search bounties by name, title, or description..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
                  />
                </div>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center justify-center w-10 h-10 bg-bitcoin-orange text-white rounded-full hover:bg-bitcoin-orange-hover transition-colors"
                  title="Add New Bounty"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
              {searchTerm && (
                <p className="mt-2 text-sm text-gray-600">
                  Found {filteredBounties.length} bounties matching "{searchTerm}"
                </p>
              )}
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-green-800 font-medium">{successMessage}</span>
                </div>
              </div>
            )}

            {/* Bounties List */}
            <div className="space-y-8">
              {/* Open Bounties */}
              {openBounties.length > 0 && (
                <section>
                  <h2 className="text-3xl font-bold mb-8 font-archivo-black text-green-600">
                    Open Bounties ({openBounties.length})
                  </h2>
                  <div className="space-y-6">
                    {openBounties.map((bounty) => (
                      <BountyCard
                        key={bounty.id}
                        bounty={bounty}
                        onMarkCompleted={handleMarkCompleted}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Completed Bounties */}
              {completedBounties.length > 0 && (
                <section>
                  <h2 className="text-3xl font-bold mb-8 font-archivo-black text-gray-600">
                    Completed Bounties ({completedBounties.length})
                  </h2>
                  <div className="space-y-6 opacity-75">
                    {completedBounties.map((bounty) => (
                      <BountyCard
                        key={bounty.id}
                        bounty={bounty}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty State */}
              {bounties.length === 0 && (
                <div className="text-center py-16">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 max-w-md mx-auto">
                    <div className="text-6xl mb-4">⚡</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4 font-archivo-black">
                      No Bounties Yet
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Be the first to add a Lightning-powered bounty or Bitcoin product!
                    </p>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="inline-flex items-center gap-2 bg-bitcoin-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors"
                    >
                      <PlusIcon className="w-5 h-5" />
                      Create First Bounty
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Bounty Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <BountyForm
                onSubmit={handleCreateBounty}
                onCancel={() => setShowCreateForm(false)}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
