import { useState, useEffect } from 'react';
import { XMarkIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';

/**
 * Contact information interface
 */
export interface ContactInfo {
  email?: string;
  phone?: string;
  institutionName?: string;
}

/**
 * ContactAdminLink component props
 */
export interface ContactAdminLinkProps {
  tenantId?: string | null;
  tenantName?: string | null;
  contactInfo?: ContactInfo;
}

/**
 * Default EduOS support contact information
 */
const DEFAULT_CONTACT_INFO: ContactInfo = {
  email: 'support@eduos.com',
  phone: '1-800-EDUOS-HELP',
  institutionName: 'EduOS Support',
};

/**
 * ContactAdminLink Component
 * Displays "Contact administrator" link at bottom of login form
 * Shows contact modal with tenant-specific or generic support information
 */
export function ContactAdminLink({
  tenantId,
  tenantName,
  contactInfo,
}: ContactAdminLinkProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        handleCloseModal();
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isModalOpen]);

  // Use tenant-specific contact info if available, otherwise use default
  const displayContactInfo = tenantId && contactInfo ? contactInfo : DEFAULT_CONTACT_INFO;
  const displayName = tenantId && tenantName ? tenantName : 'EduOS Support';

  return (
    <>
      {/* Contact Administrator Link */}
      <div className="text-center">
        <a
          href="#"
          onClick={handleOpenModal}
          className="text-sm text-slate-500 hover:text-slate-800 transition-colors block"
          aria-label="Contact administrator for help"
        >
          Contact administrator
        </a>
      </div>

      {/* Contact Information Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h2
                id="contact-modal-title"
                className="text-xl font-semibold text-gray-900"
              >
                Contact Support
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close modal"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4">
              <p className="text-gray-700">
                {tenantId
                  ? `For assistance with your ${displayName} account, please contact your institution's support team:`
                  : 'For assistance with EduOS, please contact our support team:'}
              </p>

              {/* Contact Information */}
              <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                {displayContactInfo.email && (
                  <div className="flex items-start gap-3">
                    <EnvelopeIcon className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Email</p>
                      <a
                        href={`mailto:${displayContactInfo.email}`}
                        className="text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-1 py-2 inline-block min-h-[44px] flex items-center"
                      >
                        {displayContactInfo.email}
                      </a>
                    </div>
                  </div>
                )}

                {displayContactInfo.phone && (
                  <div className="flex items-start gap-3">
                    <PhoneIcon className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Phone</p>
                      <a
                        href={`tel:${displayContactInfo.phone.replace(/[^0-9]/g, '')}`}
                        className="text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-1 py-2 inline-block min-h-[44px] flex items-center"
                      >
                        {displayContactInfo.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Help Text */}
              <p className="text-sm text-gray-600">
                {tenantId
                  ? 'Your institution administrator can help with account access, password resets, and other login issues.'
                  : 'Our support team is available to help with technical issues and account questions.'}
              </p>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-6 py-3 min-h-[44px] bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
