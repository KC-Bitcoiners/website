import React from 'react';
import { CheckIcon } from './Icons';
import { Bounty } from '../types/bounty';
import { getLightningAddress } from '../utils/bounties';

interface BountyCardProps {
  bounty: Bounty;
  onMarkCompleted?: (id: string) => void;
}

export default function BountyCard({ 
  bounty, 
  onMarkCompleted 
}: BountyCardProps) {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isOpen = bounty.status === 'open';
  const fullLightningAddress = getLightningAddress(bounty.lightning_prefix);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 sm:p-6 lg:p-8 w-full overflow-hidden">
      <div className="space-y-4 sm:space-y-6">
        {/* Header section with status and date */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6">
          <div className="order-2 sm:order-1 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-gray-500">#{bounty.id}</span>
              <span 
                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  isOpen 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {isOpen ? 'Open' : 'Completed'}
              </span>
            </div>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-2 leading-tight">
              {bounty.title}
            </div>
            <div className="text-sm text-gray-600 mb-2">
              by <span className="font-semibold">{bounty.name}</span> • Created {formatDate(bounty.created_date)}
            </div>
            <div className="text-base sm:text-lg font-bold text-bitcoin-orange">
              {fullLightningAddress}
            </div>
          </div>
          <div className="order-1 sm:order-2 flex-shrink-0">
            <div className="text-2xl sm:text-3xl font-bold bitcoin-orange font-archivo-black">
              ⚡
            </div>
          </div>
        </div>

        {/* Description section */}
        <div className="text-gray-700">
          <p className="text-sm sm:text-base leading-relaxed">
            {bounty.description}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            {isOpen ? 'Payable via Lightning Network' : 'Bounty completed'}
          </div>
          <div className="flex items-center gap-2">
            {isOpen && onMarkCompleted && (
              <button
                onClick={() => onMarkCompleted(bounty.id)}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                title="Mark as completed"
              >
                <CheckIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Complete</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
