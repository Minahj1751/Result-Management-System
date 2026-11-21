import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, panelClassName = '' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="ui-modal-backdrop fixed inset-0 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className={`ui-modal-panel inline-block w-full max-w-[calc(100vw-2rem)] align-bottom bg-white text-left transform transition-all sm:my-8 sm:align-middle ${panelClassName || 'sm:max-w-lg'}`}>
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {title && (
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                {title}
              </h3>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
